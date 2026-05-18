/**
 * OpenClaw CLI 封装
 *
 * 插件运行在用户本地机器上，通过 child_process 调用 OpenClaw CLI：
 *   - createAgent()   → openclaw agents add <name> --workspace <dir> --non-interactive --json
 *   - sendMessage()   → openclaw agent -m "<msg>" --agent <id>
 */

import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

const CLONES_DIR = path.join(os.homedir(), '.openclaw', 'agent-clones');
const OPENCLAW_AGENTS_DIR = path.join(os.homedir(), '.openclaw', 'agents');
const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const CLI_MAX_BUFFER = 10 * 1024 * 1024;
const HISTORY_POLL_INTERVAL_MS = 500;
const HISTORY_POLL_TIMEOUT_MS = 45000;
const TRANSCRIPT_READ_MAX_BYTES = 2 * 1024 * 1024;

function cleanCliOutput(value: unknown): string {
  if (!value) return '';
  return String(value).replace(ANSI_PATTERN, '').trim();
}

type TranscriptSnapshot = {
  filePath: string | null;
  size: number;
  sizes?: Record<string, number>;
};

type CliResult = {
  error: any;
  stdout: unknown;
  stderr: unknown;
};

function sessionDirForAgent(agentId: string): string {
  return path.join(OPENCLAW_AGENTS_DIR, agentId || 'main', 'sessions');
}

