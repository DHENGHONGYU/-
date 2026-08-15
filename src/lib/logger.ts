/**
 * @doc [V9-DOC-FRONT-037]
 */
export interface LogContext {
  [key: string]: unknown
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFormat = 'pretty' | 'json'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LOG_LEVEL_TAG: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
}

let globalLevel: LogLevel = 'debug'
// 浏览器环境无 process 全局，必须 typeof 守卫，否则模块顶层抛 ReferenceError 导致整应用白屏（E2E P0）
let globalFormat: LogFormat =
  (typeof process !== 'undefined' && process.env.LOG_FORMAT as LogFormat) || 'pretty'

const LOG_FORMAT_SYMBOLS: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[globalLevel]
}

function formatJson(level: LogLevel, message: string, context?: LogContext): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level: LOG_LEVEL_TAG[level],
    message,
  }
  if (context && Object.keys(context).length > 0) {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) {
        entry[key] = value
      }
    }
  }
  try {
    return JSON.stringify(entry)
  } catch {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_TAG[level],
      message,
      _parseError: true,
    })
  }
}

function formatPretty(level: LogLevel, message: string, context?: LogContext): string {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false })
  const symbol = LOG_FORMAT_SYMBOLS[level]
  if (context && Object.keys(context).length > 0) {
    return `${symbol} [${timeStr}] [${LOG_LEVEL_TAG[level]}] ${message} ${JSON.stringify(context)}`
  }
  return `${symbol} [${timeStr}] [${LOG_LEVEL_TAG[level]}] ${message}`
}

/* eslint-disable no-console */
export function getLogger() {
  return {
    debug(message: string, context?: LogContext): void {
      if (shouldLog('debug')) {
        if (globalFormat === 'json') {
          console.debug(formatJson('debug', message, context))
        } else {
          console.debug(formatPretty('debug', message), context ?? {})
        }
      }
    },
    info(message: string, context?: LogContext): void {
      if (shouldLog('info')) {
        if (globalFormat === 'json') {
          console.log(formatJson('info', message, context))
        } else {
          console.log(formatPretty('info', message), context ?? {})
        }
      }
    },
    warn(message: string, context?: LogContext): void {
      if (shouldLog('warn')) {
        if (globalFormat === 'json') {
          console.warn(formatJson('warn', message, context))
        } else {
          console.warn(formatPretty('warn', message), context ?? {})
        }
      }
    },
    error(message: string, context?: LogContext): void {
      if (shouldLog('error')) {
        if (globalFormat === 'json') {
          console.error(formatJson('error', message, context))
        } else {
          console.error(formatPretty('error', message), context ?? {})
        }
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

/**
 * setLogFormat
 * @param format 'pretty'（默认，人可读）| 'json'（ELK 结构化日志）
 * @returns void
 */
export function setLogFormat(format: LogFormat): void {
  globalFormat = format
}

/**
 * getLogFormat
 * @returns 当前日志格式
 */
export function getLogFormat(): LogFormat {
  return globalFormat
}
