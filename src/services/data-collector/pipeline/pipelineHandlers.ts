/**
 * @fileoverview pipelineHandlers
 * @description collectionPipeline 拆分（2026-08-23 遗留问题整改 P3）：
 * 单次链路分模式处理器（quote / kline / financial / 非行情维度）。
 * 处理器共享 `SingleTraceContext`，由 facade 的 runSingleTraceImpl 分发。
 *
 * @module services/data-collector/pipeline/pipelineHandlers
 */

import { getLogger } from '@/lib/logger'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import type { QuoteDataSourceId } from '@/types/modules/collection.types'
import { getQuoteWithConfig, getKlineWithConfig } from '../dataSourceOrchestrator'
import { getQualityMetrics } from '../qualityMetricsCollector'
import { fetchFinancial } from '@/services/fetcher/fetcherService'
import { persistCollectedDataToLocalFile } from '../localFilePersistService'
import { emit, emitTrace } from './pipelineEvents'
import { resolveQuoteChain, resolveKlineChain, resolveDimensionMode, DIMENSION_TO_ACTION } from './pipelineMappings'
import { writeQuoteToStock, writeKlineToDailyQuotes, writeDimensionData } from './pipelineWriters'
import { generateDataForDimension, runKimiaiEnhancement } from './pipelineDataGen'
import type { SingleTraceContext, TraceResult, NonQuoteMode } from './pipelineTypes'

const logger = getLogger()

/**
 * 分模式处理器——quote：调用 getQuoteWithConfig 并写入 stocks。
 * 从 runSingleTraceImpl 的内联分支抽取（原最深嵌套 4 层，抽取后≤3）。
 */
export async function handleQuoteMode(ctx: SingleTraceContext): Promise<TraceResult> {
  const { symbol, dimensionCode, dimension } = ctx
  const chain = resolveQuoteChain(dimension)
  const result = await getQuoteWithConfig(symbol, {
    sourcePriority: chain,
    traceId: ctx.traceId,
    taskId: ctx.taskId,
    dimensionCode,
    allowMockFallback: dimension.fallbackPolicy?.allowMockFallback ?? true,
    retryPolicy: dimension.retryPolicy,
  })

  // Mock 禁用 + 全源失败：不写入、不计成功（假绿灯修复）
  if (!result.success || !result.data) {
    const failReason = result.error ?? '所有真实数据源失败'
    ctx.addStage('source:fail', `真实源不可用: ${failReason}`, result.source, failReason)
    ctx.span.result = 'fail'
    ctx.span.error = failReason
    ctx.span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
    ctx.span.totalDurationMs = Date.now() - ctx.startedAt
    ctx.span.completedAt = Date.now()
    logger.warn('[collectionPipeline · handleQuoteMode] 行情采集失败（真实源不可用，Mock 已禁用）', {
      symbol, dimensionCode,
      source: result.source,
      fallbackCount: ctx.span.fallbackCount,
      fallbackChain: result.fallbackChain,
      latencyMs: ctx.span.totalDurationMs,
      reason: failReason,
      traceId: ctx.traceId,
    })
    emit(COLLECTION_EVENTS.COMPLETE, {
      traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
      sourceId: result.source,
      message: '行情采集失败（真实源不可用，Mock 已禁用）',
      error: failReason,
    })
    ctx.addStage('complete', `采集失败: ${failReason}`, result.source, failReason)
    emitTrace(ctx.span)
    getQualityMetrics().recordCollect(false, result.source, ctx.span.totalDurationMs, result.fallbackChain)
    return {
      success: false, symbol, dimensionCode,
      source: result.source,
      latency: ctx.span.totalDurationMs,
      fallbackCount: ctx.span.fallbackCount,
      error: failReason,
    }
  }

  ctx.addStage('source:success', `${result.source} 获取成功`, result.source)
  emit(COLLECTION_EVENTS.TRANSFORM, {
    traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
    sourceId: result.source,
    message: '行情数据适配完成',
  })
  ctx.addStage('transform', '行情数据适配完成', result.source)

  emit(COLLECTION_EVENTS.WRITE_START, {
    traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
    sourceId: result.source,
    message: '准备写入 stocks',
  })
  ctx.addStage('write:start', '准备写入 stocks', result.source)

  try {
    await writeQuoteToStock(symbol, result.data, result.source)
    getQualityMetrics().recordWrite(true)
  } catch (writeErr) {
    getQualityMetrics().recordWrite(false)
    throw writeErr
  }

  emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
    traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
    sourceId: result.source,
    message: 'stocks 写入成功',
  })
  ctx.addStage('write:success', 'stocks 写入成功', result.source)

  ctx.span.result = 'success'
  ctx.span.finalSource = result.source
  ctx.span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
  ctx.span.totalDurationMs = Date.now() - ctx.startedAt
  ctx.span.completedAt = Date.now()
  logger.info('[collectionPipeline · handleQuoteMode] 行情采集完成', {
    symbol, dimensionCode,
    source: result.source,
    fallbackCount: ctx.span.fallbackCount,
    fallbackChain: result.fallbackChain,
    latencyMs: ctx.span.totalDurationMs,
    traceId: ctx.traceId,
  })
  emit(COLLECTION_EVENTS.COMPLETE, {
    traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
    sourceId: result.source,
    durationMs: ctx.span.totalDurationMs,
    message: '单次行情采集完成',
    payload: { span: ctx.span },
  })
  ctx.addStage('complete', '单次行情采集完成', result.source)
  emitTrace(ctx.span)

  getQualityMetrics().recordCollect(true, result.source, ctx.span.totalDurationMs, result.fallbackChain)

  return {
    success: true, symbol, dimensionCode,
    source: result.source,
    latency: ctx.span.totalDurationMs,
    fallbackCount: ctx.span.fallbackCount,
  }
}

