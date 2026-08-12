/**
 * @module debugToolkit
 * @description 统一的 Debug 日志工具类。
 *
 * 核心能力：
 * 1. **命名空间隔离**：每个模块用 `createDebugLogger('HotSector')` 创建独立实例，
 *    日志自动带 `[HotSector]` 前缀，方便控制台筛选。
 * 2. **日志收集**：所有日志写入 `window.__debugLogs` 环形缓冲区（默认 500 条），
 *    支持在控制台用 `getDebugLogs('HotSector')` 快速检索。
 * 3. **计时器**：`time(label)` / `timeEnd(label)` 测量异步耗时（如并发采集）。
 * 4. **按命名空间开关**：`enableNamespace()` / `disableNamespace()` 精确控制。
 * 5. **生产环境静默**：`setEnabled(false)` 一键关闭所有 debug 输出。
 *
 * @example
 * ```ts
 * const debug = createDebugLogger('CollectBadge')
 * debug.log('handleCollectAll 开始', { symbols: ['000001.SZ'] })
 * // → console: [CollectBadge] handleCollectAll 开始 { symbols: ['000001.SZ'] }
 *
 * debug.time('collect-all')
 * await fetchAll()
 * debug.timeEnd('collect-all')  // → [CollectBadge] collect-all: 1234ms
 *
 * // 控制台检索：
 * getDebugLogs('CollectBadge')  // → 返回该命名空间的所有日志
 * ```
 */

/* eslint-disable no-console */

// ──────────────────────────────────────────────
// 类型定义
// ──────────────────────────────────────────────

export type DebugLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export interface DebugLogEntry {
  /** 命名空间，如 'HotSector'、'CollectBadge' */
  namespace: string
  /** 日志级别 */
  level: DebugLevel
  /** 时间戳（ms） */
  ts: number
  /** 日志消息 */
  message: string
  /** 附加上下文对象 */
  context?: unknown
  /** 计时器标记（仅 timeEnd 条目有值） */
  durationMs?: number
}

