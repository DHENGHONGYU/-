/**
 * @fileoverview 数据源编排器 — 四层降级策略（配置化版本）。
 *
 * 职责：
 * - B-3: 按配置的数据源优先级链执行降级（腾讯 → 新浪 → AKShare → Mock）
 * - B-4: 采集结果通过 DataBridge.forward() 写入 IndexedDB
 * - 在降级、源成功/失败、写入等关键节点 emit 生命周期事件
 *
 * 本文件在保留旧入口 `getQuote`/`getKline` 兼容的同时，新增 `getQuoteWithConfig`/
 * `getKlineWithConfig`，支持运行时动态调整数据源优先级。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { withLogging } from '@/lib/logHelpers'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, ENVELOPE_TARGET } from '@/config/dbConfig'
import type { DailyQuotes } from '@/data/types'
import type { KlineBar } from '@/data/types/types.marketData'
import { eventBus } from '@/lib/eventBus'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import type { QuoteDataSourceId } from '@/types/modules/collection.types'
import {
  getDefaultQuotePriority,
  getDefaultKlinePriority,
} from '@/config/dataSourceRegistry'
import {
  tencentQuote,
  tencentBatchQuotes,
  tencentKline,
  sinaQuote,
  sinaBatchQuotes,
  neteaseHistory,
  quoteToStock,
  klinesToDailyQuotes,
  type RealtimeQuote,
} from './directDataAPI'
import {
  tushareDaily,
  tushareStockBasic,
  fromTushareCode,
  type TushareProviderError,
} from './tushareProvider'
import { mapDailyToQuote, mapDailyToKlines } from './tushareAdapter'
import { fetchBaostockKline } from './crawlerProvider'
import { getQualityMetrics } from './qualityMetricsCollector'
import { orderChainAdaptive, recordSourceResult } from './adaptiveSourceOrchestrator'

const logger = getLogger()

// ── 类型定义 ──

export type DataSource = QuoteDataSourceId

export interface CollectionResult<T> {
  success: boolean
  data: T | null
  source: DataSource
  latency: number
  fallbackChain: DataSource[]
  error?: string
}

export interface QuoteFetchConfig {
  /** 数据源优先级链（按优先级从高到低） */
  sourcePriority?: DataSource[]
  /** 追踪 ID */
  traceId?: string
  /** 任务 ID */
  taskId?: string
  /** 维度 code */
  dimensionCode?: string
  /**
   * 是否允许全源失败后降级到 Mock 数据（缺省 true 保持旧行为）。
   * 生产环境应传 false：全源失败返回 success:false，不写库、不计成功。
   */
  allowMockFallback?: boolean
}

export interface KlineFetchConfig {
  sourcePriority?: DataSource[]
  traceId?: string
  taskId?: string
  dimensionCode?: string
  /** 同 QuoteFetchConfig.allowMockFallback */
  allowMockFallback?: boolean
}

// ── Mock 数据常量 ──
/** Mock K线量最大值（模拟真实成交区间） */
const MOCK_VOLUME_MAX = 50_000_000
/** Mock K线额最大值 */
const MOCK_AMOUNT_MAX = 500_000_000

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

// ── Tushare 适配 ──

