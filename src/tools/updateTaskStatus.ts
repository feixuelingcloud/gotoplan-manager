/**
 * 更新任务状态工具
 * 修改单个任务的执行状态
 */

import { Type } from '../utils/schema.js';
import { patch } from '../client/apiClient.js';

export const updateTaskStatusTool = {
  name: 'update_task_status',
  description: '⚠️ FOR SUB-TASKS ONLY. Update the status of an individual sub-task (NOT a plan). Supported statuses: todo, doing, done, blocked, delayed. DO NOT use this tool to mark a PLAN as completed — use update_plan with completed=true instead. This tool only updates sub-task status and does NOT change the plan\'s completion state.',

  parameters: Type.Object({
    task_id: Type.String({
      description: '子任务ID（从 get_plan_detail 返回的 tasks 列表中获取）。注意：这是子任务ID，不是计划ID。若要完成计划，请用 update_plan 工具传入 completed=true'
    }),
    status: Type.String({
      description: '子任务的新状态值（仅适用于子任务）',
      enum: ['todo', 'doing', 'done', 'blocked', 'delayed']
    }),
    note: Type.Optional(Type.String({
      description: '可选的备注,说明状态变更的原因'
    }))
  }),

  // 这是写操作,设为optional
  optional: true,

  async execute(_id: string, params: { task_id: string; status: string; note?: string }) {
    try {
      const response = await patch<{
        task_id: string;
        status: string;
        progress_after_update: number;
        plan_id: string;
      }>(`/openclaw/tasks/${params.task_id}/status`, {
        status: params.status,
        note: params.note
      });

      // 状态显示映射
      const statusDisplay: Record<string, string> = {
        pending: '⏳ 待办',
        in_progress: '🔄 进行中',
        completed: '✅ 已完成',
        blocked: '🚫 被阻塞'
      };

      const statusChinese: Record<string, string> = {
        todo: '待办',
        doing: '进行中',
        done: '已完成',
        blocked: '被阻塞',
        delayed: '延期'
      };

      const output = [
        '✅ 任务状态已更新!',
        '',
        `📋 任务ID: ${response.task_id}`,
        `📊 新状态: ${statusDisplay[response.status] || response.status}`,
        `📈 进度: ${response.progress_after_update}%`,
        ''
      ];

      if (params.note) {
        output.push(`📝 备注: ${params.note}`);
        output.push('');
      }

      // 根据状态给出建议
      if (params.status === 'done') {
        output.push('🎉 恭喜完成任务!');
        output.push('💡 提示: 可以查看计划的整体进度或生成执行报告');
      } else if (params.status === 'blocked') {
        output.push('⚠️ 任务已标记为阻塞');
        output.push('💡 建议: 尽快解决阻塞问题,或寻求协作者帮助');
      } else if (params.status === 'doing') {
        output.push('💪 继续加油!');
        output.push('💡 提示: 记得及时更新进度');
      }

      output.push('');
      output.push(`🔗 所属计划ID: ${response.plan_id}`);

      return {
        success: true,
        task_id: response.task_id,
        status: response.status,
        progress: response.progress_after_update,
        plan_id: response.plan_id,
        output: output.join('\n')
      };
    } catch (error: any) {
      const errorMessage = error.toUserMessage ? error.toUserMessage() : error.message;

      // 特别处理任务不存在的情况
      if (error.code === 'TASK_NOT_FOUND') {
        return {
          success: false,
          error: 'TASK_NOT_FOUND',
          output: [
            '❌ 任务不存在',
            '',
            '无法找到该任务,可能已被删除或ID不正确。',
            '',
            '💡 建议: 使用 get_plan_detail 工具查看计划的任务列表'
          ].join('\n')
        };
      }

      // 特别处理无效状态
      if (error.code === 'INVALID_STATUS') {
        return {
          success: false,
          error: 'INVALID_STATUS',
          output: [
            '❌ 无效的状态值',
            '',
            '状态必须是以下之一: todo, doing, done, blocked, delayed',
            '',
            '💡 提示: 请使用正确的状态值'
          ].join('\n')
        };
      }

      // 特别处理权限错误
      if (error.code === 'ACCESS_DENIED') {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          output: [
            '❌ 权限不足',
            '',
            '您没有权限修改该任务。',
            '',
            '💡 提示: 只能修改您自己创建的任务或您参与协作的任务'
          ].join('\n')
        };
      }

      return {
        success: false,
        error: errorMessage,
        output: `❌ 更新任务状态失败:\n\n${errorMessage}`
      };
    }
  }
};