/**
 * 分模式处理器——kline：调用 getKlineWithConfig 并写入 daily_quotes。
 */
export async function handleKlineMode(ctx: SingleTraceContext): Promise<TraceResult> {
  const { symbol, dimensionCode, dimension, config } = ctx
  const chain = resolveKlineChain(dimension)
  const days = config.historyDays
  const result = await getKlineWithConfig(symbol, days, {
    sourcePriority: chain,
    traceId: ctx.traceId,
    taskId: ctx.taskId,
    dimensionCode,
    allowMockFallback: dimension.fallbackPolicy?.allowMockFallback ?? true,
    retryPolicy: dimension.retryPolicy,
  })

  // Mock 禁用 + 全源失败：不写入、不计成功（假绿灯修复）
  if (!result.success || !result.data) {
    const failReason = result.error ?? 'K 线所有真实数据源失败'
    ctx.addStage('source:fail', `真实源不可用: ${failReason}`, result.source, failReason)
    ctx.span.result = 'fail'
    ctx.span.error = failReason
    ctx.span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
    ctx.span.totalDurationMs = Date.now() - ctx.startedAt
    ctx.span.completedAt = Date.now()
    logger.warn('[collectionPipeline · handleKlineMode] K 线采集失败（真实源不可用，Mock 已禁用）', {
      symbol, dimensionCode,
      historyDays: days,
      source: result.source,
      fallbackCount: ctx.span.fallbackCount,
      fallbackChain: result.fallbackChain,
      latencyMs: ctx.span.totalDurationMs,
      reason: failReason,
      traceId: ctx.traceId,
    })
    emit(COLLECTION_EVENTS.COMPLETE, {
      traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
      sourceId: result.source,
      message: 'K 线采集失败（真实源不可用，Mock 已禁用）',
      error: failReason,
    })
    ctx.addStage('complete', `采集失败: ${failReason}`, result.source, failReason)
    emitTrace(ctx.span)
    getQualityMetrics().recordCollect(false, result.source, ctx.span.totalDurationMs, result.fallbackChain)
    return {
      success: false, symbol, dimensionCode,
      source: result.source,
      latency: ctx.span.totalDurationMs,
      fallbackCount: ctx.span.fallbackCount,
      error: failReason,
    }
  }

  ctx.addStage('source:success', `${result.source} K 线获取成功`, result.source)
  emit(COLLECTION_EVENTS.TRANSFORM, {
    traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
    sourceId: result.source,
    message: 'K 线数据适配完成',
  })
  ctx.addStage('transform', 'K 线数据适配完成', result.source)

  emit(COLLECTION_EVENTS.WRITE_START, {
    traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
    sourceId: result.source,
    message: '准备写入 daily_quotes',
  })
  ctx.addStage('write:start', '准备写入 daily_quotes', result.source)

  try {
    await writeKlineToDailyQuotes(symbol, result.data, result.source)
    getQualityMetrics().recordWrite(true)
  } catch (writeErr) {
    getQualityMetrics().recordWrite(false)
    throw writeErr
  }

  emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
    traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
    sourceId: result.source,
    message: 'daily_quotes 写入成功',
  })
  ctx.addStage('write:success', 'daily_quotes 写入成功', result.source)

  ctx.span.result = 'success'
  ctx.span.finalSource = result.source
  ctx.span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
  ctx.span.totalDurationMs = Date.now() - ctx.startedAt
  ctx.span.completedAt = Date.now()
  logger.info('[collectionPipeline · handleKlineMode] K 线采集完成', {
    symbol, dimensionCode,
    historyDays: days,
    source: result.source,
    fallbackCount: ctx.span.fallbackCount,
    fallbackChain: result.fallbackChain,
    latencyMs: ctx.span.totalDurationMs,
    barCount: result.data?.length ?? 0,
    traceId: ctx.traceId,
  })
  emit(COLLECTION_EVENTS.COMPLETE, {
    traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
    sourceId: result.source,
    durationMs: ctx.span.totalDurationMs,
    message: '单次 K 线采集完成',
    payload: { span: ctx.span },
  })
  ctx.addStage('complete', '单次 K 线采集完成', result.source)
  emitTrace(ctx.span)

  getQualityMetrics().recordCollect(true, result.source, ctx.span.totalDurationMs, result.fallbackChain)

  return {
    success: true, symbol, dimensionCode,
    source: result.source,
    latency: ctx.span.totalDurationMs,
    fallbackCount: ctx.span.fallbackCount,
  }
}

