/**
 * @fileoverview 统一日志辅助工具
 *
 * 为核心 Service / Store 提供入口/出口/异常的统一日志记录能力：
 * - 记录入口参数（关键操作参数）
 * - 记录执行耗时（performance.now 高精度）
 * - 记录返回结果摘要（避免打印巨型对象）
 * - 记录异常信息（含堆栈与原 error 对象）
 *
 * 使用方式：
 *
 * ```ts
 * import { withLogging, logEntry, logExit, logException } from '@/lib/logHelpers'
 *
 * // 方式 1：高阶函数包装（推荐，自动捕获入口/出口/异常）
 * export const doWork = withLogging(
 *   'myService',
 *   'doWork',
 *   async (symbol: string, count: number) => { ... return result },
 *   { argsPick: ['symbol', 'count'], resultKeys: ['success', 'count'] }
 * )
 *
 * // 方式 2：手动调用（用于细粒度控制）
 * async function doWork(symbol: string) {
 *   const ctx = logEntry('myService', 'doWork', { symbol })
 *   try {
 *     const result = await fetch(...)
 *     logExit(ctx, { success: true, count: result.length })
 *     return result
 *   } catch (err) {
 *     logException(ctx, err)
 *     throw err
 *   }
 * }
 * ```
 *
 * @doc [V9-DOC-FRONT-037]
 */

import { getLogger, type LogContext, type LogLevel } from '@/lib/logger'
import { sendWriteEnvelope, queryList } from '@/data/dataLayerHelpers'
import { STORE_NAME } from '@/config/dbConfig'
import type { ResearchLog } from '@/data/types/types.signal'

// ============================================================
// 类型定义
// ============================================================

export interface LogScopeContext {
  /** 模块名（用于日志前缀，如 collectionPipeline / intentionPoolStore） */
  module: string
  /** 操作名（如 runSingleTrace / addItem） */
  operation: string
  /** 开始时间戳（performance.now()，高精度） */
  startTime: number
  /** 开始时间戳（Date.now()，用于人类可读） */
  startedAt: number
  /** 入口上下文（参数快照） */
  entryContext: LogContext
}

export interface WithLoggingOptions {
  /**
   * 从原函数 args 中挑选要记录的字段名（按位置参数名）。
   * 缺省：记录全部 args（通过 argsToString）。
   * 仅当 args 为对象时生效；基本类型 args 始终记录。
   */
  argsPick?: string[]
  /**
   * 从返回结果中挑选要记录的字段名（避免打印巨型对象）。
   * 缺省：仅记录 success / 类型 / 长度等摘要。
   */
  resultKeys?: string[]
  /** 日志级别（缺省 'info'；异常固定 'error'） */
  level?: 'debug' | 'info'
}

// ============================================================
// 内部辅助
// ============================================================

const LOGGER = getLogger()

/**
 * 安全序列化参数：限制深度与长度，避免循环引用与巨型输出。
 */
function safeStringify(value: unknown): string {
  if (value == null) return String(value)
  if (typeof value === 'string') return value.length > 200 ? `${value.slice(0, 200)}…` : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'function') return '[Function]'
  if (value instanceof Error) return value.message
  if (value instanceof Date) return value.toISOString()

  try {
    const seen = new WeakSet()
    const json = JSON.stringify(value, (_key, val) => {
      if (val != null && typeof val === 'object') {
        const obj = val as object
        if (seen.has(obj)) return '[Circular]'
        seen.add(obj)
      }
      // 函数/Symbol 等不可序列化值
      if (typeof val === 'function') return '[Function]'
      if (typeof val === 'symbol') return val.toString()
      if (val instanceof Error) return { name: val.name, message: val.message }
      return val as unknown
    }, 0)
    // JSON.stringify 运行时对 function/symbol 入参可能返回 undefined（TS 类型标注为 string，需放宽）
    const jsonSafe = json as string | undefined
    if (jsonSafe == null) return '[Unserializable]'
    return jsonSafe.length > 500 ? `${jsonSafe.slice(0, 500)}…(${jsonSafe.length}B)` : jsonSafe
  } catch {
    return '[Unserializable]'
  }
}

