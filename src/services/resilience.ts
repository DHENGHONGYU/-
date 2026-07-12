/**
 * @module services/resilience
 * @description S-02：关键调用韧性工具（重试 / 熔断 / 降级）
 *
 * 提供：
 * - `withRetry`：指数退避重试，失败统一经 `captureError` 入总线。
 * - `createCircuitBreaker`：熔断保护器（closed → open → half-open 状态机）。
 * - `withFallback`：失败降级，返回兜底值并上报错误。
 * - `withResilience`：组合上述三者的一站式封装。
 *
 * 设计原则：
 * - 复用 `src/services/errorBus` 的 `captureError` 与既有 `V9Error` 体系。
 * - sleep / 时钟可注入，保证单测确定性（无需真实等待）。
 * - 仅依赖 lib 基础设施与 services 内部模块，符合 AGENTS.md 分层约束。
 */

import { V9Error } from '@/lib/errors'
import { getLogger } from '@/lib/logger'
import { captureError, type ErrorContext } from '@/services/errorBus'

const logger = getLogger()

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
const defaultNow = (): number => Date.now()

/** 重试配置 */
export interface RetryOptions {
  /** 最大尝试次数（含首次），默认 3 */
  maxAttempts?: number
  /** 基础退避毫秒，默认 200 */
  baseDelayMs?: number
  /** 退避上限毫秒，默认 5000 */
  maxDelayMs?: number
  /** 退避增长因子，默认 2 */
  factor?: number
  /** 是否继续重试的判定，默认任意错误均重试 */
  shouldRetry?: (err: unknown, attempt: number) => boolean
  /** 每次重试前的回调（用于指标/日志） */
  onRetry?: (err: unknown, attempt: number) => void
  /** 用于错误总线与日志的上下文 */
  context?: ErrorContext
  /** 注入的等待函数（测试用），默认真实 setTimeout */
  sleep?: (ms: number) => Promise<void>
}

const sleepOrDefault = (o?: RetryOptions): ((ms: number) => Promise<void>) => o?.sleep ?? defaultSleep

function computeRetryDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  factor: number,
): number {
  return Math.min(baseDelayMs * Math.pow(factor, attempt - 1), maxDelayMs)
}

async function handleRetryAttempt(
  err: unknown,
  attempt: number,
  maxAttempts: number,
  shouldRetry: (err: unknown, attempt: number) => boolean,
  onRetry: ((err: unknown, attempt: number) => void) | undefined,
  sleep: (ms: number) => Promise<void>,
  baseDelayMs: number,
  maxDelayMs: number,
  factor: number,
): Promise<boolean> {
  const isLast = attempt === maxAttempts
  if (isLast || !shouldRetry(err, attempt)) {
    return false
  }

  const delay = computeRetryDelay(attempt, baseDelayMs, maxDelayMs, factor)
  onRetry?.(err, attempt)
  logger.warn(
    `[Resilience] retry ${attempt}/${maxAttempts} after ${delay}ms`,
    { error: err instanceof Error ? err.message : String(err) },
  )
  await sleep(delay)
  return true
}

/**
 * 安全调用，将异常收敛为判别联合类型，避免在重试循环内使用 try/catch 嵌套。
 */
async function safeCall<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; err: unknown }> {
  try {
    return { ok: true, value: await fn() }
  } catch (err) {
    return { ok: false, err }
  }
}

/**
 * 指数退避重试。
 * 全部尝试失败后，抛出经 `captureError` 收敛并上报的 `V9Error`。
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 200
  const maxDelayMs = options.maxDelayMs ?? 5000
  const factor = options.factor ?? 2
  const shouldRetry = options.shouldRetry ?? (() => true)
  const sleep = sleepOrDefault(options)

  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await safeCall(fn)
    if (result.ok) {
      return result.value
    }
    lastErr = result.err
    const shouldContinue = await handleRetryAttempt(
      result.err,
      attempt,
      maxAttempts,
      shouldRetry,
      options.onRetry,
      sleep,
      baseDelayMs,
      maxDelayMs,
      factor,
    )
    if (!shouldContinue) {
      break
    }
  }

  throw captureError(lastErr, {
    source: options.context?.source,
    operation: options.context?.operation
      ? `${options.context.operation} (retry exhausted)`
      : 'retry',
    meta: { ...options.context?.meta, maxAttempts },
  })
}

/** 熔断保护器配置 */
export interface CircuitBreakerOptions {
  /** 连续失败阈值，达到后熔断，默认 5 */
  failureThreshold?: number
  /** 熔断后进入 half-open 的等待毫秒，默认 30000 */
  resetTimeoutMs?: number
  /** half-open 下连续成功阈值，达到后闭合，默认 2 */
  successThreshold?: number
  /** 用于错误总线与日志的上下文 */
  context?: ErrorContext
  /** 注入的时钟（测试用），默认 Date.now */
  now?: () => number
}

