/**
 * API HTTP 客户端
 * 封装与后端 API 的通信
 */

import https from 'https';
import http from 'http';
import { CONFIG } from '../config/index.js';
import { ApiError } from '../utils/errors.js';

interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  suggestion?: string;
}

/**
 * 发送 HTTP 请求
 */
async function request<T = any>(method: string, path: string, body: any = null): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.apiBase.replace(/\/$/, '') + path);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${CONFIG.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'OpenClaw-Plugin/1.0'
      },
      timeout: CONFIG.timeout
    };

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed: ApiResponse<T> = JSON.parse(data);

          // 检查 API 响应格式
          if (!parsed.success) {
            const error = new ApiError(
              parsed.message || 'API request failed',
              parsed.code || 'UNKNOWN_ERROR',
              parsed.suggestion || 'Please check your input and try again',
              res.statusCode || 500
            );
            reject(error);
            return;
          }

          const hasData = Object.prototype.hasOwnProperty.call(parsed, 'data');
          resolve((hasData ? parsed.data : parsed) as T);
        } catch (parseError: any) {
          const preview = data.slice(0, 300).replace(/\n/g, ' ');
          reject(new Error(
            `Failed to parse API response (HTTP ${res.statusCode}): ${parseError.message}\n` +
            `响应内容预览: ${preview || '(空)'}`
          ));
        }
      });
    });

    req.on('error', (error: any) => {
      console.error('❌ API Request Error:', error.message);
      reject(new Error(`Network error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${CONFIG.timeout}ms`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * GET 请求
 */
export async function get<T = any>(path: string): Promise<T> {
  return request<T>('GET', path);
}

/**
 * POST 请求
 */
export async function post<T = any>(path: string, body: any): Promise<T> {
  return request<T>('POST', path, body);
}

/**
 * PUT 请求
 */
export async function put<T = any>(path: string, body: any): Promise<T> {
  return request<T>('PUT', path, body);
}

/**
 * PATCH 请求
 */
export async function patch<T = any>(path: string, body: any): Promise<T> {
  return request<T>('PATCH', path, body);
}

/**
 * DELETE 请求
 */
export async function del<T = any>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}
