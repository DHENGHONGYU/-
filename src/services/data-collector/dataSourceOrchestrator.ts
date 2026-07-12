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
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID, ENVELOPE_TARGET } from '@/config/dbConfig'
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
}

export interface KlineFetchConfig {
  sourcePriority?: DataSource[]
  traceId?: string
  taskId?: string
  dimensionCode?: string
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
 * 精确保留 SOURCE_SUCCESS / SOURCE_FAIL 事件与质量指标采集语义。
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
  try {
    const result = await tryQuoteSource(code, source)
    if (!result) return { kind: 'empty' }
    const latency = Date.now() - start
    const fallbackChain = chain.slice(0, index + 1)
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
  try {
    const result = await tryKlineSource(code, days, source)
    if (!result || result.length === 0) return { kind: 'empty' }
    const latency = Date.now() - start
    const fallbackChain = chain.slice(0, index + 1)
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
 * 获取实时行情（按配置优先级链降级）
 */
export async function getQuoteWithConfig(
  code: string,
  config: QuoteFetchConfig = {},
): Promise<CollectionResult<RealtimeQuote>> {
  const chain = resolveSourcePriority(config.sourcePriority, defaultQuotePriority)
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
      emitLifecycleEvent(COLLECTION_EVENTS.FALLBACK, {
        traceId,
        taskId: config.taskId,
        dimensionCode: config.dimensionCode,
        symbol: code,
        sourceId: nextSource,
        message: `${source} 失败，降级到 ${nextSource !== undefined ? nextSource : '无'}`,
      })
      logger.warn(`[orchestrator] ${source} 行情失败，降级到 ${nextSource !== undefined ? nextSource : '结束'}: ${code}`)
    }
  }

  // 全部失败（理论上 chain 最后一个应为 mock）
  const finalLatency = Date.now() - start
  const finalSource = chain[chain.length - 1] ?? 'mock'
  const finalResult: CollectionResult<RealtimeQuote> = {
    success: true,
    data: mockQuote(code),
    source: finalSource,
    latency: finalLatency,
    fallbackChain: chain,
    error: '所有真实数据源失败，使用 Mock 数据',
  }

  getQualityMetrics().recordCollect(finalResult.success, finalSource, finalLatency, chain)
  emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_SUCCESS, {
    traceId,
    taskId: config.taskId,
    dimensionCode: config.dimensionCode,
    symbol: code,
    sourceId: finalSource,
    durationMs: finalLatency,
    message: '全部数据源失败，返回 Mock 数据',
    error: finalResult.error,
  })

  return finalResult
}

/**
 * 获取实时行情（兼容旧入口，使用默认优先级链）
 */
export async function getQuote(code: string): Promise<CollectionResult<RealtimeQuote>> {
  return getQuoteWithConfig(code, { sourcePriority: defaultQuotePriority() })
}

/**
 * 尝试单一层批量数据源，返回结果或非空时 null。
 * 将 `results.length > 0` 判断收敛到单一位置，避免 getBatchQuotes 内重复条件。
 */
async function tryBatchSource(
  fetch: () => Promise<RealtimeQuote[]>,
  source: DataSource,
  start: number,
  chain: DataSource[],
): Promise<CollectionResult<RealtimeQuote[]> | null> {
  const results = await fetch()
  if (results.length > 0) {
    return { success: true, data: results, source, latency: Date.now() - start, fallbackChain: chain }
  }
  return null
}

/**
 * 批量获取实时行情（仍使用默认优先级链，暂不支持单维度配置）
 */
export async function getBatchQuotes(codes: string[]): Promise<CollectionResult<RealtimeQuote[]>> {
  const chain: DataSource[] = ['tencent']
  const start = Date.now()

  // 层 1: 腾讯批量
  const tencentResult = await tryBatchSource(() => tencentBatchQuotes(codes), 'tencent', start, chain)
  if (tencentResult) {
    return tencentResult
  }

  // 层 2: 新浪批量
  chain.push('sina')
  const sinaResult = await tryBatchSource(() => sinaBatchQuotes(codes), 'sina', start, chain)
  if (sinaResult) {
    return sinaResult
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

// ── K 线 ──

async function tryKlineSource(code: string, days: number, source: DataSource): Promise<KlineBar[] | null> {
  if (source === 'netease') {
    const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const startDateObj = new Date()
    startDateObj.setDate(startDateObj.getDate() - days)
    const startDate = startDateObj.toISOString().slice(0, 10).replace(/-/g, '')
    const result = await neteaseHistory(code, startDate, endDate)
    return result.length > 0 ? result : null
  }
  if (source === 'mock') {
    return mockKlines(code, days)
  }
  logger.warn(`[orchestrator] 数据源 ${source} 不支持 K 线，跳过: ${code}`)
  return null
}

/**
 * 获取历史 K 线（按配置优先级链降级）
 */
export async function getKlineWithConfig(
  code: string,
  days: number,
  config: KlineFetchConfig = {},
): Promise<CollectionResult<KlineBar[]>> {
  const chain = resolveSourcePriority(config.sourcePriority, defaultKlinePriority)
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
      emitLifecycleEvent(COLLECTION_EVENTS.FALLBACK, {
        traceId,
        taskId: config.taskId,
        dimensionCode: config.dimensionCode,
        symbol: code,
        sourceId: nextSource,
        message: `${source} K 线失败，降级到 ${nextSource !== undefined ? nextSource : '无'}`,
      })
      logger.warn(`[orchestrator] ${source} K线失败，降级到 ${nextSource !== undefined ? nextSource : '结束'}: ${code}`)
    }
  }

  const finalLatency = Date.now() - start
  const finalSource = chain[chain.length - 1] ?? 'mock'
  const finalData = mockKlines(code, days)
  const finalResult: CollectionResult<KlineBar[]> = {
    success: true,
    data: finalData,
    source: finalSource,
    latency: finalLatency,
    fallbackChain: chain,
    error: 'K 线真实数据源失败，使用 Mock 数据',
  }

  getQualityMetrics().recordCollect(finalResult.success, finalSource, finalLatency, chain)
  emitLifecycleEvent(COLLECTION_EVENTS.SOURCE_SUCCESS, {
    traceId,
    taskId: config.taskId,
    dimensionCode: config.dimensionCode,
    symbol: code,
    sourceId: finalSource,
    durationMs: finalLatency,
    message: 'K 线全部数据源失败，返回 Mock 数据',
    error: finalResult.error,
  })

  return finalResult
}

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
        payload: {
          store: STORE_NAME.stocks,
          data: quoteToStock(result.data),
        },
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
 */
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
