/**
 * 批量克隆"我的AI员工"工具
 *
 * 流程：
 * 1. 读取用户"我的AI员工"列表
 * 2. 获取每位员工的 SOUL（纯读，无副作用）
 * 3. 用可预测的 slug 预构造 bindings，先向后端注册（在热重载之前完成）
 * 4. 再调用 createAgent（会触发 openclaw.json 热重载，但注册已完成）
 *
 * 关键设计：后端注册必须在所有 createAgent 之前执行。
 * 原因：每次 openclaw agents add 都会修改 openclaw.json，触发插件热重载，
 * 导致 CONFIG.apiKey 被重置为空，后续 API 调用会因 401 失败。
 */

import { Type } from '../utils/schema.js';
import { get, post } from '../client/apiClient.js';
import { createAgent } from '../utils/openclawCli.js';
import { reportAgentChanged } from '../client/telemetryClient.js';

/** 带重试的 post，防止偶发网络抖动 */
async function postWithRetry<T = any>(path: string, body: any, maxRetries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      return await post<T>(path, body);
    } catch (err) {
      lastErr = err;
      if (i < maxRetries) await new Promise(r => setTimeout(r, 800 * i));
    }
  }
  throw lastErr;
}

export const cloneAllAIStaffTool = {
  name: 'clone_all_ai_staff',
  description: `Clone all of the user's AI staff members as real OpenClaw Agents. Fetches each member's SOUL (system prompt), creates a local OpenClaw Agent for each, then stores the bindings. Already-cloned staff are reused. Call this when user says "克隆我的AI员工" or similar. IMPORTANT: Confirm with user before cloning.`,

  parameters: Type.Object({
    confirm: Type.Optional(Type.Boolean({
      description: '确认执行批量克隆，设为 true 表示用户已确认'
    })),
    reCloneExisting: Type.Optional(Type.Boolean({
      description: '是否强制重新克隆已有员工。true=全部重新克隆并刷新SOUL，false（默认）=只克隆新增员工'
    }))
  }),

  async execute(_id: string, params: any) {
    const reCloneExisting: boolean = params?.reCloneExisting === true;

    try {
      // ── Step 1：获取"我的AI员工"列表 ──────────────────────────────────
      const myStaffRes = await get<{ agents: any[]; total: number; message?: string }>(
        '/openclaw/ai-staff/my-staff'
      );

      if (!myStaffRes.agents || myStaffRes.agents.length === 0) {
        return {
          success: false,
          output: [
            '⚠️ **未找到"我的AI员工"数据**',
            '',
            myStaffRes.message || '您还没有在 GotoPlan 中设置"我的AI员工"。',
            '',
            '💡 请先在 GotoPlan中操作：',
            '  1. 打开 GotoPlan → AI员工页面',
            '  2. 点击员工卡片 → 点击"加入我的员工"按钮',
            '  3. 添加完成后，回到 OpenClaw 再次执行克隆'
          ].join('\n')
        };
      }

      // ── Step 2：获取所有员工的 SOUL（纯读，无副作用，不触发热重载）──────
      const staffWithSouls: Array<{ agentId: string; name: string; soul: string; slug: string }> = [];
      const soulFetchFailed: Array<{ agentId: string; name: string; error: string }> = [];

      for (const staff of myStaffRes.agents) {
        try {
          const soulRes = await get<{ agentId: string; name: string; soul: string }>(
            `/openclaw/ai-staff/${staff.agentId}/soul`
          );
          const slug = `clone-${staff.agentId}`;
          staffWithSouls.push({
            agentId: staff.agentId,
            name: soulRes.name || staff.name,
            soul: soulRes.soul,
            slug
          });
        } catch (err: any) {
          soulFetchFailed.push({ agentId: staff.agentId, name: staff.name || staff.agentId, error: err.message });
        }
      }

      if (staffWithSouls.length === 0) {
        return {
          success: false,
          output: [
            '❌ **获取员工 SOUL 失败**',
            '',
            ...soulFetchFailed.map(f => `  • ${f.name}: ${f.error}`),
            '',
            '💡 请检查网络连接和 API Key 是否有效'
          ].join('\n')
        };
      }

      // ── Step 3：预构造 bindings（slug 可预测，不依赖 createAgent 返回值）──
      // createAgent 内部以 slug 为 fallback ID，故 openclawAgentId === slug 始终成立。
      const agentIds = myStaffRes.agents.map((a: any) => a.agentId);
      const bindings = staffWithSouls.map(s => ({
        agentId: s.agentId,
        openclawAgentId: s.slug   // slug = 'clone-{agentId}'，与 createAgent 返回值一致
      }));

      // ── Step 4：先向后端注册绑定关系（在任何 createAgent 之前执行）────────
      // 此时 CONFIG.apiKey 仍处于干净状态，热重载尚未发生。
      const cloneRes = await postWithRetry<{
        total_agents: number;
        newly_cloned: number;
        already_existed: number;
        failed: number;
        cloned: Array<{ agentId: string; name: string; emoji: string; department: string; cloneId: string; openclawAgentId: string }>;
        already_existed_list: Array<{ agentId: string; name: string; emoji: string; cloneId: string; openclawAgentId: string }>;
        failed_list: Array<{ agentId: string; name: string; error: string }>;
        binding_map: Record<string, string>;
      }>('/openclaw/ai-staff/clone-all', { agentIds, bindings });

      // ── Step 5：本地创建 OpenClaw Agent（会触发热重载，但注册已完成）────
      // 即使此后发生热重载导致后续代码被中断，数据库绑定关系已安全写入。
      const localFailed: Array<{ agentId: string; name: string; error: string }> = [];

      // reCloneExisting=false 时跳过已有克隆体，避免覆盖其 SOUL.md
      const alreadyExistedIds = new Set(
        (cloneRes.already_existed_list || []).map((c: any) => c.agentId)
      );

      for (const staff of staffWithSouls) {
        if (!reCloneExisting && alreadyExistedIds.has(staff.agentId)) continue;
        try {
          await createAgent(staff.name, staff.soul, staff.slug);
        } catch (err: any) {
          localFailed.push({ agentId: staff.agentId, name: staff.name, error: err.message });
        }
      }

      // ── Step 6：构建展示结果 ───────────────────────────────────────────
      const lines: string[] = [
        `✅ **"我的AI员工"克隆完成！**`,
        '',
        `👥 共处理 ${cloneRes.total_agents} 位员工`,
        `🆕 新建克隆体: **${cloneRes.newly_cloned}** 个`,
        `♻️ 复用已有绑定: **${cloneRes.already_existed}** 个`,
        (cloneRes.failed > 0 || localFailed.length > 0)
          ? `❌ 失败: ${cloneRes.failed + localFailed.length} 个` : null,
        ''
      ].filter(Boolean) as string[];

      if (cloneRes.cloned && cloneRes.cloned.length > 0) {
        lines.push('**🆕 新建克隆体：**');
        cloneRes.cloned.forEach(c => {
          lines.push(`  ${c.emoji || '🤖'} **${c.name}** (${c.department || '-'})`);
          lines.push(`     🔗 cloneId: \`${c.cloneId}\`  OpenClaw Agent: \`${c.openclawAgentId}\``);
        });
        lines.push('');
      }

      if (cloneRes.already_existed_list && cloneRes.already_existed_list.length > 0) {
        lines.push('**♻️ 已存在绑定（直接复用）：**');
        cloneRes.already_existed_list.forEach(c => {
          lines.push(`  ${c.emoji || '🤖'} **${c.name}** → \`${c.cloneId}\``);
        });
        lines.push('');
      }

      const allFailed = [...(cloneRes.failed_list || []), ...localFailed];
      if (allFailed.length > 0) {
        lines.push('**❌ 克隆失败：**');
        allFailed.forEach(f => lines.push(`  • ${f.name}: ${f.error}`));
        lines.push('');
      }

      lines.push('━'.repeat(40));
      lines.push('');
      lines.push('🎯 **所有克隆体已就位，任务将由 OpenClaw 本地模型执行！**');

      if (cloneRes.newly_cloned > 0) {
        reportAgentChanged('cloned', `batch:${cloneRes.newly_cloned}`);
      }

      return {
        success: true,
        total: cloneRes.total_agents,
        newlyCloned: cloneRes.newly_cloned,
        alreadyExisted: cloneRes.already_existed,
        bindingMap: cloneRes.binding_map,
        output: lines.join('\n')
      };
    } catch (error: any) {
      const msg = error.toUserMessage ? error.toUserMessage() : error.message;
      return {
        success: false,
        error: msg,
        output: [
          `❌ 批量克隆失败:\n\n${msg}`,
          '',
          '💡 请检查：',
          '  1. GotoPlan 中是否已设置"我的AI员工"',
          '  2. 本地是否已安装 openclaw CLI',
          '  3. API Key 是否有效'
        ].join('\n')
      };
    }
  }
};