async function tushareQuote(code: string): Promise<RealtimeQuote | null> {
  try {
    const today = new Date()
    const endDate = today.toISOString().slice(0, 10).replace(/-/g, '')
    const start = new Date(today)
    start.setDate(start.getDate() - 10)
    const startDate = start.toISOString().slice(0, 10).replace(/-/g, '')
    const records = await tushareDaily(code, startDate, endDate)
    if (records.length === 0) return null
    const latest = records[records.length - 1]
    if (!latest) return null
    const quote = mapDailyToQuote(latest)
    // 补充名称：若 daily 无名称，尝试 stock_basic
    const basic = await tushareStockBasic(code)
    if (basic.length > 0) {
      const rawName = basic[0]?.name
      quote.name = fromTushareCode(typeof rawName === 'string' ? rawName : quote.name)
    }
    return quote
  } catch (err) {
    const code = (err as TushareProviderError)?.code ?? 'UNKNOWN'
    logger.warn(`[orchestrator] Tushare 行情失败: ${code}`, { error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

async function tushareKline(code: string, days: number): Promise<KlineBar[] | null> {
  try {
    const today = new Date()
    const endDate = today.toISOString().slice(0, 10).replace(/-/g, '')
    const start = new Date(today)
    start.setDate(start.getDate() - days - 5)
    const startDate = start.toISOString().slice(0, 10).replace(/-/g, '')
    const records = await tushareDaily(code, startDate, endDate)
    const klines = mapDailyToKlines(records)
    return klines.length > 0 ? klines.slice(-days) : null
  } catch (err) {
    logger.warn('[orchestrator] Tushare K线失败', { error: err instanceof Error ? err.message : String(err) })
    return null
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
      volume: Math.floor(Math.random() * MOCK_VOLUME_MAX),
      amount: parseFloat((Math.random() * MOCK_AMOUNT_MAX).toFixed(2)),
    })
  }
  return klines
}

// ── AKShare 占位（Python 库，浏览器不可用） ──

async function akshareQuote(_code: string): Promise<RealtimeQuote | null> {
  logger.debug('[orchestrator] AKShare 层跳过（浏览器不可用）')
  return null
}

// ── 事件发射辅助 ──

function emitLifecycleEvent(
  type: (typeof COLLECTION_EVENTS)[keyof typeof COLLECTION_EVENTS],
  params: {
    traceId: string
    taskId?: string
    dimensionCode?: string
    symbol: string
    sourceId?: DataSource
    durationMs?: number
    message: string
    error?: string
    payload?: Record<string, unknown>
  },
): void {
  try {
    eventBus.emit(type, {
      type,
      ...params,
      timestamp: Date.now(),
    })
  } catch (err) {
    logger.warn('[orchestrator] 生命周期事件发射失败', { error: err, type })
  }
}

function defaultQuotePriority(): DataSource[] {
  return getDefaultQuotePriority(true).map((item) => item.id)
}

function defaultKlinePriority(): DataSource[] {
  return getDefaultKlinePriority(true).map((item) => item.id)
}

// ── 单源行情尝试 ──

async function tryQuoteSource(code: string, source: DataSource): Promise<RealtimeQuote | null> {
  switch (source) {
    case 'tushare':
      return tushareQuote(code)
    case 'tencent':
      return tencentQuote(code)
    case 'sina':
      return sinaQuote(code)
    case 'akshare':
      return akshareQuote(code)
    case 'mock':
      return mockQuote(code)
    case 'netease':
    default:
      logger.warn(`[orchestrator] 数据源 ${source} 不支持实时行情，跳过: ${code}`)
      return null
  }
}

// ── B-3: 可配置降级编排 ──

function resolveSourcePriority<T extends DataSource>(
  configPriority: T[] | undefined,
  defaultPriority: () => T[],
): T[] {
  return configPriority && configPriority.length > 0 ? configPriority : defaultPriority()
}

function createTraceId(prefix: string, code: string): string {
  return `${prefix}-${code}-${Date.now()}`
}

/** 单源行情尝试结果（区分成功 / 空 / 异常，便于调用方精确保留事件序列） */
type QuoteAttempt =
  | { kind: 'success'; result: CollectionResult<RealtimeQuote> }
  | { kind: 'empty' }
  | { kind: 'error' }

/** 单源 K 线尝试结果 */
type KlineAttempt =
  | { kind: 'success'; result: CollectionResult<KlineBar[]> }
  | { kind: 'empty' }
  | { kind: 'error' }

/**
 * 尝试单个行情数据源（由 getQuoteWithConfig 的降级循环调用）。
 * 精确保留 SOURCE_SUCCESS / SOURCE_FAIL 事件与质量指标采集语义；
 * 每次尝试同步记录 EWMA 源健康指标（recordSourceResult）供自适应链排序消费。
 */
async function attemptQuoteSource(
  code: string,
  source: DataSource,
  index: number,
  chain: DataSource[],
  traceId: string,
  config: QuoteFetchConfig,
  start: number,
): Promise<QuoteAttempt> {
  const attemptStart = Date.now()
  try {
    const result = await tryQuoteSource(code, source)
    if (!result) {
      recordSourceResult(source, { success: false, isMock: false, latencyMs: Date.now() - attemptStart, completeness: 0 })
      return { kind: 'empty' }
    }
    const latency = Date.now() - start
    const fallbackChain = chain.slice(0, index + 1)
    recordSourceResult(source, { success: true, isMock: source === 'mock', latencyMs: Date.now() - attemptStart, completeness: 1 })
    getQualityMetrics().recordCollect(true, source, latency, fallbackChain)
    emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_SUCCESS, {
      traceId,
      taskId: config.taskId,
      dimensionCode: config.dimensionCode,
      symbol: code,
      sourceId: source,
      durationMs: latency,
      message: `${source} 获取成功`,
    })
    return { kind: 'success', result: { success: true, data: result, source, latency, fallbackChain } }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    recordSourceResult(source, { success: false, isMock: false, latencyMs: Date.now() - attemptStart, completeness: 0 })
    logger.warn(`[orchestrator] 数据源 ${source} 异常: ${code}`, { error: errorMsg })
    emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_FAIL, {
      traceId,
      taskId: config.taskId,
      dimensionCode: config.dimensionCode,
      symbol: code,
      sourceId: source,
      message: `${source} 异常`,
      error: errorMsg,
    })
    return { kind: 'error' }
  }
}

