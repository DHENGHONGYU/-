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
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
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

// ── Mock 维度数据生成器（已禁用 —— MOCK 数据不真实，真实源失败直接报错）──
// 保留代码供开发参考，生产环境不调用。历史代码见 git log collectionPipeline.ts。

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

  // MOCK 禁用：真实源失败直接返回错误标记，不生成 mock
  logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 真实数据不可用，禁止 mock: ${symbol}。原因: ${fallbackReason}`)
  return { _source: 'mock', _mock: true, _fallbackReason: fallbackReason, error: fallbackReason }
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
 *
 * @param dimension 维度配置
 * @param allowMockFallback 是否注入 mock 兜底（缺省 true 保持旧行为；
 *   传 false 时映射表中的 mock 项与末尾 mock 兜底均被剔除 —— 假绿灯修复）
 */
export function buildDefaultSourcePriority(
  dimension: DimensionPipelineConfig,
  allowMockFallback = true,
): SourcePriorityItem[] {
  const seen = new Set<QuoteDataSourceId>()
  const items: SourcePriorityItem[] = []
  let priority = 1

  for (const businessSource of dimension.sources) {
    const mapped = BUSINESS_TO_QUOTE_SOURCE[businessSource] ?? ['mock']
    for (const id of mapped) {
      if (!allowMockFallback && id === 'mock') continue
      if (seen.has(id)) continue
      seen.add(id)
      items.push({ id, priority, enabled: true })
      priority++
    }
  }

  // 兜底：允许 mock 时确保至少包含 mock
  if (allowMockFallback && !seen.has('mock')) {
    items.push({ id: 'mock', priority, enabled: true })
  }

  return items.sort((a, b) => a.priority - b.priority)
}

/**
 * resolveQuoteChain
 *
 * 按 fallbackPolicy.allowMockFallback 决定 mock 是否在链中：
 * 显式配置了 fallbackPolicy 且 allowMockFallback=false 时剔除 mock（假绿灯修复）；
 * 未配置 fallbackPolicy 的维度保持旧行为（含 mock）。
 * @param dimension
 * @returns QuoteDataSourceId[]
 */
export function resolveQuoteChain(dimension: DimensionPipelineConfig): QuoteDataSourceId[] {
  const chain = dimension.sourcePriority.length > 0
    ? dimension.sourcePriority
    : buildDefaultSourcePriority(dimension)
  const allowMock = dimension.fallbackPolicy.allowMockFallback
  return chain
    .filter((item) => item.enabled)
    .filter((item) => allowMock || item.id !== 'mock')
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.id)
}

/**
 * resolveKlineChain
 *
 * mock 追加同样受 fallbackPolicy.allowMockFallback 门禁（假绿灯修复）。
 * @param dimension
 * @returns QuoteDataSourceId[]
 */
export function resolveKlineChain(dimension: DimensionPipelineConfig): QuoteDataSourceId[] {
  const quoteChain = resolveQuoteChain(dimension)
  const allowMock = dimension.fallbackPolicy.allowMockFallback
  // 腾讯同时支持行情+K线，优先使用
  const klineSources = quoteChain.filter((id) => id !== 'mock')
  if (klineSources.length > 0) return allowMock ? [...klineSources, 'mock'] : klineSources
  return allowMock ? ['mock'] : []
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

/**
 * 判断字段值是否"有效"（非 null/undefined/空串/NaN/Infinity）。
 * @param value 待检查字段值
 * @returns 有效返回 true
 */
function isFieldPresent(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (typeof value === 'number') return Number.isFinite(value)
  return true
}

/** 行情完整率校验字段（RealtimeQuote 核心 9 字段，symbol 由上游强制覆盖故不计） */
const QUOTE_COMPLETENESS_FIELDS = ['name', 'price', 'change', 'changePercent', 'open', 'high', 'low', 'volume', 'amount'] as const

/** K 线单 bar 完整率校验字段（KlineBar 核心 7 字段，turnoverRate 可选不计） */
const KLINE_COMPLETENESS_FIELDS = ['date', 'open', 'high', 'low', 'close', 'volume', 'amount'] as const

/**
 * 统计行情数据字段完整率并上报 qualityMetricsCollector（P0：接通 recordCompleteness）。
 * @param quote 实时行情数据
 */
function reportQuoteCompleteness(quote: RealtimeQuote): void {
  const nonNull = QUOTE_COMPLETENESS_FIELDS.filter((f) => isFieldPresent(quote[f])).length
  getQualityMetrics().recordCompleteness({ nonNull, total: QUOTE_COMPLETENESS_FIELDS.length })
}

/**
 * 统计 K 线数据字段完整率（跨 bar 聚合）并上报 qualityMetricsCollector（P0：接通 recordCompleteness）。
 * @param klines K 线数据数组
 */
function reportKlineCompleteness(klines: KlineBar[]): void {
  if (klines.length === 0) return
  let nonNull = 0
  for (const bar of klines) {
    nonNull += KLINE_COMPLETENESS_FIELDS.filter((f) => isFieldPresent(bar[f])).length
  }
  getQualityMetrics().recordCompleteness({ nonNull, total: klines.length * KLINE_COMPLETENESS_FIELDS.length })
}

async function writeQuoteToStock(symbol: string, quote: RealtimeQuote, source?: string): Promise<void> {
  // 防御：上游已归一化 symbol，此处强制执行覆盖，防止 API 返回字段缺失导致 DB 写入被拒
  const stock = quoteToStock(quote, source)
  stock.symbol = symbol
  auditRecord('stocks', stock)
  reportQuoteCompleteness(quote)

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
  reportKlineCompleteness(klines)
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
        allowMockFallback: dimension.fallbackPolicy.allowMockFallback,
      })

      // Mock 禁用 + 全源失败：不写入、不计成功（假绿灯修复）
      if (!result.success || !result.data) {
        const failReason = result.error ?? '所有真实数据源失败'
        addStage('source:fail', `真实源不可用: ${failReason}`, result.source, failReason)
        span.result = 'fail'
        span.error = failReason
        span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        emit(COLLECTION_EVENTS.COMPLETE, {
          traceId,
          taskId,
          dimensionCode,
          symbol: normalizedSymbol,
          sourceId: result.source,
          message: '行情采集失败（真实源不可用，Mock 已禁用）',
          error: failReason,
        })
        addStage('complete', `采集失败: ${failReason}`, result.source, failReason)
        emitTrace(span)
        getQualityMetrics().recordCollect(false, result.source, span.totalDurationMs, result.fallbackChain)
        return {
          success: false,
          symbol: normalizedSymbol,
          dimensionCode,
          source: result.source,
          latency: span.totalDurationMs,
          fallbackCount: span.fallbackCount,
          error: failReason,
        }
      }

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
        allowMockFallback: dimension.fallbackPolicy.allowMockFallback,
      })

      // Mock 禁用 + 全源失败：不写入、不计成功（假绿灯修复）
      if (!result.success || !result.data) {
        const failReason = result.error ?? 'K 线所有真实数据源失败'
        addStage('source:fail', `真实源不可用: ${failReason}`, result.source, failReason)
        span.result = 'fail'
        span.error = failReason
        span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        emit(COLLECTION_EVENTS.COMPLETE, {
          traceId,
          taskId,
          dimensionCode,
          symbol: normalizedSymbol,
          sourceId: result.source,
          message: 'K 线采集失败（真实源不可用，Mock 已禁用）',
          error: failReason,
        })
        addStage('complete', `采集失败: ${failReason}`, result.source, failReason)
        emitTrace(span)
        getQualityMetrics().recordCollect(false, result.source, span.totalDurationMs, result.fallbackChain)
        return {
          success: false,
          symbol: normalizedSymbol,
          dimensionCode,
          source: result.source,
          latency: span.totalDurationMs,
          fallbackCount: span.fallbackCount,
          error: failReason,
        }
      }

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

    // ── 03–08 非行情维度数据链路 ──
    // 策略：仅使用真实数据源，禁用 mock 兜底。真实源失败 = 维度失败。
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
        const dimData = await generateDataForDimension(normalizedSymbol, dimensionCode)
        const modeLabel = { news: '资讯', research: '研报', competitor: '竞品', index: '关联指数', chip: '筹码' }[mode]

        // MOCK 禁用：真实源失败 → 维度失败，不写入假数据
        if (dimData._source === 'mock' || dimData._mock === true) {
          const rawReason = dimData._fallbackReason
          const failReason = typeof rawReason === 'string' ? rawReason : '所有真实数据源均不可用'
          logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 真实源失败，禁用 mock，上报失败: ${normalizedSymbol}`, { reason: failReason })
          emit(COLLECTION_EVENTS.SOURCE_FAIL, {
            traceId, taskId, dimensionCode, symbol: normalizedSymbol,
            message: `[${modeLabel}] ${failReason}`,
            error: `真实源不可用（${modeLabel}），未使用 mock 数据`,
          })
          addStage('source:fail', `真实源不可用: ${failReason}`, undefined, failReason)
          span.result = 'fail'
          span.error = failReason
          span.totalDurationMs = Date.now() - start
          span.completedAt = Date.now()
          emit(COLLECTION_EVENTS.COMPLETE, {
            traceId, taskId, dimensionCode, symbol: normalizedSymbol,
            message: `[${modeLabel}] 采集失败（真实源不可用）`,
            error: failReason,
          })
          addStage('complete', `采集失败: ${failReason}`, undefined, failReason)
          emitTrace(span)
          getQualityMetrics().recordCollect(false, 'mock' as QuoteDataSourceId, span.totalDurationMs, [])
          return { success: false, symbol: normalizedSymbol, dimensionCode, latency: span.totalDurationMs, fallbackCount: 0, error: failReason }
        }

        // 真实数据写入
        // 真实数据写入
        const sourceLabel = dimData._source as string || 'real'
        addStage('source:success', `${sourceLabel}:${mode} 数据获取成功`, sourceLabel as QuoteDataSourceId)
        emit(COLLECTION_EVENTS.TRANSFORM, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: sourceLabel as QuoteDataSourceId,
          message: `${modeLabel} 真实数据适配完成（来源: ${sourceLabel}）`,
        })
        addStage('transform', `${modeLabel} 真实数据适配完成`, sourceLabel as QuoteDataSourceId)

        emit(COLLECTION_EVENTS.WRITE_START, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: sourceLabel as QuoteDataSourceId,
          message: `准备写入 ${dimensionCode} 维度真实数据`,
        })
        addStage('write:start', `准备写入 ${dimensionCode} 维度数据`, sourceLabel as QuoteDataSourceId)

        await writeMockDimensionData(normalizedSymbol, dimensionCode, dimData, storeAction)
        getQualityMetrics().recordWrite(true)

        emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: sourceLabel as QuoteDataSourceId,
          message: `${modeLabel} 真实数据写入成功`,
        })
        addStage('write:success', `${modeLabel} 真实数据写入成功`, sourceLabel as QuoteDataSourceId)

        span.result = 'success'
        span.finalSource = sourceLabel as QuoteDataSourceId
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        span.metadata = { _mock: false, dataType: mode, source: sourceLabel }
        emit(COLLECTION_EVENTS.COMPLETE, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: sourceLabel as QuoteDataSourceId,
          durationMs: span.totalDurationMs,
          message: `${modeLabel} 真实数据采集完成（来源: ${sourceLabel}）`,
          payload: { span },
        })
        addStage('complete', `${modeLabel} 采集完成`, sourceLabel as QuoteDataSourceId)
        emitTrace(span)

        getQualityMetrics().recordCollect(true, sourceLabel as QuoteDataSourceId, span.totalDurationMs, [])

        return {
          success: true,
          symbol: normalizedSymbol,
          dimensionCode,
          source: sourceLabel as QuoteDataSourceId,
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
  return dimensions.map((dim) => {
    // 先解析 fallbackPolicy，再用其 allowMockFallback 决定默认链是否注入 mock（假绿灯修复）
    const fallbackPolicy = dim.fallbackPolicy
    return {
      ...dim,
      sourcePriority:
        dim.sourcePriority.length > 0
          ? dim.sourcePriority
          : buildDefaultSourcePriority(dim, fallbackPolicy.allowMockFallback),
      concurrency: dim.concurrency,
      retryPolicy: dim.retryPolicy,
      timeoutPolicy: dim.timeoutPolicy,
      fallbackPolicy,
    }
  })
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