/**
 * 分模式处理器——financial：调用 fetcherService.fetchFinancial 采集并写入 financial_reports。
 */
export async function handleFinancialMode(ctx: SingleTraceContext): Promise<TraceResult> {
  const { symbol, dimensionCode } = ctx
  const finSource = 'fetcher' as QuoteDataSourceId
  try {
    ctx.addStage('source:start', '调用 fetchFinancial 采集财务数据')
    const finResult = await fetchFinancial(symbol)

    if (!finResult.success || !finResult.data) {
      const failReason = finResult.error ?? '财务数据采集失败'
      ctx.addStage('source:fail', `财务数据采集失败: ${failReason}`, undefined, failReason)
      ctx.span.result = 'fail'
      ctx.span.error = failReason
      ctx.span.totalDurationMs = Date.now() - ctx.startedAt
      ctx.span.completedAt = Date.now()
      logger.warn('[collectionPipeline · handleFinancialMode] 财务数据采集失败', {
        symbol, dimensionCode,
        latencyMs: ctx.span.totalDurationMs,
        reason: failReason,
        traceId: ctx.traceId,
      })
      emit(COLLECTION_EVENTS.COMPLETE, {
        traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
        message: '财务数据采集失败',
        error: failReason,
      })
      ctx.addStage('complete', `采集失败: ${failReason}`, undefined, failReason)
      emitTrace(ctx.span)
      getQualityMetrics().recordCollect(false, finSource, ctx.span.totalDurationMs, [])
      getQualityMetrics().recordWrite(false)
      return { success: false, symbol, dimensionCode, latency: ctx.span.totalDurationMs, fallbackCount: 0, error: failReason }
    }

    ctx.addStage('source:success', 'fetchFinancial 获取成功', finSource)
    emit(COLLECTION_EVENTS.TRANSFORM, {
      traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
      sourceId: finSource,
      message: '财务数据适配完成',
    })
    ctx.addStage('transform', '财务数据适配完成', finSource)

    // fetchFinancial 内部已通过 DataBridge.forward 写入 financial_reports store
    emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
      traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
      sourceId: finSource,
      message: 'financial_reports 写入成功',
    })
    ctx.addStage('write:success', 'financial_reports 写入成功', finSource)
    getQualityMetrics().recordWrite(true)

    // 本地文件即时落盘（维度 09；fetchFinancial 内部已写库，此处用同一份返回数据落盘，失败不阻塞）
    await persistCollectedDataToLocalFile({
      symbol,
      dimensionCode: '09',
      data: finResult.data,
      source: finSource,
    })

    ctx.span.result = 'success'
    ctx.span.finalSource = finSource
    ctx.span.totalDurationMs = Date.now() - ctx.startedAt
    ctx.span.completedAt = Date.now()
    logger.info('[collectionPipeline · handleFinancialMode] 财务数据采集完成', {
      symbol, dimensionCode,
      latencyMs: ctx.span.totalDurationMs,
      traceId: ctx.traceId,
    })
    emit(COLLECTION_EVENTS.COMPLETE, {
      traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
      sourceId: finSource,
      durationMs: ctx.span.totalDurationMs,
      message: '财务数据采集完成',
      payload: { span: ctx.span },
    })
    ctx.addStage('complete', '财务数据采集完成', finSource)
    emitTrace(ctx.span)
    getQualityMetrics().recordCollect(true, finSource, ctx.span.totalDurationMs, [])

    return {
      success: true, symbol, dimensionCode,
      source: finSource,
      latency: ctx.span.totalDurationMs,
      fallbackCount: 0,
    }
  } catch (err) {
    const failReason = err instanceof Error ? err.message : String(err)
    ctx.addStage('source:fail', `财务数据采集异常: ${failReason}`, undefined, failReason)
    ctx.span.result = 'fail'
    ctx.span.error = failReason
    ctx.span.totalDurationMs = Date.now() - ctx.startedAt
    ctx.span.completedAt = Date.now()
    emit(COLLECTION_EVENTS.COMPLETE, {
      traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
      message: '财务数据采集异常',
      error: failReason,
    })
    ctx.addStage('complete', `采集异常: ${failReason}`, undefined, failReason)
    emitTrace(ctx.span)
    getQualityMetrics().recordCollect(false, finSource, ctx.span.totalDurationMs, [])
    getQualityMetrics().recordWrite(false)
    return { success: false, symbol, dimensionCode, latency: ctx.span.totalDurationMs, fallbackCount: 0, error: failReason }
  }
}

