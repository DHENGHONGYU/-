/**
 * @fileoverview 数据源编排器 — 四层降级策略
 *
 * 职责：
 * - B-3: 四层降级编排（腾讯 → 新浪 → AKShare → Mock）
 * - B-4: 采集结果通过 DataBridge.forward() 写入 IndexedDB
 *
 * 降级链：
 *   getQuote(code):  腾讯 → 新浪 → AKShare → Mock
 *   getKline(code):  网易 → 腾讯 → Mock
 *
 * 每层失败自动切换备用源，全部失败返回 Mock 数据并标记 dataQuality=mock
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID, ENVELOPE_TARGET } from '@/config/dbConfig'
import type { DailyQuotes } from '@/data/types'
import type { KlineBar } from '@/data/types/types.marketData'
import {
  tencentQuote,
  tencentBatchQuotes,
  sinaQuote,
  sinaBatchQuotes,
  neteaseHistory,
  quoteToStock,
  klinesToDailyQuotes,
  type RealtimeQuote,
} from './directDataAPI'
import { getQualityMetrics } from './qualityMetricsCollector'

const logger = getLogger()

// ── 类型定义 ──

export type DataSource = 'tencent' | 'sina' | 'netease' | 'akshare' | 'mock'

export interface CollectionResult<T> {
  success: boolean
  data: T | null
  source: DataSource
  latency: number
  fallbackChain: DataSource[]
  error?: string
}

// ── Mock 兜底数据生成 ──

function mockQuote(code: string): RealtimeQuote {
  const basePrice = 10 + (parseInt(code.slice(-2)) || 50)
  const price = basePrice + (Math.random() - 0.5) * 2
  return {
    symbol: code,
    name: `股票${code}`,
    price: parseFloat(price.toFixed(2)),
    change: parseFloat((Math.random() - 0.5).toFixed(2)),
    changePercent: parseFloat(((Math.random() - 0.5) * 3).toFixed(2)),
    open: parseFloat((price - 0.5).toFixed(2)),
    high: parseFloat((price + 0.8).toFixed(2)),
    low: parseFloat((price - 0.8).toFixed(2)),
    volume: Math.floor(Math.random() * 1000000),
    amount: parseFloat((Math.random() * 100000000).toFixed(2)),
    timestamp: Date.now(),
  }
}

function mockKlines(code: string, days: number): KlineBar[] {
  const klines: KlineBar[] = []
  const basePrice = 10 + (parseInt(code.slice(-2)) || 50)
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')

    const prevClose = i < days - 1 ? klines[klines.length - 1]!.close : basePrice
    const open = prevClose + (Math.random() - 0.5) * 0.5
    const close = open + (Math.random() - 0.5) * 2
    const high = Math.max(open, close) + Math.random() * 0.8
    const low = Math.min(open, close) - Math.random() * 0.8

    klines.push({
      date: dateStr,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 50000000),
      amount: parseFloat((Math.random() * 500000000).toFixed(2)),
    })
  }
  return klines
}

// ── AKShare 占位（Python 库，浏览器不可用） ──

async function akshareQuote(_code: string): Promise<RealtimeQuote | null> {
  logger.debug('[orchestrator] AKShare 层跳过（浏览器不可用）')
  return null
}

// ── B-3: 四层降级编排 ──

/**
 * 获取实时行情（四层降级：腾讯 → 新浪 → AKShare → Mock）
 */
export async function getQuote(code: string): Promise<CollectionResult<RealtimeQuote>> {
  const chain: DataSource[] = []
  const start = Date.now()

  // 层 1: 腾讯
  chain.push('tencent')
  const tencentResult = await tencentQuote(code)
  if (tencentResult) {
    const result: CollectionResult<RealtimeQuote> = { success: true, data: tencentResult, source: 'tencent', latency: Date.now() - start, fallbackChain: chain }
    getQualityMetrics().recordCollect(true, 'tencent', result.latency, chain)
    return result
  }
  logger.warn(`[orchestrator] 腾讯行情失败，降级到新浪: ${code}`)

  // 层 2: 新浪
  chain.push('sina')
  const sinaResult = await sinaQuote(code)
  if (sinaResult) {
    const result: CollectionResult<RealtimeQuote> = { success: true, data: sinaResult, source: 'sina', latency: Date.now() - start, fallbackChain: chain }
    getQualityMetrics().recordCollect(true, 'sina', result.latency, chain)
    return result
  }
  logger.warn(`[orchestrator] 新浪行情失败，降级到 AKShare: ${code}`)

  // 层 3: AKShare
  chain.push('akshare')
  const akshareResult = await akshareQuote(code)
  if (akshareResult) {
    return { success: true, data: akshareResult, source: 'akshare', latency: Date.now() - start, fallbackChain: chain }
  }

  // 层 4: Mock
  chain.push('mock')
  logger.warn(`[orchestrator] 全部源失败，返回 Mock 数据: ${code}`)
  const finalResult: CollectionResult<RealtimeQuote> = {
    success: true,
    data: mockQuote(code),
    source: 'mock',
    latency: Date.now() - start,
    fallbackChain: chain,
    error: '所有真实数据源失败，使用 Mock 数据',
  }

  // G-3: 记录采集指标
  getQualityMetrics().recordCollect(finalResult.success, finalResult.source, finalResult.latency, finalResult.fallbackChain)

  return finalResult
}

