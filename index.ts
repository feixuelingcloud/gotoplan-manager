/**
 * GotoPlan OpenClaw Plugin
 * 主入口文件
 */

import { loadConfig, validateConfig, CONFIG } from './src/config/index.js';
import { get, post } from './src/client/apiClient.js';
import { createPlanDraftTool } from './src/tools/createPlanDraft.js';
import { confirmPlanTool } from './src/tools/confirmPlan.js';
import { updatePlanTool } from './src/tools/updatePlan.js';
import { getPlanRemindersTool } from './src/tools/getPlanReminders.js';
import { listPlansTool } from './src/tools/listPlans.js';
import { getPlanDetailTool } from './src/tools/getPlanDetail.js';
import { updateTaskStatusTool } from './src/tools/updateTaskStatus.js';
import { generateReportTool } from './src/tools/generateReport.js';
import { getTodayFocusTool } from './src/tools/getTodayFocus.js';
import { testConnectionTool } from './src/tools/testConnection.js';

// AI员工克隆 & 多Agent编排工具
import { listAIStaffTool } from './src/tools/listAIStaff.js';
import { cloneStaffAgentTool } from './src/tools/cloneStaffAgent.js';
import { listClonedAgentsTool } from './src/tools/listClonedAgents.js';
import { removeCloneTool } from './src/tools/removeClone.js';
import { dispatchTaskToAgentTool } from './src/tools/dispatchTaskToAgent.js';
import { getTaskStatusTool } from './src/tools/getTaskStatus.js';
import { getBossReportsTool } from './src/tools/getBossReports.js';
import { acknowledgeReportTool } from './src/tools/acknowledgeReport.js';
import { bossMorningDispatchTool } from './src/tools/bossMorningDispatch.js';
import { cloneAllAIStaffTool } from './src/tools/cloneAllAIStaff.js';
import { emitGatewayLog } from './src/utils/gatewayLog.js';
import { pollBotCommandsOnce } from './src/tools/executeBotCommand.js';
import { pollGotoBotChannelOnce, setChannelApi } from './src/channel/gotobotChannel.js';
import { sendGotoBotReplyTool } from './src/tools/sendGotoBotReply.js';

type GotoPlanTimers = {
  clone: ReturnType<typeof setInterval> | null;
  ping: ReturnType<typeof setInterval> | null;
  botCmd: ReturnType<typeof setInterval> | null;
  channel: ReturnType<typeof setInterval> | null;
  cloneFailStreak: number;
  pingFailStreak: number;
  lastCloneWarnTs: number;
  lastPingWarnTs: number;
};

declare global {
  // OpenClaw may hot-reload plugins after agent changes. Keep timer refs on
  // globalThis so the next plugin instance can replace them instead of leaving
  // old intervals running, and can also preserve a healthy poller if config is
  // temporarily missing during reload.
  // eslint-disable-next-line no-var
  var __gotoplanTimers: GotoPlanTimers | undefined;
}

if (!globalThis.__gotoplanTimers) {
  globalThis.__gotoplanTimers = {
    clone: null,
    ping: null,
    botCmd: null,
    channel: null,
    cloneFailStreak: 0,
    pingFailStreak: 0,
    lastCloneWarnTs: 0,
    lastPingWarnTs: 0
  };
}

/**
 * 插件入口
 * 注册所有工具
 */
