/**
 * @fileoverview collectionPipeline
 * @description 配置化采集流水线。
 *
 * 根据 `CollectionConfig` 执行单次/批量采集：
 * - 按维度配置生成数据源优先级链
 * - 调用 `dataSourceOrchestrator` 获取数据
 * - 通过 `DataBridge.forward()` 写入 IndexedDB
 * - 每个阶段 emit `CollectionLifecycleEvent`
 *
 * 注意：本 service 不依赖任何 store，配置由调用方（store / UI）传入。
 */

import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { MOCK_NEWS_URL_TEMPLATE } from '@/config/marketDataEndpoints'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, ENVELOPE_TARGET } from '@/config/dbConfig'
import type { EnvelopeAction } from '@/config/dbConfig'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import type {
  CollectionConfig,
  DimensionPipelineConfig,
  QuoteDataSourceId,
  SourcePriorityItem,
  CollectionTraceSpan,
  CollectionStageRecord,
  CollectionLifecycleEvent,
} from '@/types/modules/collection.types'
import {
  getQuoteWithConfig,
  getKlineWithConfig,
} from './dataSourceOrchestrator'
import {
  quoteToStock,
  klinesToDailyQuotes,
  type RealtimeQuote,
} from './directDataAPI'
import { getQualityMetrics } from './qualityMetricsCollector'
import type { KlineBar } from '@/data/types/types.marketData'
import { saveTraceRecord } from './tracePersistenceService'
import { fetchDimensionData } from './multiSourceFetcher'
import { detect as detectMissing } from './missingReportDetector'
import { MISSING_REPORT_TYPE } from '@/constants/execution.constants'

const logger = getLogger()

// ── 类型 ──

type CollectionMode = 'quote' | 'kline' | 'news' | 'research' | 'competitor' | 'index' | 'chip' | 'unsupported'

interface RunSingleTraceOptions {
  symbol: string
  dimensionCode: string
  config: CollectionConfig
  parentTaskId?: string
}

interface RunBatchTraceOptions {
  symbols: string[]
  dimensionCode: string
  config: CollectionConfig
  parentTaskId?: string
}

interface TraceResult {
  success: boolean
  symbol: string
  dimensionCode: string
  source?: QuoteDataSourceId
  latency: number
  fallbackCount: number
  error?: string
}

export type { TraceResult }

// ── 常量 ──

const DIMENSION_TO_MODE: Readonly<Record<string, CollectionMode>> = {
  '01': 'quote',
  '02': 'kline',
  '03': 'chip',
  '04': 'news',
  '05': 'news',
  '06': 'competitor',
  '07': 'index',
  '08': 'research',
}

// ── Mock 维度数据生成器 ──

/** 用标的与维度生成确定性哈希，保证同股票同维度 mock 数据一致 */
function mockHash(symbol: string, dimensionCode: string): number {
  let h = 0
  const str = `${symbol}:${dimensionCode}`
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0x7fffffff
  return h
}

function generateMockChipData(symbol: string): Record<string, unknown> {
  const seed = mockHash(symbol, '03')
  return {
    id: `chip-${symbol}`,
    symbol,
    concentrationRatio: 20 + (seed % 40),
    avgCost: 10 + (seed % 90),
    profitRatio90: -(seed % 30),
    profitRatio70: -(seed % 20),
    pressureLevels: [10 + (seed % 5), 15 + (seed % 8), 25 + (seed % 10)],
    supportLevels: [5 + (seed % 3), 8 + (seed % 4)],
    dataDate: new Date().toISOString().slice(0, 10),
    _mock: true,
  }
}

