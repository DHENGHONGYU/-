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

import { getLogger, type LogContext } from '@/lib/logger'

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
        if (seen.has(val)) return '[Circular]'
        seen.add(val)
      }
      // 函数/Symbol 等不可序列化值
      if (typeof val === 'function') return '[Function]'
      if (typeof val === 'symbol') return val.toString()
      if (val instanceof Error) return { name: val.name, message: val.message }
      return val
    }, 0)
    if (json == null) return String(value)
    return json.length > 500 ? `${json.slice(0, 500)}…(${json.length}B)` : json
  } catch {
    return String(value)
  }
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
  if (err instanceof Error && err.stack) {
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