/**
 * 分模式处理器——非行情维度（news/research/competitor/index/chip/dividend/consensus）。
 * 仅真实数据源，禁用 mock 兜底；真实源失败 = 维度失败。
 */
export async function handleNonQuoteMode(ctx: SingleTraceContext): Promise<TraceResult> {
  const { symbol, dimensionCode, startedAt } = ctx
  const mode = resolveDimensionMode(dimensionCode) as NonQuoteMode
  const storeAction = DIMENSION_TO_ACTION[dimensionCode]
  if (!storeAction) {
    const msg = `维度 ${dimensionCode} 无对应 DB action`
    ctx.addStage('complete', msg, undefined, msg)
    ctx.span.result = 'fail'
    ctx.span.totalDurationMs = Date.now() - startedAt
    ctx.span.completedAt = Date.now()
    emitTrace(ctx.span)
    return { success: false, symbol, dimensionCode, latency: ctx.span.totalDurationMs, fallbackCount: 0, error: msg }
  }

  const modeLabel = { news: '资讯', research: '研报', competitor: '竞品', index: '关联指数', chip: '筹码', dividend: '分红股本', consensus: '一致预期', sector: '热门板块', technical: '技术指标', fund_flow: '资金流向', institutional: '机构持仓', valuation: '估值分析' }[mode]

  try {
    const dimData = await generateDataForDimension(symbol, dimensionCode)

    // MOCK 禁用：真实源失败 → 维度失败，不写入假数据
    if (dimData._source === 'mock' || dimData._mock === true) {
      const rawReason = dimData._fallbackReason
      const failReason = typeof rawReason === 'string' ? rawReason : '所有真实数据源均不可用'
      logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 真实源失败，禁用 mock，上报失败: ${symbol}`, { reason: failReason })
      emit(COLLECTION_EVENTS.SOURCE_FAIL, {
        traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
        message: `[${modeLabel}] ${failReason}`,
        error: `真实源不可用（${modeLabel}），未使用 mock 数据`,
      })
      ctx.addStage('source:fail', `真实源不可用: ${failReason}`, undefined, failReason)
      ctx.span.result = 'fail'
      ctx.span.error = failReason
      ctx.span.totalDurationMs = Date.now() - startedAt
      ctx.span.completedAt = Date.now()
      emit(COLLECTION_EVENTS.COMPLETE, {
        traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
        message: `[${modeLabel}] 采集失败（真实源不可用）`,
        error: failReason,
      })
      ctx.addStage('complete', `采集失败: ${failReason}`, undefined, failReason)
      emitTrace(ctx.span)
      getQualityMetrics().recordCollect(false, 'mock', ctx.span.totalDurationMs, [])
      return { success: false, symbol, dimensionCode, latency: ctx.span.totalDurationMs, fallbackCount: 0, error: failReason }
    }

    const sourceLabel = dimData._source as string || 'real'
    if (!dimData._source) {
      logger.warn(`[collectionPipeline] ${symbol}/${dimensionCode} 数据缺失 _source 字段，默认标记为 'real'`)
    }
    ctx.addStage('source:success', `${sourceLabel}:${mode} 数据获取成功`, sourceLabel as QuoteDataSourceId)
    emit(COLLECTION_EVENTS.TRANSFORM, {
      traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
      sourceId: sourceLabel as QuoteDataSourceId,
      message: `${modeLabel} 真实数据适配完成（来源: ${sourceLabel}）`,
    })
    ctx.addStage('transform', `${modeLabel} 真实数据适配完成`, sourceLabel as QuoteDataSourceId)

    emit(COLLECTION_EVENTS.WRITE_START, {
      traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
      sourceId: sourceLabel as QuoteDataSourceId,
      message: `准备写入 ${dimensionCode} 维度真实数据`,
    })
    ctx.addStage('write:start', `准备写入 ${dimensionCode} 维度数据`, sourceLabel as QuoteDataSourceId)

    await writeDimensionData(symbol, dimensionCode, dimData, storeAction)
    getQualityMetrics().recordWrite(true)

    emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
      traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
      sourceId: sourceLabel as QuoteDataSourceId,
      message: `${modeLabel} 真实数据写入成功`,
    })
    ctx.addStage('write:success', `${modeLabel} 真实数据写入成功`, sourceLabel as QuoteDataSourceId)

    // KIMI AI 增强（独立函数，失败不阻塞）
    try {
      await runKimiaiEnhancement(ctx, dimData, sourceLabel)
    } catch (aiErr) {
      logger.warn('[collectionPipeline] KIMI AI 增强失败（不阻塞主流程）', {
        symbol, dimensionCode, error: aiErr,
      })
    }

    ctx.span.result = 'success'
    ctx.span.finalSource = sourceLabel as QuoteDataSourceId
    ctx.span.totalDurationMs = Date.now() - startedAt
    ctx.span.completedAt = Date.now()
    ctx.span.metadata = { _mock: false, dataType: mode, source: sourceLabel }
    logger.info('[collectionPipeline · handleNonQuoteMode] 非行情维度采集完成', {
      symbol, dimensionCode,
      mode,
      source: sourceLabel,
      latencyMs: ctx.span.totalDurationMs,
      traceId: ctx.traceId,
    })
    emit(COLLECTION_EVENTS.COMPLETE, {
      traceId: ctx.traceId, taskId: ctx.taskId, dimensionCode, symbol,
      sourceId: sourceLabel as QuoteDataSourceId,
      durationMs: ctx.span.totalDurationMs,
      message: `${modeLabel} 真实数据采集完成（来源: ${sourceLabel}）`,
      payload: { span: ctx.span },
    })
    ctx.addStage('complete', `${modeLabel} 采集完成`, sourceLabel as QuoteDataSourceId)
    emitTrace(ctx.span)

    getQualityMetrics().recordCollect(true, sourceLabel as QuoteDataSourceId, ctx.span.totalDurationMs, [])

    return {
      success: true, symbol, dimensionCode,
      source: sourceLabel as QuoteDataSourceId,
      latency: ctx.span.totalDurationMs,
      fallbackCount: 0,
    }
  } catch (err) {
    getQualityMetrics().recordWrite(false)
    const failReason = err instanceof Error ? err.message : String(err)
    ctx.addStage('complete', `写入失败: ${failReason}`, undefined, failReason)
    ctx.span.result = 'fail'
    ctx.span.error = failReason
    ctx.span.totalDurationMs = Date.now() - startedAt
    ctx.span.completedAt = Date.now()
    logger.error('[collectionPipeline · handleNonQuoteMode] 非行情维度写入异常', {
      symbol, dimensionCode,
      mode,
      latencyMs: ctx.span.totalDurationMs,
      error: failReason,
      traceId: ctx.traceId,
    })
    emitTrace(ctx.span)
    getQualityMetrics().recordCollect(false, 'mock', ctx.span.totalDurationMs, [])
    return { success: false, symbol, dimensionCode, latency: ctx.span.totalDurationMs, fallbackCount: 0, error: failReason }
  }
}