function listNewestTranscriptPaths(agentId: string, limit = 8): string[] {
  const sessionsDir = sessionDirForAgent(agentId);
  if (!fs.existsSync(sessionsDir)) return [];

  return fs.readdirSync(sessionsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map(entry => {
      const filePath = path.join(sessionsDir, entry.name);
      const stat = fs.statSync(filePath);
      return { filePath, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit)
    .map(item => item.filePath);
}

function findNewestTranscriptPath(agentId: string): string | null {
  return listNewestTranscriptPaths(agentId, 1)[0] || null;
}

function uniquePaths(paths: Array<string | null | undefined>): string[] {
  return Array.from(new Set(paths.filter(Boolean).map(item => String(item))));
}

function listTranscriptPaths(agentId: string): string[] {
  return uniquePaths([
    resolveTranscriptPath(agentId),
    ...listNewestTranscriptPaths(agentId)
  ]).filter(filePath => fs.existsSync(filePath));
}

function readJsonFile(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function normalizeSessionMap(store: any): Record<string, any> {
  if (!store || typeof store !== 'object') return {};
  if (store.sessions && typeof store.sessions === 'object') return store.sessions;
  if (store.entries && typeof store.entries === 'object') return store.entries;
  return store;
}

function chooseMainSessionEntry(agentId: string): { key: string; entry: any } | null {
  const sessionsDir = sessionDirForAgent(agentId);
  const store = readJsonFile(path.join(sessionsDir, 'sessions.json'));
  const sessions = normalizeSessionMap(store);
  const wantedKey = `agent:${agentId || 'main'}:main`;

  if (sessions[wantedKey]) {
    return { key: wantedKey, entry: sessions[wantedKey] };
  }

  if (sessions.main) {
    return { key: 'main', entry: sessions.main };
  }

  const candidates = Object.entries(sessions)
    .filter(([key, entry]) => {
      if (!entry || typeof entry !== 'object') return false;
      if (key === wantedKey || key.endsWith(':main')) return true;
      return entry.agentId === agentId && (entry.kind === 'main' || entry.chatType === 'direct');
    })
    .sort(([, a], [, b]) => {
      const ta = Date.parse(a?.lastInteractionAt || a?.updatedAt || a?.sessionStartedAt || 0) || 0;
      const tb = Date.parse(b?.lastInteractionAt || b?.updatedAt || b?.sessionStartedAt || 0) || 0;
      return tb - ta;
    });

  if (candidates.length === 0) return null;
  const [key, entry] = candidates[0];
  return { key, entry };
}

function resolveTranscriptPath(agentId: string): string | null {
  const selected = chooseMainSessionEntry(agentId);
  if (!selected) return findNewestTranscriptPath(agentId);

  const { entry } = selected;
  let candidate: string | null = null;
  if (entry.sessionFile && path.isAbsolute(entry.sessionFile)) {
    candidate = entry.sessionFile;
  } else if (entry.sessionFile) {
    candidate = path.join(sessionDirForAgent(agentId), entry.sessionFile);
  } else {
    const sessionId = entry.sessionId || entry.id || entry.currentSessionId;
    if (sessionId) {
      const fileName = String(sessionId).endsWith('.jsonl') ? String(sessionId) : `${sessionId}.jsonl`;
      candidate = path.join(sessionDirForAgent(agentId), fileName);
    }
  }

  if (candidate && fs.existsSync(candidate)) return candidate;
  return findNewestTranscriptPath(agentId) || candidate;
}

function getTranscriptSnapshot(agentId: string): TranscriptSnapshot {
  const filePath = resolveTranscriptPath(agentId);
  const sizes: Record<string, number> = {};
  for (const candidate of listTranscriptPaths(agentId)) {
    try {
      sizes[candidate] = fs.statSync(candidate).size;
    } catch {
      sizes[candidate] = 0;
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return { filePath, size: 0, sizes };
  }

  return {
    filePath,
    size: fs.statSync(filePath).size,
    sizes
  };
}

function readTranscriptChunk(filePath: string, afterSize = 0): string {
  if (!fs.existsSync(filePath)) return '';
  const size = fs.statSync(filePath).size;
  let start = Math.max(0, afterSize);
  if (start > size) start = 0;
  if (start === 0 && size > TRANSCRIPT_READ_MAX_BYTES) {
    start = size - TRANSCRIPT_READ_MAX_BYTES;
  }

  const fd = fs.openSync(filePath, 'r');
  try {
    const length = size - start;
    if (length <= 0) return '';
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    return buffer.toString('utf-8');
  } finally {
    fs.closeSync(fd);
  }
}

function parseEntryTimestamp(entry: any): number {
  const value =
    entry?.timestamp ||
    entry?.createdAt ||
    entry?.created_at ||
    entry?.time ||
    entry?.message?.timestamp ||
    entry?.message?.createdAt;
  if (!value) return 0;
  const parsed = typeof value === 'number' ? value : Date.parse(String(value));
  if (!Number.isFinite(parsed)) return 0;
  return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

function extractRole(entry: any): string {
  return String(
    entry?.role ||
    entry?.message?.role ||
    entry?.item?.role ||
    entry?.payload?.role ||
    entry?.record?.role ||
    entry?.response?.role ||
    entry?.data?.role ||
    entry?.event?.role ||
    ''
  ).toLowerCase();
}

function inferAssistantRole(entry: any): boolean {
  const markers = [
    entry?.type,
    entry?.kind,
    entry?.eventType,
    entry?.event?.type,
    entry?.item?.type,
    entry?.message?.type
  ].map(value => String(value || '').toLowerCase());

  return markers.some(value =>
    value.includes('assistant') ||
    value.includes('agent_message') ||
    value.includes('message.completed') ||
    value.includes('response.output_item.done')
  );
}

function extractTextValue(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(extractTextValue).filter(Boolean).join('\n').trim();
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.value === 'string') return value.value;

    const nested = [
      value.content,
      value.parts,
      value.message,
      value.item,
      value.payload,
      value.record,
      value.data,
      value.output,
      value.reply,
      value.response,
      value.result
    ];

    for (const item of nested) {
      const text = extractTextValue(item);
      if (text) return text;
    }
  }
  return '';
}

function extractMessageText(entry: any): string {
  const text =
    extractTextValue(entry?.message?.content) ||
    extractTextValue(entry?.message?.parts) ||
    extractTextValue(entry?.message?.text) ||
    extractTextValue(entry?.item?.content) ||
    extractTextValue(entry?.item?.message?.content) ||
    extractTextValue(entry?.payload?.content) ||
    extractTextValue(entry?.payload?.message?.content) ||
    extractTextValue(entry?.record?.content) ||
    extractTextValue(entry?.content) ||
    extractTextValue(entry?.parts) ||
    extractTextValue(entry?.text) ||
    extractTextValue(entry?.data?.content) ||
    extractTextValue(entry?.data?.message?.content) ||
    extractTextValue(entry?.response?.output) ||
    extractTextValue(entry?.output) ||
    extractTextValue(entry?.result) ||
    extractTextValue(entry?.delta?.content);

  return cleanCliOutput(text)
    .replace(/<tool_calls?>[\s\S]*?<\/tool_calls?>/gi, '')
    .replace(/<function_calls?>[\s\S]*?<\/function_calls?>/gi, '')
    .trim();
}

function isOperationalNoise(text: string): boolean {
  const cleaned = cleanCliOutput(text);
  const registeredCount = (cleaned.match(/\bRegistered:\s*[a-z_]/g) || []).length;

  return [
    /\[gotoplan-manager\]/i,
    /\[plugins\]/i,
    /plugins\.allow/i,
    /loaded without install\/load-path provenance/i,
    /Gateway agent failed/i,
    /Pass --to/i,
    /choose a session/i,
    /Command failed:\s*openclaw agent/i,
    /^✅?\s*GotoPlan Plugin loading/i,
    /Plugin config received/i,
    /Configuration loaded\s*:/i,
    /GotoPlan Plugin loaded/i,
    /pluginConfigKeys/i,
    /apiKeyLength/i,
    /hasApiKey/i
  ].some(pattern => pattern.test(cleaned)) || registeredCount >= 2;
}

function isUsefulAgentReply(text: string): boolean {
  const cleaned = cleanCliOutput(text);
  if (!cleaned || /^no_reply$/i.test(cleaned)) return false;
  return !isOperationalNoise(cleaned);
}

function findLatestAssistantReplyFromTranscript(
  filePath: string,
  sinceMs: number,
  afterSize = 0
): string {
  const raw = readTranscriptChunk(filePath, afterSize);
  if (!raw.trim()) return '';

  const lines = raw.split(/\r?\n/).filter(Boolean);
  let latest = '';

  for (const line of lines) {
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const role = extractRole(entry);
    if (role !== 'assistant' && role !== 'agent' && !inferAssistantRole(entry)) continue;

    const ts = parseEntryTimestamp(entry);
    if (ts && ts < sinceMs - 3000) continue;

    const text = extractMessageText(entry);
    if (isUsefulAgentReply(text)) {
      latest = text;
    }
  }

  return latest;
}

async function waitForAssistantReply(
  agentId: string,
  sinceMs: number,
  before: TranscriptSnapshot,
  timeoutMs = HISTORY_POLL_TIMEOUT_MS
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const currentPath of listTranscriptPaths(agentId)) {
      const offset = before.sizes?.[currentPath] ?? (currentPath === before.filePath ? before.size : 0);
      const reply = findLatestAssistantReplyFromTranscript(currentPath, sinceMs, offset);
      if (reply) return reply;
    }
    await new Promise(resolve => setTimeout(resolve, HISTORY_POLL_INTERVAL_MS));
  }

  return '';
}

/**
 * 在本地创建一个 OpenClaw Agent，以 soulContent 作为 SOUL.md。
 * 返回 OpenClaw 分配的 agentId（即 agents add 命令返回的 JSON 中的 id）。
 */
export async function createAgent(
  name: string,
  soulContent: string,
  slug: string
): Promise<string> {
  // 1. 准备工作目录
  const workspaceDir = path.join(CLONES_DIR, slug);
  fs.mkdirSync(workspaceDir, { recursive: true });

  // 2. 写入 SOUL.md
  fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), soulContent, 'utf-8');

  // 3. 调用 CLI 创建 Agent
  // 用 slug 作为 Agent ID（避免中文名被 CLI 解析为保留字 main）
  const safeSlug = slug.replace(/"/g, '\\"');
  const safeDir = workspaceDir.replace(/"/g, '\\"');
  const cmd = `openclaw agents add "${safeSlug}" --workspace "${safeDir}" --non-interactive --json`;

  const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });

  // 4. 解析返回的 JSON，取 agentId
  const output = stdout.trim();
  try {
    const result = JSON.parse(output);
    const agentId = result.id || result.agentId || result.name;
    if (!agentId) throw new Error(`openclaw agents add 未返回 agentId。输出: ${output}`);
    return String(agentId);
  } catch {
    // 如果输出不是 JSON，说明命令可能用 slug 作为 ID
    if (stderr) throw new Error(`openclaw agents add 失败: ${stderr}`);
    // 降级：以 slug 作为 agentId
    return slug;
  }
}

