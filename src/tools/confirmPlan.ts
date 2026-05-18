/**
 * 确认计划创建工具
 * 第二步:确认草稿并正式保存到数据库
 */

import { Type } from '../utils/schema.js';
import { post } from '../client/apiClient.js';

export const confirmPlanTool = {
  name: 'confirm_plan',
  description: 'Confirm and save the plan draft to database (WRITE operation - requires explicit user consent). ONLY call this tool when user explicitly says "confirm", "yes", "create", "ok", "agree" or similar confirmation words. DO NOT call if user just asks "how about it?" or gives no clear consent. Draft expires in 30 minutes.',

  parameters: Type.Object({
    draft_id: Type.String({
      description: 'Draft ID returned by create_plan_draft tool'
    })
  }),

  // 这是写操作,设为optional
  optional: true,

  async execute(_id: string, params: { draft_id: string }) {
    try {
      const response = await post<{
        plan_id: string;
        title: string;
        summary: string;
        details: {
          category: string;
          start_date: string;
          deadline: string;
          importance: number;
          urgency: number;
          frequency: string;
        };
        next_actions: string[];
      }>(`/openclaw/plans/confirm/${params.draft_id}`, {});

      // 格式化返回给用户的消息
      const output = [
        '✅ 计划创建成功!',
        '',
        `📋 ${response.title}`,
        '',
        '📊 计划信息:',
        `  • 分类: ${response.details.category}`,
        `  • 开始: ${response.details.start_date}`,
        response.details.deadline ? `  • 截止: ${response.details.deadline}` : '',
        `  • 重要性: ${response.details.importance}/10`,
        `  • 紧急性: ${response.details.urgency}/10`,
        `  • 频次: ${response.details.frequency}`,
        '',
        `🆔 计划ID: ${response.plan_id}`,
        '',
        '📌 接下来您可以:',
        ...response.next_actions.map(action => `  • ${action}`)
      ].filter(line => line !== '').join('\n');

      return {
        success: true,
        plan_id: response.plan_id,
        title: response.title,
        output
      };
    } catch (error: any) {
      const errorMessage = error.toUserMessage ? error.toUserMessage() : error.message;

      // 特别处理草稿过期的情况
      if (error.code === 'DRAFT_NOT_FOUND') {
        return {
          success: false,
          error: 'DRAFT_EXPIRED',
          output: [
            '❌ 草稿不存在或已过期',
            '',
            '草稿的有效期为30分钟。如果超过30分钟未确认,草稿会自动删除。',
            '',
            '💡 建议: 请重新生成计划草稿'
          ].join('\n')
        };
      }

      return {
        success: false,
        error: errorMessage,
        output: `❌ 确认计划失败:\n\n${errorMessage}`
      };
    }
  }
};

