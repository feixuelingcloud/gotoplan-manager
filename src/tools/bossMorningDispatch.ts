/**
 * Boss 晨间调度工具
 *
 * 流程：
 * 1. 从后端获取今日计划列表（含 AI 执行人 + 现有克隆信息）
 * 2. 对没有克隆体的 AI 执行人：本地获取 SOUL → 创建 OpenClaw Agent → 存储绑定
 * 3. 对每个计划：后台调用 openclaw agent CLI 执行任务，完成后回写结果
 * 4. 立即返回分派摘要
 */

import { Type } from '../utils/schema.js';
import { get, post } from '../client/apiClient.js';
import { createAgent, sendMessage } from '../utils/openclawCli.js';

export const bossMorningDispatchTool = {
  name: 'boss_morning_dispatch',
  description: `[BOSS DAILY ROUTINE] Query today's plans, ensure AI executors are cloned as real OpenClaw Agents, then dispatch tasks to them. Tasks are executed by OpenClaw's local model. Returns taskIds — use get_task_status and get_boss_reports to collect results. IMPORTANT: Confirm with user before dispatching.`,

  parameters: Type.Object({
    date: Type.Optional(Type.String({
      description: '指定日期（格式 YYYY-MM-DD），不填则默认今天'
    })),
    max_plans: Type.Optional(Type.Number({
      description: '最多处理多少个计划，默认20，最多50'
    }))
  }),

  async execute(_id: string, params: any) {
    try {
      // 1. 获取今日计划数据
      const response = await post<{
        date: string;
        total_plans: number;
        plans: Array<{
          plan_id: string;
          plan_title: string;
          task_description: string;
          priority: string;
          source_plan_id: string;
          ai_executors: Array<{
            agentId: string;
            name: string;
            emoji: string;
            clone: { cloneId: string; openclawAgentId: string | null } | null;
          }>;
        }>;
        message?: string;
      }>('/openclaw/boss/morning-dispatch', {
        date: params.date || undefined,
        max_plans: params.max_plans || undefined
      });

      if (response.total_plans === 0) {
        return {
          success: true,
          dispatched: [],
          output: [
            `☀️ **Boss 晨间调度** — ${response.date}`,
            '',
            '📋 今日没有需要执行的计划，轻松的一天！'
          ].join('\n')
        };
      }

      const dispatched: Array<{ plan_title: string; agentName: string; agentEmoji: string; taskId: string }> = [];
      const skipped: Array<{ plan_title: string; reason: string }> = [];
      const autoCloned: string[] = [];

      // 2. 对每个计划的每个 AI 执行人进行处理
      for (const plan of response.plans) {
        if (plan.ai_executors.length === 0) {
          skipped.push({ plan_title: plan.plan_title, reason: '该计划没有指定 AI 执行人' });
          continue;
        }

        for (const executor of plan.ai_executors) {
          let cloneId: string;
          let openclawAgentId: string;

          if (executor.clone && executor.clone.openclawAgentId) {
            // 已有克隆体
            cloneId = executor.clone.cloneId;
            openclawAgentId = executor.clone.openclawAgentId;
          } else {
            // 需要先克隆：获取 SOUL → 本地创建 Agent → 存储绑定
            try {
              const soulRes = await get<{ name: string; soul: string }>(
                `/openclaw/ai-staff/${executor.agentId}/soul`
              );
              const slug = `clone-${executor.agentId}`;
              openclawAgentId = await createAgent(soulRes.name, soulRes.soul, slug);

              const bindRes = await post<{ cloneId: string }>('/openclaw/ai-staff/clone', {
                agentId: executor.agentId,
                openclawAgentId,
                purpose: '晨间调度自动克隆'
              });
              cloneId = bindRes.cloneId;
              autoCloned.push(executor.name || executor.agentId);
            } catch (err: any) {
              skipped.push({ plan_title: plan.plan_title, reason: `克隆 ${executor.name} 失败: ${err.message}` });
              continue;
            }
          }

          // 3. 创建任务记录
          let taskId: string;
          let agentName = executor.name || executor.agentId;
          let agentEmoji = executor.emoji || '🤖';
          try {
            const dispatchRes = await post<{ taskId: string; agentName: string; agentEmoji: string }>('/openclaw/tasks/dispatch', {
              cloneId,
              taskDescription: plan.task_description,
              priority: plan.priority || 'normal',
              contextInfo: `来自晨间调度，计划ID: ${plan.source_plan_id}，执行日期: ${response.date}`
            });
            taskId = dispatchRes.taskId;
            agentName = dispatchRes.agentName || agentName;
            agentEmoji = dispatchRes.agentEmoji || agentEmoji;
          } catch (err: any) {
            skipped.push({ plan_title: plan.plan_title, reason: `创建任务失败: ${err.message}` });
            continue;
          }

          // 4. 后台异步执行：调用 OpenClaw 本地模型
          const capturedTaskId = taskId;
          const capturedAgentName = agentName;
          const capturedAgentEmoji = agentEmoji;
          Promise.resolve().then(async () => {
            try {
              const result = await sendMessage(openclawAgentId, plan.task_description);
              await post(`/openclaw/tasks/${capturedTaskId}/complete`, {
                result,
                agentName: capturedAgentName,
                agentEmoji: capturedAgentEmoji
              });
            } catch (err: any) {
              await post(`/openclaw/tasks/${capturedTaskId}/complete`, {
                failed: true,
                errorMessage: err.message,
                agentName: capturedAgentName,
                agentEmoji: capturedAgentEmoji
              }).catch(() => {});
            }
          });

          dispatched.push({ plan_title: plan.plan_title, agentName, agentEmoji, taskId });
        }
      }

      // 5. 构建摘要
      const lines: string[] = [
        `☀️ **Boss 晨间调度完成** — ${response.date}`,
        '',
        `📊 今日计划总数: **${response.total_plans}**`,
        `✅ 已分派任务: **${dispatched.length}**`,
        skipped.length > 0 ? `⏭️ 跳过: **${skipped.length}** 个` : null,
        autoCloned.length > 0 ? `🤖 自动创建克隆体: ${autoCloned.join(', ')}` : null,
        ''
      ].filter(Boolean) as string[];

      if (dispatched.length > 0) {
        lines.push('**📡 已分派任务（由 OpenClaw 本地模型执行）：**');
        lines.push('');
        dispatched.forEach((d, i) => {
          lines.push(`${i + 1}. ${d.agentEmoji} **${d.agentName}** ← 📋 ${d.plan_title}`);
          lines.push(`   🆔 taskId: \`${d.taskId}\``);
        });
        lines.push('');
      }

      if (skipped.length > 0) {
        lines.push('**⏭️ 跳过的计划：**');
        skipped.forEach(s => lines.push(`  • ${s.plan_title}: ${s.reason}`));
        lines.push('');
      }

      lines.push('⏳ AI 员工正在执行任务中...');
      lines.push('📬 完成后使用 `get_boss_reports()` 查看所有工作汇报');

      return {
        success: true,
        date: response.date,
        dispatched,
        skipped,
        taskIds: dispatched.map(d => d.taskId),
        output: lines.join('\n')
      };
    } catch (error: any) {
      const msg = error.toUserMessage ? error.toUserMessage() : error.message;
      return {
        success: false,
        error: msg,
        output: [
          `❌ Boss 晨间调度失败:\n\n${msg}`,
          '',
          '💡 请检查:',
          '  1. 是否已在 GotoPlan 中为计划指定了 AI 员工执行人',
          '  2. 本地是否已安装 openclaw CLI',
          '  3. 网络连接是否正常'
        ].join('\n')
      };
    }
  }
};

