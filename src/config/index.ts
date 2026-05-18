/**
 * 插件配置管理
 * API 地址固定，用户只需配置 API Key
 */

export interface PluginConfig {
  apiBase: string;          // 固定值
  apiKey: string;           // 用户配置
  timeout: number;          // 固定值
  notionApiKey: string;     // Notion Integration Token
  notionParentPageId: string; // Notion "2026工作计划" 页面 ID
  notionEnabled: boolean;   // 是否启用 Notion 同步
  feishuAppId: string;      // 飞书应用 App ID
  feishuAppSecret: string;  // 飞书应用 App Secret
  feishuFolderToken: string; // 飞书云空间文件夹 token（可选）
  feishuEnabled: boolean;   // 是否启用飞书同步
  yuqueToken: string;       // 语雀个人访问令牌
  yuqueNamespace: string;   // 目标知识库，格式：用户名/知识库slug
  yuqueEnabled: boolean;    // 是否启用语雀同步
}

type PersistedConfig = Partial<PluginConfig> & {
  loadedAt?: string;
};

declare global {
  // OpenClaw may hot-reload plugins after local agent changes. In a hot reload,
  // api.pluginConfig can be temporarily empty, so keep the last good config in
  // the process to prevent background ping/clone polling from stopping.
  // eslint-disable-next-line no-var
  var __gotoplanConfig: PersistedConfig | undefined;
}

// 全局配置对象
export let CONFIG: PluginConfig = {
  // 固定的后端服务器地址
  apiBase: 'https://plan.lingcloudai.com/api',
  // API Key 由用户通过 OpenClaw 设置
  apiKey: '',
  timeout: 15000,
  // Notion 同步配置（默认关闭）
  notionApiKey: '',
  notionParentPageId: '',
  notionEnabled: false,
  // 飞书同步配置（默认关闭）
  feishuAppId: '',
  feishuAppSecret: '',
  feishuFolderToken: '',
  feishuEnabled: false,
  // 语雀同步配置（默认关闭）
  yuqueToken: '',
  yuqueNamespace: '',
  yuqueEnabled: false
};

function firstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return undefined;
}

/**
 * 从 OpenClaw 配置系统加载配置
 *
 * API Key 支持三种来源（按优先级）：
 * 1. pluginConfig.apiKey          ← openclaw.plugin.json / claw-hub.json schema key
 * 2. pluginConfig.AI_PLAN_API_KEY ← SKILL.md requires.config key
 * 3. process.env.AI_PLAN_API_KEY  ← 环境变量（OpenClaw 技能系统注入）
 *
 * API Base 支持来源（按优先级）：
 * 1. pluginConfig.apiBase         ← openclaw.plugin.json configSchema（推荐）
 * 2. pluginConfig.apiBaseUrl      ← 旧文档中的别名，兼容保留
 * 3. process.env.AI_PLAN_API_BASE ← 环境变量
 * 4. globalThis.__gotoplanConfig  ← 热重载时复用上一轮有效配置
 */