/**
 * 尝试单个 K 线数据源（由 getKlineWithConfig 的降级循环调用）。
 * 每次尝试同步记录 EWMA 源健康指标（recordSourceResult），完整度按返回条数/请求天数估算。
 */
async function attemptKlineSource(
  code: string,
  days: number,
  source: DataSource,
  index: number,
  chain: DataSource[],
  traceId: string,
  config: KlineFetchConfig,
  start: number,
): Promise<KlineAttempt> {
  const attemptStart = Date.now()
  try {
    const result = await tryKlineSource(code, days, source)
    if (!result || result.length === 0) {
      recordSourceResult(source, { success: false, isMock: false, latencyMs: Date.now() - attemptStart, completeness: 0 })
      return { kind: 'empty' }
    }
    const latency = Date.now() - start
    const fallbackChain = chain.slice(0, index + 1)
    const completeness = Math.min(1, result.length / Math.max(1, days))
    recordSourceResult(source, { success: true, isMock: source === 'mock', latencyMs: Date.now() - attemptStart, completeness })
    getQualityMetrics().recordCollect(true, source, latency, fallbackChain)
    emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_SUCCESS, {
      traceId,
      taskId: config.taskId,
      dimensionCode: config.dimensionCode,
      symbol: code,
      sourceId: source,
      durationMs: latency,
      message: `${source} K 线获取成功，共 ${result.length} 条`,
    })
    return { kind: 'success', result: { success: true, data: result, source, latency, fallbackChain } }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    recordSourceResult(source, { success: false, isMock: false, latencyMs: Date.now() - attemptStart, completeness: 0 })
    logger.warn(`[orchestrator] K 线数据源 ${source} 异常: ${code}`, { error: errorMsg })
    emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_FAIL, {
      traceId,
      taskId: config.taskId,
      dimensionCode: config.dimensionCode,
      symbol: code,
      sourceId: source,
      message: `${source} K 线异常`,
      error: errorMsg,
    })
    return { kind: 'error' }
  }
}

/**
 * 获取实时行情（按配置优先级链降级，链顺序经 orderChainAdaptive 按源健康分自适应重排）
 *
 * Mock 假绿灯防护：config.allowMockFallback === false 时，全源失败返回
 * success:false（附错误原因），不生成 mock 数据、不计采集成功；
 * 允许 mock 时返回的 result.source 恒为 'mock'，保证 dataProvenance 血缘标记正确。
 *
 * 内部实现（由 withLogging 包装后导出为 getQuoteWithConfig）。
 */
