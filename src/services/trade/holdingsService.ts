/**
 * @module HoldingsService
 * @description 交易持仓列表 API 服务层。封装 /api/v1/trade/holdings 接口调用，包含请求超时、重试、错误处理。
 */

import type {
  HoldingsApiResponse,
  HoldingsListData,
  HoldingsQueryParams,
  TradeActionRequest,
  TradeActionResponse,
} from '@/types/modules/trade.types'
import { HOLDINGS_API, HOLDINGS_REQUEST_CONFIG } from '@/constants/trade.constants'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 内部 fetch 封装（带超时） */
async function requestWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeout: number = HOLDINGS_REQUEST_CONFIG.TIMEOUT,
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`)
    }

    return response.json() as Promise<T>
  } finally {
    clearTimeout(timeoutId)
  }
}

/** 带重试的请求 */
async function requestWithRetry<T>(
  url: string,
  options: RequestInit = {},
  maxRetries: number = HOLDINGS_REQUEST_CONFIG.MAX_RETRIES,
  retryDelay: number = HOLDINGS_REQUEST_CONFIG.RETRY_DELAY,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestWithTimeout<T>(url, options)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)))
      }
    }
  }

  throw lastError ?? new Error('请求失败')
}

/**
 * 获取持仓列表
 * @param params 查询参数
 * @returns 持仓列表数据
 */
export async function fetchHoldings(
  params: HoldingsQueryParams,
): Promise<HoldingsApiResponse<HoldingsListData>> {
  const queryString = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    startDate: params.startDate,
    endDate: params.endDate,
    direction: params.direction,
    keyword: params.keyword,
  }).toString()

  const url = `${HOLDINGS_API.LIST}?${queryString}`
  logger.info('[holdingsService] 请求持仓列表', { url, ...params })

  try {
    const result = await requestWithRetry<HoldingsApiResponse<HoldingsListData>>(url)
    logger.info('[holdingsService] 持仓列表响应成功', {
      code: result.code,
      total: result.data?.total,
      page: params.page,
    })

    // DataBridge 事件转发：记录持仓数据加载（用于可观测性）
    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.trading,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.holdingsDataLoaded,
          traceId: `holdings-list-${Date.now()}`,
        },
        { total: result.data?.total, page: params.page, pageSize: params.pageSize },
      )
      void dataBridge.forward(envelope).catch((forwardErr) => {
        logger.error('[holdingsService] DataBridge forward failed for holdingsDataLoaded', { error: forwardErr })
      })
    } catch (err) {
      logger.error('[holdingsService] Failed to create holdingsDataLoaded envelope', { error: err })
    }

    return result
  } catch (err) {
    logger.error('[holdingsService] 持仓列表请求失败', {
      url,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * 执行交易操作（补仓/平仓）
 * @param req 交易操作请求
 * @returns 操作结果
 */
export async function executeTradeAction(
  req: TradeActionRequest,
): Promise<TradeActionResponse> {
  const endpoint =
    req.action === 'ADD_POSITION'
      ? HOLDINGS_API.ADD_POSITION
      : HOLDINGS_API.CLOSE_POSITION

  logger.info('[holdingsService] 执行交易操作', {
    endpoint,
    code: req.code,
    action: req.action,
    quantity: req.quantity,
  })

  try {
    const result = await requestWithRetry<TradeActionResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(req),
    })
    logger.info('[holdingsService] 交易操作响应', {
      success: result.success,
      message: result.message,
      code: req.code,
      action: req.action,
    })

    // DataBridge 事件转发：交易操作完成后通知所有订阅者
    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.trading,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.tradeActionExecuted,
          traceId: `trade-action-${Date.now()}-${req.code}`,
        },
        { code: req.code, action: req.action, quantity: req.quantity, success: result.success },
      )
      void dataBridge.forward(envelope).catch((forwardErr) => {
        logger.error('[holdingsService] DataBridge forward failed for tradeActionExecuted', { error: forwardErr })
      })
    } catch (err) {
      logger.error('[holdingsService] Failed to create tradeActionExecuted envelope', { error: err })
    }

    return result
  } catch (err) {
    logger.error('[holdingsService] 交易操作请求失败', {
      endpoint,
      code: req.code,
      action: req.action,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * 导出持仓数据为 CSV
 * @param params 查询参数
 */
export async function exportHoldingsCSV(params: HoldingsQueryParams): Promise<void> {
  const queryString = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    startDate: params.startDate,
    endDate: params.endDate,
    direction: params.direction,
    keyword: params.keyword,
  }).toString()

  const exportUrl = `${HOLDINGS_API.EXPORT}?${queryString}`
  logger.info('[holdingsService] 导出持仓数据', { url: exportUrl, ...params })

  const response = await fetch(exportUrl)

  if (!response.ok) {
    logger.error('[holdingsService] 导出失败', { status: response.status, url: exportUrl })
    throw new Error(`导出失败: ${response.status}`)
  }

  logger.info('[holdingsService] 导出成功', { status: response.status })
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `持仓数据_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}