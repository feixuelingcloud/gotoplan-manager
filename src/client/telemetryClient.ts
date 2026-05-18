/**
 * OpenClaw 执行状态回传客户端
 * 将 AI 员工任务执行状态、执行结果、同步状态实时回传到 GotoPlan 后端
 * 所有方法静默处理错误，确保回传失败不影响主流程
 */

import { post } from './apiClient.js';

async function silentPost(path: string, payload: object): Promise<void> {
  try {
    await post(path, payload);
  } catch {
    // 回传失败不影响主流程，静默忽略
  }
}

export function reportTaskStarted(taskId: string, payload: {
  status: 'in_progress';
  progress?: number;
  message?: string;
}): Promise<void> {
  return silentPost(`/openclaw/tasks/${encodeURIComponent(taskId)}/start`, payload);
}

export function reportTaskEvent(taskId: string, payload: {
  eventType: string;
  title?: string;
  message?: string;
  progress?: number;
}): Promise<void> {
  return silentPost(`/openclaw/tasks/${encodeURIComponent(taskId)}/events`, payload);
}

export function reportTaskCompleted(taskId: string, payload: {
  status?: 'completed';
  resultSummary?: string;
  resultContent?: string;
  agentName?: string;
  agentEmoji?: string;
  failed?: boolean;
  errorMessage?: string;
}): Promise<void> {
  return silentPost(`/openclaw/tasks/${encodeURIComponent(taskId)}/complete`, payload);
}

export function reportSyncStarted(taskId: string, payload: {
  targets: string[];
}): Promise<void> {
  return silentPost(`/openclaw/tasks/${encodeURIComponent(taskId)}/sync/start`, payload);
}

export function reportSyncCompleted(taskId: string, payload: {
  target: string;
  syncStatus: 'synced';
  targetUrl?: string;
  targetDocId?: string;
}): Promise<void> {
  return silentPost(`/openclaw/tasks/${encodeURIComponent(taskId)}/sync/complete`, payload);
}

export function reportSyncFailed(taskId: string, payload: {
  target: string;
  syncStatus: 'failed';
  errorMessage?: string;
}): Promise<void> {
  return silentPost(`/openclaw/tasks/${encodeURIComponent(taskId)}/sync/failed`, payload);
}

export function reportAgentChanged(action: 'cloned' | 'removed', cloneId: string): Promise<void> {
  return silentPost('/openclaw/agents/notify', { action, cloneId });
}
