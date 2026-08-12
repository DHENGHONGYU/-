/**
 * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
 */
import { getDefaultFetcherServiceConfig } from '@/config/fetcherConfig'
import { getLogger } from '@/lib/logger'
import { measureAsync, PERF } from '@/lib/perf'
import { API_COLLECT_BASIC, API_COLLECT_FINANCIAL, API_COLLECT_KLINE, API_COLLECT_SECTORS } from '@/config/apiPaths'
import type {
  CollectBasicData,
  CollectBasicRequest,
  CollectFinancialData,
  CollectFinancialRequest,
  CollectKlineData,
  CollectKlineRequest,
  CollectResponse,
  CollectSectorsData,
  CollectSectorsRequest,
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
      return { ok: false, error: new FetcherError(`HTTP ${response.status}: ${response.statusText}`) }
    }

    const data = (await response.json()) as T
    return { ok: true, data }
  } catch (err) {
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
        const isNetworkError =
          result.error instanceof TypeError || result.error instanceof FetcherError
        if (!isNetworkError || attempt === maxRetries) {
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
      throw lastError instanceof Error
        ? new FetcherError(lastError.message, lastError)
        : new FetcherError(String(lastError), lastError)
    },
    { path, maxRetries },
  )
}

/**
 * checkFetcherHealth
 *
 * 仅 `real` 模式请求 Python AkShare 服务 `/health`；
 * 其他模式（rest/mock/websocket）不依赖 Python 服务，直接返回 `ok: true`，
 * 避免对未启动的 :8000 端口发起无意义请求触发 HTTP 500 噪声。
 *
 * @returns Promise<
 */
export async function checkFetcherHealth(): Promise<{
  ok: boolean
  error?: string
}> {
  const dataSourceType = import.meta.env.VITE_DATA_SOURCE_TYPE ?? 'mock'
  if (dataSourceType !== 'real') {
    return { ok: true }
  }

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

/**
 * collectSectors —— 采集申万二级行业板块轮动评分
 *
 * 调用 Python 后端 /api/collect/sectors，返回 RotationSectorScore 列表。
 * 数据源为 AKShare sw_index_second_info + index_hist_sw，五因子加权评分。
 *
 * @param topN 返回的板块数量（按成份个数降序取 TOP N），默认由后端决定
 */
export async function collectSectors(
  params: CollectSectorsRequest = {},
): Promise<CollectResponse<CollectSectorsData>> {
  logger.info('[fetcherClient] collectSectors 开始请求', { topN: params.topN, path: API_COLLECT_SECTORS })
  const startTs = Date.now()
  try {
    const result = await request<CollectResponse<CollectSectorsData>>(API_COLLECT_SECTORS, {
      method: 'POST',
      body: JSON.stringify({ topN: params.topN ?? 20 } satisfies CollectSectorsRequest),
    })
    const durationMs = Date.now() - startTs
    logger.info('[fetcherClient] collectSectors 请求成功', {
      success: result.success,
      durationMs,
      sectorCount: result.data?.sectors?.length ?? 0,
      scoreDate: result.data?.scoreDate,
    })
    return result
  } catch (err) {
    const durationMs = Date.now() - startTs
    logger.error('[fetcherClient] collectSectors 请求失败', {
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
