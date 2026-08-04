/**
 * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
 */
import { getDefaultFetcherServiceConfig } from '@/config/fetcherConfig'
import { getLogger } from '@/lib/logger'
import { measureAsync, PERF } from '@/lib/perf'
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
    public readonly statusCode?: number,
    public readonly retriable: boolean = true,
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
  const timeoutId = setTimeout(() => {
    logger.warn('[fetcherClient] 请求超时，AbortController 触发 abort', {
      url,
      timeoutMs,
    })
    controller.abort()
  }, timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

async function tryRequest<T>(
  path: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<{ ok: true; data: T } | { ok: false; error: unknown }> {
  try {
    const response = await fetchWithTimeout(buildUrl(path), {
      headers: options.body !== undefined
        ? { 'Content-Type': 'application/json', ...options.headers }
        : { ...options.headers },
      ...options,
    }, timeoutMs)

    if (!response.ok) {
      const isClientError = response.status >= 400 && response.status < 500
      return {
        ok: false,
        error: new FetcherError(
          `HTTP ${response.status}: ${response.statusText}`,
          undefined,
          response.status,
          !isClientError,
        ),
      }
    }

    const data = (await response.json()) as T

    if (data === null || data === undefined) {
      logger.warn('[fetcherClient] response.json() 返回 null/undefined', {
        path,
        status: response.status,
        contentType: response.headers.get('content-type'),
      })
    }

    return { ok: true, data }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      logger.warn('[fetcherClient] 请求被 abort（超时或手动取消）', {
        path,
        errorName: err.name,
        errorMessage: err.message,
      })
    } else if (err instanceof TypeError) {
      logger.warn('[fetcherClient] 网络错误（服务未启动或 DNS 解析失败）', {
        path,
        errorMessage: err.message,
      })
    } else {
      logger.warn('[fetcherClient] 请求异常（非网络错误）', {
        path,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
    }
    return { ok: false, error: err }
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retries?: number,
): Promise<T> {
  const { retries: defaultRetries } = getConfig()
  const maxRetries = retries ?? defaultRetries
  return measureAsync(
    PERF.DATA_FETCH_REQUEST,
    async () => {
      const { timeoutMs } = getConfig()
      let lastError: unknown

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const result = await tryRequest<T>(path, options, timeoutMs)
        if (result.ok) {
          return result.data
        }

        lastError = result.error
        const isRetriable =
          result.error instanceof TypeError ||
          (result.error instanceof FetcherError && result.error.retriable) ||
          (result.error instanceof DOMException && result.error.name === 'AbortError')
        if (!isRetriable || attempt === maxRetries) {
          break
        }
        logger.warn(`[fetcherClient] 请求失败，第 ${attempt + 1} 次重试`, {
          path,
          err: result.error,
        })
      }

      if (lastError instanceof TypeError) {
        throw new FetcherError(
          '数据采集服务未启动或无法连接，请检查 Python 服务是否运行',
          lastError,
        )
      }
      if (lastError instanceof DOMException && lastError.name === 'AbortError') {
        throw new FetcherError(
          '请求超时，请检查网络连接或服务响应速度',
          lastError,
          undefined,
          true,
        )
      }
      throw lastError instanceof Error
        ? new FetcherError(lastError.message, lastError)
        : new FetcherError(String(lastError), lastError)
    },
    { path, maxRetries },
  )
}

/**
 * checkFetcherHealth
 * @returns Promise<
 */
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

/**
 * collectBasic
 */
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

    if (!result.success) {
      logger.warn('[fetcherClient] collectBasic 业务级失败（HTTP 200, success=false）', {
        symbol,
        durationMs,
        error: result.error,
        dataNull: result.data === null || result.data === undefined,
      })
    } else {
      logger.info('[fetcherClient] collectBasic 请求成功', {
        symbol,
        success: result.success,
        durationMs,
        stockName: result.data?.name,
        price: result.data?.price,
      })
    }
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

/**
 * collectKline
 */
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

    if (!result.success) {
      logger.warn('[fetcherClient] collectKline 业务级失败（HTTP 200, success=false）', {
        symbol: params.symbol,
        durationMs,
        error: result.error,
        dataNull: result.data === null || result.data === undefined,
      })
    } else {
      logger.info('[fetcherClient] collectKline 请求成功', {
        symbol: params.symbol,
        success: result.success,
        durationMs,
        historyCount: result.data?.history?.length ?? 0,
      })
    }
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

/**
 * collectFinancial
 */
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

    if (!result.success) {
      logger.warn('[fetcherClient] collectFinancial 业务级失败（HTTP 200, success=false）', {
        symbol,
        durationMs,
        error: result.error,
        dataNull: result.data === null || result.data === undefined,
      })
    } else {
      logger.info('[fetcherClient] collectFinancial 请求成功', {
        symbol,
        success: result.success,
        durationMs,
        reportDate: result.data?.report_date,
        revenue: result.data?.revenue,
        netProfit: result.data?.net_profit,
      })
    }
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
