/**
 * 列出 AI 员工工具
 * 获取系统中所有 AI 员工，可按部门或关键词过滤
 */

import { Type } from '../utils/schema.js';
import { get } from '../client/apiClient.js';

export const listAIStaffTool = {
  name: 'list_ai_staff',
  description: '列出"我的AI员工"列表（来自 user_my_staff 集合）。用于查看当前用户设置的专属AI员工，克隆前先调用此工具获取 agentId。返回每位员工的 name、agentId、department、emoji、vibe 等信息。',

  parameters: Type.Object({}),

  async execute(_id: string, _params: Record<string, never>) {
    try {
      const response = await get<{ agents: any[]; total: number }>(
        `/openclaw/ai-staff/my-staff`
      );

      if (!response.agents || response.agents.length === 0) {
        return {
          success: true,
          output: '📋 暂无可用的 AI 员工。'
        };
      }

      // 按部门分组展示
      const grouped: Record<string, any[]> = {};
      for (const agent of response.agents) {
        const dept = agent.department || '其他';
        if (!grouped[dept]) grouped[dept] = [];
        grouped[dept].push(agent);
      }

      const lines: string[] = [
        `👥 **AI 员工列表** (共 ${response.total} 位)`,
        ''
      ];

      for (const [dept, agents] of Object.entries(grouped)) {
        lines.push(`**📁 ${dept}**`);
        for (const a of agents) {
          lines.push(`  ${a.emoji || '🤖'} **${a.name}** \`agentId: ${a.agentId}\``);
          if (a.vibe) lines.push(`     ${a.vibe}`);
        }
        lines.push('');
      }

      lines.push('💡 使用 `clone_staff_agent(agentId)` 将员工克隆为可调用的 Agent 实例。');

      return {
        success: true,
        agents: response.agents,
        total: response.total,
        output: lines.join('\n')
      };
    } catch (error: any) {
      const msg = error.toUserMessage ? error.toUserMessage() : error.message;
      return {
        success: false,
        error: msg,
        output: `❌ 获取 AI 员工列表失败:\n\n${msg}`
      };
    }
  }
};