async function getQuoteWithConfigImpl(
  code: string,
  config: QuoteFetchConfig = {},
): Promise<CollectionResult<RealtimeQuote>> {
  const chain = orderChainAdaptive(resolveSourcePriority(config.sourcePriority, defaultQuotePriority))
  const traceId = config.traceId ?? createTraceId('quote', code)
  const start = Date.now()

  emitLifecycleEvent(COLLECTION_EVENTS.TRIGGERED, {
    traceId,
    taskId: config.taskId,
    dimensionCode: config.dimensionCode,
    symbol: code,
    message: `开始实时行情采集，降级链: ${chain.join(' > ')}`,
  })

  for (let i = 0; i < chain.length; i++) {
    const source = chain[i]!
    emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_START, {
      traceId,
      taskId: config.taskId,
      dimensionCode: config.dimensionCode,
      symbol: code,
      sourceId: source,
      message: `尝试数据源: ${source}`,
    })

    const attempt = await attemptQuoteSource(code, source, i, chain, traceId, config, start)
    if (attempt.kind === 'success') return attempt.result
    if (attempt.kind === 'error') continue

    emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_FAIL, {
      traceId,
      taskId: config.taskId,
      dimensionCode: config.dimensionCode,
      symbol: code,
      sourceId: source,
      message: `${source} 返回空`,
    })

    if (i < chain.length - 1) {
      const nextSource = chain[i + 1]
      const fallbackTarget = nextSource !== undefined ? nextSource : '无'
      emitLifecycleEvent(COLLECTION_EVENTS.FALLBACK, {
        traceId,
        taskId: config.taskId,
        dimensionCode: config.dimensionCode,
        symbol: code,
        sourceId: nextSource,
        message: `${source} 失败，降级到 ${fallbackTarget}`,
      })
      logger.warn(`[orchestrator] ${source} 行情失败，降级到 ${fallbackTarget}: ${code}`)
    }
  }

  const finalLatency = Date.now() - start

  // Mock 兜底禁用：全源失败即失败，不写假数据、不计成功（假绿灯修复）
  if (config.allowMockFallback === false) {
    const failedResult: CollectionResult<RealtimeQuote> = {
      success: false,
      data: null,
      source: chain[chain.length - 1] ?? 'mock',
      latency: finalLatency,
      fallbackChain: chain,
      error: '所有真实数据源失败，且 Mock 兜底已禁用',
    }
    getQualityMetrics().recordCollect(false, failedResult.source, finalLatency, chain)
    emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_FAIL, {
      traceId,
      taskId: config.taskId,
      dimensionCode: config.dimensionCode,
      symbol: code,
      sourceId: failedResult.source,
      durationMs: finalLatency,
      message: '全部数据源失败，Mock 兜底已禁用',
      error: failedResult.error,
    })
    logger.warn(`[orchestrator] 全部行情源失败且 Mock 已禁用: ${code}`)
    return failedResult
  }

  // Mock 兜底：source 恒为 'mock'，保证 dataProvenance 血缘可区分假数据
  recordSourceResult('mock', { success: true, isMock: true, latencyMs: finalLatency, completeness: 1 })
  const finalResult: CollectionResult<RealtimeQuote> = {
    success: true,
    data: mockQuote(code),
    source: 'mock',
    latency: finalLatency,
    fallbackChain: chain,
    error: '所有真实数据源失败，使用 Mock 数据',
  }

  getQualityMetrics().recordCollect(finalResult.success, finalResult.source, finalLatency, chain)
  emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_SUCCESS, {
    traceId,
    taskId: config.taskId,
    dimensionCode: config.dimensionCode,
    symbol: code,
    sourceId: finalResult.source,
    durationMs: finalLatency,
    message: '全部数据源失败，返回 Mock 数据',
    error: finalResult.error,
  })

  return finalResult
}

/**
 * getQuoteWithConfig — withLogging 包装版本（自动记录入口参数/耗时/返回结果/异常）。
 */
export const getQuoteWithConfig = withLogging(
  'orchestrator',
  'getQuoteWithConfig',
  getQuoteWithConfigImpl,
  { resultKeys: ['success', 'source', 'latency', 'fallbackChain', 'error'] },
)

/**
 * 获取实时行情（兼容旧入口，使用默认优先级链）
 */
export async function getQuote(code: string): Promise<CollectionResult<RealtimeQuote>> {
  return getQuoteWithConfig(code, { sourcePriority: defaultQuotePriority() })
}

/** 批量行情可选策略 */
export interface BatchQuotesOptions {
  /** 同 QuoteFetchConfig.allowMockFallback（缺省 true 保持旧行为） */
  allowMockFallback?: boolean
}

/**
 * 批量获取实时行情（sina/tencent 双源，顺序经 orderChainAdaptive 自适应重排）。
 *
 * Mock 假绿灯防护：options.allowMockFallback === false 时全源失败返回
 * success:false，不生成 mock 数据；允许 mock 时 source 恒为 'mock'。
 * 每个真实源的成败/延迟同步记录 EWMA 源健康指标。
 */
