/**
 * 日志工具
 *
 * 简单的分级日志，输出到 console 和文件
 * 日志文件位置：userData/logs/electron-main.log
 */

import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL: LogLevel = (process.env.ELECTRON_LOG_LEVEL as LogLevel) || 'info'

let logStream: fs.WriteStream | null = null

function getLogStream(): fs.WriteStream | null {
  if (logStream) return logStream
  try {
    const logDir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(logDir, { recursive: true })
    const logFile = path.join(logDir, 'electron-main.log')
    logStream = fs.createWriteStream(logFile, { flags: 'a' })
    return logStream
  } catch {
    return null
  }
}

function formatLog(level: LogLevel, module: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString()
  const dataStr = data ? ' ' + JSON.stringify(data) : ''
  return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${dataStr}`
}

export function getLogger(module: string) {
  return {
    debug(message: string, data?: unknown): void {
      if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.debug) {
        const line = formatLog('debug', module, message, data)
        console.debug(line)
        getLogStream()?.write(line + '\n')
      }
    },
    info(message: string, data?: unknown): void {
      if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.info) {
        const line = formatLog('info', module, message, data)
        console.info(line)
        getLogStream()?.write(line + '\n')
      }
    },
    warn(message: string, data?: unknown): void {
      if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.warn) {
        const line = formatLog('warn', module, message, data)
        console.warn(line)
        getLogStream()?.write(line + '\n')
      }
    },
    error(message: string, data?: unknown): void {
      if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.error) {
        const line = formatLog('error', module, message, data)
        console.error(line)
        getLogStream()?.write(line + '\n')
      }
    },
  }
}
