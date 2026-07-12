/**
 * @module scripts/doc-retry
 * @description 文档自动更新体系 —— 统一的「指数退避重试 + 错误可重试性分类」工具（M2 · T2）
 *
 * 提供带指数退避的重试封装，且**只重试可重试错误**（TRANSIENT / IO 类），
 * 对 FILE_NOT_FOUND / PARSE 等确定性错误立即失败（符合计划约束 2「失败重试」）。
 *
 * 与 `scripts/daily-doc-validation.ts` 中局部 `retryWithBackoff` 的区别：
 * 本工具按错误类别过滤重试（确定性错误不重试），并支持 AbortSignal / onRetry 回调。
 */

/** 错误可重试性分类 */
export type RetryableErrorCategory = 'FILE_NOT_FOUND' | 'PARSE' | 'IO' | 'TRANSIENT' | 'UNKNOWN'

/** 重试选项 */
export interface RetryOptions {
  /** 最大重试次数（不含首次），默认 3 */
  maxRetries?: number
  /** 退避基础延迟 ms，默认 500 */
  baseDelayMs?: number
  /** 单次退避上限 ms，默认 8000（防止无限增长） */
  maxDelayMs?: number
  /** 仅当返回 true 才重试；默认 isTransientError */
  isRetryable?: (error: unknown) => boolean
  /** 每次重试前回调（可用于日志/告警） */
  onRetry?: (ctx: { attempt: number; error: unknown; delayMs: number }) => void
  /** 中止信号，aborted 时立即抛 AbortError */
  signal?: AbortSignal
}

/** 视为瞬时/可重试的 Node errno 集合 */
const TRANSIENT_ERRNOS = new Set<string>([
  'EIO',
  'ENOMEM',
  'EAGAIN',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
])

/** 读取错误对象上可能携带的错误码（优先 errorCode，其次 Node code） */
function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; errorCode?: unknown }
    if (typeof e.errorCode === 'string') return e.errorCode
    if (typeof e.code === 'string') return e.code
  }
  return undefined
}

/** 安全地取得错误消息字符串 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

/**
 * 将错误分类为可重试类别。
 * 优先读取错误对象的 `errorCode`（如 'FILE_NOT_FOUND' / 'IO' / 'TRANSIENT'），
 * 其次按 Node `ErrnoException.code` 判断；未知 → 'UNKNOWN'。
 */
export function classifyError(error: unknown): RetryableErrorCategory {
  const code = getErrorCode(error)
  if (code === 'FILE_NOT_FOUND' || code === 'ENOENT') return 'FILE_NOT_FOUND'
  if (code === 'PATH_OUTSIDE_ROOT' || code === 'PATH_TRAVERSAL') return 'FILE_NOT_FOUND'
  if (code === 'PARSE' || error instanceof SyntaxError) return 'PARSE'
  if (code === 'IO') return 'IO'
  if (code === 'TRANSIENT') return 'TRANSIENT'
  if (code && TRANSIENT_ERRNOS.has(code)) return 'TRANSIENT'
  return 'UNKNOWN'
}

/**
 * 判断错误是否可重试（仅 TRANSIENT / IO 类）。
 * FILE_NOT_FOUND / PARSE / UNKNOWN 一律不可重试（保守策略）。
 */
export function isTransientError(error: unknown): boolean {
  const category = classifyError(error)
  return category === 'TRANSIENT' || category === 'IO'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 带指数退避的重试封装。
 *
 * - 成功：直接返回结果。
 * - 失败且 `isRetryable` 为 false → **立即抛出原错误**（不 sleep、不重试，保留 errorCode）。
 * - 可重试失败 → 最多重试 `maxRetries` 次，每次延迟 `baseDelayMs * 2^attempt`（封顶 `maxDelayMs`，带 ±20% jitter）。
 * - `signal` 中止时立即抛 `name: 'AbortError'` 的 Error。
 * - 重试耗尽后抛出**最后一个原始错误**（不使用 wrapper 包裹，以免丢失 errorCode 语义）。
 *
 * @param fn 待执行的可能失败操作
 * @param options 重试选项
 * @returns fn 的成功结果
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const baseDelayMs = options?.baseDelayMs ?? 500
  const maxDelayMs = options?.maxDelayMs ?? 8000
  const isRetryable = options?.isRetryable ?? isTransientError
  const onRetry = options?.onRetry
  const signal = options?.signal

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      throw err
    }
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isRetryable(error)) {
        throw error
      }
      if (attempt < maxRetries) {
        const rawDelay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs)
        const jitter = rawDelay * 0.2 * (Math.random() * 2 - 1)
        const delay = Math.max(0, Math.round(rawDelay + jitter))
        if (onRetry) {
          try {
            onRetry({ attempt, error, delayMs: delay })
          } catch {
            /* 回调异常不影响重试流程 */
          }
        }
        console.error(
          `[DocRetry] 操作失败，准备重试 (attempt=${attempt}, maxRetries=${maxRetries}): ${getErrorMessage(error)}`,
        )
        await sleep(delay)
      }
    }
  }

  throw lastError
}
