/**
 * 确认报告工具
 * Boss 助理阅读汇报后标记为已确认，清理待办列表
 * 确认后自动将成果异步同步到 Notion（若已启用）
 */

import { Type } from '../utils/schema.js';
import { post, get } from '../client/apiClient.js';
import { syncTaskResultToNotion } from '../utils/notionClient.js';
import { syncTaskResultToFeishuDocx } from '../utils/feishuClient.js';
import { syncTaskResultToYuque } from '../utils/yuqueClient.js';
import { CONFIG } from '../config/index.js';
import { reportSyncStarted, reportSyncCompleted, reportSyncFailed } from '../client/telemetryClient.js';

export const acknowledgeReportTool = {
  name: 'acknowledge_report',
  description: 'Mark a work report as acknowledged (reviewed by Boss). Use this after reading a report from get_boss_reports. IMPORTANT: Confirm with user before acknowledging. 确认后可将成果同步到 Notion / 飞书文档 / 语雀（可选）。',

  parameters: Type.Object({
    reportId: Type.String({
      description: '要确认的报告 ID，来自 get_boss_reports 中的 reportId 字段'
    }),
    syncTarget: Type.Optional(Type.Union([
      Type.Literal('auto'),
      Type.Literal('notion'),
      Type.Literal('feishu'),
      Type.Literal('yuque'),
      Type.Literal('both'),
      Type.Literal('none')
    ], {
      description: '同步目标：auto(按插件配置开关) / notion / feishu / yuque / both(notion+feishu) / none。默认 auto。'
    }))
  }),

  async execute(_id: string, params: any) {
    try {
      // 1. 获取报告详情（用于 Notion 同步）
      let taskInfo: Record<string, string> = {};
      try {
        const reportsResponse = await get<{ reports: any[] }>(`/openclaw/reports?status=pending_review&limit=50`);
        const reports = reportsResponse.reports || [];
        const report = reports.find((r: any) => r.reportId === params.reportId);
        if (report) {
          taskInfo = {
            taskId:       report.taskId || '',
            title: report.taskDescription?.split('\n')[0]
              ?.replace('撰写一篇', '')
              ?.replace('任务：', '')
              || '未命名任务',
            description:  report.taskDescription || '',
            agentName:    report.agentName || '',
            completedAt:  report.completedAt || new Date().toISOString(),
            result:       report.result || ''
          };
        }
      } catch (e: any) {
        console.log('[acknowledge] 获取报告详情失败:', e.message);
      }

      // 2. 确认报告
      const response = await post<{ reportId: string; status: string }>(
        `/openclaw/reports/${encodeURIComponent(params.reportId)}/acknowledge`,
        {}
      );

      // 3. 异步同步到 Notion / 飞书 / 语雀（不阻塞回复）
      const syncTarget: 'auto' | 'notion' | 'feishu' | 'yuque' | 'both' | 'none' = (params?.syncTarget || 'auto');
      const shouldSyncNotion =
        taskInfo.result &&
        syncTarget !== 'none' &&
        (syncTarget === 'notion' || syncTarget === 'both' || (syncTarget === 'auto' && CONFIG.notionEnabled));
      const shouldSyncFeishu =
        taskInfo.result &&
        syncTarget !== 'none' &&
        (syncTarget === 'feishu' || syncTarget === 'both' || (syncTarget === 'auto' && CONFIG.feishuEnabled));
      const shouldSyncYuque =
        taskInfo.result &&
        syncTarget !== 'none' &&
        (syncTarget === 'yuque' || (syncTarget === 'auto' && CONFIG.yuqueEnabled));

      const syncMsgs: string[] = [];
      const syncTaskId: string = (taskInfo as any).taskId || '';

      // 有 taskId 时提前回传"开始同步"状态
      if (syncTaskId) {
        const targets: string[] = [];
        if (shouldSyncNotion) targets.push('notion');
        if (shouldSyncFeishu) targets.push('feishu');
        if (shouldSyncYuque)  targets.push('yuque');
        if (targets.length > 0) {
          reportSyncStarted(syncTaskId, { targets });
        }
      }

      if (shouldSyncNotion) {
        syncTaskResultToNotion(taskInfo as any, taskInfo.result)
          .then((r: { success: boolean; pageId?: string; error?: string }) => {
            if (r.success) {
              console.log(`[acknowledge] ✅ Notion 同步成功: ${r.pageId}`);
              if (syncTaskId) {
                reportSyncCompleted(syncTaskId, {
                  target: 'notion',
                  syncStatus: 'synced',
                  targetDocId: r.pageId
                });
              }
            } else {
              console.log(`[acknowledge] ❌ Notion 同步失败: ${r.error}`);
              if (syncTaskId) {
                reportSyncFailed(syncTaskId, {
                  target: 'notion',
                  syncStatus: 'failed',
                  errorMessage: r.error
                });
              }
            }
          })
          .catch((e: any) => {
            console.error('[acknowledge] Notion 同步异常:', e.message);
            if (syncTaskId) {
              reportSyncFailed(syncTaskId, {
                target: 'notion',
                syncStatus: 'failed',
                errorMessage: e.message
              });
            }
          });
        syncMsgs.push('📝 Notion: 已触发异步同步');
      } else if (syncTarget === 'notion' || syncTarget === 'both') {
        syncMsgs.push('📝 Notion: 未触发（未启用或无成果）');
      }

      if (shouldSyncFeishu) {
        syncTaskResultToFeishuDocx(taskInfo as any, taskInfo.result)
          .then((r: { success: boolean; documentId?: string; url?: string; error?: string }) => {
            if (r.success) {
              console.log(`[acknowledge] ✅ 飞书同步成功: ${r.documentId} ${r.url ? `(${r.url})` : ''}`);
              if (syncTaskId) {
                reportSyncCompleted(syncTaskId, {
                  target: 'feishu',
                  syncStatus: 'synced',
                  targetUrl: r.url,
                  targetDocId: r.documentId
                });
              }
            } else {
              console.log(`[acknowledge] ❌ 飞书同步失败: ${r.error}`);
              if (syncTaskId) {
                reportSyncFailed(syncTaskId, {
                  target: 'feishu',
                  syncStatus: 'failed',
                  errorMessage: r.error
                });
              }
            }
          })
          .catch((e: any) => {
            console.error('[acknowledge] 飞书同步异常:', e.message);
            if (syncTaskId) {
              reportSyncFailed(syncTaskId, {
                target: 'feishu',
                syncStatus: 'failed',
                errorMessage: e.message
              });
            }
          });
        syncMsgs.push('📝 飞书: 已触发异步同步（Docx）');
      } else if (syncTarget === 'feishu' || syncTarget === 'both') {
        syncMsgs.push('📝 飞书: 未触发（未启用或无成果）');
      }

      if (shouldSyncYuque) {
        syncTaskResultToYuque(taskInfo as any, taskInfo.result)
          .then((r: { success: boolean; documentId?: string; url?: string; error?: string }) => {
            if (r.success) {
              console.log(`[acknowledge] ✅ 语雀同步成功: ${r.documentId} ${r.url ? `(${r.url})` : ''}`);
              if (syncTaskId) {
                reportSyncCompleted(syncTaskId, {
                  target: 'yuque',
                  syncStatus: 'synced',
                  targetUrl: r.url,
                  targetDocId: r.documentId
                });
              }
            } else {
              console.log(`[acknowledge] ❌ 语雀同步失败: ${r.error}`);
              if (syncTaskId) {
                reportSyncFailed(syncTaskId, { target: 'yuque', syncStatus: 'failed', errorMessage: r.error });
              }
            }
          })
          .catch((e: any) => {
            console.error('[acknowledge] 语雀同步异常:', e.message);
            if (syncTaskId) {
              reportSyncFailed(syncTaskId, { target: 'yuque', syncStatus: 'failed', errorMessage: e.message });
            }
          });
        syncMsgs.push('📝 语雀: 已触发异步同步');
      } else if (syncTarget === 'yuque') {
        syncMsgs.push('📝 语雀: 未触发（未启用或无成果）');
      }

      return {
        success: true,
        reportId: response.reportId,
        output: [
          `✅ **报告已确认**`,
          '',
          `🆔 reportId: \`${response.reportId}\``,
          `📋 状态: ${response.status}`,
          ...(syncMsgs.length ? [''] : []),
          ...syncMsgs,
          '',
          '💡 使用 `get_boss_reports()` 查看其他待审阅的汇报。'
        ].join('\n')
      };

    } catch (error: any) {
      const msg = error.toUserMessage ? error.toUserMessage() : error.message;
      return {
        success: false,
        error: msg,
        output: `❌ 确认报告失败:\n\n${msg}`
      };
    }
  }
};

