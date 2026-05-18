/**
 * GotoBot 回复回传工具
 *
 * 当 OpenClaw Agent 通过 GotoBot Channel 收到用户消息后，调用此工具
 * 将最终回复写回 GotoPlan 的 GotoBot 聊天窗口。
 */

import { post } from '../client/apiClient.js';
import { Type } from '../utils/schema.js';

function isOperationalReplyNoise(text: string): boolean {
  const cleaned = String(text || '').replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '').trim();
  const registeredCount = (cleaned.match(/\bRegistered:\s*[a-z_]/g) || []).length;

  return [
    /^✅?\s*GotoPlan Plugin loading/i,
    /Plugin config received/i,
    /Configuration loaded\s*:/i,
    /GotoPlan Plugin loaded/i,
    /pluginConfigKeys/i,
    /apiKeyLength/i,
    /hasApiKey/i,
    /\[gotoplan-manager\]/i,
    /\[plugins\]/i,
    /plugins\.allow/i,
    /loaded without install\/load-path provenance/i,
    /Command failed:\s*openclaw agent/i,
    /Pass --to|choose a session/i
  ].some(pattern => pattern.test(cleaned)) || registeredCount >= 2;
}

export const sendGotoBotReplyTool = {
  name: 'send_gotobot_reply',
  description: 'Send the final reply for a GotoBot Channel message back to the user in GotoPlan. Use this whenever a prompt contains a GotoBot messageId.',
  parameters: Type.Object({
    messageId: Type.String({
      description: 'The GotoBot messageId from the prompt.'
    }),
    reply: Type.String({
      description: 'The final answer that should appear in the GotoBot chat window.'
    })
  }),

  async execute(_id: string, params: { messageId: string; reply: string }) {
    const messageId = String(params.messageId || '').trim();
    const reply = String(params.reply || '').trim();

    if (!messageId) {
      return {
        success: false,
        output: '缺少 messageId，无法回传 GotoBot 回复'
      };
    }

    if (!reply) {
      return {
        success: false,
        output: '回复内容为空，未回传 GotoBot'
      };
    }

    if (isOperationalReplyNoise(reply)) {
      return {
        success: false,
        output: '检测到插件过程日志或配置日志，已拦截，未回传 GotoBot。请只把最终答复正文作为 reply。'
      };
    }

    await post('/openclaw/events', {
      eventType: 'message.reply',
      messageId,
      payload: {
        agentReply: reply,
        status: 'completed'
      }
    });

    return {
      success: true,
      output: '已回传 GotoBot 回复'
    };
  }
};
