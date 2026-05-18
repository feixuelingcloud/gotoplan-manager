/**
 * 创建计划草稿工具
 * 第一步:生成计划预览,等待用户确认
 */

import { Type } from '../utils/schema.js';
import { post } from '../client/apiClient.js';

export const createPlanDraftTool = {
  name: 'create_plan_draft',
  description: 'Create a plan DRAFT for user preview (READ-ONLY, not saved to database). IMPORTANT: After calling this tool, you MUST STOP and WAIT for explicit user confirmation. DO NOT automatically call confirm_plan. Only call confirm_plan when user explicitly says "confirm", "yes", "create", "ok" or similar confirmation words in their NEXT message.',

  parameters: Type.Object({
    goal: Type.String({
      description: 'Plan goal or title, e.g.: "30-day weight loss plan", "Prepare annual report"'
    }),
    constraints: Type.Optional(Type.String({
      description: 'Constraints or additional notes, e.g.: "Exercise 30 minutes daily", "Must complete by end of month"'
    })),
    plan_type: Type.Optional(Type.String({
      description: 'Plan type: work, study, life, exercise, hobby, travel, leisure, other'
    })),
    granularity: Type.Optional(Type.String({
      description: 'Time granularity: day, week, month (default: day)'
    })),
    language: Type.Optional(Type.String({
      description: 'Language: zh-CN (Chinese), en (English), default: zh-CN'
    }))
  }),

  async execute(_id: string, params: any) {
    try {
      const response = await post<{
        draft_id: string;
        preview: string;
        raw_content: string;
        parsed_fields: {
          title: string;
          category: string;
          start_date: string;
          deadline: string;
          importance: number;
          urgency: number;
        };
        expires_in_minutes: number;
        message: string;
      }>('/openclaw/plans/draft', params);

      // 格式化返回给用户的消息
      const output = [
        '📋 **计划草稿已生成** (预览模式,未保存)',
        '',
        response.preview,
        '',
        '═'.repeat(60),
        '',
        '⚠️  **重要提示**: 这只是草稿预览,还未保存到系统中!',
        '',
        '💡 **接下来你需要做什么**:',
        '',
        '  ✅ 如果确认无误 → 请明确回复 **"确认"** 或 **"创建"**',
        '  ✏️  如果需要修改 → 告诉我需要调整什么',
        '  ❌ 如果不需要了 → 回复 **"取消"**',
        '',
        `⏰ 草稿有效期: ${response.expires_in_minutes} 分钟`,
        `🆔 草稿ID: \`${response.draft_id}\``,
        '',
        '💬 **我在等待你的确认...**'
      ].join('\n');

      return {
        success: true,
        draft_id: response.draft_id,
        preview: response.preview,
        parsed_fields: response.parsed_fields,
        output
      };
    } catch (error: any) {
      const errorMessage = error.toUserMessage ? error.toUserMessage() : error.message;

      return {
        success: false,
        error: errorMessage,
        output: `❌ 创建计划草稿失败:\n\n${errorMessage}`
      };
    }
  }
};