export interface DebugLogger {
  log(message: string, context?: unknown): void
  info(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
  error(message: string, context?: unknown): void
  debug(message: string, context?: unknown): void
  /** 启动计时器 */
  time(label: string): void
  /** 结束计时器并输出耗时 */
  timeEnd(label: string): void
  /** 当前命名空间（用于动态判断） */
  readonly namespace: string
}

// ──────────────────────────────────────────────
// 内部状态
// ──────────────────────────────────────────────

/** 全局开关，false 时所有 debug 日志静默 */
let globalEnabled = true

/** 命名空间黑名单（被禁用的命名空间不输出） */
const disabledNamespaces = new Set<string>()

/** 环形缓冲区最大容量 */
const MAX_LOGS = 500

/** 日志缓冲区（挂在 window 上方便控制台检索） */
interface WindowWithDebug extends Window {
  __debugLogs?: DebugLogEntry[]
}
const win = typeof window !== 'undefined' ? (window as WindowWithDebug) : undefined

if (win && !win.__debugLogs) {
  win.__debugLogs = []
}

/** 计时器存储：key = `${namespace}:${label}` */
const timers = new Map<string, number>()

// ──────────────────────────────────────────────
// 核心实现
// ──────────────────────────────────────────────

/**
 * 将日志写入环形缓冲区
 */
function pushLog(entry: DebugLogEntry): void {
  if (!win?.__debugLogs) return
  const logs = win.__debugLogs
  if (logs.length >= MAX_LOGS) {
    logs.shift() // 超出容量，丢弃最旧的
  }
  logs.push(entry)
}

/**
 * 格式化上下文对象为可读字符串
 */
function formatContext(context: unknown): string {
  if (context === undefined || context === null) return ''
  if (typeof context === 'string') return context
  try {
    return JSON.stringify(context)
  } catch {
    if (typeof context === 'object') {
      return Object.prototype.toString.call(context)
    }
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- fallback after JSON.stringify failure
    return String(context)
  }
}

/**
 * 判断指定命名空间是否应该输出日志
 */
function shouldOutput(namespace: string): boolean {
  if (!globalEnabled) return false
  if (disabledNamespaces.has(namespace)) return false
  return true
}

/**
 * 输出日志到 console 并写入缓冲区
 */
function emit(namespace: string, level: DebugLevel, message: string, context?: unknown): void {
  const ts = Date.now()
  const ctxStr = formatContext(context)
  const prefix = `[${namespace}]`

  // 写入缓冲区（即使全局关闭也记录，方便事后检索）
  pushLog({ namespace, level, ts, message, context })

  // 控制台输出（受开关控制）
  if (!shouldOutput(namespace)) return

  const logFn = console[level] ?? console.log
  if (ctxStr) {
    logFn(`${prefix} ${message}`, context ?? '')
  } else {
    logFn(`${prefix} ${message}`)
  }
}

// ──────────────────────────────────────────────
// 公开 API
// ──────────────────────────────────────────────

/**
 * 创建带命名空间的 Debug Logger。
 *
 * @param namespace - 命名空间，如 'HotSector'、'CollectBadge'
 * @returns DebugLogger 实例
 *
 * @example
 * ```ts
 * const debug = createDebugLogger('HotSector')
 * debug.log('加入板块', { code: '半导体' })
 * // → [HotSector] 加入板块 { code: '半导体' }
 * ```
 */
export function createDebugLogger(namespace: string): DebugLogger {
  return {
    namespace,
    log(message: string, context?: unknown) {
      emit(namespace, 'log', message, context)
    },
    info(message: string, context?: unknown) {
      emit(namespace, 'info', message, context)
    },
    warn(message: string, context?: unknown) {
      emit(namespace, 'warn', message, context)
    },
    error(message: string, context?: unknown) {
      emit(namespace, 'error', message, context)
    },
    debug(message: string, context?: unknown) {
      emit(namespace, 'debug', message, context)
    },
    time(label: string) {
      const key = `${namespace}:${label}`
      timers.set(key, Date.now())
    },
    timeEnd(label: string) {
      const key = `${namespace}:${label}`
      const start = timers.get(key)
      if (start === undefined) {
        emit(namespace, 'warn', `timeEnd("${label}") 未找到对应 time() 调用`)
        return
      }
      timers.delete(key)
      const durationMs = Date.now() - start
      pushLog({ namespace, level: 'log', ts: Date.now(), message: `${label}: ${durationMs}ms`, durationMs })
      if (shouldOutput(namespace)) {
        console.log(`[${namespace}] ${label}: ${durationMs}ms`)
      }
    },
  }
}

// ──────────────────────────────────────────────
// 全局控制函数
// ──────────────────────────────────────────────

/**
 * 全局开关。设为 false 后所有 debug 日志停止控制台输出（缓冲区仍记录）。
 * @param enabled - 是否启用
 */
export function setDebugEnabled(enabled: boolean): void {
  globalEnabled = enabled
}

/**
 * 禁用指定命名空间的控制台输出。
 * @param namespace - 命名空间
 */
export function disableDebugNamespace(namespace: string): void {
  disabledNamespaces.add(namespace)
}

/**
 * 重新启用指定命名空间。
 * @param namespace - 命名空间
 */
export function enableDebugNamespace(namespace: string): void {
  disabledNamespaces.delete(namespace)
}

/**
 * 从缓冲区检索日志。
 *
 * @param namespace - 可选，传则只返回该命名空间的日志；不传则返回全部
 * @param level - 可选，按级别过滤
 * @returns 日志条目数组
 *
 * @example
 * ```ts
 * // 在浏览器控制台执行：
 * getDebugLogs('CollectBadge')  // 获取采集相关日志
 * getDebugLogs('HotSector', 'warn')  // 获取热门板块的 warn 日志
 * ```
 */
export function getDebugLogs(namespace?: string, level?: DebugLevel): DebugLogEntry[] {
  const logs = win?.__debugLogs ?? []
  return logs.filter((entry) => {
    if ((namespace ?? '') !== '' && entry.namespace !== namespace) return false
    if (level && entry.level !== level) return false
    return true
  })
}

/**
 * 清空日志缓冲区。
 */
export function clearDebugLogs(): void {
  if (win?.__debugLogs) {
    win.__debugLogs.length = 0
  }
}

/**
 * 将日志缓冲区导出为可读的文本格式（方便复制分享）。
 *
 * @param namespace - 可选，仅导出该命名空间
 * @returns 格式化的日志文本
 */
export function exportDebugLogs(namespace?: string): string {
  const logs = getDebugLogs(namespace)
  return logs
    .map((entry) => {
      const time = new Date(entry.ts).toLocaleTimeString('zh-CN', { hour12: false })
      const ctx = formatContext(entry.context)
      const dur = (entry.durationMs ?? 0) !== 0 ? ` (${entry.durationMs}ms)` : ''
      return `[${time}] [${entry.namespace}] [${entry.level.toUpperCase()}] ${entry.message}${dur}${ctx ? ' ' + ctx : ''}`
    })
    .join('\n')
}
// 控制台全局暴露（浏览器环境直接 window.getDebugLogs 可用）
if (typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>
  if (w.getDebugLogs === undefined) w.getDebugLogs = getDebugLogs
  if (w.exportDebugLogs === undefined) w.exportDebugLogs = exportDebugLogs
  if (w.clearDebugLogs === undefined) w.clearDebugLogs = clearDebugLogs
  if (w.setDebugEnabled === undefined) w.setDebugEnabled = setDebugEnabled
  if (w.enableDebugNamespace === undefined) w.enableDebugNamespace = enableDebugNamespace
  if (w.disableDebugNamespace === undefined) w.disableDebugNamespace = disableDebugNamespace
  if (w.createDebugLogger === undefined) w.createDebugLogger = createDebugLogger
  if (w.__debugLogs === undefined) w.__debugLogs = []
}
