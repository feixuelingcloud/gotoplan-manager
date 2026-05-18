/**
 * 获取工作汇报工具
 * Boss 助理查看各 AI 员工克隆体提交的工作汇报
 */

import { Type } from '../utils/schema.js';
import { get } from '../client/apiClient.js';

export const getBossReportsTool = {
  name: 'get_boss_reports',
  description: 'Retrieve work reports submitted by AI staff clones. By default shows pending (unreviewed) reports. Each report contains the full result from the staff clone\'s execution. Use acknowledge_report after reviewing.',

  parameters: Type.Object({
    status: Type.Optional(Type.Union([
      Type.Literal('pending_review'),
      Type.Literal('acknowledged'),
      Type.Literal('all')
    ], {
      description: '报告状态过滤：pending_review（待审阅，默认）/ acknowledged（已确认）/ all（全部）'
    })),
    limit: Type.Optional(Type.Number({
      description: '返回数量，默认20，最多100'
    }))
  }),

  async execute(_id: string, params: any) {
    try {
      const queryParams = new URLSearchParams();
      if (params.status) queryParams.set('status', params.status);
      if (params.limit) queryParams.set('limit', String(params.limit));

      const query = queryParams.toString();
      const response = await get<{ reports: any[]; total: number }>(
        `/openclaw/reports${query ? '?' + query : ''}`
      );

      if (!response.reports || response.reports.length === 0) {
        return {
          success: true,
          output: [
            '📬 暂无工作汇报。',
            '',
            params.status === 'acknowledged'
              ? '💡 所有报告均未确认，或尚无已提交报告。'
              : '💡 当前没有待审阅的汇报。使用 `dispatch_task_to_agent` 分派任务后，克隆体完成工作会自动提交汇报。'
          ].join('\n')
        };
      }

      const lines: string[] = [
        `📬 **工作汇报** (共 ${response.total} 份${params.status === 'all' ? '' : params.status === 'acknowledged' ? '·已确认' : '·待审阅'})`,
        ''
      ];

      for (let i = 0; i < response.reports.length; i++) {
        const r = response.reports[i];
        const statusIcon = r.status === 'acknowledged' ? '✅' : '📩';
        lines.push(`${statusIcon} **报告 ${i + 1}**`);
        lines.push(`   👤 汇报员工: ${r.agentEmoji || '🤖'} ${r.agentName}`);
        lines.push(`   📋 任务: ${r.taskDescription}`);
        lines.push(`   🆔 reportId: \`${r.reportId}\``);
        lines.push(`   🕐 完成时间: ${r.completedAt || '-'}`);
        lines.push('');
        lines.push('   **📝 工作成果:**');
        // 展示完整结果，按换行分段
        const resultLines = (r.result || '').split('\n').map((l: string) => `   ${l}`);
        lines.push(...resultLines);
        lines.push('');
        lines.push('─'.repeat(50));
        lines.push('');
      }

      const pendingCount = response.reports.filter((r: any) => r.status === 'pending_review').length;
      if (pendingCount > 0) {
        lines.push(`💡 还有 ${pendingCount} 份报告待确认。使用 \`acknowledge_report(reportId)\` 确认已读。`);
      }

      return {
        success: true,
        reports: response.reports,
        total: response.total,
        output: lines.join('\n')
      };
    } catch (error: any) {
      const msg = error.toUserMessage ? error.toUserMessage() : error.message;
      return {
        success: false,
        error: msg,
        output: `❌ 获取工作汇报失败:\n\n${msg}`
      };
    }
  }
};

