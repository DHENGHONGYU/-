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

export function getLogger() {
  return {
    debug(message: string, context?: LogContext): void {
      if (shouldLog('debug')) {
        console.debug(`[DEBUG] ${message}`, context ?? '')
      }
    },
    info(message: string, context?: LogContext): void {
      if (shouldLog('info')) {
        console.log(`[INFO] ${message}`, context ?? '')
      }
    },
    warn(message: string, context?: LogContext): void {
      if (shouldLog('warn')) {
        console.warn(`[WARN] ${message}`, context ?? '')
      }
    },
    error(message: string, context?: LogContext): void {
      if (shouldLog('error')) {
        console.error(`[ERROR] ${message}`, context ?? '')
      }
    },
  }
}

export function setLogLevel(level: LogLevel): void {
  globalLevel = level
}
