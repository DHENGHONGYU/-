/**
 * @fileoverview 数据采集服务层
 * 封装对 /api/collect/* 端点的调用，作为前端与后端采集服务的防腐层
 *
 * 提供功能：
 * - fetchBasicData: 获取股票基础信息（含实时行情）
 * - fetchKlineData: 获取股票K线数据
 *
 * @module services/collect
 * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020]
 */

import { safeFetch } from './shared/safeFetch'
import { API_COLLECT_BASIC, API_COLLECT_KLINE } from '@/config/apiPaths'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 基础数据响应 */
export interface BasicData {
  name: string | null
  price: number | null
  pe: number | null
  pb: number | null
  market_cap: number | null
  industry_code: string | null
  industry_name?: string | null
}

/** K线数据响应 */
export interface KlineData {
  latest: KlineBar | null
  history: KlineBar[]
}

/** 单根K线 */
export interface KlineBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
}

/** 通用采集响应 */
export interface CollectResponse<T> {
  success: boolean
  symbol: string
  dimension: string
  data: T | null
  records: number
  error: string | null
  fetched_at: string
}

/** 基础数据请求参数 */
export interface FetchBasicOptions {
  symbol: string
}

/** K线数据请求参数 */
export interface FetchKlineOptions {
  symbol: string
  period?: '1min' | '5min' | '15min' | '30min' | '60min' | 'daily' | 'weekly' | 'monthly'
  adjust?: 'qfq' | 'hfq' | ''
  count?: number
}

// ============================================================
// 数据获取函数
// ============================================================

/**
 * 获取股票基础信息（含实时行情）
 *
 * @param symbol 股票代码（如 600519）
 * @returns 基础数据或 null（请求失败时）
 */
export async function fetchBasicData(symbol: string): Promise<BasicData | null> {
  const url = `${API_COLLECT_BASIC}?symbol=${encodeURIComponent(symbol)}`

  const response = await safeFetch(
    url,
    {
      timeoutMs: 15000,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      },
      requireOk: true,
    },
    '[collect:basic]',
  )

  if (!response) {
    logger.warn(`[collect:basic] 请求失败: symbol=${symbol}`)
    return null
  }

  try {
    const result = (await response.json()) as CollectResponse<BasicData>

    if (!result.success) {
      logger.warn(`[collect:basic] 后端返回失败: symbol=${symbol} error=${result.error}`)
      return null
    }

    return result.data
  } catch (err) {
    logger.error(`[collect:basic] 解析响应失败: symbol=${symbol}`, {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/**
 * 获取股票K线数据
 *
 * @param options 请求参数
 * @returns K线数据或 null（请求失败时）
 */
export async function fetchKlineData(options: FetchKlineOptions): Promise<KlineData | null> {
  const { symbol, period = 'daily', adjust = 'qfq', count = 60 } = options

  const url = API_COLLECT_KLINE

  const response = await safeFetch(
    url,
    {
      timeoutMs: 15000,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, period, adjust, count }),
      },
      requireOk: true,
    },
    '[collect:kline]',
  )

  if (!response) {
    logger.warn(`[collect:kline] 请求失败: symbol=${symbol} period=${period}`)
    return null
  }

  try {
    const result = (await response.json()) as CollectResponse<KlineData>

    if (!result.success) {
      logger.warn(`[collect:kline] 后端返回失败: symbol=${symbol} error=${result.error}`)
      return null
    }

    return result.data
  } catch (err) {
    logger.error(`[collect:kline] 解析响应失败: symbol=${symbol}`, {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