function generateMockNewsItem(symbol: string, dimensionCode: string): Record<string, unknown> {
  const seed = mockHash(symbol, dimensionCode)
  const titles: Record<string, string[]> = {
    '04': [`${symbol} 2025 年报发布`, `${symbol} 重大资产重组进展`, `${symbol} 分红派息公告`],
    '05': [`【热点】${symbol} 获机构密集调研`, `市场关注：${symbol} 技术突破`, `${symbol} 入选行业龙头指数`],
  }
  const titleList = titles[dimensionCode] ?? [`${symbol} 相关资讯`]
  return {
    id: `news-${dimensionCode}-${symbol}-${Date.now()}`,
    title: titleList[seed % titleList.length]!,
    content: `这是关于 ${symbol} 的${dimensionCode === '04' ? '重大事项' : '热点新闻'} mock 数据内容。`,
    url: `${MOCK_NEWS_URL_TEMPLATE}/${symbol}`,
    source: 'mock',
    category: dimensionCode === '04' ? 'announcement' : 'hot_news',
    publishTime: new Date(Date.now() - seed % 86400000).toISOString(),
    fetchTime: new Date().toISOString(),
    sentiment: (['positive', 'neutral', 'negative'] as const)[seed % 3],
    sentimentConfidence: 0.5 + (seed % 50) / 100,
    relatedStocks: [symbol],
    keywords: [symbol, dimensionCode === '04' ? '公告' : '热点'],
    hash: `mock-${seed}`,
    _mock: true,
  }
}

function generateMockCompetitorData(symbol: string): Record<string, unknown> {
  const seed = mockHash(symbol, '06')
  const fakeCompetitors = ['COMP1', 'COMP2', 'COMP3']
  return {
    id: `competitor-${symbol}-${Date.now()}`,
    sectorCode: `SECTOR-${seed % 10}`,
    scoreDate: new Date().toISOString().slice(0, 10),
    dimensions: {
      marketShare: 5 + (seed % 30),
      revenueGrowth: -(seed % 20) + 10,
      profitability: 5 + (seed % 25),
      innovation: 3 + (seed % 10),
    },
    composite: 40 + (seed % 50),
    isCore: (seed % 3) === 0,
    modelUsed: 'mock-v1',
    createdAt: new Date().toISOString(),
    competitors: fakeCompetitors.map((c) => ({
      symbol: c,
      score: 30 + ((seed + c.charCodeAt(0)) % 60),
    })),
    _mock: true,
  }
}

function generateMockIndexCorrelation(symbol: string): Record<string, unknown> {
  const seed = mockHash(symbol, '07')
  const indices = ['000300.SH', '000905.SH', '399006.SZ']
  return {
    id: `index-corr-${symbol}-${Date.now()}`,
    sectorCode: `IDX-CORR-${seed % 5}`,
    scoreDate: new Date().toISOString().slice(0, 10),
    dimensions: {
      correlation: 0.3 + (seed % 50) / 100,
      beta: 0.5 + (seed % 150) / 100,
      alpha: -(seed % 10),
      trackingError: 0.1 + (seed % 20) / 100,
    },
    composite: 30 + (seed % 60),
    isCore: true,
    modelUsed: 'mock-v1',
    createdAt: new Date().toISOString(),
    relatedIndices: indices.map((idx) => ({
      code: idx,
      correlation: 0.2 + ((idx.charCodeAt(0) + seed) % 80) / 100,
    })),
    _mock: true,
  }
}

function generateMockResearchReport(symbol: string): Record<string, unknown> {
  const seed = mockHash(symbol, '08')
  const institutions = ['中信证券', '华泰证券', '招商证券', '中金公司']
  const ratings = ['买入', '增持', '中性', '减持']
  return {
    id: seed % 100000,
    traceId: `research-${symbol}-${Date.now()}`,
    timestamp: Date.now(),
    actor: 'mock-collector',
    action: 'save_research',
    targetType: 'stock',
    targetCode: symbol,
    payload: JSON.stringify({
      symbol,
      institution: institutions[seed % institutions.length],
      rating: ratings[seed % ratings.length],
      targetPrice: (10 + (seed % 90)) * (1 + (seed % 10) / 100),
      reportDate: new Date(Date.now() - (seed % 30) * 86400000).toISOString().slice(0, 10),
      title: `${symbol} 深度研究报告`,
      summary: `这是 ${symbol} 的 mock 研报摘要。`,
      _mock: true,
    }),
    _mock: true,
  }
}

// ── 通用维度 mock 写入 ──

