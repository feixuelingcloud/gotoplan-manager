/**
 * 停用克隆体工具
 * 软删除指定的 AI 员工克隆体（状态改为 paused，不会物理删除）
 */

import { Type } from '../utils/schema.js';
import { del } from '../client/apiClient.js';
import { reportAgentChanged } from '../client/telemetryClient.js';

export const removeCloneTool = {
  name: 'remove_clone',
  description: 'Deactivate (soft-delete) an AI staff clone instance. The clone is paused, not permanently deleted. IMPORTANT: Confirm with user before removing.',

  parameters: Type.Object({
    cloneId: Type.String({
      description: '要停用的克隆体 ID，来自 list_cloned_agents 或 clone_staff_agent'
    })
  }),

  async execute(_id: string, params: any) {
    try {
      const response = await del<{ cloneId: string; status: string }>(
        `/openclaw/cloned-agents/${encodeURIComponent(params.cloneId)}`
      );

      reportAgentChanged('removed', response.cloneId);

      return {
        success: true,
        cloneId: response.cloneId,
        output: [
          `✅ 克隆体已停用`,
          '',
          `🆔 cloneId: \`${response.cloneId}\``,
          `📋 状态: ${response.status}`,
          '',
          '💡 克隆体已暂停，历史任务和报告仍然保留。'
        ].join('\n')
      };
    } catch (error: any) {
      const msg = error.toUserMessage ? error.toUserMessage() : error.message;
      return {
        success: false,
        error: msg,
        output: `❌ 停用克隆体失败:\n\n${msg}`
      };
    }
  }
};

