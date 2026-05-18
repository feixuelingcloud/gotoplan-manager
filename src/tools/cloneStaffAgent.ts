/**
 * 克隆 AI 员工工具
 *
 * 流程：
 * 1. 从后端拉取员工的 SOUL（rawMarkdown）
 * 2. 在本地调用 `openclaw agents add` 创建真实的 OpenClaw Agent
 * 3. 将 openclawAgentId 回存后端，建立 sourceAgentId ↔ cloneId 绑定
 */

import { Type } from '../utils/schema.js';
import { get, post } from '../client/apiClient.js';
import { createAgent } from '../utils/openclawCli.js';
import { reportAgentChanged } from '../client/telemetryClient.js';

export const cloneStaffAgentTool = {
  name: 'clone_staff_agent',
  description: `Clone an AI staff member as a real OpenClaw Agent instance. Fetches the staff member's SOUL (system prompt) and creates a local OpenClaw Agent with it. Returns a cloneId for dispatching tasks. IMPORTANT: Confirm with user before cloning.`,

  parameters: Type.Object({
    agentId: Type.String({
      description: '要克隆的员工 agentId，来自 list_ai_staff 的结果'
    }),
    purpose: Type.Optional(Type.String({
      description: '克隆目的说明，可选'
    }))
  }),

  async execute(_id: string, params: any) {
    try {
      // 1. 获取员工 SOUL
      const soulRes = await get<{
        agentId: string;
        name: string;
        emoji: string;
        department: string;
        soul: string;
      }>(`/openclaw/ai-staff/${params.agentId}/soul`);

      // 2. 在本地创建 OpenClaw Agent
      const slug = `clone-${params.agentId}`;
      const openclawAgentId = await createAgent(soulRes.name, soulRes.soul, slug);

      // 3. 将绑定关系存回后端
      const response = await post<{
        cloneId: string;
        sourceAgentId: string;
        openclawAgentId: string;
        name: string;
        emoji: string;
        department: string;
        status: string;
        alreadyExisted: boolean;
        message: string;
      }>('/openclaw/ai-staff/clone', {
        agentId: params.agentId,
        openclawAgentId,
        purpose: params.purpose || ''
      });

      const output = [
        `✅ **员工克隆成功！**`,
        '',
        `${response.emoji || '🤖'} **${response.name}** 已就位`,
        '',
        `🆔 克隆体 ID: \`${response.cloneId}\``,
        `🤖 OpenClaw Agent ID: \`${openclawAgentId}\``,
        `📁 部门: ${response.department}`,
        `🔗 源员工: ${response.sourceAgentId}`,
        response.alreadyExisted ? '♻️ 已存在绑定，已更新' : '🆕 新建克隆体',
        '',
        '💡 现在可以使用 `dispatch_task_to_agent` 向该克隆体分派任务。',
        `   示例: dispatch_task_to_agent(cloneId="${response.cloneId}", taskDescription="...")`
      ].join('\n');

      reportAgentChanged('cloned', response.cloneId);

      return {
        success: true,
        cloneId: response.cloneId,
        openclawAgentId,
        agentName: response.name,
        agentEmoji: response.emoji,
        output
      };
    } catch (error: any) {
      const msg = error.toUserMessage ? error.toUserMessage() : error.message;
      return {
        success: false,
        error: msg,
        output: [
          `❌ 克隆员工失败:\n\n${msg}`,
          '',
          '💡 请检查:',
          '  1. agentId 是否正确（使用 list_ai_staff 查看）',
          '  2. 本地是否已安装并可正常运行 openclaw CLI'
        ].join('\n')
      };
    }
  }
};

