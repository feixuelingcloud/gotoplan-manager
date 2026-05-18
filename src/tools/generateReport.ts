/**
 * 生成执行报告工具
 * 为指定计划生成执行情况报告
 */

import { Type } from '../utils/schema.js';
import { post } from '../client/apiClient.js';

export const generateReportTool = {
  name: 'generate_execution_report',
  description: 'Generate execution report for a specific plan, including completion rate, overdue task count, blocked task count, and next action suggestions. Suitable for periodic reviews and summaries.',

  parameters: Type.Object({
    plan_id: Type.String({
      description: '计划ID,从list_plans或上下文的recent_plans中获取'
    }),
    range: Type.Optional(Type.String({
      description: '报告时间范围,如 "本周"、"上周"、"本月"、"全部"',
      enum: ['week', 'last_week', 'month', 'all']
    }))
  }),

  async execute(_id: string, params: { plan_id: string; range?: string }) {
    try {
      const response = await post<{
        report: {
          completion_rate: number;
          overdue_tasks: number;
          blocked_tasks: number;
          next_actions: string[];
          summary: string;
        };
      }>(`/openclaw/plans/${params.plan_id}/report`, {
        range: params.range || 'all'
      });

      const report = response.report;

      // 格式化输出
      const output = [
        '📊 执行报告',
        '═══════════════════════════════════════',
        '',
        `📝 ${report.summary}`,
        ''
      ];

      // 完成率
      const completionIcon = report.completion_rate >= 80 ? '🟢' :
                            report.completion_rate >= 50 ? '🟡' : '🔴';
      output.push('📈 完成情况:');
      output.push(`  ${completionIcon} 完成率: ${report.completion_rate}%`);

      // 进度条
      const progressBarLength = 20;
      const filledLength = Math.round(progressBarLength * report.completion_rate / 100);
      const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);
      output.push(`  [${progressBar}] ${report.completion_rate}%`);
      output.push('');

      // 问题统计
      if (report.overdue_tasks > 0 || report.blocked_tasks > 0) {
        output.push('⚠️ 需要关注的问题:');
        if (report.overdue_tasks > 0) {
          output.push(`  🔴 逾期任务: ${report.overdue_tasks} 个`);
        }
        if (report.blocked_tasks > 0) {
          output.push(`  🚫 阻塞任务: ${report.blocked_tasks} 个`);
        }
        output.push('');
      } else {
        output.push('✅ 无逾期或阻塞问题');
        output.push('');
      }

      // 下一步行动
      if (report.next_actions && report.next_actions.length > 0) {
        output.push('💡 下一步建议:');
        report.next_actions.forEach((action) => {
          output.push(`  • ${action}`);
        });
        output.push('');
      }

      // 评价
      output.push('───────────────────────────────────────');
      if (report.completion_rate >= 80) {
        output.push('🎉 执行情况良好,继续保持!');
      } else if (report.completion_rate >= 50) {
        output.push('💪 进度正常,注意把控节奏');
      } else if (report.completion_rate >= 20) {
        output.push('⚠️ 进度偏慢,建议加快推进或调整计划');
      } else {
        output.push('🔴 进度严重滞后,需要重点关注');
      }

      // 时间范围说明
      const rangeDisplay: Record<string, string> = {
        week: '本周',
        last_week: '上周',
        month: '本月',
        all: '全部时间'
      };
      output.push(`📅 统计范围: ${rangeDisplay[params.range || 'all']}`);

      return {
        success: true,
        report: response.report,
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
        output: `❌ 生成执行报告失败:\n\n${errorMessage}`
      };
    }
  }
};