export type CircuitState = 'closed' | 'open' | 'half-open'

/** 熔断保护器实例 */
export interface CircuitBreaker {
  /** 经熔断保护执行调用 */
  execute<T>(fn: () => Promise<T>): Promise<T>
  /** 当前状态 */
  readonly state: CircuitState
  /** 重置为 closed（清除计数与打开时间） */
  reset(): void
}

/** 熔断开启时抛出的错误 */
export class CircuitOpenError extends V9Error {
  constructor() {
    super('Circuit breaker is open', { category: 'system', code: 'CIRCUIT_OPEN' })
    this.name = 'CircuitOpenError'
  }
}

/**
 * 创建熔断保护器。
 * - closed：请求直通；连续失败达阈值 → open。
 * - open：直接拒绝（抛 CircuitOpenError），超过 resetTimeoutMs → half-open。
 * - half-open：放行一次探测；成功达 successThreshold → closed，失败 → open。
 */
export function createCircuitBreaker(options: CircuitBreakerOptions = {}): CircuitBreaker {
  const failureThreshold = options.failureThreshold ?? 5
  const resetTimeoutMs = options.resetTimeoutMs ?? 30000
  const successThreshold = options.successThreshold ?? 2
  const now = options.now ?? defaultNow

  let failures = 0
  let successes = 0
  let openedAt = 0
  let state: CircuitState = 'closed'

  const guard = (fn: () => Promise<unknown>): Promise<unknown> => {
    if (state === 'open') {
      if (now() - openedAt >= resetTimeoutMs) {
        state = 'half-open'
        successes = 0
        logger.info('[Resilience] circuit half-open: probing')
      } else {
        return Promise.reject(new CircuitOpenError())
      }
    }

    return fn().then(
      (value) => {
        if (state === 'half-open') {
          successes += 1
          if (successes >= successThreshold) {
            state = 'closed'
            failures = 0
            successes = 0
            logger.info('[Resilience] circuit closed: recovered')
          }
        } else {
          failures = 0
        }
        return value
      },
      (err) => {
        if (state === 'half-open') {
          state = 'open'
          openedAt = now()
          failures = 0
        } else {
          failures += 1
          if (failures >= failureThreshold) {
            state = 'open'
            openedAt = now()
            failures = 0
            logger.warn('[Resilience] circuit opened', { threshold: failureThreshold })
          }
        }
        throw err
      },
    )
  }

  return {
    execute: guard as <T>(fn: () => Promise<T>) => Promise<T>,
    get state() {
      return state
    },
    reset() {
      state = 'closed'
      failures = 0
      successes = 0
      openedAt = 0
    },
  }
}

/**
 * 失败降级：执行 fn，异常时捕获上报并返回兜底值。
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T | (() => T),
  context?: ErrorContext,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    captureError(err, {
      source: context?.source,
      operation: context?.operation ? `${context.operation} (degraded)` : 'fallback',
      meta: context?.meta,
    })
    return typeof fallback === 'function' ? (fallback as () => T)() : fallback
  }
}

/** 一站式韧性封装：熔断 → 重试 → 降级 */
export interface ResilienceOptions<T> extends RetryOptions {
  circuitBreaker?: CircuitBreakerOptions
  fallback?: T | (() => T)
}

/**
 * 组合熔断、重试与降级。
 * 顺序：熔断保护器包裹「重试包裹的调用」，最外层兜底降级。
 */
export async function withResilience<T>(
  fn: () => Promise<T>,
  options: ResilienceOptions<T> = {},
): Promise<T> {
  const breaker = options.circuitBreaker
    ? createCircuitBreaker(options.circuitBreaker)
    : undefined

  const core = (): Promise<T> => withRetry(fn, options)

  if (!breaker) {
    return applyFallback(core, options)
  }

  return applyFallback(() => breaker.execute(core), options)
}

function applyFallback<T>(core: () => Promise<T>, options: ResilienceOptions<T>): Promise<T> {
  if (options.fallback !== undefined) {
    return withFallback(core, options.fallback, options.context)
  }
  return core()
}
