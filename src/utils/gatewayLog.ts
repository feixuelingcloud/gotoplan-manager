/**
 * 尽量让日志出现在 OpenClaw「网关日志」或宿主聚合日志中。
 * 许多环境下插件进程的 console.* 不会写入 gateway 的 *.log 文件。
 */

export function emitGatewayLog(
  api: any,
  scope: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  const line = `[gotoplan-manager][${scope}] ${message}`;

  const emitConsole = () => {
    if (level === 'warn') console.warn(line);
    else if (level === 'error') console.error(line);
    else {
      console.log(line);
      try {
        console.info(line);
      } catch {
        /* ignore */
      }
    }
  };

  emitConsole();

  try {
    if (typeof process?.stderr?.write === 'function') {
      process.stderr.write(`${line}\n`);
    }
  } catch {
    /* ignore */
  }

  const safeCall = (fn: unknown, args: unknown[]) => {
    if (typeof fn !== 'function') return;
    try {
      (fn as (...a: unknown[]) => void)(...args);
    } catch {
      /* ignore */
    }
  };

  safeCall(api?.log, [level, line]);
  safeCall(api?.logger?.[level], [line]);
  safeCall(api?.logger?.log, [level, line]);
  safeCall(api?.logger?.info, [line]);
  safeCall(api?.diagnostics?.emit, [{ level, message: line, source: 'gotoplan-manager' }]);
  safeCall(api?.gateway?.log, [level, line]);
}
