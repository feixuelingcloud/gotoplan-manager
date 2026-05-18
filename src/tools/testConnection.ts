/**
 * 连接诊断工具
 * 帮助用户快速排查 API Key 和后端连接问题
 */

import { Type } from '../utils/schema.js';
import { CONFIG } from '../config/index.js';
import { get } from '../client/apiClient.js';

export const testConnectionTool = {
  name: 'test_connection',
  description: 'Test the connection to the GotoPlan backend and verify the API Key. Use this tool when users report "Token无效", "连接失败" or similar errors to diagnose the issue.',
  parameters: Type.Object({}),

  async execute(_id: string, _params: Record<string, never>) {
    const result: string[] = [];

    result.push('🔍 **连接诊断报告**');
    result.push('');

    // 1. 检查 API Key 是否已加载
    result.push('**① API Key 状态**');
    if (!CONFIG.apiKey) {
      result.push('  ❌ API Key 未加载（空）');
      result.push('  → 请在 OpenClaw 插件设置中填写 API Key');
      result.push('  → 在系统"个人设置 → OpenClaw API Key"页面生成并复制 Key');
    } else {
      const masked = `${CONFIG.apiKey.substring(0, 6)}...${CONFIG.apiKey.substring(CONFIG.apiKey.length - 4)}`;
      result.push(`  ✅ API Key 已加载: ${masked} (长度: ${CONFIG.apiKey.length})`);
    }
    result.push('');

    // 2. 显示后端地址
    result.push('**② 后端地址**');
    result.push(`  📡 当前地址: ${CONFIG.apiBase}`);
    if (CONFIG.apiBase.includes('localhost')) {
      result.push('  ℹ️  使用本地后端（请确保后端服务已启动）');
    } else {
      result.push('  ℹ️  使用云端后端');
    }
    result.push('');

    // 3. 尝试连接测试（计划接口）
    result.push('**③ 连接测试 — 计划接口**');
    if (!CONFIG.apiKey) {
      result.push('  ⏭️  跳过（API Key 未设置）');
    } else {
      try {
        await get('/openclaw/plans?date_range=week&_limit=1');
        result.push('  ✅ 计划接口正常');
      } catch (error: any) {
        const msg = error.message || String(error);
        const code = error.code || '';
        const status = error.statusCode ? ` (HTTP ${error.statusCode})` : '';

        if (msg.includes('Invalid or expired token') || msg.includes('Token is empty') || code === 'INVALID_TOKEN') {
          result.push('  ❌ API Key 无效');
          result.push('');
          result.push('  **可能原因：**');
          result.push(`  1. 你的 API Key 是在「${CONFIG.apiBase.includes('localhost') ? '本地' : '其他'}」后端生成的`);
          result.push(`     但插件正在连接「${CONFIG.apiBase}」`);
          result.push('  2. API Key 已被禁用或删除');
          result.push('');
          result.push('  **解决方法：**');
          if (!CONFIG.apiBase.includes('localhost')) {
            result.push('  → 方法A（推荐）: 在 OpenClaw 插件设置中，将"API 地址"改为:');
            result.push('    `http://localhost:4000/api`（本地测试）');
          }
          result.push('  → 方法B: 重新生成 API Key，确保在与插件连接的同一个系统里生成');
        } else if (msg.includes('Network error') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
          result.push('  ❌ 网络连接失败');
          result.push(`  → 后端服务 ${CONFIG.apiBase} 无法访问`);
          if (CONFIG.apiBase.includes('localhost')) {
            result.push('  → 请确认后端已启动：双击运行 "启动后端.bat"');
          } else {
            result.push('  → 请检查网络连接，或将 API 地址改为本地地址');
          }
        } else {
          result.push(`  ❌ 错误${status}: ${msg}`);
        }
      }
    }
    result.push('');

    // 4. 专项：汇报接口测试
    result.push('**④ 连接测试 — 汇报接口 (get_boss_reports)**');
    if (!CONFIG.apiKey) {
      result.push('  ⏭️  跳过（API Key 未设置）');
    } else {
      try {
        await get('/openclaw/reports?status=pending_review&limit=1');
        result.push('  ✅ 汇报接口正常');
      } catch (error: any) {
        const status = error.statusCode ?? '?';
        const code = error.code || 'UNKNOWN';
        const msg = error.message || String(error);
        result.push(`  ❌ 汇报接口失败 — HTTP ${status}  |  错误码: ${code}`);
        result.push(`  → ${msg}`);
        if (status === 404) {
          result.push('  ⚠️  404 表示后端尚未实现 /openclaw/reports 接口，需要升级后端版本');
        } else if (status === 401 || status === 403) {
          result.push('  ⚠️  权限不足，当前 API Key 可能没有查看汇报的权限');
        } else if (status === 500) {
          result.push('  ⚠️  后端内部错误，请查看后端日志');
        }
      }
    }

    result.push('');
    result.push('─────────────────────────────────');
    result.push('💡 **快速修复**：在 OpenClaw 插件设置里：');
    result.push('   - **API Key**: 从系统"个人设置"页面生成后粘贴');
    result.push('   - **API 地址**: 本地测试填 `http://localhost:4000/api`');
    result.push('');
    result.push('📋 如汇报接口返回 404，请升级后端到最新版本（支持 AI 员工克隆功能的版本）');

    const output = result.join('\n');

    return {
      success: true,
      apiBase: CONFIG.apiBase,
      hasApiKey: !!CONFIG.apiKey,
      output
    };
  }
};

