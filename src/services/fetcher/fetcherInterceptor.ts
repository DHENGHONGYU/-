import { HttpError, HttpErrorType, getHttpErrorType } from './fetcherErrors'

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
export function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  // 添加随机抖动 ±20%
  const jitter = delay * 0.2 * (Math.random() - 0.5)
  return Math.floor(delay + jitter)
}

// 全局拦截器实例
let globalConfig: InterceptorConfig = { ...DEFAULT_CONFIG }

export function setInterceptorConfig(config: Partial<InterceptorConfig>): void {
  globalConfig = { ...globalConfig, ...config }
}

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

// 全局 fetch 包装函数
export async function interceptedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const config = getInterceptorConfig()
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  let lastError: HttpError | null = null

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)  // 30s 超时

      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      // 处理 HTTP 错误状态码
      if (!response.ok) {
        const errorType = getHttpErrorType(response.status)
        const error = new HttpError(
          `HTTP ${response.status}: ${response.statusText}`,
          errorType,
          response.status,
          url,
        )

        // 触发特殊回调
        if (errorType === HttpErrorType.UNAUTHORIZED && config.onUnauthorized) {
          config.onUnauthorized()
        }
        if (errorType === HttpErrorType.FORBIDDEN && config.onForbidden) {
          config.onForbidden()
        }

        // 判断是否重试
        if (shouldRetry(error, config, attempt)) {
          lastError = error
          const delay = calculateBackoff(attempt, config.baseDelay, config.maxDelay)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        throw error
      }

      return response

    } catch (err) {
      if (err instanceof HttpError) {
        throw err
      }

      // 网络错误（fetch 抛出）
      const isAbort = err instanceof DOMException && err.name === 'AbortException'
      const errorType = isAbort ? HttpErrorType.TIMEOUT : HttpErrorType.NETWORK_ERROR
      const error = new HttpError(
        isAbort ? '请求超时' : '网络连接失败',
        errorType,
        undefined,
        url,
      )

      if (shouldRetry(error, config, attempt)) {
        lastError = error
        const delay = calculateBackoff(attempt, config.baseDelay, config.maxDelay)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      throw error
    }
  }

  throw lastError || new HttpError('请求失败', HttpErrorType.UNKNOWN, undefined, url)
}
