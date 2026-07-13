export interface LogContext {
  [key: string]: unknown
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

let globalLevel: LogLevel = 'debug'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[globalLevel]
}

/**
 * getLogger
 *
 * Logger 底层实现，直接调用 console — 本文件豁免 no-console 规则。
 * 生产环境通过 setLogLevel 控制日志级别，默认 debug 输出全部。
 */
/* eslint-disable no-console */
export function getLogger() {
  return {
    debug(message: string, context?: LogContext): void {
      if (shouldLog('debug')) {
        console.debug(`[DEBUG] ${message}`, context ?? {})
      }
    },
    info(message: string, context?: LogContext): void {
      if (shouldLog('info')) {
        console.log(`[INFO] ${message}`, context ?? {})
      }
    },
    warn(message: string, context?: LogContext): void {
      if (shouldLog('warn')) {
        console.warn(`[WARN] ${message}`, context ?? {})
      }
    },
    error(message: string, context?: LogContext): void {
      if (shouldLog('error')) {
        console.error(`[ERROR] ${message}`, context ?? {})
      }
    },
  }
}

/**
 * setLogLevel
 * @param level
 * @returns void
 */
export function setLogLevel(level: LogLevel): void {
  globalLevel = level
}
