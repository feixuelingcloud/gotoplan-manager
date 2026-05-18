/**
 * 获取计划提醒工具
 * 查询需要提醒的计划(即将到期、已逾期、长时间未更新等)
 */

import { get } from '../client/apiClient.js';

export const getPlanRemindersTool = {
  name: 'get_plan_reminders',
  description: 'Get plans that need attention: due soon, overdue, stale (not updated for long time), or blocked. Helps users focus on important pending items.',

  parameters: {},

  async execute(_id: string, _params: any) {
    try {
      const response = await get<{
        total_reminders: number;
        reminders: {
          due_soon: any[];
          overdue: any[];
          stale: any[];
          blocked: any[];
        };
        summary: {
          overdue_count: number;
          due_soon_count: number;
          stale_count: number;
          blocked_count: number;
        };
      }>('/openclaw/plans/reminders');

      const { reminders, summary, total_reminders } = response;

      // 如果没有提醒
      if (total_reminders === 0) {
        return {
          success: true,
          total_reminders: 0,
          output: [
            '✅ 太棒了!目前没有需要提醒的计划',
            '',
            '所有计划都在正常进行中,继续保持! 💪'
          ].join('\n')
        };
      }

      // 格式化输出
      const lines = [
        `⏰ 计划提醒 (共 ${total_reminders} 项需要关注)`,
        ''
      ];

      // 1. 已逾期的计划(优先级最高)
      if (reminders.overdue.length > 0) {
        lines.push('🔴 已逾期的计划:');
        reminders.overdue.forEach((plan, index) => {
          lines.push(`  ${index + 1}. ${plan.title} (${plan.category})`);
          lines.push(`     ${plan.reason}`);
          if (plan.deadline) {
            lines.push(`     截止: ${plan.deadline}`);
          }
        });
        lines.push('');
      }

      // 2. 阻塞的计划
      if (reminders.blocked.length > 0) {
        lines.push('🚫 被阻塞的计划:');
        reminders.blocked.forEach((plan, index) => {
          lines.push(`  ${index + 1}. ${plan.title} (${plan.category})`);
          lines.push(`     ${plan.reason}`);
        });
        lines.push('');
      }

      // 3. 即将到期的计划(3天内)
      if (reminders.due_soon.length > 0) {
        lines.push('⚠️ 即将到期的计划:');
        reminders.due_soon.forEach((plan, index) => {
          lines.push(`  ${index + 1}. ${plan.title} (${plan.category})`);
          lines.push(`     ${plan.reason}`);
          if (plan.deadline) {
            lines.push(`     截止: ${plan.deadline}${plan.deadlineTime ? ' ' + plan.deadlineTime : ''}`);
          }
        });
        lines.push('');
      }

      // 4. 长时间未更新的计划
      if (reminders.stale.length > 0) {
        lines.push('📅 长时间未更新的计划:');
        reminders.stale.forEach((plan, index) => {
          lines.push(`  ${index + 1}. ${plan.title} (${plan.category})`);
          lines.push(`     ${plan.reason}`);
        });
        lines.push('');
      }

      // 添加建议
      lines.push('💡 建议:');
      if (reminders.overdue.length > 0) {
        lines.push('  • 优先处理已逾期的计划,或考虑调整截止日期');
      }
      if (reminders.blocked.length > 0) {
        lines.push('  • 尽快解决阻塞问题,确保计划能够继续推进');
      }
      if (reminders.due_soon.length > 0) {
        lines.push('  • 关注即将到期的计划,合理安排时间');
      }
      if (reminders.stale.length > 0) {
        lines.push('  • 更新长时间未动的计划,保持进度记录');
      }

      return {
        success: true,
        total_reminders,
        summary,
        reminders,
        output: lines.join('\n')
      };
    } catch (error: any) {
      const errorMessage = error.toUserMessage ? error.toUserMessage() : error.message;

      return {
        success: false,
        error: errorMessage,
        output: `❌ 获取提醒失败:\n\n${errorMessage}`
      };
    }
  }
};

