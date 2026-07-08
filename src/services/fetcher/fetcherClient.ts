import { getDefaultFetcherServiceConfig } from '@/config/fetcherConfig'
import { getLogger } from '@/lib/logger'
import { API_COLLECT_BASIC, API_COLLECT_FINANCIAL, API_COLLECT_KLINE } from '@/config/apiPaths'
import type {
  CollectBasicData,
  CollectBasicRequest,
  CollectFinancialData,
  CollectFinancialRequest,
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
  logger.info('[fetcherClient] collectBasic 开始请求', { symbol, path: API_COLLECT_BASIC })
  const startTs = Date.now()
  try {
    const result = await request<CollectResponse<CollectBasicData>>(API_COLLECT_BASIC, {
      method: 'POST',
      body: JSON.stringify({ symbol } satisfies CollectBasicRequest),
    })
    const durationMs = Date.now() - startTs
    logger.info('[fetcherClient] collectBasic 请求成功', {
      symbol,
      success: result.success,
      durationMs,
      stockName: result.data?.name,
      price: result.data?.price,
    })
    return result
  } catch (err) {
    const durationMs = Date.now() - startTs
    logger.error('[fetcherClient] collectBasic 请求失败', {
      symbol,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

export async function collectKline(
  params: CollectKlineRequest,
): Promise<CollectResponse<CollectKlineData>> {
  logger.info('[fetcherClient] collectKline 开始请求', {
    symbol: params.symbol,
    period: params.period,
    adjust: params.adjust,
    path: API_COLLECT_KLINE,
  })
  const startTs = Date.now()
  try {
    const result = await request<CollectResponse<CollectKlineData>>(API_COLLECT_KLINE, {
      method: 'POST',
      body: JSON.stringify(params),
    })
    const durationMs = Date.now() - startTs
    logger.info('[fetcherClient] collectKline 请求成功', {
      symbol: params.symbol,
      success: result.success,
      durationMs,
      historyCount: result.data?.history?.length ?? 0,
    })
    return result
  } catch (err) {
    const durationMs = Date.now() - startTs
    logger.error('[fetcherClient] collectKline 请求失败', {
      symbol: params.symbol,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

export async function collectFinancial(
  symbol: string,
): Promise<CollectResponse<CollectFinancialData>> {
  logger.info('[fetcherClient] collectFinancial 开始请求', { symbol, path: API_COLLECT_FINANCIAL })
  const startTs = Date.now()
  try {
    const result = await request<CollectResponse<CollectFinancialData>>(API_COLLECT_FINANCIAL, {
      method: 'POST',
      body: JSON.stringify({ symbol } satisfies CollectFinancialRequest),
    })
    const durationMs = Date.now() - startTs
    logger.info('[fetcherClient] collectFinancial 请求成功', {
      symbol,
      success: result.success,
      durationMs,
      reportDate: result.data?.report_date,
      revenue: result.data?.revenue,
      netProfit: result.data?.net_profit,
    })
    return result
  } catch (err) {
    const durationMs = Date.now() - startTs
    logger.error('[fetcherClient] collectFinancial 请求失败', {
      symbol,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
