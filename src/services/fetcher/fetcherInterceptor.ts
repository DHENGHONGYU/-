/**
 * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
 */
import { HttpError, HttpErrorType, getHttpErrorType } from './fetcherErrors'
import { DIRECT_DATA_API_TIMEOUT_MS } from '@/config/timeouts'

// 拦截器配置
export interface InterceptorConfig {
  // 最大重试次数
  maxRetries: number
  // 初始重试延迟（毫秒）
  baseDelay: number
  // 最大重试延迟（毫秒）
  maxDelay: number
  // 是否在 5xx 时重试
  retryOnServerError: boolean
  // 是否在 429 时重试
  retryOnRateLimit: boolean
  // 是否在网络错误时重试
  retryOnNetworkError: boolean
  // 401 回调（用于跳转登录）
  onUnauthorized?: () => void
  // 403 回调（用于显示无权限）
  onForbidden?: () => void
}

const DEFAULT_CONFIG: InterceptorConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryOnServerError: true,
  retryOnRateLimit: true,
  retryOnNetworkError: true,
  onUnauthorized: undefined,
  onForbidden: undefined,
}

// 指数退避计算
/**
 * calculateBackoff
 * @param attempt
 * @param baseDelay
 * @param maxDelay
 * @returns number
 */
export function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  // 添加随机抖动 ±20%
  const jitter = delay * 0.2 * (Math.random() - 0.5)
  return Math.floor(delay + jitter)
}

// 全局拦截器实例
let globalConfig: InterceptorConfig = { ...DEFAULT_CONFIG }

/**
 * setInterceptorConfig
 * @param config
 * @returns void
 */
export function setInterceptorConfig(config: Partial<InterceptorConfig>): void {
  globalConfig = { ...globalConfig, ...config }
}

/**
 * getInterceptorConfig
 * @returns InterceptorConfig
 */
export function getInterceptorConfig(): InterceptorConfig {
  return { ...globalConfig }
}

// 错误判断
function shouldRetry(error: HttpError, config: InterceptorConfig, attempt: number): boolean {
  if (attempt >= config.maxRetries) return false
  if (error.type === HttpErrorType.UNAUTHORIZED) return false  // 401 不重试
  if (error.type === HttpErrorType.FORBIDDEN) return false   // 403 不重试
  if (error.type === HttpErrorType.NOT_FOUND) return false    // 404 不重试
  if (error.type === HttpErrorType.RATE_LIMITED && config.retryOnRateLimit) return true
  if (error.type === HttpErrorType.SERVER_ERROR && config.retryOnServerError) return true
  if (error.type === HttpErrorType.NETWORK_ERROR && config.retryOnNetworkError) return true
  if (error.type === HttpErrorType.TIMEOUT && config.retryOnNetworkError) return true
  return false
}

function createHttpErrorFromResponse(response: Response, url: string): HttpError {
  return new HttpError(
    `HTTP ${response.status}: ${response.statusText}`,
    getHttpErrorType(response.status),
    response.status,
    url,
  )
}

function createNetworkError(err: unknown, url: string): HttpError {
  const isAbort = err instanceof DOMException && err.name === 'AbortException'
  return new HttpError(
    isAbort ? '请求超时' : '网络连接失败',
    isAbort ? HttpErrorType.TIMEOUT : HttpErrorType.NETWORK_ERROR,
    undefined,
    url,
  )
}

function triggerAuthCallbacks(errorType: HttpErrorType, config: InterceptorConfig): void {
  if (errorType === HttpErrorType.UNAUTHORIZED && config.onUnauthorized) {
    config.onUnauthorized()
  }
  if (errorType === HttpErrorType.FORBIDDEN && config.onForbidden) {
    config.onForbidden()
  }
}

async function tryOnce(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DIRECT_DATA_API_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

// 全局 fetch 包装函数
/**
 * interceptedFetch
 */
export async function interceptedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const config = getInterceptorConfig()
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    const outcome = await attemptOnce(input, init, config, url, attempt)
    if (outcome.type === 'response') return outcome.response
    if (outcome.type === 'throw') throw outcome.error
  }

  throw new HttpError('请求失败', HttpErrorType.UNKNOWN, undefined, url)
}

type FetchAttemptOutcome =
  | { type: 'response'; response: Response }
  | { type: 'throw'; error: HttpError }
  | { type: 'continue' }

async function shouldRetryWithDelay(
  error: HttpError,
  config: InterceptorConfig,
  attempt: number,
): Promise<boolean> {
  if (!shouldRetry(error, config, attempt)) return false
  await delay(calculateBackoff(attempt, config.baseDelay, config.maxDelay))
  return true
}

async function attemptOnce(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  config: InterceptorConfig,
  url: string,
  attempt: number,
): Promise<FetchAttemptOutcome> {
  const response = await tryOnce(input, init).catch((err) => ({ error: createNetworkError(err, url) }))
  if ('error' in response) {
    const networkError = response.error
    if (await shouldRetryWithDelay(networkError, config, attempt)) return { type: 'continue' }
    return { type: 'throw', error: networkError }
  }
  if (response.ok) return { type: 'response', response }
  const error = createHttpErrorFromResponse(response, url)
  triggerAuthCallbacks(error.type, config)
  if (await shouldRetryWithDelay(error, config, attempt)) return { type: 'continue' }
  return { type: 'throw', error }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