export function loadConfig(pluginConfig: any): void {
  const cachedConfig = globalThis.__gotoplanConfig || {};

  // ── API Key ──────────────────────────────────────────────────────────────
  const envApiKey = typeof process !== 'undefined' ? process.env?.AI_PLAN_API_KEY : undefined;
  const rawApiKey = firstNonEmpty(
    pluginConfig?.apiKey,
    pluginConfig?.AI_PLAN_API_KEY,
    envApiKey,
    cachedConfig.apiKey
  );

  if (rawApiKey) {
    CONFIG.apiKey = rawApiKey;
  } else {
    CONFIG.apiKey = '';
  }

  // ── API Base（允许用户覆盖后端地址，解决本地/远程数据库不一致问题）───────────
  const envApiBase = typeof process !== 'undefined' ? process.env?.AI_PLAN_API_BASE : undefined;
  const rawApiBase = firstNonEmpty(
    pluginConfig?.apiBase,
    pluginConfig?.apiBaseUrl,
    envApiBase,
    cachedConfig.apiBase
  );

  if (rawApiBase && String(rawApiBase).trim()) {
    CONFIG.apiBase = String(rawApiBase).trim().replace(/\/$/, ''); // 去掉末尾斜线
  }

  // ── Notion 配置 ──────────────────────────────────────────────────────────
  const notionApiKey = firstNonEmpty(
    pluginConfig?.notionApiKey,
    typeof process !== 'undefined' ? process.env?.NOTION_API_KEY : undefined,
    cachedConfig.notionApiKey
  );
  if (notionApiKey) CONFIG.notionApiKey = String(notionApiKey).trim();

  const notionParentPageId = firstNonEmpty(
    pluginConfig?.notionParentPageId,
    typeof process !== 'undefined' ? process.env?.NOTION_PARENT_PAGE_ID : undefined,
    cachedConfig.notionParentPageId
  );
  if (notionParentPageId) CONFIG.notionParentPageId = String(notionParentPageId).trim();

  const notionEnabledRaw = pluginConfig?.notionEnabled ??
    (typeof process !== 'undefined' ? process.env?.NOTION_ENABLED : undefined) ??
    cachedConfig.notionEnabled;
  if (notionEnabledRaw !== undefined && notionEnabledRaw !== null && notionEnabledRaw !== '') {
    CONFIG.notionEnabled = notionEnabledRaw === true || notionEnabledRaw === 'true' || notionEnabledRaw === '1';
  }

  // ── 飞书配置 ──────────────────────────────────────────────────────────────
  const feishuAppId = firstNonEmpty(
    pluginConfig?.feishuAppId,
    typeof process !== 'undefined' ? process.env?.FEISHU_APP_ID : undefined,
    cachedConfig.feishuAppId
  );
  if (feishuAppId) CONFIG.feishuAppId = String(feishuAppId).trim();

  const feishuAppSecret = firstNonEmpty(
    pluginConfig?.feishuAppSecret,
    typeof process !== 'undefined' ? process.env?.FEISHU_APP_SECRET : undefined,
    cachedConfig.feishuAppSecret
  );
  if (feishuAppSecret) CONFIG.feishuAppSecret = String(feishuAppSecret).trim();

  const feishuFolderToken = firstNonEmpty(
    pluginConfig?.feishuFolderToken,
    typeof process !== 'undefined' ? process.env?.FEISHU_FOLDER_TOKEN : undefined,
    cachedConfig.feishuFolderToken
  );
  if (feishuFolderToken) CONFIG.feishuFolderToken = String(feishuFolderToken).trim();

  const feishuEnabledRaw = pluginConfig?.feishuEnabled ??
    (typeof process !== 'undefined' ? process.env?.FEISHU_ENABLED : undefined) ??
    cachedConfig.feishuEnabled;
  if (feishuEnabledRaw !== undefined && feishuEnabledRaw !== null && feishuEnabledRaw !== '') {
    CONFIG.feishuEnabled = feishuEnabledRaw === true || feishuEnabledRaw === 'true' || feishuEnabledRaw === '1';
  }

  // ── 语雀配置 ──────────────────────────────────────────────────────────────
  const yuqueToken = firstNonEmpty(
    pluginConfig?.yuqueToken,
    typeof process !== 'undefined' ? process.env?.YUQUE_TOKEN : undefined,
    cachedConfig.yuqueToken
  );
  if (yuqueToken) CONFIG.yuqueToken = String(yuqueToken).trim();

  const yuqueNamespace = firstNonEmpty(
    pluginConfig?.yuqueNamespace,
    typeof process !== 'undefined' ? process.env?.YUQUE_NAMESPACE : undefined,
    cachedConfig.yuqueNamespace
  );
  if (yuqueNamespace) CONFIG.yuqueNamespace = String(yuqueNamespace).trim();

  const yuqueEnabledRaw = pluginConfig?.yuqueEnabled ??
    (typeof process !== 'undefined' ? process.env?.YUQUE_ENABLED : undefined) ??
    cachedConfig.yuqueEnabled;
  if (yuqueEnabledRaw !== undefined && yuqueEnabledRaw !== null && yuqueEnabledRaw !== '') {
    CONFIG.yuqueEnabled = yuqueEnabledRaw === true || yuqueEnabledRaw === 'true' || yuqueEnabledRaw === '1';
  }

  const keySource = firstNonEmpty(pluginConfig?.apiKey)
    ? 'pluginConfig.apiKey'
    : firstNonEmpty(pluginConfig?.AI_PLAN_API_KEY)
      ? 'pluginConfig.AI_PLAN_API_KEY'
      : firstNonEmpty(envApiKey)
        ? 'process.env.AI_PLAN_API_KEY'
        : firstNonEmpty(cachedConfig.apiKey)
          ? 'globalThis.__gotoplanConfig.apiKey'
        : 'none';

  globalThis.__gotoplanConfig = {
    ...CONFIG,
    loadedAt: new Date().toISOString()
  };

  console.log('✅ Configuration loaded:', {
    apiBase: CONFIG.apiBase,
    hasApiKey: !!CONFIG.apiKey,
    apiKeyLength: CONFIG.apiKey.length,
    keySource,
    apiBaseOverridden: !!rawApiBase,
    timeout: CONFIG.timeout,
    notionEnabled: CONFIG.notionEnabled,
    hasNotionApiKey: !!CONFIG.notionApiKey,
    hasNotionParentPageId: !!CONFIG.notionParentPageId,
    feishuEnabled: CONFIG.feishuEnabled,
    hasFeishuAppId: !!CONFIG.feishuAppId,
    hasFeishuAppSecret: !!CONFIG.feishuAppSecret,
    hasFeishuFolderToken: !!CONFIG.feishuFolderToken,
    yuqueEnabled: CONFIG.yuqueEnabled,
    hasYuqueToken: !!CONFIG.yuqueToken,
    hasYuqueNamespace: !!CONFIG.yuqueNamespace
  });
}

/**
 * 验证配置
 */
export function validateConfig(): { valid: boolean; message?: string } {
  if (!CONFIG.apiKey) {
    return {
      valid: false,
      message: '🔑 请先配置 API Key。\n对我说:"设置计划管理 API Key 为 your_key_here"'
    };
  }

  return { valid: true };
}