/** 非行情维度（03–08）的统一 mock 写入入口 */
async function writeMockDimensionData(
  symbol: string,
  dimensionCode: string,
  data: Record<string, unknown>,
  action: EnvelopeAction,
): Promise<void> {
  // WAP Audit：校验 mock 数据关键字段
  const storeForDim: Record<string, string> = {
    '03': 'news', '04': 'news', '05': 'news',
    '06': 'sectorScores', '07': 'sectorScores',
    '08': 'researchLogs',
  }
  const targetStore = storeForDim[dimensionCode]
  if (targetStore) auditRecord(targetStore, data)

  await dataBridge.forward({
    meta: {
      source: MODULE_ID.fetcher,
      target: ENVELOPE_TARGET.db,
      action,
      traceId: `pipeline-${dimensionCode}-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
    },
    payload: data,
  })
}

/** 维度 → ENVELOPE_ACTION 映射（非行情维度写入时使用） */
const DIMENSION_TO_ACTION: Readonly<Record<string, EnvelopeAction>> = {
  '03': ENVELOPE_ACTION.saveNews,             // 筹码 → news store (带 _mock 标记)
  '04': ENVELOPE_ACTION.saveNews,             // 重大事项 → news store
  '05': ENVELOPE_ACTION.saveNews,             // 热点新闻 → news store
  '06': ENVELOPE_ACTION.saveSectorScores,     // 行业竞品 → sector_scores store
  '07': ENVELOPE_ACTION.saveSectorScores,     // 关联指数 → sector_scores store
  '08': ENVELOPE_ACTION.saveResearchLog,      // 研报中心 → research_logs store
}

// ── 通用维度 mock 数据路由 ──

/**
 * 生成维度数据：优先尝试真实数据源，失败时回退到 Mock。
 * @convergence Phase C: multiSourceFetcher 拉取真实数据，Mock 作为降级回退
 */
async function generateDataForDimension(symbol: string, dimensionCode: string): Promise<Record<string, unknown>> {
  let fallbackReason = ''
  // 尝试真实数据源
  try {
    const realData = await fetchDimensionData(symbol, dimensionCode)
    if (realData) {
      logger.debug(`[collectionPipeline] 维度 ${dimensionCode} 真实数据获取成功: ${symbol}`)
      const source = (realData._source as string) || 'real'
      return { ...realData, _source: source, _fallbackReason: '' }
    }
    fallbackReason = 'real_source_returned_empty'
  } catch (err) {
    logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 真实数据获取失败: ${symbol}`, { error: String(err) })
    fallbackReason = `real_source_threw: ${err instanceof Error ? err.message : String(err)}`
  }

  // 降级到 Mock
  if (import.meta.env.PROD) {
    logger.warn(`[collectionPipeline] PROD 环境降级 Mock: 维度 ${dimensionCode}（${symbol}）。原因: ${fallbackReason}`)
  }
  let mockResult: Record<string, unknown>
  switch (dimensionCode) {
    case '03': mockResult = generateMockChipData(symbol); break
    case '04': mockResult = generateMockNewsItem(symbol, '04'); break
    case '05': mockResult = generateMockNewsItem(symbol, '05'); break
    case '06': mockResult = generateMockCompetitorData(symbol); break
    case '07': mockResult = generateMockIndexCorrelation(symbol); break
    case '08': mockResult = generateMockResearchReport(symbol); break
    default: mockResult = { _mock: true, error: `unknown dimension: ${dimensionCode}` }; break
  }
  return { ...mockResult, _source: 'mock', _fallbackReason: fallbackReason }
}

/** 业务数据源 → 直连行情数据源的默认映射（MVP 阶段） */
const BUSINESS_TO_QUOTE_SOURCE: Readonly<Record<string, QuoteDataSourceId[]>> = {
  akshare: ['akshare'],
  ifind: ['tencent', 'sina'],
  yahoo: ['tencent', 'sina'],
  tianyancha: ['mock'],
  scholar: ['mock'],
  cache: ['mock'],
}

// ── 事件发射 ──

function emit(
  type: (typeof COLLECTION_EVENTS)[keyof typeof COLLECTION_EVENTS],
  params: Omit<CollectionLifecycleEvent, 'type' | 'timestamp'>,
): void {
  try {
    eventBus.emit(type, {
      ...params,
      type,
      timestamp: Date.now(),
    })
  } catch (err) {
    logger.warn('[collectionPipeline] 事件发射失败', { error: err, type })
  }
}

function traceIdFor(symbol: string, dimensionCode: string): string {
  return `trace-${dimensionCode}-${symbol}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── 配置映射 ──

/**
 * resolveDimensionMode
 * @param dimensionCode
 * @returns CollectionMode
 */
export function resolveDimensionMode(dimensionCode: string): CollectionMode {
  return DIMENSION_TO_MODE[dimensionCode] ?? 'unsupported'
}

/**
 * buildDefaultSourcePriority
 */
export function buildDefaultSourcePriority(
  dimension: DimensionPipelineConfig,
): SourcePriorityItem[] {
  const seen = new Set<QuoteDataSourceId>()
  const items: SourcePriorityItem[] = []
  let priority = 1

  for (const businessSource of dimension.sources) {
    const mapped = BUSINESS_TO_QUOTE_SOURCE[businessSource] ?? ['mock']
    for (const id of mapped) {
      if (seen.has(id)) continue
      seen.add(id)
      items.push({ id, priority, enabled: true })
      priority++
    }
  }

  // 兜底：确保至少包含 mock
  if (!seen.has('mock')) {
    items.push({ id: 'mock', priority, enabled: true })
  }

  return items.sort((a, b) => a.priority - b.priority)
}

/**
 * resolveQuoteChain
 * @param dimension
 * @returns QuoteDataSourceId[]
 */
export function resolveQuoteChain(dimension: DimensionPipelineConfig): QuoteDataSourceId[] {
  const chain = dimension.sourcePriority && dimension.sourcePriority.length > 0
    ? dimension.sourcePriority
    : buildDefaultSourcePriority(dimension)
  return chain
    .filter((item) => item.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.id)
}

/**
 * resolveKlineChain
 * @param dimension
 * @returns QuoteDataSourceId[]
 */
export function resolveKlineChain(dimension: DimensionPipelineConfig): QuoteDataSourceId[] {
  const quoteChain = resolveQuoteChain(dimension)
  // 腾讯同时支持行情+K线，优先使用
  const klineSources = quoteChain.filter((id) => id !== 'mock')
  if (klineSources.length > 0) return [...klineSources, 'mock']
  return ['mock']
}

/**
 * getDimensionConfig
 */
export function getDimensionConfig(
  config: CollectionConfig,
  dimensionCode: string,
): DimensionPipelineConfig | undefined {
  return config.dimensions.find((dim) => dim.code === dimensionCode)
}

// ── DB 写入 ──

/**
 * 写入后数据质量断言（WAP 模式 Audit 阶段）。
 * 校验关键字段非空，防止"写入成功但数据无效"的假绿灯。
 *
 * @param storeName - 目标存储名（用于选择校验规则）
 * @param payload - 已写入的记录
 * @throws Error 如果关键字段缺失或为空
 */
function auditRecord(storeName: string, payload: unknown): void {
  if (payload == null) {
    throw new Error(`[auditRecord] ${storeName}: payload 为 null/undefined`)
  }
  const record = payload as Record<string, unknown>

  // 按存储定义必填字段
  const requiredFields: Record<string, string[]> = {
    stocks: ['symbol'],
    dailyQuotes: ['symbol'],
    news: ['id'],
    sectorScores: ['id'],
    researchLogs: ['id'],
    traceRecords: ['traceId'],
  }

  const required = requiredFields[storeName]
  if (!required) return // 无校验规则的存储跳过

  for (const field of required) {
    const value = record[field]
    if (value == null || (typeof value === 'string' && value.trim() === '')) {
      throw new Error(`[auditRecord] ${storeName}: 必填字段 "${field}" 为空`)
    }
  }
}

async function writeQuoteToStock(symbol: string, quote: RealtimeQuote, source?: string): Promise<void> {
  // 防御：上游已归一化 symbol，此处强制执行覆盖，防止 API 返回字段缺失导致 DB 写入被拒
  const stock = quoteToStock(quote, source)
  stock.symbol = symbol
  auditRecord('stocks', stock)

  // 优先使用 updateStock（合并现有字段，不覆盖用户手动修改的 researchStatus/group 等）
  try {
    await dataBridge.forward({
      meta: {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.updateStock,
        traceId: `pipeline-stock-${symbol}-${Date.now()}`,
        timestamp: Date.now(),
      },
      payload: stock,
    })
    return
  } catch (err) {
    // 股票尚不存在时，updateStock 会因 UpdateStockHandler 找不到现有记录而抛错
    // 此时回退到 insertStock 做全量写入（新股票首次入库）
    if (err instanceof Error && err.message.includes('not found')) {
      logger.info(`[collectionPipeline] ${symbol} 为新股票，使用 insertStock 首次入库`)
    } else {
      logger.warn(`[collectionPipeline] ${symbol} updateStock 失败，回退 insertStock`, { error: err })
    }
  }

  await dataBridge.forward({
    meta: {
      source: MODULE_ID.fetcher,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.insertStock,
      traceId: `pipeline-stock-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
    },
    payload: stock,
  })
}

