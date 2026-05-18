/**
 * GotoBot Channel - 双通道架构的会话通道模块
 *
 * 职责：
 *   1. 轮询 GotoPlan 后端 gotobot_messages 队列（GET /openclaw/gotobot/messages/pending）
 *   2. 调用 openclawCli.sendMessage() 将消息转发给 OpenClaw Agent（openclaw agent -m "..." --agent "..."）
 *   3. 将 Agent 回复通过 POST /openclaw/events 回传给 GotoPlan
 *
 * 并发模型：每条消息独立 fire-and-forget 处理，轮询主循环不阻塞。
 */

import { sendMessage } from '../utils/openclawCli.js';
import { get, post } from '../client/apiClient.js';
import { emitGatewayLog } from '../utils/gatewayLog.js';

// 由 index.ts 调用 setChannelApi(api) 注入，使 processMessage 能写入 OpenClaw 日志面板
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _api: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setChannelApi(api: any): void { _api = api; }

function clog(level: 'info' | 'warn' | 'error', msg: string): void {
  if (_api) emitGatewayLog(_api, 'Channel', msg, level);
  console[level === 'error' ? 'error' : 'log'](`[GotoBotChannel] ${msg}`);
}

interface PendingMessage {
  _id: string;
  userId: string;
  userMessage: string;
  openclawAgentId: string;
  agentName?: string;
  context?: {
    planId?: string | null;
    taskId?: string | null;
    aiEmployeeId?: string | null;
    conversationId?: string | null;
  };
}

/**
 * 将上下文信息附加到消息末尾，帮助 Agent 理解操作背景。
 */
function buildEnrichedMessage(msg: PendingMessage): string {
  const { userMessage, context } = msg;
  const ctx: string[] = [];
  if (context?.planId)        ctx.push(`当前计划ID: ${context.planId}`);
  if (context?.taskId)        ctx.push(`当前任务ID: ${context.taskId}`);
  if (context?.conversationId) ctx.push(`会话ID: ${context.conversationId}`);

  const bridgeInstruction = [
    '',
    '[GotoBot Channel]',
    `messageId: ${msg._id}`,
    '你正在通过 GotoPlan 的 GotoBot 与用户对话。请直接正常回答用户的问题。',
    '最终回复生成后，请调用 send_gotobot_reply 工具把回复写回 GotoBot：messageId 使用上面的值，reply 使用最终答复正文。'
  ];

  if (ctx.length > 0) {
    bridgeInstruction.splice(1, 0, `[上下文: ${ctx.join(' | ')}]`);
  }

  return `${userMessage}\n${bridgeInstruction.join('\n')}`;
}

function formatPublicAgentError(errMsg: string): string {
  const firstLine = errMsg.split(/\r?\n/).map(line => line.trim()).find(Boolean) || errMsg;

  if (/Pass --to|choose a session|--session-id|--agent/i.test(errMsg)) {
    return '⚠️ OpenClaw 没有接收到本次 GotoBot 消息：当前运行的 gotoplan-manager 可能仍是旧版本，或 CLI 未正确带上 --agent。请重新安装最新插件包并重启 OpenClaw。';
  }

  if (/plugins\.allow|loaded without install\/load-path provenance|untracked local code/i.test(errMsg)) {
    return '⚠️ OpenClaw 插件信任配置阻断了本次回传，请在 OpenClaw 中重新安装 gotoplan-manager，并允许该插件加载。';
  }

  if (/未提取到|未能从 OpenClaw CLI stdout|transcript/i.test(errMsg)) {
    return '⚠️ OpenClaw 已发起处理，但插件未能确认回复已写回 GotoBot。请稍后刷新，或重试本条消息。';
  }

  return `⚠️ OpenClaw Agent 回复同步失败：${firstLine.slice(0, 160)}`;
}

/**
 * 处理单条 pending 消息：发给 OpenClaw Agent → 结果回传。
 * fire-and-forget，不阻塞轮询主循环。
 */
async function processMessage(msg: PendingMessage): Promise<void> {
  const agentId = String(msg.openclawAgentId || 'main').trim() || 'main';
  const useDefault = agentId === 'main';
  const enriched = buildEnrichedMessage(msg);

  try {
    clog('info', `→ ${useDefault ? '默认Agent' : `Agent "${agentId}"`} | agentId=${agentId || 'main'} | msgId=${msg._id} | "${enriched.substring(0, 60)}"`);
    const agentReply = await sendMessage(agentId, enriched, 120000);
    clog('info', `← 回复 ${agentReply.length} 字符 | msgId=${msg._id}`);

    if (agentReply.trim()) {
      await post('/openclaw/events', {
        eventType: 'message.reply',
        messageId: msg._id,
        userId:    msg.userId,
        openclawAgentId: agentId,
        payload: {
          agentReply,
          status: 'completed'
        }
      });
    } else {
      throw new Error('OpenClaw 已执行，但插件未提取到可回传的 Agent 回复');
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    clog('error', `Agent 执行失败 msgId=${msg._id}: ${errMsg}`);

    await post('/openclaw/events', {
      eventType: 'message.failed',
      messageId: msg._id,
      userId:    msg.userId,
      openclawAgentId: agentId,
      payload: {
        agentReply: formatPublicAgentError(errMsg),
        status: 'failed'
      }
    }).catch((e: unknown) => {
      clog('error', `回传 events 也失败: ${e instanceof Error ? e.message : String(e)}`);
    });
  }
}

/**
 * 单次轮询入口：拉取 pending 消息，并发分发处理。
 * 由 index.ts 的 setInterval 驱动。
 * 返回错误信息字符串（供调用方通过 emitGatewayLog 上报），正常返回 null。
 */
export async function pollGotoBotChannelOnce(): Promise<string | null> {
  let messages: PendingMessage[];
  try {
    const res = await get<{ messages: PendingMessage[] }>('/openclaw/gotobot/messages/pending');
    messages = res?.messages || [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return msg; // 把错误信息返回给调用方上报
  }

  if (messages.length === 0) return null;
  clog('info', `拉取到 ${messages.length} 条待处理消息，开始转发...`);

  // 并发处理，互不阻塞
  for (const msg of messages) {
    void processMessage(msg);
  }
  return null;
}