export default function definePlugin(api: any) {
  console.log('✅ GotoPlan Plugin loading...');

  // OpenClaw 通过 api.pluginConfig 传递用户配置
  const pluginConfig = api.pluginConfig || {};
  console.log('📋 Plugin config received:', {
    hasApiKey: !!pluginConfig.apiKey,
    apiKeyLength: pluginConfig.apiKey?.length || 0,
    hasAI_PLAN_API_KEY: !!pluginConfig.AI_PLAN_API_KEY,
    hasApiBase: !!pluginConfig.apiBase,
    hasEnvKey: !!(typeof process !== 'undefined' && process.env?.AI_PLAN_API_KEY),
    pluginConfigKeys: Object.keys(pluginConfig)
  });

  loadConfig(pluginConfig);

  // 验证配置（不抛出错误，只是警告）
  const validation = validateConfig();
  if (!validation.valid) {
    console.warn('⚠️  Plugin configuration incomplete:', validation.message);
  }
  const timers = globalThis.__gotoplanTimers!;

  // ========== 注册工具 ==========

  // 1. 创建计划草稿(只读操作)
  api.registerTool(createPlanDraftTool);
  console.log('✅ Registered: create_plan_draft');

  // 2. 确认计划创建(写操作,optional=true)
  api.registerTool(confirmPlanTool);
  console.log('✅ Registered: confirm_plan');

  // 3. 修改计划(写操作,optional=true)
  api.registerTool(updatePlanTool);
  console.log('✅ Registered: update_plan');

  // 4. 获取计划提醒(只读操作)
  api.registerTool(getPlanRemindersTool);
  console.log('✅ Registered: get_plan_reminders');

  // 5. 列出计划列表(只读操作)
  api.registerTool(listPlansTool);
  console.log('✅ Registered: list_plans');

  // 6. 获取计划详情(只读操作)
  api.registerTool(getPlanDetailTool);
  console.log('✅ Registered: get_plan_detail');

  // 7. 更新任务状态(写操作,optional=true)
  api.registerTool(updateTaskStatusTool);
  console.log('✅ Registered: update_task_status');

  // 8. 生成执行报告(只读操作)
  api.registerTool(generateReportTool);
  console.log('✅ Registered: generate_execution_report');

  // 9. 获取今日重点(只读操作)
  api.registerTool(getTodayFocusTool);
  console.log('✅ Registered: get_today_focus');

  // 10. 连接诊断工具（排查 Token无效/连接失败）
  api.registerTool(testConnectionTool);
  console.log('✅ Registered: test_connection');

  // ========== AI员工克隆 & 多Agent编排工具 ==========

  // 11. 列出AI员工(只读操作)
  api.registerTool(listAIStaffTool);
  console.log('✅ Registered: list_ai_staff');

  // 12. 克隆员工为Agent(写操作,optional=true)
  api.registerTool(cloneStaffAgentTool);
  console.log('✅ Registered: clone_staff_agent');

  // 13. 列出克隆体(只读操作)
  api.registerTool(listClonedAgentsTool);
  console.log('✅ Registered: list_cloned_agents');

  // 14. 停用克隆体(写操作,optional=true)
  api.registerTool(removeCloneTool);
  console.log('✅ Registered: remove_clone');

  // 15. Boss分派任务(写操作,optional=true)
  api.registerTool(dispatchTaskToAgentTool);
  console.log('✅ Registered: dispatch_task_to_agent');

  // 16. 查询任务状态(只读操作)
  api.registerTool(getTaskStatusTool);
  console.log('✅ Registered: get_task_status');

  // 17. 获取工作汇报(只读操作)
  api.registerTool(getBossReportsTool);
  console.log('✅ Registered: get_boss_reports');

  // 18. 确认报告(写操作,optional=true)
  api.registerTool(acknowledgeReportTool);
  console.log('✅ Registered: acknowledge_report');

  // 19. Boss晨间调度(写操作,optional=true) - 每天早上自动触发
  api.registerTool(bossMorningDispatchTool);
  console.log('✅ Registered: boss_morning_dispatch');

  // 20. 批量克隆"我的AI员工"(写操作,optional=true) - "克隆我的AI员工"入口
  api.registerTool(cloneAllAIStaffTool);
  console.log('✅ Registered: clone_all_ai_staff');

  // 21. GotoBot Channel 回复回传工具（由 Agent 调用，把回复写回 GotoBot）
  api.registerTool(sendGotoBotReplyTool);
  console.log('✅ Registered: send_gotobot_reply');

  console.log('✅ GotoPlan Plugin loaded (21 tools)');

  if (!validation.valid) {
    console.log(validation.message);
  }

  emitGatewayLog(
    api,
    'Config',
    `插件已加载：apiBase=${CONFIG.apiBase} apiKeyLength=${CONFIG.apiKey.length} validation=${validation.valid ? 'ok' : 'missing_api_key'}`,
    validation.valid ? 'info' : 'warn'
  );

  // ── 启动诊断：验证 API Key 是否有效 ──────────────────────────────
  if (!validation.valid) {
    console.error('❌ [GotoPlan] API Key 未配置！请在 OpenClaw 插件设置中填写 API Key。');
    if (timers.clone || timers.ping) {
      emitGatewayLog(
        api,
        'Config',
        '本次热重载未收到 API Key，已保留上一轮健康轮询；若仍无法联通，请重新保存插件配置并重启 Gateway。',
        'warn'
      );
    }
  } else {
    setTimeout(async () => {
      try {
        await get('/openclaw/ping');
        console.log('✅ [GotoPlan] API Key 验证通过，服务器连接正常');
        emitGatewayLog(api, 'Config', 'API Key 验证通过，服务器连接正常', 'info');
      } catch (err: any) {
        console.error('❌ [GotoPlan] API Key 验证失败:', err.message || String(err));
        console.error('❌ [GotoPlan] 请检查插件设置中的 API Key 是否正确');
        emitGatewayLog(api, 'Config', `API Key 验证失败: ${err.message || String(err)}`, 'error');
      }
    }, 2000);
  }

  // ── 后台轮询：自动执行前端触发的克隆请求 ──
  // GotoPlan 网页只会在数据库里写入 pending；必须由插件「拉取」此队列（无法服务端推送进 OpenClaw）。
  // 须在已配置 API Key 后运行；失败不再静默吞掉，否则会误判为「系统传不到 OpenClaw」。
  async function pollCloneRequestOnce(): Promise<void> {
    try {
      const res = await get<{ hasPending: boolean; requestId?: string; reCloneExisting?: boolean }>(
        '/openclaw/ai-staff/clone-request'
      );
      timers.cloneFailStreak = 0;
      if (!res || !res.hasPending || !res.requestId) return;

      emitGatewayLog(api, 'ClonePoll', `检测到克隆请求 requestId=${res.requestId} reCloneExisting=${res.reCloneExisting ?? false}`, 'info');
      console.log('🤖 检测到克隆请求，开始自动克隆...', res.requestId, 'reCloneExisting:', res.reCloneExisting ?? false);
      const result = await cloneAllAIStaffTool.execute(res.requestId, { confirm: true, reCloneExisting: res.reCloneExisting ?? false });

      await post('/openclaw/ai-staff/clone-request/' + res.requestId + '/ack', {
        status: result.success ? 'completed' : 'failed',
        result: { output: result.output || '', error: result.error || null }
      });

      emitGatewayLog(
        api,
        'ClonePoll',
        `克隆请求处理完成 requestId=${res.requestId} success=${result.success}`,
        result.success ? 'info' : 'warn'
      );
      console.log('✅ 克隆请求处理完成 requestId=' + res.requestId + ' success=' + result.success);
    } catch (err: any) {
      timers.cloneFailStreak++;
      const msg = err?.message || String(err);
      const now = Date.now();
      const streak = timers.cloneFailStreak;
      const shouldWarn =
        streak === 1 || now - timers.lastCloneWarnTs > 45000;
      if (shouldWarn) {
        timers.lastCloneWarnTs = now;
        emitGatewayLog(
          api,
          'ClonePoll',
          `无法拉取克隆队列（已连续失败 ${streak} 次）: ${msg}。请核对插件「后端 API 地址」是否与浏览器访问的 GotoPlan 为同一环境，且 API Key 与网页账号一致。当前 apiBase=${CONFIG.apiBase}`,
          'warn'
        );
      }
    }
  }

  if (validation.valid) {
    if (timers.clone) {
      clearInterval(timers.clone);
      timers.clone = null;
    }
    emitGatewayLog(
      api,
      'ClonePoll',
      `克隆队列轮询已启动（拉取式，约每 5s）apiBase=${CONFIG.apiBase}`,
      'info'
    );
    void pollCloneRequestOnce();
    timers.clone = setInterval(pollCloneRequestOnce, 5000);
  } else {
    console.error('❌ [GotoPlan] 未配置 API Key，克隆队列后台轮询未启动');
  }

  // ── 后台轮询：响应前端 Ping 联通检测 ──
  // 前端点击"一键克隆"时会向服务器写入 ping 记录，插件需轮询并应答（拉取模型，非服务端推送）
  // 启动后立即执行一轮，避免用户在前 5~10 秒内操作「一键克隆」却永远等不到首次轮询
  async function pollPendingPingOnce(): Promise<void> {
    try {
      const res = await get<{ pingId: string | null }>('/openclaw/ping');
      if (!res || !res.pingId) return;
      await post('/openclaw/ping/ack', { pingId: res.pingId });
      timers.pingFailStreak = 0;
      emitGatewayLog(api, 'Ping', `联通检测已应答: ${res.pingId}`, 'info');
    } catch (err: any) {
      timers.pingFailStreak++;
      const now = Date.now();
      const shouldWarn = timers.pingFailStreak === 1 || now - timers.lastPingWarnTs > 45000;
      if (shouldWarn) {
        timers.lastPingWarnTs = now;
        emitGatewayLog(
          api,
          'Ping',
          `轮询失败（已连续失败 ${timers.pingFailStreak} 次）: ${err.message || String(err)}`,
          'warn'
        );
      }
    }
  }

  if (validation.valid) {
    if (timers.ping) {
      clearInterval(timers.ping);
      timers.ping = null;
    }
    emitGatewayLog(api, 'Ping', '轮询已启动（GET /openclaw/ping，间隔 2.5s）', 'info');
    void pollPendingPingOnce();
    timers.ping = setInterval(pollPendingPingOnce, 2500);
  }

  // ── 后台轮询：执行 GotoBot 指令队列 ──
  // 用户在网页端通过 GotoBot 发出操作指令，后端写入 bot_commands 队列；
  // 插件轮询并执行，结果通过 ack 接口回写为 GotoBot 消息通知用户。
  if (validation.valid) {
    if (timers.botCmd) {
      clearInterval(timers.botCmd);
      timers.botCmd = null;
    }
    emitGatewayLog(api, 'BotCmd', 'GotoBot 指令队列轮询已启动（间隔 5s）', 'info');
    void pollBotCommandsOnce();
    timers.botCmd = setInterval(pollBotCommandsOnce, 5000);
  }

  // ── 后台轮询：GotoBot Channel 双通道会话转发 ──
  // 用户在 GotoBot 聊天框发出消息 → 后端写入 gotobot_messages（pending）；
  // 插件拉取消息 → openclaw agent -m "..." → 回复通过 POST /openclaw/events 返回。
  if (validation.valid) {
    if (timers.channel) {
      clearInterval(timers.channel);
      timers.channel = null;
    }
    setChannelApi(api); // 注入 api 让 processMessage 错误可见于日志面板
    emitGatewayLog(api, 'Channel', 'GotoBot Channel 会话转发轮询已启动（间隔 2.5s）', 'info');

    let channelFailStreak = 0;
    let lastChannelWarnTs = 0;

    async function pollChannelWithLog(): Promise<void> {
      const errMsg = await pollGotoBotChannelOnce();
      if (errMsg) {
        channelFailStreak++;
        const now = Date.now();
        if (channelFailStreak === 1 || now - lastChannelWarnTs > 30000) {
          lastChannelWarnTs = now;
          emitGatewayLog(
            api,
            'Channel',
            `GotoBot 消息拉取失败（连续 ${channelFailStreak} 次）: ${errMsg}。请确认后端已重启且 API Key 有效。`,
            'warn'
          );
        }
      } else {
        channelFailStreak = 0;
      }
    }

    void pollChannelWithLog();
    timers.channel = setInterval(pollChannelWithLog, 2500);
  }
}