/**
 * 安全字符串化 unknown 值，避免 no-base-to-string ESLint 错误。
 */
function safeStr(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return val.toString()
  try { return JSON.stringify(val) } catch { return '[unserializable]' }
}

/**
 * 从函数参数列表构造入口上下文。
 * - 单个对象参数：按 argsPick 挑选字段
 * - 单个基本类型参数：记录为 arg0
 * - 多个参数：记录为 args 数组（每项尝试 safeStringify）
 */
function buildEntryContext(args: unknown[], opts?: WithLoggingOptions): LogContext {
  if (args.length === 0) return { args: '[]' }

  // 单个对象参数 + argsPick：挑选字段
  if (args.length === 1 && args[0] != null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const obj = args[0] as Record<string, unknown>
    if (opts?.argsPick && opts.argsPick.length > 0) {
      const picked: LogContext = {}
      for (const key of opts.argsPick) {
        if (key in obj) picked[key] = obj[key]
      }
      return picked
    }
    // 无 argsPick：挑选常见轻量字段（避免打印 payload 等巨型数据）
    const lightweight: LogContext = {}
    const safeKeys = ['symbol', 'symbols', 'dimensionCode', 'code', 'name', 'count', 'size', 'taskId', 'traceId', 'parentTaskId', 'query', 'status', 'group', 'id']
    for (const key of safeKeys) {
      if (key in obj) lightweight[key] = obj[key]
    }
    return Object.keys(lightweight).length > 0 ? lightweight : { arg0: safeStringify(obj) }
  }

  // 多个参数或基本类型参数
  if (args.length === 1) {
    return { arg0: safeStringify(args[0]) }
  }
  return { args: args.map((a) => safeStringify(a)) }
}

/**
 * 从返回结果构造摘要上下文。
 * - resultKeys 指定：仅记录指定字段
 * - 默认：记录 success / 类型 / 数组长度 等摘要
 */
function buildResultContext(result: unknown, opts?: WithLoggingOptions): LogContext {
  if (result == null) return { result: 'null' }

  // resultKeys 显式指定
  if (opts?.resultKeys && opts.resultKeys.length > 0 && typeof result === 'object') {
    const obj = result as Record<string, unknown>
    const picked: LogContext = {}
    for (const key of opts.resultKeys) {
      if (key in obj) picked[key] = obj[key]
    }
    return picked
  }

  // 数组：记录长度与首项摘要
  if (Array.isArray(result)) {
    return {
      resultType: 'array',
      length: result.length,
      first: result[0] != null ? safeStringify(result[0]) : undefined,
    }
  }

  // 对象：记录常用摘要字段
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>
    const summary: LogContext = {}
    const commonKeys = ['success', 'error', 'ok', 'count', 'length', 'total', 'symbol', 'source', 'latency', 'fallbackCount', 'status', 'dataVersion']
    for (const key of commonKeys) {
      if (key in obj) summary[key] = obj[key]
    }
    if (Object.keys(summary).length > 0) return summary
    return { resultType: typeof result, keys: Object.keys(obj).slice(0, 5).join(',') }
  }

  // 基本类型
  return { result: safeStringify(result) }
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 记录入口日志，返回 scope 上下文供后续 logExit / logException 使用。
 *
 * @param module 模块名（如 collectionPipeline）
 * @param operation 操作名（如 runSingleTrace）
 * @param entryContext 入口参数上下文
 * @returns LogScopeContext 用于后续 logExit / logException
 */
export function logEntry(
  module: string,
  operation: string,
  entryContext: LogContext = {},
): LogScopeContext {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const startedAt = Date.now()

  LOGGER.info(`[${module}] ${operation} 入口`, entryContext)

  return { module, operation, startTime, startedAt, entryContext }
}

