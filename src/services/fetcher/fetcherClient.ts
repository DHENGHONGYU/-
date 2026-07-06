import { getDefaultFetcherServiceConfig } from '@/config/fetcherConfig'
import { getLogger } from '@/lib/logger'
import { API_COLLECT_BASIC, API_COLLECT_KLINE } from '@/config/apiPaths'
import type {
  CollectBasicData,
  CollectBasicRequest,
  CollectKlineData,
  CollectKlineRequest,
  CollectResponse,
  HealthCheckResponse,
} from './fetcherTypes'

const logger = getLogger()

class FetcherError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'FetcherError'
  }
}

function getConfig() {
  return getDefaultFetcherServiceConfig()
}

function buildUrl(path: string): string {
  const { baseURL } = getConfig()
  const normalizedBase = baseURL.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retries?: number,
): Promise<T> {
  const { timeoutMs, retries: defaultRetries } = getConfig()
  const maxRetries = retries ?? defaultRetries
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        buildUrl(path),
        {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          ...options,
        },
        timeoutMs,
      )

      if (!response.ok) {
        throw new FetcherError(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = (await response.json()) as T
      return data
    } catch (err) {
      lastError = err
      const isNetworkError = err instanceof TypeError || err instanceof FetcherError
      if (!isNetworkError || attempt === maxRetries) {
        break
      }
      logger.warn(`[fetcherClient] 请求失败，第 ${attempt + 1} 次重试`, { path, err })
    }
  }

  if (lastError instanceof TypeError) {
    throw new FetcherError(
      '数据采集服务未启动或无法连接，请检查 Python 服务是否运行',
      lastError,
    )
  }
  throw lastError instanceof Error
    ? new FetcherError(lastError.message, lastError)
    : new FetcherError(String(lastError), lastError)
}

export async function checkFetcherHealth(): Promise<{
  ok: boolean
  error?: string
}> {
  try {
    const result = await request<HealthCheckResponse>('/health', { method: 'GET' }, 0)
    if (result.status === 'ok') {
      return { ok: true }
    }
    return { ok: false, error: result.error ?? '服务状态异常' }
  } catch (err) {
    const message = err instanceof FetcherError ? err.message : '健康检查失败'
    logger.warn('[fetcherClient] 健康检查失败', { err })
    return { ok: false, error: message }
  }
}

export async function collectBasic(
  symbol: string,
): Promise<CollectResponse<CollectBasicData>> {
  return request<CollectResponse<CollectBasicData>>(API_COLLECT_BASIC, {
    method: 'POST',
    body: JSON.stringify({ symbol } satisfies CollectBasicRequest),
  })
}

export async function collectKline(
  params: CollectKlineRequest,
): Promise<CollectResponse<CollectKlineData>> {
  return request<CollectResponse<CollectKlineData>>(API_COLLECT_KLINE, {
    method: 'POST',
    body: JSON.stringify(params),
  })
}
