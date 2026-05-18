/**
 * 语雀同步工具
 * 将任务成果写入语雀知识库（原生 Markdown，无需格式转换）
 */

import { CONFIG } from '../config/index.js';

const YUQUE_BASE = 'https://www.yuque.com/api/v2';

export async function syncTaskResultToYuque(
  taskInfo: { title: string; agentName?: string; completedAt?: string },
  result: string
): Promise<{ success: boolean; documentId?: string; url?: string; error?: string }> {
  if (!CONFIG.yuqueEnabled)   return { success: false, error: '语雀同步未启用' };
  if (!CONFIG.yuqueToken)     return { success: false, error: '未配置 yuqueToken' };
  if (!CONFIG.yuqueNamespace) return { success: false, error: '未配置 yuqueNamespace（格式: 用户名/知识库slug）' };

  const bodyLines: string[] = [
    `> **执行员工**：${taskInfo.agentName || '未知'}`
  ];
  if (taskInfo.completedAt) bodyLines.push(`> **完成时间**：${taskInfo.completedAt}`);
  bodyLines.push('', '---', '', result || '');
  const body = bodyLines.join('\n');

  const resp = await fetch(
    `${YUQUE_BASE}/repos/${encodeURIComponent(CONFIG.yuqueNamespace)}/docs`,
    {
      method: 'POST',
      headers: {
        'X-Auth-Token': CONFIG.yuqueToken,
        'Content-Type': 'application/json',
        'User-Agent': 'GotoPlan-Manager/1.0'
      },
      body: JSON.stringify({
        title:  taskInfo.title || '未命名任务',
        body,
        format: 'markdown',
        status: 1
      })
    }
  );

  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.message || `HTTP ${resp.status}`;
    return { success: false, error: `语雀 API 失败: ${msg}` };
  }

  const doc = data?.data;
  const slug = doc?.slug || doc?.id;
  const documentId = String(doc?.id || '');
  const url = slug ? `https://www.yuque.com/${CONFIG.yuqueNamespace}/${slug}` : undefined;
  return { success: true, documentId, url };
}
