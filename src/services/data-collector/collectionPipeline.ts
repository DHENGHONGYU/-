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
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID, ENVELOPE_TARGET } from '@/config/dbConfig'
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

const logger = getLogger()

// ── 类型 ──

type CollectionMode = 'quote' | 'kline' | 'unsupported'

interface RunSingleTraceOptions {
  symbol: string
  dimensionCode: string
  config: CollectionConfig
  taskId?: string
}

interface RunBatchTraceOptions {
  symbols: string[]
  dimensionCode: string
  config: CollectionConfig
  taskId?: string
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

export function resolveDimensionMode(dimensionCode: string): CollectionMode {
  return DIMENSION_TO_MODE[dimensionCode] ?? 'unsupported'
}

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

export function resolveQuoteChain(dimension: DimensionPipelineConfig): QuoteDataSourceId[] {
  const chain = dimension.sourcePriority && dimension.sourcePriority.length > 0
    ? dimension.sourcePriority
    : buildDefaultSourcePriority(dimension)
  return chain
    .filter((item) => item.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.id)
}

export function resolveKlineChain(dimension: DimensionPipelineConfig): QuoteDataSourceId[] {
  const quoteChain = resolveQuoteChain(dimension)
  const klineSources = quoteChain.filter((id) => id === 'netease' || id === 'mock')
  if (klineSources.length > 0) return klineSources
  return ['netease', 'mock']
}

export function getDimensionConfig(
  config: CollectionConfig,
  dimensionCode: string,
): DimensionPipelineConfig | undefined {
  return config.dimensions.find((dim) => dim.code === dimensionCode)
}

// ── DB 写入 ──

async function writeQuoteToStock(symbol: string, quote: RealtimeQuote): Promise<void> {
  await dataBridge.forward({
    meta: {
      source: MODULE_ID.fetcher,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.insertStock,
      traceId: `pipeline-stock-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
    },
    payload: {
      store: STORE_NAME.stocks,
      data: quoteToStock(quote),
    },
  })
}

async function writeKlineToDailyQuotes(symbol: string, klines: KlineBar[]): Promise<void> {
  const dailyQuotes = klinesToDailyQuotes(symbol, klines)
  await dataBridge.forward({
    meta: {
      source: MODULE_ID.fetcher,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.saveDailyQuotes,
      traceId: `pipeline-kline-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
    },
    payload: {
      store: STORE_NAME.dailyQuotes,
      data: dailyQuotes,
    },
  })
}

// ── 单次链路 ──

export async function runSingleTrace(
  options: RunSingleTraceOptions,
): Promise<TraceResult> {
  const { symbol, dimensionCode, config, taskId } = options
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
  const start = Date.now()

  const span: CollectionTraceSpan = {
    traceId,
    taskId,
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

      await writeQuoteToStock(normalizedSymbol, result.data!)
      getQualityMetrics().recordWrite(true)

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

      await writeKlineToDailyQuotes(normalizedSymbol, result.data!)
      getQualityMetrics().recordWrite(true)

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

      return {
        success: true,
        symbol: normalizedSymbol,
        dimensionCode,
        source: result.source,
        latency: span.totalDurationMs,
        fallbackCount: span.fallbackCount,
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

export async function runBatchTrace(
  options: RunBatchTraceOptions,
): Promise<TraceResult[]> {
  const { symbols, dimensionCode, config, taskId } = options
  const taskIdResolved = taskId ?? `batch-${dimensionCode}-${Date.now()}`

  emit(COLLECTION_EVENTS.TASK_STATUS, {
    traceId: taskIdResolved,
    taskId: taskIdResolved,
    dimensionCode,
    message: '批量任务开始',
    payload: { status: 'running', total: symbols.length },
  })

  const results: TraceResult[] = []
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i]!
    const result = await runSingleTrace({ symbol, dimensionCode, config, taskId: taskIdResolved })
    results.push(result)

    emit(COLLECTION_EVENTS.TASK_STATUS, {
      traceId: taskIdResolved,
      taskId: taskIdResolved,
      dimensionCode,
      symbol,
      message: `批量进度 ${i + 1}/${symbols.length}`,
      payload: { status: 'running', progress: Math.round(((i + 1) / symbols.length) * 100) },
    })
  }

  emit(COLLECTION_EVENTS.TASK_STATUS, {
    traceId: taskIdResolved,
    taskId: taskIdResolved,
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
    // 异步持久化，不阻塞主流程
    saveTraceRecord(span).catch((err) => {
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
    fallbackPolicy: dim.fallbackPolicy ?? { allowFallback: true, allowMockFallback: true, alertFailureRate: 80 },
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