export async function getBatchQuotes(
  codes: string[],
  options: BatchQuotesOptions = {},
): Promise<CollectionResult<RealtimeQuote[]>> {
  const chain: DataSource[] = []
  const start = Date.now()

  for (const source of orderChainAdaptive<DataSource>(['sina', 'tencent'])) {
    chain.push(source)
    const attemptStart = Date.now()
    try {
      const results = source === 'sina' ? await sinaBatchQuotes(codes) : await tencentBatchQuotes(codes)
      if (results.length > 0) {
        recordSourceResult(source, { success: true, isMock: false, latencyMs: Date.now() - attemptStart, completeness: 1 })
        return { success: true, data: results, source, latency: Date.now() - start, fallbackChain: [...chain] }
      }
      recordSourceResult(source, { success: false, isMock: false, latencyMs: Date.now() - attemptStart, completeness: 0 })
    } catch (err) {
      recordSourceResult(source, { success: false, isMock: false, latencyMs: Date.now() - attemptStart, completeness: 0 })
      logger.warn(`[orchestrator] 批量行情源 ${source} 异常`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  // Mock 兜底禁用：全源失败即失败（假绿灯修复）
  if (options.allowMockFallback === false) {
    logger.warn('[orchestrator] 批量行情全部源失败，Mock 兜底已禁用')
    return {
      success: false,
      data: null,
      source: chain[chain.length - 1] ?? 'sina',
      latency: Date.now() - start,
      fallbackChain: chain,
      error: '所有真实数据源失败，且 Mock 兜底已禁用',
    }
  }

  chain.push('mock')
  recordSourceResult('mock', { success: true, isMock: true, latencyMs: Date.now() - start, completeness: 1 })
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

// ── K 线 ──

async function tryKlineSource(code: string, days: number, source: DataSource): Promise<KlineBar[] | null> {
  if (source === 'tushare') {
    return tushareKline(code, days)
  }
  if (source === 'tencent') {
    const result = await tencentKline(code, days)
    return result.length > 0 ? result : null
  }
  if (source === 'netease') {
    const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const startDateObj = new Date()
    startDateObj.setDate(startDateObj.getDate() - days)
    const startDate = startDateObj.toISOString().slice(0, 10).replace(/-/g, '')
    const result = await neteaseHistory(code, startDate, endDate)
    return result.length > 0 ? result : null
  }
  if (source === 'akshare') {
    const result = await fetchBaostockKline(code, days)
    return result.length > 0 ? result : null
  }
  if (source === 'mock') {
    return mockKlines(code, days)
  }
  logger.warn(`[orchestrator] 数据源 ${source} 不支持 K 线，跳过: ${code}`)
  return null
}

/**
 * 获取历史 K 线（按配置优先级链降级，链顺序经 orderChainAdaptive 自适应重排）
 *
 * Mock 假绿灯防护同 getQuoteWithConfig：allowMockFallback === false 时全源失败
 * 返回 success:false；允许 mock 时 result.source 恒为 'mock'。
 *
 * 内部实现（由 withLogging 包装后导出为 getKlineWithConfig）。
 */
async function getKlineWithConfigImpl(
  code: string,
  days: number,
  config: KlineFetchConfig = {},
): Promise<CollectionResult<KlineBar[]>> {
  const chain = orderChainAdaptive(resolveSourcePriority(config.sourcePriority, defaultKlinePriority))
  const traceId = config.traceId ?? createTraceId('kline', code)
  const start = Date.now()

  emitLifecycleEvent(COLLECTION_EVENTS.TRIGGERED, {
    traceId,
    taskId: config.taskId,
    dimensionCode: config.dimensionCode,
    symbol: code,
    message: `开始 K 线采集，降级链: ${chain.join(' > ')}`,
  })

  for (let i = 0; i < chain.length; i++) {
    const source = chain[i]!
    emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_START, {
      traceId,
      taskId: config.taskId,
      dimensionCode: config.dimensionCode,
      symbol: code,
      sourceId: source,
      message: `尝试 K 线数据源: ${source}`,
    })

    const attempt = await attemptKlineSource(code, days, source, i, chain, traceId, config, start)
    if (attempt.kind === 'success') return attempt.result
    if (attempt.kind === 'error') continue

    emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_FAIL, {
      traceId,
      taskId: config.taskId,
      dimensionCode: config.dimensionCode,
      symbol: code,
      sourceId: source,
      message: `${source} K 线返回空`,
    })

    if (i < chain.length - 1) {
      const nextSource = chain[i + 1]
      const fallbackTarget = nextSource !== undefined ? nextSource : '无'
      emitLifecycleEvent(COLLECTION_EVENTS.FALLBACK, {
        traceId,
        taskId: config.taskId,
        dimensionCode: config.dimensionCode,
        symbol: code,
        sourceId: nextSource,
        message: `${source} K 线失败，降级到 ${fallbackTarget}`,
      })
      logger.warn(`[orchestrator] ${source} K线失败，降级到 ${fallbackTarget}: ${code}`)
    }
  }

  const finalLatency = Date.now() - start

  // Mock 兜底禁用：全源失败即失败，不写假数据、不计成功（假绿灯修复）
  if (config.allowMockFallback === false) {
    const failedResult: CollectionResult<KlineBar[]> = {
      success: false,
      data: null,
      source: chain[chain.length - 1] ?? 'mock',
      latency: finalLatency,
      fallbackChain: chain,
      error: 'K 线真实数据源失败，且 Mock 兜底已禁用',
    }
    getQualityMetrics().recordCollect(false, failedResult.source, finalLatency, chain)
    emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_FAIL, {
      traceId,
      taskId: config.taskId,
      dimensionCode: config.dimensionCode,
      symbol: code,
      sourceId: failedResult.source,
      durationMs: finalLatency,
      message: 'K 线全部数据源失败，Mock 兜底已禁用',
      error: failedResult.error,
    })
    logger.warn(`[orchestrator] 全部 K 线源失败且 Mock 已禁用: ${code}`)
    return failedResult
  }

  // Mock 兜底：source 恒为 'mock'，保证血缘可区分假数据
  recordSourceResult('mock', { success: true, isMock: true, latencyMs: finalLatency, completeness: 1 })
  const finalResult: CollectionResult<KlineBar[]> = {
    success: true,
    data: mockKlines(code, days),
    source: 'mock',
    latency: finalLatency,
    fallbackChain: chain,
    error: 'K 线真实数据源失败，使用 Mock 数据',
  }

  getQualityMetrics().recordCollect(finalResult.success, finalResult.source, finalLatency, chain)
  emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_SUCCESS, {
    traceId,
    taskId: config.taskId,
    dimensionCode: config.dimensionCode,
    symbol: code,
    sourceId: finalResult.source,
    durationMs: finalLatency,
    message: 'K 线全部数据源失败，返回 Mock 数据',
    error: finalResult.error,
  })

  return finalResult
}

