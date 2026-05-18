/**
 * 分派任务给 AI 员工克隆体工具
 *
 * 流程：
 * 1. 后端创建任务记录，返回 taskId 和 openclawAgentId
 * 2. 本地后台执行：调用 `openclaw agent -m "<任务>" --agent <id>`
 * 3. 执行完成后回写结果到后端（POST /tasks/:taskId/complete）
 * 4. 立即返回 taskId，用 get_task_status 轮询
 */

import { Type } from '../utils/schema.js';
import { post } from '../client/apiClient.js';
import { sendMessage } from '../utils/openclawCli.js';
import { reportTaskStarted, reportTaskCompleted } from '../client/telemetryClient.js';

export const dispatchTaskToAgentTool = {
  name: 'dispatch_task_to_agent',
  description: `Dispatch a task to an AI staff clone. The clone executes the task using OpenClaw's local model with the staff member's SOUL as system prompt. Returns taskId immediately — use get_task_status to poll for completion. IMPORTANT: Confirm with user before dispatching.`,

  parameters: Type.Object({
    cloneId: Type.String({
      description: '目标克隆体的 ID，来自 list_cloned_agents 或 clone_staff_agent 的返回值'
    }),
    taskDescription: Type.String({
      description: '任务描述，清晰说明需要该 AI 员工完成什么工作'
    }),
    priority: Type.Optional(Type.Union([
      Type.Literal('high'),
      Type.Literal('normal'),
      Type.Literal('low')
    ], { description: '任务优先级，默认 normal' })),
    contextInfo: Type.Optional(Type.String({
      description: '背景信息，帮助员工更好理解任务上下文'
    }))
  }),

  async execute(_id: string, params: any) {
    try {
      // 1. 后端创建任务记录
      const response = await post<{
        taskId: string;
        status: string;
        agentName: string;
        agentEmoji: string;
        openclawAgentId: string;
        taskDescription: string;
        message: string;
      }>('/openclaw/tasks/dispatch', {
        cloneId: params.cloneId,
        taskDescription: params.taskDescription,
        priority: params.priority || 'normal',
        contextInfo: params.contextInfo || ''
      });

      const { taskId, agentName, agentEmoji, openclawAgentId } = response;

      // 2. 后台异步执行：不阻塞工具返回
      const fullMessage = params.contextInfo
        ? `任务：${params.taskDescription}\n\n背景信息：${params.contextInfo}`
        : `任务：${params.taskDescription}`;

      // 后台执行，状态实时回传后端
      Promise.resolve().then(async () => {
        try {
          await reportTaskStarted(taskId, {
            status: 'in_progress',
            progress: 10,
            message: 'AI员工已开始执行任务'
          });

          const result = await sendMessage(openclawAgentId, fullMessage);

          await reportTaskCompleted(taskId, {
            status: 'completed',
            resultSummary: result.slice(0, 200),
            resultContent: result,
            agentName,
            agentEmoji
          });
        } catch (err: any) {
          await reportTaskCompleted(taskId, {
            failed: true,
            errorMessage: err.message,
            agentName,
            agentEmoji
          });
        }
      });

      const output = [
        `📡 **任务已分派！**`,
        '',
        `${agentEmoji || '🤖'} **${agentName}** 正在执行中（由 OpenClaw 本地模型处理）...`,
        '',
        `🆔 任务 ID: \`${taskId}\``,
        `📋 任务: ${params.taskDescription}`,
        '',
        '⏳ **接下来：**',
        `  📊 轮询状态 → \`get_task_status(taskId="${taskId}")\``,
        '  📬 完成后使用 `get_boss_reports()` 查看工作汇报',
        '',
        '⏰ 通常需要 30-60 秒...'
      ].join('\n');

      return {
        success: true,
        taskId,
        agentName,
        status: 'in_progress',
        output
      };
    } catch (error: any) {
      const msg = error.toUserMessage ? error.toUserMessage() : error.message;
      return {
        success: false,
        error: msg,
        output: [
          `❌ 任务分派失败:\n\n${msg}`,
          '',
          '💡 请检查:',
          '  1. cloneId 是否正确（使用 list_cloned_agents 查看）',
          '  2. 克隆体是否已绑定 OpenClaw Agent（需先克隆）'
        ].join('\n')
      };
    }
  }
};