/**
 * 记录出口日志（成功路径），包含耗时与返回结果摘要。
 *
 * @param ctx logEntry 返回的上下文
 * @param result 返回结果（用于构造摘要）
 * @param opts WithLoggingOptions（用于 resultKeys）
 */
export function logExit<T>(
  ctx: LogScopeContext,
  result?: T,
  opts?: WithLoggingOptions,
): void {
  const durationMs = typeof performance !== 'undefined'
    ? Math.round((performance.now() - ctx.startTime) * 100) / 100
    : Date.now() - ctx.startedAt

  // 仅在调用方显式传入 result（包括 null/undefined）时构造结果摘要；
  // 调用方未传 result（arguments.length === 1）时仅记录耗时。
  const hasResultArg = arguments.length >= 2
  const resultContext: LogContext = hasResultArg ? buildResultContext(result, opts) : {}
  const exitContext: LogContext = {
    ...resultContext,
    durationMs,
  }

  const level = opts?.level ?? 'info'
  if (level === 'debug') {
    LOGGER.debug(`[${ctx.module}] ${ctx.operation} 出口`, exitContext)
  } else {
    LOGGER.info(`[${ctx.module}] ${ctx.operation} 出口`, exitContext)
  }
}

/**
 * 记录异常日志（失败路径），包含耗时与异常信息。
 *
 * @param ctx logEntry 返回的上下文
 * @param err 异常对象
 */
export function logException(ctx: LogScopeContext, err: unknown): void {
  const durationMs = typeof performance !== 'undefined'
    ? Math.round((performance.now() - ctx.startTime) * 100) / 100
    : Date.now() - ctx.startedAt

  const errorContext: LogContext = {
    ...ctx.entryContext,
    durationMs,
    error: err instanceof Error ? err.message : String(err),
    errorName: err instanceof Error ? err.name : typeof err,
  }
  if (err instanceof Error && err.stack != null) {
    errorContext.stack = err.stack
  }

  LOGGER.error(`[${ctx.module}] ${ctx.operation} 异常`, errorContext)
}

/**
 * 高阶函数：包装异步函数，自动记录入口/出口/异常。
 *
 * @param module 模块名
 * @param operation 操作名
 * @param fn 被包装的异步函数
 * @param opts 日志选项
 *
 * @example
 * ```ts
 * export const fetchStockBasic = withLogging(
 *   'fetcherService',
 *   'fetchStockBasic',
 *   async (symbol: string) => { ... },
 *   { resultKeys: ['success', 'error', 'dataVersion'] }
 * )
 * ```
 */
export function withLogging<A extends unknown[], R>(
  module: string,
  operation: string,
  fn: (...args: A) => Promise<R>,
  opts?: WithLoggingOptions,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const entryContext = buildEntryContext(args, opts)
    const ctx = logEntry(module, operation, entryContext)
    try {
      const result = await fn(...args)
      logExit(ctx, result, opts)
      return result
    } catch (err) {
      logException(ctx, err)
      throw err
    }
  }
}

/**
 * 高阶函数：包装同步函数，自动记录入口/出口/异常。
 */
export function withLoggingSync<A extends unknown[], R>(
  module: string,
  operation: string,
  fn: (...args: A) => R,
  opts?: WithLoggingOptions,
): (...args: A) => R {
  return (...args: A): R => {
    const entryContext = buildEntryContext(args, opts)
    const ctx = logEntry(module, operation, entryContext)
    try {
      const result = fn(...args)
      logExit(ctx, result, opts)
      return result
    } catch (err) {
      logException(ctx, err)
      throw err
    }
  }
}

// ============================================================
// 分支日志工具（2026-08-09 从 branchLogger.ts 合并）
// 封装三类常见日志模式，供 directDataAPI / orchestrator 等模块复用。
// @doc [V9-DOC-FRONT-037]
// ============================================================

/** 复用 getLogger 返回类型，避免重复定义 */
type LoggerLike = ReturnType<typeof getLogger>

export type { LoggerLike }

