/**
 * 列出计划列表工具
 * 查询用户的所有计划并支持筛选
 */

import { Type } from '../utils/schema.js';
import { get } from '../client/apiClient.js';

export const listPlansTool = {
  name: 'list_plans',
  description: 'List user\'s plans with optional filters. Default shows this week\'s plans. Supports filtering by time range (week/month/all), status (pending/in_progress/completed/blocked), and keyword search. Returns basic plan info including ID, title, status, and dates.',

  parameters: Type.Object({
    time_range: Type.Optional(Type.String({
      description: '时间范围: week(本周,默认)、last_week(上周)、month(本月)、all(全部)',
      enum: ['week', 'last_week', 'month', 'all']
    })),
    status: Type.Optional(Type.String({
      description: '按状态筛选: pending(待办)、in_progress(进行中)、completed(已完成)、blocked(被阻塞)',
      enum: ['pending', 'in_progress', 'completed', 'blocked']
    })),
    keyword: Type.Optional(Type.String({
      description: '关键词搜索,用于在计划标题中搜索'
    }))
  }),

  async execute(_id: string, params: { time_range?: string; status?: string; keyword?: string }) {
    try {
      // 默认为本周
      const timeRange = params.time_range || 'week';

      // 构建查询参数
      const queryParams = new URLSearchParams();

      // 添加时间范围
      if (timeRange) {
        queryParams.append('date_range', timeRange);
      }

      if (params.status) {
        queryParams.append('status', params.status);
      }
      if (params.keyword) {
        queryParams.append('keyword', params.keyword);
      }

      const queryString = queryParams.toString();
      const url = `/openclaw/plans${queryString ? `?${queryString}` : ''}`;

      const response = await get<{
        plans: Array<{
          plan_id: string;
          title: string;
          status?: string;
          completed?: boolean;
          progress: number;
          createTime: string;
          startDate?: string;
          startTime?: string;
          dueDate?: string;
          deadline?: string;
          deadlineTime?: string;
          category?: string;
          executionNotes?: string;
          source?: string;
        }>;
      }>(url);

      // 格式化输出
      const statusEmoji: Record<string, string> = {
        pending: '⏳',
        in_progress: '🔄',
        completed: '✅',
        blocked: '🚫'
      };

      // 时间范围显示文本
      const rangeText: Record<string, string> = {
        week: '本周',
        last_week: '上周',
        month: '本月',
        all: '全部'
      };

      const output = [
        `📋 您${rangeText[timeRange]}有 ${response.plans.length} 个计划:`,
        ''
      ];

      response.plans.forEach((plan, index) => {
        // 确定状态 emoji：只读取 status 字段
        let emoji = '📌';
        if (plan.status) {
          emoji = statusEmoji[plan.status] || '📌';
        }

        const lines = [
          `${index + 1}. ${plan.title} (${plan.category || '其他'}) ${emoji}`,
        ];

        // 添加时间信息
        if (plan.deadline || plan.dueDate) {
          const deadline = plan.deadline || plan.dueDate;
          lines.push(`   截止: ${deadline}${plan.deadlineTime ? ' ' + plan.deadlineTime : ''}`);
        } else if (plan.startDate) {
          lines.push(`   开始: ${plan.startDate}${plan.startTime ? ' ' + plan.startTime : ''}`);
        }

        // 添加进度
        if (plan.status === 'in_progress' && plan.progress > 0) {
          lines.push(`   进度: ${plan.progress}%`);
        }

        output.push(lines.join('\n'));
      });

      if (response.plans.length === 0) {
        output.push('暂无计划');
        output.push('');
        output.push('💡 提示:');
        if (timeRange === 'week') {
          output.push('  • 查看上周计划,请说 "告诉我上周的计划"');
          output.push('  • 查看本月计划,请说 "告诉我本月的计划"');
          output.push('  • 查看全部计划,请说 "告诉我所有计划"');
        } else if (timeRange === 'last_week') {
          output.push('  • 查看本周计划,请说 "告诉我本周的计划"');
          output.push('  • 查看本月计划,请说 "告诉我本月的计划"');
        } else {
          output.push('  • 尝试调整筛选条件或查看其他时间范围');
        }
      } else {
        output.push('');
        output.push('────────────────────────────');
        output.push('💡 提示:');
        output.push('  • 要查看详情,请说 "告诉我第X个计划的详情"');
        output.push('  • 要修改计划,请说 "修改第X个计划的..."');
        if (timeRange === 'week') {
          output.push('  • 查看上周计划,请说 "告诉我上周的计划"');
          output.push('  • 查看本月计划,请说 "告诉我本月的计划"');
        } else if (timeRange === 'last_week') {
          output.push('  • 查看本周计划,请说 "告诉我本周的计划"');
        } else if (timeRange === 'month') {
          output.push('  • 查看本周计划,请说 "告诉我本周的计划"');
        }
      }

      return {
        success: true,
        plans: response.plans,
        count: response.plans.length,
        output: output.join('\n'),
        // 保存到上下文供后续引用
        context_data: {
          recent_plans: response.plans.map((plan, index) => ({
            index: index + 1,
            plan_id: plan.plan_id,
            title: plan.title,
            status: plan.status
          }))
        }
      };
    } catch (error: any) {
      const errorMessage = error.toUserMessage ? error.toUserMessage() : error.message;

      return {
        success: false,
        error: errorMessage,
        output: `❌ 查询计划列表失败:\n\n${errorMessage}`
      };
    }
  }
};

