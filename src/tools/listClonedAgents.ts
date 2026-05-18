/**
 * 列出克隆体工具
 * 查看当前活跃的所有 AI 员工克隆体及其 cloneId
 */

import { Type } from '../utils/schema.js';
import { get } from '../client/apiClient.js';

export const listClonedAgentsTool = {
  name: 'list_cloned_agents',
  description: 'List all active AI staff clone instances. Shows cloneId, agent name, department, and creation time. Use cloneId to dispatch tasks.',

  parameters: Type.Object({
    department: Type.Optional(Type.String({
      description: '按部门过滤，不填则返回全部部门的克隆体'
    }))
  }),

  async execute(_id: string, params: any) {
    try {
      const queryParams = new URLSearchParams();
      if (params.department) queryParams.set('department', params.department);

      const query = queryParams.toString();
      const response = await get<{ clones: any[]; total: number }>(
        `/openclaw/cloned-agents${query ? '?' + query : ''}`
      );

      if (!response.clones || response.clones.length === 0) {
        return {
          success: true,
          output: [
            '📋 当前没有活跃的 AI 员工克隆体。',
            '',
            '💡 使用 `clone_staff_agent(agentId)` 创建克隆体。',
            '   先用 `list_ai_staff` 查看可用员工。'
          ].join('\n')
        };
      }

      const lines: string[] = [
        `🤖 **活跃克隆体列表** (共 ${response.total} 个)`,
        ''
      ];

      response.clones.forEach((clone: any, i: number) => {
        lines.push(`${i + 1}. ${clone.emoji || '🤖'} **${clone.name}**`);
        lines.push(`   🆔 cloneId: \`${clone.cloneId}\``);
        lines.push(`   📁 部门: ${clone.department || '-'}`);
        if (clone.purpose) lines.push(`   📝 用途: ${clone.purpose}`);
        lines.push(`   🕐 克隆时间: ${clone.clonedAt || '-'}`);
        lines.push('');
      });

      lines.push('💡 使用 `dispatch_task_to_agent(cloneId, taskDescription)` 向克隆体分派任务。');

      return {
        success: true,
        clones: response.clones,
        total: response.total,
        output: lines.join('\n')
      };
    } catch (error: any) {
      const msg = error.toUserMessage ? error.toUserMessage() : error.message;
      return {
        success: false,
        error: msg,
        output: `❌ 获取克隆体列表失败:\n\n${msg}`
      };
    }
  }
};