/**
 * 条件分支切换日志 — 用于 if/else if 分支点标记进入了哪个分支。
 *
 * 典型场景：parseTencentQuote / parseSinaQuote 的 A 股 vs 港股解析分支分叉点。
 *
 * @param level 日志级别，默认 'debug'。单次调用场景可传 'info' 便于生产排查；
 *              批量循环内保持 'debug' 避免刷屏。
 */
export function logBranchSwitch(
  logger: LoggerLike,
  ns: string,
  point: string,
  branch: string,
  context: LogContext = {},
  level: LogLevel = 'debug',
): void {
  logger[level](`[${ns}] ${point}: ${branch} 分支`, context)
}

/**
 * 映射/策略回退日志 — 用于主路径失败后切换到降级/回退路径时记录。
 *
 * 典型场景：tencentBatchQuotes / sinaBatchQuotes 的 codeMap 映射失败后回退到裸码。
 *
 * @param level 日志级别，默认 'debug'。关键降级路径可传 'info' 或 'warn'。
 */
export function logFallback(
  logger: LoggerLike,
  ns: string,
  strategy: string,
  input: string,
  fallback: unknown,
  extra: LogContext = {},
  level: LogLevel = 'debug',
): void {
  logger[level](`[${ns}] ${strategy}: 回退`, {
    input,
    fallback,
    ...extra,
  })
}

/**
 * 守卫告警日志 — 用于前置条件不满足、触发守卫逻辑时的 warn 级别输出。
 *
 * 典型场景：getNeteaseCode 港股代码超长碰撞风险、parseXXX 字段不足。
 */
export function logGuardWarn(
  logger: LoggerLike,
  ns: string,
  guardName: string,
  reason: string,
  context: LogContext = {},
): void {
  logger.warn(`[${ns}] ${guardName}: 守卫触发 — ${reason}`, context)
}

/**
 * 工厂函数：绑定 logger + namespace，批量使用时无需重复传参。
 *
 * branchSwitch / fallback 的 level 参数默认 'debug'（批量安全），
 * 单次入口可传 'info' 提升为生产可见级别。
 */
export function createBranchLogger(logger: LoggerLike, ns: string) {
  return {
    branchSwitch: (point: string, branch: string, context: LogContext = {}, level: LogLevel = 'debug') =>
      logBranchSwitch(logger, ns, point, branch, context, level),
    fallback: (strategy: string, input: string, fallback: unknown, extra: LogContext = {}, level: LogLevel = 'debug') =>
      logFallback(logger, ns, strategy, input, fallback, extra, level),
    guardWarn: (guardName: string, reason: string, context: LogContext = {}) =>
      logGuardWarn(logger, ns, guardName, reason, context),
  }
}

export type BranchLogger = ReturnType<typeof createBranchLogger>

// ============================================================
// Fallback 事件双写（控制台 + IndexedDB research_logs）
// ============================================================

export type FallbackEventType =
  | 'kline_fallback'
  | 'chip_fallback'
  | 'kline_price_sanitize'
  | 'chip_price_sanitize'
  | (string & {})

interface ReportFallbackParams {
  actor: string
  logger?: LoggerLike
  event: FallbackEventType
  fromTo?: { from: string | number; to: string | number }
  reason?: string
  extra?: Record<string, unknown>
  target: { type: string; code: string }
}