/**
 * getKlineWithConfig — withLogging 包装版本（自动记录入口参数/耗时/返回结果/异常）。
 */
export const getKlineWithConfig = withLogging(
  'orchestrator',
  'getKlineWithConfig',
  getKlineWithConfigImpl,
  { resultKeys: ['success', 'source', 'latency', 'fallbackChain', 'error'] },
)

/**
 * 获取历史 K 线（兼容旧入口）
 */
export async function getKline(code: string, days: number): Promise<CollectionResult<KlineBar[]>> {
  return getKlineWithConfig(code, days, { sourcePriority: defaultKlinePriority() })
}

// ── B-4: DataBridge 写入 ──

/**
 * 采集实时行情并写入 IndexedDB（经 DataBridge.forward）
 */
export async function collectAndSaveQuote(code: string): Promise<CollectionResult<RealtimeQuote>> {
  const result = await getQuote(code)

  if (result.success && result.data) {
    try {
      emitLifecycleEvent(COLLECTION_EVENTS.WRITE_START, {
        traceId: `collect-quote-${code}-${Date.now()}`,
        symbol: code,
        sourceId: result.source,
        message: '准备写入行情到 IndexedDB',
      })

      await dataBridge.forward({
        meta: {
          source: MODULE_ID.fetcher,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.insertStock,
          traceId: `collect-quote-${code}-${Date.now()}`,
          timestamp: Date.now(),
        },
        payload: quoteToStock(result.data, result.source),
      })
      logger.info(`[orchestrator] 行情写入 DataBridge 成功: ${code}`, { source: result.source })
      getQualityMetrics().recordWrite(true)
      emitLifecycleEvent(COLLECTION_EVENTS.WRITE_SUCCESS, {
        traceId: `collect-quote-${code}-${Date.now()}`,
        symbol: code,
        sourceId: result.source,
        message: '行情写入 IndexedDB 成功',
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error(`[orchestrator] 行情写入 DataBridge 失败: ${code}`, { error: errorMsg })
      getQualityMetrics().recordWrite(false)
      emitLifecycleEvent(COLLECTION_EVENTS.WRITE_FAIL, {
        traceId: `collect-quote-${code}-${Date.now()}`,
        symbol: code,
        sourceId: result.source,
        message: '行情写入 IndexedDB 失败',
        error: errorMsg,
      })
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
      emitLifecycleEvent(COLLECTION_EVENTS.WRITE_START, {
        traceId: `collect-kline-${code}-${Date.now()}`,
        symbol: code,
        sourceId: result.source,
        message: '准备写入 K 线到 IndexedDB',
      })

      const dailyQuotes = klinesToDailyQuotes(code, result.data, result.source)
      await dataBridge.forward({
        meta: {
          source: MODULE_ID.fetcher,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.saveDailyQuotes,
          traceId: `collect-kline-${code}-${Date.now()}`,
          timestamp: Date.now(),
        },
        payload: dailyQuotes,
      })
      logger.info(`[orchestrator] K线写入 DataBridge 成功: ${code}`, { source: result.source, bars: result.data.length })
      getQualityMetrics().recordWrite(true)
      emitLifecycleEvent(COLLECTION_EVENTS.WRITE_SUCCESS, {
        traceId: `collect-kline-${code}-${Date.now()}`,
        symbol: code,
        sourceId: result.source,
        message: 'K 线写入 IndexedDB 成功',
      })
      return {
        success: true,
        data: dailyQuotes,
        source: result.source,
        latency: result.latency,
        fallbackChain: result.fallbackChain,
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error(`[orchestrator] K线写入 DataBridge 失败: ${code}`, { error: errorMsg })
      getQualityMetrics().recordWrite(false)
      emitLifecycleEvent(COLLECTION_EVENTS.WRITE_FAIL, {
        traceId: `collect-kline-${code}-${Date.now()}`,
        symbol: code,
        sourceId: result.source,
        message: 'K 线写入 IndexedDB 失败',
        error: errorMsg,
      })
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

// ── 连通性测试 ──

export interface SourceConnectivityResult {
  ok: boolean
  latencyMs: number
  message: string
}

const TEST_SYMBOL_QUOTE = '000001.SZ'
const TEST_SYMBOL_KLINE = '000001.SZ'
const TEST_KLINE_DAYS = 5

/**
 * 测试单个数据源的连通性（不触发降级，直接探测）。
/**
 * 探测单数据源连通性（testSourceConnectivity 内部使用，不触发降级）。
 */
async function probeSource(source: DataSource, start: number): Promise<SourceConnectivityResult> {
  if (source === 'tencent' || source === 'sina') {
    const result = await tryQuoteSource(TEST_SYMBOL_QUOTE, source)
    if (result) return { ok: true, latencyMs: Date.now() - start, message: `${source} 连通正常` }
    return { ok: false, latencyMs: Date.now() - start, message: `${source} 返回空` }
  }

  if (source === 'netease') {
    const result = await tryKlineSource(TEST_SYMBOL_KLINE, TEST_KLINE_DAYS, source)
    if (result && result.length > 0) {
      return { ok: true, latencyMs: Date.now() - start, message: `网易 K 线连通，返回 ${result.length} 条` }
    }
    return { ok: false, latencyMs: Date.now() - start, message: '网易 K 线返回空' }
  }

  return { ok: false, latencyMs: Date.now() - start, message: `未知数据源 ${String(source)}` }
}

/**
 * 测试指定数据源的连接连通性。
 * @param source 数据源标识（如 mock, market 等）
 * @returns 连通性结果（ok、延迟、消息）
 */
export async function testSourceConnectivity(source: DataSource): Promise<SourceConnectivityResult> {
  const start = Date.now()

  if (source === 'mock') {
    mockQuote(TEST_SYMBOL_QUOTE)
    return { ok: true, latencyMs: Date.now() - start, message: 'Mock 数据源就绪' }
  }

  if (source === 'akshare') {
    return { ok: false, latencyMs: Date.now() - start, message: 'AKShare 在浏览器环境不可用（需 Python 服务）' }
  }

  try {
    return await probeSource(source, start)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, latencyMs: Date.now() - start, message }
  }
}
