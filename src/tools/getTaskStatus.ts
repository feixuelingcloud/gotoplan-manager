/**
 * 查询任务状态工具
 * 轮询任务执行进度，获取完成状态和报告信息
 */

import { Type } from '../utils/schema.js';
import { get } from '../client/apiClient.js';

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ 等待中',
  in_progress: '🔄 执行中',
  completed: '✅ 已完成',
  failed: '❌ 执行失败'
};

export const getTaskStatusTool = {
  name: 'get_task_status',
  description: 'Check the execution status of a dispatched task. Poll this until status is "completed" or "failed". When completed, returns reportId for reading the result via get_boss_reports.',

  parameters: Type.Object({
    taskId: Type.String({
      description: '任务 ID，来自 dispatch_task_to_agent 的返回值'
    })
  }),

  async execute(_id: string, params: any) {
    try {
      const response = await get<{
        taskId: string;
        status: string;
        agentId: string;
        taskDescription: string;
        priority: string;
        createdAt: string;
        startedAt: string;
        completedAt: string;
        errorMessage: string | null;
        reportId?: string;
        reportSummary?: string;
      }>(`/openclaw/tasks/${encodeURIComponent(params.taskId)}/status`);

      const statusLabel = STATUS_LABELS[response.status] || response.status;
      const lines: string[] = [
        `📊 **任务状态查询**`,
        '',
        `🆔 任务 ID: \`${response.taskId}\``,
        `📋 任务: ${response.taskDescription}`,
        `${statusLabel}`,
        `🤖 执行员工: ${response.agentId}`,
        `⚡ 优先级: ${response.priority || 'normal'}`,
        ''
      ];

      if (response.startedAt) lines.push(`🕐 开始时间: ${response.startedAt}`);
      if (response.completedAt) lines.push(`🕐 完成时间: ${response.completedAt}`);

      if (response.status === 'completed') {
        lines.push('');
        lines.push('✅ **任务已完成！**');
        if (response.reportId) {
          lines.push(`📬 报告 ID: \`${response.reportId}\``);
          if (response.reportSummary) {
            lines.push(`📝 摘要预览: ${response.reportSummary}...`);
          }
          lines.push('');
          lines.push('💡 使用 `get_boss_reports()` 查看完整工作汇报。');
        }
      } else if (response.status === 'failed') {
        lines.push('');
        lines.push(`❌ **执行失败**: ${response.errorMessage || '未知错误'}`);
      } else if (response.status === 'in_progress') {
        lines.push('');
        lines.push('⏳ 仍在执行中，请稍后再次查询...');
      }

      return {
        success: true,
        taskId: response.taskId,
        status: response.status,
        reportId: response.reportId,
        output: lines.join('\n')
      };
    } catch (error: any) {
      const msg = error.toUserMessage ? error.toUserMessage() : error.message;
      return {
        success: false,
        error: msg,
        output: `❌ 查询任务状态失败:\n\n${msg}`
      };
    }
  }
};