async function writeKlineToDailyQuotes(symbol: string, klines: KlineBar[], source?: string): Promise<void> {
  const dailyQuotes = klinesToDailyQuotes(symbol, klines, source)
  if (Array.isArray(dailyQuotes) && dailyQuotes.length > 0) {
    auditRecord('dailyQuotes', dailyQuotes[0])
  }
  await dataBridge.forward({
    meta: {
      source: MODULE_ID.fetcher,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.saveDailyQuotes,
      traceId: `pipeline-kline-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
    },
    payload: dailyQuotes,
  })
}

// ── 单次链路 ──

/**
 * runSingleTrace
 */
export async function runSingleTrace(
  options: RunSingleTraceOptions,
): Promise<TraceResult> {
  const { symbol, dimensionCode, config, parentTaskId } = options
  const normalizedSymbol = symbol.trim().toUpperCase()
  if (!normalizedSymbol) {
    return { success: false, symbol: '', dimensionCode, latency: 0, fallbackCount: 0, error: '股票代码为空' }
  }

  const dimension = getDimensionConfig(config, dimensionCode)
  if (!dimension) {
    return {
      success: false,
      symbol: normalizedSymbol,
      dimensionCode,
      latency: 0,
      fallbackCount: 0,
      error: `未找到维度配置: ${dimensionCode}`,
    }
  }

  const mode = resolveDimensionMode(dimensionCode)
  const traceId = traceIdFor(normalizedSymbol, dimensionCode)
  const taskId = parentTaskId ? `${parentTaskId}-${normalizedSymbol}-${dimensionCode}` : traceIdFor(normalizedSymbol, dimensionCode)
  const start = Date.now()

  const span: CollectionTraceSpan = {
    traceId,
    taskId,
    parentTaskId,
    dimensionCode,
    symbol: normalizedSymbol,
    stages: [],
    result: 'fail',
    totalDurationMs: 0,
    fallbackCount: 0,
    startedAt: start,
  }

  const addStage = (stage: CollectionStageRecord['stage'], message: string, sourceId?: QuoteDataSourceId, error?: string): void => {
    span.stages.push({
      stage,
      sourceId,
      timestamp: Date.now(),
      message,
      error,
    })
  }

  logger.info('[collectionPipeline] 单次链路开始', {
    symbol: normalizedSymbol,
    dimensionCode,
    mode,
    traceId,
  })

  emit(COLLECTION_EVENTS.TRIGGERED, {
    traceId,
    taskId,
    dimensionCode,
    symbol: normalizedSymbol,
    message: `开始采集: ${dimension.name} (${mode})`,
  })
  addStage('triggered', `开始采集: ${dimension.name} (${mode})`)

  if (mode === 'unsupported') {
    const message = `维度 ${dimensionCode} 暂不支持静态采集链路演示`
    addStage('complete', message, undefined, message)
    emit(COLLECTION_EVENTS.COMPLETE, {
      traceId,
      taskId,
      dimensionCode,
      symbol: normalizedSymbol,
      message,
      error: message,
    })
    span.result = 'fail'
    span.totalDurationMs = Date.now() - start
    span.completedAt = Date.now()
    emitTrace(span)
    getQualityMetrics().recordCollect(false, 'mock' as QuoteDataSourceId, span.totalDurationMs, [])
    return {
      success: false,
      symbol: normalizedSymbol,
      dimensionCode,
      latency: span.totalDurationMs,
      fallbackCount: 0,
      error: message,
    }
  }

  try {
    if (mode === 'quote') {
      const chain = resolveQuoteChain(dimension)
      const result = await getQuoteWithConfig(normalizedSymbol, {
        sourcePriority: chain,
        traceId,
        taskId,
        dimensionCode,
      })

      addStage('source:success', `${result.source} 获取成功`, result.source)
      emit(COLLECTION_EVENTS.TRANSFORM, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: '行情数据适配完成',
      })
      addStage('transform', '行情数据适配完成', result.source)

      emit(COLLECTION_EVENTS.WRITE_START, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: '准备写入 stocks',
      })
      addStage('write:start', '准备写入 stocks', result.source)

      try {
        await writeQuoteToStock(normalizedSymbol, result.data!, result.source)
        getQualityMetrics().recordWrite(true)
      } catch (writeErr) {
        getQualityMetrics().recordWrite(false)
        throw writeErr
      }

      emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: 'stocks 写入成功',
      })
      addStage('write:success', 'stocks 写入成功', result.source)

      span.result = 'success'
      span.finalSource = result.source
      span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
      span.totalDurationMs = Date.now() - start
      span.completedAt = Date.now()
      emit(COLLECTION_EVENTS.COMPLETE, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        durationMs: span.totalDurationMs,
        message: '单次行情采集完成',
        payload: { span },
      })
      addStage('complete', '单次行情采集完成', result.source)
      emitTrace(span)

      getQualityMetrics().recordCollect(true, result.source, span.totalDurationMs, result.fallbackChain)

      return {
        success: true,
        symbol: normalizedSymbol,
        dimensionCode,
        source: result.source,
        latency: span.totalDurationMs,
        fallbackCount: span.fallbackCount,
      }
    }

    if (mode === 'kline') {
      const chain = resolveKlineChain(dimension)
      const days = config.historyDays
      const result = await getKlineWithConfig(normalizedSymbol, days, {
        sourcePriority: chain,
        traceId,
        taskId,
        dimensionCode,
      })

      addStage('source:success', `${result.source} K 线获取成功`, result.source)
      emit(COLLECTION_EVENTS.TRANSFORM, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: 'K 线数据适配完成',
      })
      addStage('transform', 'K 线数据适配完成', result.source)

      emit(COLLECTION_EVENTS.WRITE_START, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: '准备写入 daily_quotes',
      })
      addStage('write:start', '准备写入 daily_quotes', result.source)

      try {
        await writeKlineToDailyQuotes(normalizedSymbol, result.data!, result.source)
        getQualityMetrics().recordWrite(true)
      } catch (writeErr) {
        getQualityMetrics().recordWrite(false)
        throw writeErr
      }

      emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: 'daily_quotes 写入成功',
      })
      addStage('write:success', 'daily_quotes 写入成功', result.source)

      span.result = 'success'
      span.finalSource = result.source
      span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
      span.totalDurationMs = Date.now() - start
      span.completedAt = Date.now()
      emit(COLLECTION_EVENTS.COMPLETE, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        durationMs: span.totalDurationMs,
        message: '单次 K 线采集完成',
        payload: { span },
      })
      addStage('complete', '单次 K 线采集完成', result.source)
      emitTrace(span)

      getQualityMetrics().recordCollect(true, result.source, span.totalDurationMs, result.fallbackChain)

      return {
        success: true,
        symbol: normalizedSymbol,
        dimensionCode,
        source: result.source,
        latency: span.totalDurationMs,
        fallbackCount: span.fallbackCount,
      }
    }

    // ── 03–08 非行情维度 mock 链路 ──
    if (mode === 'news' || mode === 'research' || mode === 'competitor' || mode === 'index' || mode === 'chip') {
      const storeAction = DIMENSION_TO_ACTION[dimensionCode]
      if (!storeAction) {
        const msg = `维度 ${dimensionCode} 无对应 DB action`
        addStage('complete', msg, undefined, msg)
        span.result = 'fail'
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        emitTrace(span)
        return { success: false, symbol: normalizedSymbol, dimensionCode, latency: span.totalDurationMs, fallbackCount: 0, error: msg }
      }

      try {
        const mockData = await generateDataForDimension(normalizedSymbol, dimensionCode)
        const modeLabel = { news: '资讯', research: '研报', competitor: '竞品', index: '关联指数', chip: '筹码' }[mode] ?? mode

        addStage('source:success', `mock:${mode} 数据生成完成`, 'mock')
        emit(COLLECTION_EVENTS.TRANSFORM, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: 'mock' as QuoteDataSourceId,
          message: `[示例] ${modeLabel} mock 数据适配完成`,
        })
        addStage('transform', `[示例] ${modeLabel} mock 数据适配完成`, 'mock')

        emit(COLLECTION_EVENTS.WRITE_START, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: 'mock' as QuoteDataSourceId,
          message: `准备写入 ${dimensionCode} 维度数据`,
        })
        addStage('write:start', `准备写入 ${dimensionCode} 维度数据`, 'mock')

        await writeMockDimensionData(normalizedSymbol, dimensionCode, mockData, storeAction)
        getQualityMetrics().recordWrite(true)

        emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: 'mock' as QuoteDataSourceId,
          message: `[示例] ${modeLabel} 数据写入成功`,
        })
        addStage('write:success', `[示例] ${modeLabel} 数据写入成功`, 'mock')

        span.result = 'success'
        span.finalSource = 'mock' as QuoteDataSourceId
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        span.metadata = { _mock: true, dataType: mode }
        emit(COLLECTION_EVENTS.COMPLETE, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: 'mock' as QuoteDataSourceId,
          durationMs: span.totalDurationMs,
          message: `[示例] ${modeLabel} 采集完成`,
          payload: { span },
        })
        addStage('complete', `[示例] ${modeLabel} 采集完成`, 'mock')
        emitTrace(span)

        getQualityMetrics().recordCollect(true, 'mock' as QuoteDataSourceId, span.totalDurationMs, [])

        return {
          success: true,
          symbol: normalizedSymbol,
          dimensionCode,
          source: 'mock' as QuoteDataSourceId,
          latency: span.totalDurationMs,
          fallbackCount: 0,
        }
      } catch (writeErr) {
        getQualityMetrics().recordWrite(false)
        const msg = writeErr instanceof Error ? writeErr.message : String(writeErr)
        addStage('complete', `写入失败: ${msg}`, undefined, msg)
        span.result = 'fail'
        span.error = msg
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        emitTrace(span)
        getQualityMetrics().recordCollect(false, 'mock' as QuoteDataSourceId, span.totalDurationMs, [])
        return { success: false, symbol: normalizedSymbol, dimensionCode, latency: span.totalDurationMs, fallbackCount: 0, error: msg }
      }
    }

    // unreachable
    const message = '未知采集模式'
    addStage('complete', message, undefined, message)
    span.result = 'fail'
    span.totalDurationMs = Date.now() - start
    span.completedAt = Date.now()
    emitTrace(span)
    return {
      success: false,
      symbol: normalizedSymbol,
      dimensionCode,
      latency: span.totalDurationMs,
      fallbackCount: 0,
      error: message,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error('[collectionPipeline] 单次链路异常', {
      symbol: normalizedSymbol,
      dimensionCode,
      error: errorMsg,
    })
    addStage('complete', `采集异常: ${errorMsg}`, undefined, errorMsg)
    span.result = 'fail'
    span.error = errorMsg
    span.totalDurationMs = Date.now() - start
    span.completedAt = Date.now()
    emit(COLLECTION_EVENTS.COMPLETE, {
      traceId,
      taskId,
      dimensionCode,
      symbol: normalizedSymbol,
      message: '采集异常',
      error: errorMsg,
    })
    emitTrace(span)

    getQualityMetrics().recordCollect(false, 'mock' as QuoteDataSourceId, span.totalDurationMs, [])

    // 自动登记缺失报告（方便事后追溯采集失败原因）
    try {
      void detectMissing(normalizedSymbol, MISSING_REPORT_TYPE.RESEARCH, errorMsg, { enabled: true })
    } catch { /* 缺失登记本身不阻塞主流程 */ }

    return {
      success: false,
      symbol: normalizedSymbol,
      dimensionCode,
      latency: span.totalDurationMs,
      fallbackCount: 0,
      error: errorMsg,
    }
  }
}

// ── 批量链路 ──

/**
 * runBatchTrace — 分批并发采集，避免串行瓶颈。
 *
 * 每批最多 CONCURRENCY 只股票并发采集，批间串行保证进度上报有序。
 * 单只 2s × 40 只 = 原串行 80s → 并发 5 只/批 ≈ 16s（约 5× 提速）。
 */
export async function runBatchTrace(
  options: RunBatchTraceOptions,
): Promise<TraceResult[]> {
  const { symbols, dimensionCode, config, parentTaskId } = options
  const bpTaskId = parentTaskId ?? `batch-${dimensionCode}-${Date.now()}`
  const CONCURRENCY = 5

  emit(COLLECTION_EVENTS.TASK_STATUS, {
    traceId: bpTaskId,
    taskId: bpTaskId,
    dimensionCode,
    message: `批量任务开始（并发 ${CONCURRENCY}）`,
    payload: { status: 'running', total: symbols.length, parentTaskId },
  })

  const results: TraceResult[] = []
  let completed = 0

  // 分批并发处理
  for (let chunkStart = 0; chunkStart < symbols.length; chunkStart += CONCURRENCY) {
    const chunk = symbols.slice(chunkStart, chunkStart + CONCURRENCY)
    const chunkResults = await Promise.all(
      chunk.map((symbol) =>
        runSingleTrace({ symbol, dimensionCode, config, parentTaskId: bpTaskId })
      )
    )
    results.push(...chunkResults)
    completed += chunkResults.length

    emit(COLLECTION_EVENTS.TASK_STATUS, {
      traceId: bpTaskId,
      taskId: bpTaskId,
      dimensionCode,
      message: `批量进度 ${completed}/${symbols.length}`,
      payload: { status: 'running', progress: Math.round((completed / symbols.length) * 100) },
    })
  }

  emit(COLLECTION_EVENTS.TASK_STATUS, {
    traceId: bpTaskId,
    taskId: bpTaskId,
    dimensionCode,
    message: '批量任务完成',
    payload: { status: 'completed', total: symbols.length, success: results.filter((r) => r.success).length },
  })

  return results
}

// ── Trace 广播 ──

function emitTrace(span: CollectionTraceSpan): void {
  try {
    eventBus.emit('collect:trace', span)
    // 异步持久化，不阻塞主流程；但写入成败需纳入质量统计
    saveTraceRecord(span)
      .then(() => getQualityMetrics().recordWrite(true))
      .catch((err) => {
        getQualityMetrics().recordWrite(false)
        logger.warn('[collectionPipeline] trace 持久化失败', { error: err, traceId: span.traceId })
      })
  } catch (err) {
    logger.warn('[collectionPipeline] trace 广播失败', { error: err })
  }
}

// ── 配置辅助 ──

/**
 * 将基础 `DimensionConfig[]` 升级为 `DimensionPipelineConfig[]`，
 * 补充默认的 sourcePriority、策略等字段。
 */
export function upgradeDimensionsToPipeline(
  dimensions: DimensionPipelineConfig[],
): DimensionPipelineConfig[] {
  return dimensions.map((dim) => ({
    ...dim,
    sourcePriority:
      dim.sourcePriority && dim.sourcePriority.length > 0
        ? dim.sourcePriority
        : buildDefaultSourcePriority(dim),
    concurrency: dim.concurrency ?? 1,
    retryPolicy: dim.retryPolicy ?? { maxRetries: 2, backoffMultiplier: 2, initialDelayMs: 500 },
    timeoutPolicy: dim.timeoutPolicy ?? { requestTimeoutMs: 5000, dimensionTimeoutMs: 30000 },
    fallbackPolicy: dim.fallbackPolicy ?? { allowFallback: true, allowMockFallback: !import.meta.env.PROD, alertFailureRate: 80 },
  }))
}

/**
 * 从 `CollectionConfig` 构造一个用于 store/持久化的默认对象。
 */
export function createDefaultCollectionConfig(): CollectionConfig {
  return {
    version: '1.0.0',
    activeTemplate: 'value',
    dimensions: [],
    global: {
      maxSymbols: 40,
      defaultBatchSize: 50,
      rateLimitPerMinute: 10,
      rateLimitPerHour: 200,
      rateLimitPerDay: 2000,
      notifyOnComplete: true,
      notifyOnError: true,
      defaultTimeoutMs: 5000,
      defaultRetries: 2,
    },
    symbolCount: 40,
    historyDays: 252,
    updatedAt: Date.now(),
  }
}
