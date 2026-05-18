/**
 * 获取计划详情工具
 * 查询指定计划的完整信息
 */

import { Type } from '../utils/schema.js';
import { get } from '../client/apiClient.js';

export const getPlanDetailTool = {
  name: 'get_plan_detail',
  description: 'Get detailed information of a specific plan, including plan content (description), time details, category, task list, risks, and next action suggestions. Use plan_id from list_plans results or context recent_plans.',

  parameters: Type.Object({
    plan_id: Type.String({
      description: '计划ID,可以从list_plans工具返回的结果中获取,或从上下文的recent_plans中提取'
    })
  }),

  async execute(_id: string, params: { plan_id: string }) {
    try {
      const response = await get<{
        plan: {
          plan_id: string;
          title: string;
          description: string;
          status?: string;
          completed?: boolean;
          progress: number;
          createTime: string;
          startDate?: string;
          startTime?: string;
          dueDate?: string;
          deadline?: string;
          deadlineTime?: string;
          category?: string;
          executionNotes?: string;
          source?: string;
          tasks: Array<{
            task_id: string;
            title: string;
            status: string;
            priority: string;
            due_date?: string;
          }>;
          risks: any[];
          next_actions: string[];
        };
      }>(`/openclaw/plans/${params.plan_id}`);

      const plan = response.plan;

      // 格式化输出
      const statusEmoji: Record<string, string> = {
        pending: '⏳ 待办',
        in_progress: '🔄 进行中',
        completed: '✅ 已完成',
        blocked: '🚫 被阻塞'
      };

      // 确定状态显示：只读取 status 字段
      let statusDisplay = '未设置';
      if (plan.status) {
        statusDisplay = statusEmoji[plan.status] || plan.status;
      }

      const output = [
        '📋 计划详情',
        '═══════════════════════════════════════',
        '',
        `📌 ${plan.title}`,
        `🏷️ 分类: ${plan.category || '未分类'}`,
        `📊 状态: ${statusDisplay}`,
        `📈 进度: ${plan.progress}%`,
        ''
      ];

      // 时间信息
      output.push('⏰ 时间信息:');
      if (plan.createTime) {
        output.push(`  • 创建时间: ${plan.createTime}`);
      }
      if (plan.startDate) {
        output.push(`  • 开始时间: ${plan.startDate}${plan.startTime ? ' ' + plan.startTime : ''}`);
      }
      if (plan.deadline || plan.dueDate) {
        const deadline = plan.deadline || plan.dueDate;
        output.push(`  • 截止时间: ${deadline}${plan.deadlineTime ? ' ' + plan.deadlineTime : ''}`);
      }
      output.push('');

      // 计划内容
      if (plan.description || plan.executionNotes) {
        output.push('📝 计划内容:');
        output.push(`  ${plan.description || plan.executionNotes}`);
        output.push('');
      }

      // 任务列表
      if (plan.tasks && plan.tasks.length > 0) {
        output.push('✅ 任务列表:');
        plan.tasks.forEach((task, index) => {
          const taskEmoji = task.status === 'done' ? '✅' : task.status === 'doing' ? '🔄' : '⏳';
          output.push(`  ${index + 1}. ${taskEmoji} ${task.title} (${task.priority || 'medium'})`);
          if (task.due_date) {
            output.push(`     到期: ${task.due_date}`);
          }
        });
        output.push('');
      }

      // 风险
      if (plan.risks && plan.risks.length > 0) {
        output.push('⚠️ 风险:');
        plan.risks.forEach((risk, index) => {
          output.push(`  ${index + 1}. ${risk}`);
        });
        output.push('');
      }

      // 下一步建议
      if (plan.next_actions && plan.next_actions.length > 0) {
        output.push('💡 下一步建议:');
        plan.next_actions.forEach((action) => {
          output.push(`  • ${action}`);
        });
        output.push('');
      }

      // 元信息
      output.push('───────────────────────────────────────');
      output.push(`🆔 计划ID: ${plan.plan_id}`);
      if (plan.source) {
        output.push(`📍 来源: ${plan.source}`);
      }

      return {
        success: true,
        plan: response.plan,
        output: output.join('\n')
      };
    } catch (error: any) {
      const errorMessage = error.toUserMessage ? error.toUserMessage() : error.message;

      // 特别处理计划不存在的情况
      if (error.code === 'PLAN_NOT_FOUND') {
        return {
          success: false,
          error: 'PLAN_NOT_FOUND',
          output: [
            '❌ 计划不存在',
            '',
            '无法找到该计划,可能已被删除或ID不正确。',
            '',
            '💡 建议: 使用 list_plans 工具查看您的所有计划'
          ].join('\n')
        };
      }

      // 特别处理权限错误
      if (error.code === 'ACCESS_DENIED') {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          output: [
            '❌ 权限不足',
            '',
            '您没有权限访问该计划。',
            '',
            '💡 提示: 只能查看您自己创建的计划或您参与协作的计划'
          ].join('\n')
        };
      }

      return {
        success: false,
        error: errorMessage,
        output: `❌ 获取计划详情失败:\n\n${errorMessage}`
      };
    }
  }
};