/**
 * 批量获取实时行情
 */
export async function getBatchQuotes(codes: string[]): Promise<CollectionResult<RealtimeQuote[]>> {
  const chain: DataSource[] = ['tencent']
  const start = Date.now()

  // 层 1: 腾讯批量
  let results = await tencentBatchQuotes(codes)
  if (results.length > 0) {
    return { success: true, data: results, source: 'tencent', latency: Date.now() - start, fallbackChain: chain }
  }

  // 层 2: 新浪批量
  chain.push('sina')
  results = await sinaBatchQuotes(codes)
  if (results.length > 0) {
    return { success: true, data: results, source: 'sina', latency: Date.now() - start, fallbackChain: chain }
  }

  // 层 3: Mock 批量
  chain.push('mock')
  logger.warn('[orchestrator] 批量行情全部源失败，返回 Mock 数据')
  return {
    success: true,
    data: codes.map(mockQuote),
    source: 'mock',
    latency: Date.now() - start,
    fallbackChain: chain,
    error: '所有真实数据源失败',
  }
}

/**
 * 获取历史 K 线（三层降级：网易 → 腾讯 → Mock）
 */
export async function getKline(code: string, days: number): Promise<CollectionResult<KlineBar[]>> {
  const chain: DataSource[] = []
  const start = Date.now()
  const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const startDateObj = new Date()
  startDateObj.setDate(startDateObj.getDate() - days)
  const startDate = startDateObj.toISOString().slice(0, 10).replace(/-/g, '')

  // 层 1: 网易
  chain.push('netease')
  const neteaseResult = await neteaseHistory(code, startDate, endDate)
  if (neteaseResult.length > 0) {
    return { success: true, data: neteaseResult, source: 'netease', latency: Date.now() - start, fallbackChain: chain }
  }
  logger.warn(`[orchestrator] 网易K线失败，降级到 Mock: ${code}`)

  // 层 2: Mock（腾讯 K 线 API 格式复杂，暂跳过）
  chain.push('mock')
  logger.warn(`[orchestrator] K线全部真实源失败，返回 Mock: ${code}`)
  return {
    success: true,
    data: mockKlines(code, days),
    source: 'mock',
    latency: Date.now() - start,
    fallbackChain: chain,
    error: 'K线真实数据源失败',
  }
}

// ── B-4: DataBridge 写入 ──

/**
 * 采集实时行情并写入 IndexedDB（经 DataBridge.forward）
 */
export async function collectAndSaveQuote(code: string): Promise<CollectionResult<RealtimeQuote>> {
  const result = await getQuote(code)

  if (result.success && result.data) {
    try {
      // 通过 DataBridge 写入 stocks store
      await dataBridge.forward({
        meta: {
          source: MODULE_ID.fetcher,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.insertStock,
          traceId: `collect-quote-${code}-${Date.now()}`,
          timestamp: Date.now(),
        },
        payload: {
          store: STORE_NAME.stocks,
          data: quoteToStock(result.data),
        },
      })
      logger.info(`[orchestrator] 行情写入 DataBridge 成功: ${code}`, { source: result.source })
      getQualityMetrics().recordWrite(true)
    } catch (err) {
      logger.error(`[orchestrator] 行情写入 DataBridge 失败: ${code}`, { error: err instanceof Error ? err.message : String(err) })
      getQualityMetrics().recordWrite(false)
    }
  }

  return result
}

/**
 * 采集 K 线并写入 IndexedDB
 */
export async function collectAndSaveKline(code: string, days: number): Promise<CollectionResult<DailyQuotes>> {
  const result = await getKline(code, days)

  if (result.success && result.data && result.data.length > 0) {
    try {
      const dailyQuotes = klinesToDailyQuotes(code, result.data)
      await dataBridge.forward({
        meta: {
          source: MODULE_ID.fetcher,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.saveDailyQuotes,
          traceId: `collect-kline-${code}-${Date.now()}`,
          timestamp: Date.now(),
        },
        payload: {
          store: STORE_NAME.dailyQuotes,
          data: dailyQuotes,
        },
      })
      logger.info(`[orchestrator] K线写入 DataBridge 成功: ${code}`, { source: result.source, bars: result.data.length })
      return {
        success: true,
        data: dailyQuotes,
        source: result.source,
        latency: result.latency,
        fallbackChain: result.fallbackChain,
      }
    } catch (err) {
      logger.error(`[orchestrator] K线写入 DataBridge 失败: ${code}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    success: false,
    data: null,
    source: result.source,
    latency: result.latency,
    fallbackChain: result.fallbackChain,
    error: result.error ?? 'K线采集失败',
  }
}
