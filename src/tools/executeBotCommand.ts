/**
 * GotoBot 指令执行工具
 * 轮询 bot_commands 队列，分发并执行用户通过 GotoBot 发出的操作指令
 */

import { get, post } from '../client/apiClient.js';
import { updateTaskStatusTool } from './updateTaskStatus.js';
import { getPlanDetailTool } from './getPlanDetail.js';
import { listPlansTool } from './listPlans.js';
import { listClonedAgentsTool } from './listClonedAgents.js';
import { getTodayFocusTool } from './getTodayFocus.js';
import { getPlanRemindersTool } from './getPlanReminders.js';
import { listAIStaffTool } from './listAIStaff.js';
import { getBossReportsTool } from './getBossReports.js';

interface BotCommand {
  _id: string;
  userId: string;
  action: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>;
  status: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolResult = { success: boolean; output: string; [key: string]: any };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dispatchCommand(cmd: BotCommand): Promise<ToolResult> {
  const { action, params } = cmd;
  // 所有 params 均通过 as any 传入，避免 TypeBox 生成类型与运行时 any 的冲突
  /* eslint-disable @typescript-eslint/no-explicit-any */
  switch (action) {
    case 'update_task_status':
      return updateTaskStatusTool.execute('', params as any);

    case 'get_plan_detail':
      return getPlanDetailTool.execute('', params as any);

    case 'list_plans':
      return listPlansTool.execute('', params as any);

    case 'list_cloned_agents':
      return listClonedAgentsTool.execute('', params as any);

    case 'get_today_focus':
      return getTodayFocusTool.execute('', params as any);

    case 'get_plan_reminders':
      return getPlanRemindersTool.execute('', params as any);

    case 'list_ai_staff':
      return listAIStaffTool.execute('', params as any);

    case 'get_boss_reports':
      return getBossReportsTool.execute('', params as any);

    default:
      throw new Error(`未知指令类型: ${action}`);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function pollBotCommandsOnce(): Promise<void> {
  let commands: BotCommand[];
  try {
    const res = await get<{ commands: BotCommand[] }>('/openclaw/bot/commands/pending');
    commands = res?.commands || [];
  } catch {
    return;
  }

  for (const cmd of commands) {
    try {
      const result = await dispatchCommand(cmd);
      await post(`/openclaw/bot/commands/${cmd._id}/ack`, {
        status: result.success ? 'done' : 'failed',
        resultMessage: result.output
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await post(`/openclaw/bot/commands/${cmd._id}/ack`, {
        status: 'failed',
        resultMessage: msg
      }).catch(() => {/* ack 失败不阻塞后续命令 */});
    }
  }
}