/**
 * 向指定的 OpenClaw Agent 发送消息，等待响应并返回结果文本。
 * timeout 默认 2 分钟。
 *
 * agentId 为空时省略 --agent；"main" 是 OpenClaw 的真实默认 Agent ID，必须显式传入。
 */
export async function sendMessage(
  openclawAgentId: string,
  message: string,
  timeoutMs = 120000
): Promise<string> {
  const agentId = String(openclawAgentId || '').trim();
  const args = ['agent', '-m', message.replace(/\r?\n/g, ' ')];
  if (agentId) {
    args.push('--agent', agentId);
  }

  console.log(`[openclawCli] exec: openclaw ${args.map(arg => JSON.stringify(arg)).join(' ')}`);

  const startedAt = Date.now();
  const beforeTranscript = getTranscriptSnapshot(agentId || 'main');
  let child: any = null;
  const cliDone = new Promise<CliResult>(resolve => {
    child = execFile('openclaw', args, {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: CLI_MAX_BUFFER
    }, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });

  const transcriptDone = waitForAssistantReply(
    agentId || 'main',
    startedAt,
    beforeTranscript,
    Math.min(timeoutMs, HISTORY_POLL_TIMEOUT_MS)
  );

  try {
    const first = await Promise.race([
      transcriptDone.then(reply => ({ kind: 'transcript' as const, reply })),
      cliDone.then(result => ({ kind: 'cli' as const, result }))
    ]);

    if (first.kind === 'transcript' && first.reply) {
      const elapsed = Date.now() - startedAt;
      console.log(`[openclawCli] transcript reply captured in ${elapsed}ms`);
      if (child && !child.killed && child.exitCode === null) {
        child.kill();
      }
      return first.reply;
    }

    const cliResult = first.kind === 'cli' ? first.result : await cliDone;
    const { stdout, stderr, error } = cliResult;

    const transcriptReply = await waitForAssistantReply(agentId || 'main', startedAt, beforeTranscript);
    if (transcriptReply) return transcriptReply;

    const output = cleanCliOutput(stdout);
    if (isUsefulAgentReply(output)) return output;

    const warning = cleanCliOutput(stderr);
    if (warning) {
      throw new Error(warning);
    }

    if (error) {
      throw error;
    }

    throw new Error('未能从 OpenClaw CLI stdout 或本地会话 transcript 提取 Agent 回复');
  } catch (error: any) {
    const transcriptReply = await waitForAssistantReply(agentId || 'main', startedAt, beforeTranscript);
    if (transcriptReply) return transcriptReply;

    const output = cleanCliOutput(error?.stdout);
    if (isUsefulAgentReply(output)) {
      return output;
    }

    const details =
      cleanCliOutput(error?.stderr) ||
      cleanCliOutput(error?.message) ||
      'OpenClaw CLI 执行失败';

    throw new Error(details);
  }
}

/**
 * 删除本地 Agent 的工作目录（软删除时调用）
 */
export function removeAgentWorkspace(slug: string): void {
  const workspaceDir = path.join(CLONES_DIR, slug);
  if (fs.existsSync(workspaceDir)) {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
}