export function reportFallbackEvent(params: ReportFallbackParams): void {
  const { actor, logger, event, fromTo, reason, extra, target } = params
  const log = getLogger()
  const usedLogger = logger ?? log

  usedLogger.warn(
    `[${actor}] fallback:${event} — ${reason ?? '无原因'}`,
    { target, from: fromTo?.from, to: fromTo?.to, ...extra },
  )

  try {
    const traceId = `fallback-${event}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const researchLog: ResearchLog = {
      traceId,
      timestamp: Date.now(),
      actor,
      action: `fallback:${event}`,
      targetType: target.type,
      targetCode: target.code,
      payload: JSON.stringify({
        module: actor,
        event,
        fallbackFrom: fromTo?.from,
        fallbackTo: fromTo?.to,
        reason,
        ...extra,
      } satisfies Record<string, unknown>),
    }
    void sendWriteEnvelope('saveResearchLog', researchLog, 'system').catch((err) => {
      usedLogger.debug(`[${actor}] [research_logs] 写入失败（忽略）`, {
        error: err instanceof Error ? err.message : String(err),
        event,
        target,
      })
    })
  } catch (err) {
    usedLogger.debug(`[${actor}] [research_logs] 报告函数异常（忽略）`, {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export function reportFallbackForSymbol(params: {
  actor: string
  symbol: string
  logger?: LoggerLike
  event: FallbackEventType
  fromTo?: { from: string | number; to: string | number }
  reason?: string
  extra?: Record<string, unknown>
}): void {
  reportFallbackEvent({
    actor: params.actor,
    logger: params.logger,
    event: params.event,
    fromTo: params.fromTo,
    reason: params.reason,
    extra: params.extra,
    target: { type: 'stock', code: params.symbol },
  })
}

// ============================================================
// Fallback 日志查询与 CSV 导出
// ============================================================

export interface FallbackLogCsvRow {
  timestamp: string
  traceId: string
  actor: string
  action: string
  targetType: string
  targetCode: string
  event: string
  fallbackFrom: string
  fallbackTo: string
  reason: string
  payload: string
}

export async function queryFallbackLogs(days = 7): Promise<ResearchLog[]> {
  const allLogs = await queryList<ResearchLog>(STORE_NAME.researchLogs)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return allLogs
    .filter((log) => log.action?.startsWith('fallback:') && log.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp)
}

export async function exportFallbackLogsToCsv(days = 7): Promise<number> {
  const LOGGER = getLogger()
  const logs = await queryFallbackLogs(days)
  if (logs.length === 0) {
    LOGGER.warn('[logHelpers] exportFallbackLogsToCsv: 最近 {days} 天无 fallback 日志', { days })
    return 0
  }

  const rows: FallbackLogCsvRow[] = logs.map((log) => {
    let payload: Record<string, unknown> = {}
    try {
      payload = log.payload ? (JSON.parse(log.payload) as Record<string, unknown>) : {}
    } catch {
      payload = { rawPayload: log.payload ?? '' }
    }
    return {
      timestamp: new Date(log.timestamp).toISOString(),
      traceId: log.traceId,
      actor: log.actor,
      action: log.action,
      targetType: log.targetType,
      targetCode: log.targetCode,
      event: (payload.event as string) ?? log.action.replace('fallback:', ''),
      fallbackFrom: safeStr(payload.fallbackFrom),
      fallbackTo: safeStr(payload.fallbackTo),
      reason: safeStr(payload.reason),
      payload: log.payload ?? '',
    }
  })

  const headers = [
    'timestamp', 'traceId', 'actor', 'action', 'targetType', 'targetCode',
    'event', 'fallbackFrom', 'fallbackTo', 'reason', 'payload',
  ]
  const DANGEROUS_PREFIX = /^[=+\-@]/
  const escape = (val: unknown): string => {
    if (val == null) return ''
    let str: string
    if (typeof val === 'string') str = val
    else if (typeof val === 'number' || typeof val === 'boolean') str = val.toString()
    else { str = safeStr(val) }
    if (DANGEROUS_PREFIX.test(str)) str = `'${str}`
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
  const csvLines = [headers.join(',')]
  for (const row of rows) {
    csvLines.push(headers.map((h) => escape((row as unknown as Record<string, unknown>)[h])).join(','))
  }
  const csvContent = `${String.fromCharCode(0xfeff)}${csvLines.join('\n')}`

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const dateStr = new Date().toISOString().slice(0, 10)
  link.download = `fallback-logs-${dateStr}-${days}d.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  LOGGER.info('[logHelpers] exportFallbackLogsToCsv 导出完成', { days, rows: rows.length })
  return rows.length
}
