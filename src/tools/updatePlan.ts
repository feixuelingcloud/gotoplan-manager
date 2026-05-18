/**
 * 修改计划工具
 * 用于修改计划的各种字段(截止日期、重要性、分类等)
 *
 * ⚠️ 关键说明:
 * - 标记计划完成: 使用 completed 字段 (boolean: true/false)
 * - status 字段是只读的展示字段，由后端根据 completed 自动计算，不可直接写入
 */

import { Type } from '../utils/schema.js';
import { patch } from '../client/apiClient.js';

export const updatePlanTool = {
  name: 'update_plan',
  description: 'Update a plan. To mark a plan as COMPLETED: pass completed=true. To reopen: pass completed=false. DO NOT pass a "status" field - it is read-only. Other updatable fields: title, deadline (YYYY-MM-DD), deadlineTime (HH:mm), startDate, startTime, category, importance (1-10), urgency (1-10), executionNotes.',

  parameters: Type.Object({
    plan_id: Type.String({
      description: 'The plan ID to update'
    }),
    completed: Type.Optional(Type.Boolean({
      description: 'Set true to mark plan as COMPLETED. Set false to reopen it. THIS IS THE ONLY WAY to change completion status.'
    })),
    title: Type.Optional(Type.String({
      description: 'New plan title'
    })),
    deadline: Type.Optional(Type.String({
      description: 'New deadline date, format: YYYY-MM-DD'
    })),
    deadlineTime: Type.Optional(Type.String({
      description: 'New deadline time, format: HH:mm'
    })),
    startDate: Type.Optional(Type.String({
      description: 'New start date, format: YYYY-MM-DD'
    })),
    startTime: Type.Optional(Type.String({
      description: 'New start time, format: HH:mm'
    })),
    category: Type.Optional(Type.String({
      description: 'Category: 工作/学习/生活/运动/兴趣/出行/休闲/其他'
    })),
    importance: Type.Optional(Type.Number({
      description: 'Importance score (1-10)'
    })),
    urgency: Type.Optional(Type.Number({
      description: 'Urgency score (1-10)'
    })),
    executionNotes: Type.Optional(Type.String({
      description: 'Execution notes or remarks'
    }))
  }),

  // 这是写操作,设为optional
  optional: true,

  async execute(_id: string, params: any) {
    // ★★★ 关键调试日志：打印 OpenClaw 实际传递给 execute 的完整参数 ★★★
    console.log('[update_plan] ★ execute() called. Raw params from OpenClaw:', JSON.stringify(params));

    try {
      const { plan_id, ...updateFields } = params;

      console.log('[update_plan] plan_id:', plan_id);
      console.log('[update_plan] updateFields keys:', Object.keys(updateFields));
      console.log('[update_plan] updateFields values:', JSON.stringify(updateFields));

      // 构建最终要发送给 API 的字段
      const fieldsToUpdate: any = {};

      for (const [key, value] of Object.entries(updateFields)) {
        if (value !== undefined && value !== null) {
          fieldsToUpdate[key] = value;
        }
      }

      console.log('[update_plan] fieldsToUpdate (before send):', JSON.stringify(fieldsToUpdate));

      if (Object.keys(fieldsToUpdate).length === 0) {
        console.warn('[update_plan] ⚠️ No fields to update! params was:', JSON.stringify(params));
        return {
          success: false,
          error: 'NO_FIELDS_PROVIDED',
          output: '❌ 没有提供需要更新的字段\n\n💡 提示: 要将计划标记为完成，请传入 completed=true\n要修改其他字段，请传入 deadline/title/importance 等'
        };
      }

      const response = await patch<{
        plan_id: string;
        updated_fields: string[];
        change_summary: string;
        message: string;
      }>(`/openclaw/plans/${plan_id}/update`, fieldsToUpdate);

      console.log('[update_plan] API response:', JSON.stringify(response));

      // 格式化返回给用户的消息
      const completedValue = fieldsToUpdate.completed;
      const statusLine = completedValue === true
        ? '✅ 计划已标记为【已完成】'
        : completedValue === false
        ? '🔄 计划已重新打开（标记为未完成）'
        : '';

      const output = [
        '✅ 计划更新成功!',
        statusLine,
        '',
        `📋 计划ID: ${response.plan_id}`,
        `📝 更新的字段: ${response.updated_fields.join(', ')}`,
        '',
        '📊 变更详情:',
        response.change_summary.split('; ').map((change: string) => `  • ${change}`).join('\n')
      ].filter((line: string) => line !== undefined).join('\n');

      return {
        success: true,
        plan_id: response.plan_id,
        updated_fields: response.updated_fields,
        output
      };
    } catch (error: any) {
      const errorMessage = error.toUserMessage ? error.toUserMessage() : error.message;
      console.error('[update_plan] Error:', errorMessage);

      // 特别处理计划不存在的情况
      if (error.code === 'PLAN_NOT_FOUND') {
        return {
          success: false,
          error: 'PLAN_NOT_FOUND',
          output: [
            '❌ 计划不存在',
            '',
            '💡 建议: 先查询计划列表,确认计划ID是否正确'
          ].join('\n')
        };
      }

      return {
        success: false,
        error: errorMessage,
        output: `❌ 修改计划失败:\n\n${errorMessage}`
      };
    }
  }
};

