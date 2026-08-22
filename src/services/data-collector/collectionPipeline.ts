/**
 * @fileoverview collectionPipeline
 * @description 配置化采集流水线（facade 入口）。
 *
 * 根据 `CollectionConfig` 执行单次/批量采集：
 * - 按维度配置生成数据源优先级链
 * - 调用 `dataSourceOrchestrator` 获取数据
 * - 通过 `DataBridge.forward()` 写入 IndexedDB
 * - 每个阶段 emit `CollectionLifecycleEvent`
 *
 * 注意：本 service 不依赖任何 store，配置由调用方（store / UI）传入。
 *
 * 2026-08-23 遗留问题整改 P3：本文件拆分为 `./pipeline/*` 子模块
 * （类型/映射/事件/审计/写入/数据生成/分模式处理器），本文件保留为
 * 对外 facade——runSingleTrace/runBatchTrace 编排与全部既有导出
 * （re-export）保持不变，消费方零破坏。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { withLogging } from '@/lib/logHelpers'
// P1-12 分层合规：buildDefaultSourcePriority / upgradeDimensionsToPipeline
//  纯函数下沉到 domain/collection/pipeline.ts，此处 re-export 保持对外 API 兼容。
export { buildDefaultSourcePriority, upgradeDimensionsToPipeline } from '@/domain/collection/pipeline'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import type {
  CollectionConfig,
  CollectionTraceSpan,
  CollectionStageRecord,
  QuoteDataSourceId,
} from '@/types/modules/collection.types'
import { getQualityMetrics } from './qualityMetricsCollector'
import { detect as detectMissing } from './missingReportDetector'
import { MISSING_REPORT_TYPE } from '@/constants/execution.constants'

// ── 拆分后子模块 re-export（对外 API 零破坏） ──
export {
  NON_QUOTE_MODES,
  type TraceResult,
  type CollectionMode,
  type RunSingleTraceOptions,
  type RunBatchTraceOptions,
} from './pipeline/pipelineTypes'
export {
  resolveDimensionMode,
  resolveQuoteChain,
  resolveKlineChain,
  getDimensionConfig,
  DIMENSION_TO_ACTION,
} from './pipeline/pipelineMappings'
import { NON_QUOTE_MODES } from './pipeline/pipelineTypes'
import type {
  TraceResult,
  CollectionMode,
  RunSingleTraceOptions,
  RunBatchTraceOptions,
  SingleTraceContext,
} from './pipeline/pipelineTypes'
import {
  resolveDimensionMode,
  getDimensionConfig,
} from './pipeline/pipelineMappings'
import { emit, traceIdFor, emitTrace } from './pipeline/pipelineEvents'
import {
  handleQuoteMode,
  handleKlineMode,
  handleFinancialMode,
  handleNonQuoteMode,
} from './pipeline/pipelineHandlers'

const logger = getLogger()

// ── 单次链路 ──

/**
 * runSingleTrace — 内部实现（不直接导出，由 withLogging 包装后导出）
 */
async function runSingleTraceImpl(
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
  const taskId = (parentTaskId ?? '') !== '' ? `${parentTaskId}-${normalizedSymbol}-${dimensionCode}` : traceIdFor(normalizedSymbol, dimensionCode)
  const start = Date.now()

  // ── Debug：强制走演示模式（mock + 随机延迟 + 彩色状态）
  //    触发方式：在调用批量采集前设置 sessionStorage.POOL_FORCE_DEMO = '1'
  //    当此标志启用时，无论 mode 是什么，都走 mock 采集分支，
  //    让进度面板能观察到 0→100% 流畅增长以及维度圆点三色切换。
  const forceDemo = (() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('POOL_FORCE_DEMO') === '1'
    } catch { return false }
  })()
  const effectiveMode = forceDemo ? 'unsupported' as CollectionMode : mode

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

  // 单次链路上下文：分模式处理器共享（P2 复杂度还款——将内联分支抽取为独立函数）
  const ctx: SingleTraceContext = {
    symbol: normalizedSymbol,
    dimensionCode,
    dimension,
    config,
    traceId,
    taskId,
    startedAt: start,
    span,
    addStage,
  }

  // 入口关键信息提升到 info 级别，便于生产环境追踪；traceId + mode 可做链路聚合
  logger.info('[collectionPipeline · runSingleTrace] 维度采集开始', {
    symbol: normalizedSymbol,
    dimensionCode,
    dimensionName: dimension.name,
    mode,
    effectiveMode,
    traceId,
    parentTaskId,
    forceDemo,
  })

  emit(COLLECTION_EVENTS.TRIGGERED, {
    traceId,
    taskId,
    dimensionCode,
    symbol: normalizedSymbol,
    message: `开始采集: ${dimension.name} (${mode})`,
  })
  addStage('triggered', `开始采集: ${dimension.name} (${mode})`)

  if (effectiveMode === 'unsupported') {
    // 演示模式：逐维度逐步写入 trace，模拟真实采集节奏
    // 随机延迟 800–2200ms，使进度面板能观察到进度条从 0%→100% 流畅增长
    // 维度状态分配：85% success（绿色）、10% fail（红色）、5% partial（琥珀色）
    await new Promise((res) => setTimeout(res, 800 + Math.floor(Math.random() * 1400)))
    const rnd = Math.random()
    const simulatedResult: 'success' | 'fail' | 'partial' =
      rnd < 0.85 ? 'success' : rnd < 0.95 ? 'fail' : 'partial'
    const message =
      simulatedResult === 'success'
        ? `维度 ${dimension.name} 采集完成（mock · demo）`
        : simulatedResult === 'partial'
          ? `维度 ${dimension.name} 部分完成（mock · demo）`
          : `维度 ${dimensionCode} 采集失败（mock · demo 演示）`
    addStage('complete', message, 'mock')
    emit(COLLECTION_EVENTS.COMPLETE, {
      traceId,
      taskId,
      dimensionCode,
      symbol: normalizedSymbol,
      message,
    })
    span.result = simulatedResult
    span.totalDurationMs = Date.now() - start
    span.completedAt = Date.now()
    emitTrace(span)
    getQualityMetrics().recordCollect(simulatedResult === 'success' || simulatedResult === 'partial', 'mock', span.totalDurationMs, [])
    // Mock 分支输出清晰 info 日志，标明状态/耗时/随机种子
    logger.info('[collectionPipeline · runSingleTrace] Mock 分支维度采集结束', {
      symbol: normalizedSymbol,
      dimensionCode,
      result: simulatedResult,
      latencyMs: span.totalDurationMs,
      traceId,
    })
    return {
      success: simulatedResult !== 'fail',
      symbol: normalizedSymbol,
      dimensionCode,
      latency: span.totalDurationMs,
      fallbackCount: 0,
      error: simulatedResult === 'fail' ? message : undefined,
    }
  }

  try {
    if (mode === 'quote') return handleQuoteMode(ctx)
    if (mode === 'kline') return handleKlineMode(ctx)
    if (mode === 'financial') return handleFinancialMode(ctx)
    // 2026-08-21 接线修复：集合判定替代 || 链，覆盖维度 03-08/10-16 全部非行情 mode
    if (NON_QUOTE_MODES.has(mode)) {
      return handleNonQuoteMode(ctx)
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

    getQualityMetrics().recordCollect(false, 'mock', span.totalDurationMs, [])

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
 *
 * 内部实现（不直接导出，由 withLogging 包装后导出）。
 */
async function runBatchTraceImpl(
  options: RunBatchTraceOptions,
): Promise<TraceResult[]> {
  const { symbols, dimensionCode, config, parentTaskId } = options
  const bpTaskId = parentTaskId ?? `batch-${dimensionCode}-${Date.now()}`
  // Demo 模式下降为串行，让进度面板能观察到 0%→100% 流畅增长
  const forceDemo = (() => {
    try { return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('POOL_FORCE_DEMO') === '1' }
    catch { return false }
  })()
  const CONCURRENCY = forceDemo ? 1 : 5
  const batchStart = Date.now()

  logger.info('[collectionPipeline · runBatchTrace] 批量任务开始', {
    dimensionCode,
    symbolCount: symbols.length,
    symbols,
    concurrency: CONCURRENCY,
    forceDemo,
    bpTaskId,
    parentTaskId,
  })

  emit(COLLECTION_EVENTS.TASK_STATUS, {
    traceId: bpTaskId,
    taskId: bpTaskId,
    dimensionCode,
    message: `批量任务开始（并发 ${CONCURRENCY}）`,
    payload: { status: 'running', total: symbols.length, parentTaskId },
  })

  const results: TraceResult[] = []
  let completed = 0
  let chunkIndex = 0
  const totalChunks = Math.ceil(symbols.length / CONCURRENCY)

  // 分批并发处理
  for (let chunkStart = 0; chunkStart < symbols.length; chunkStart += CONCURRENCY) {
    chunkIndex++
    const chunk = symbols.slice(chunkStart, chunkStart + CONCURRENCY)
    const chunkStartTs = Date.now()
    const chunkResults = await Promise.all(
      chunk.map((symbol) =>
        runSingleTrace({ symbol, dimensionCode, config, parentTaskId: bpTaskId })
      )
    )
    const chunkSuccess = chunkResults.filter((r) => r.success).length
    const chunkLatencyMs = Date.now() - chunkStartTs
    results.push(...chunkResults)
    completed += chunkResults.length
    const progressPct = Math.round((completed / symbols.length) * 100)

    logger.info('[collectionPipeline · runBatchTrace] 批次处理完成', {
      dimensionCode,
      bpTaskId,
      chunkIndex,
      totalChunks,
      chunkSize: chunk.length,
      chunkSymbols: chunk,
      chunkSuccess,
      chunkFail: chunkResults.length - chunkSuccess,
      chunkLatencyMs,
      completed,
      total: symbols.length,
      progressPct,
    })

    emit(COLLECTION_EVENTS.TASK_STATUS, {
      traceId: bpTaskId,
      taskId: bpTaskId,
      dimensionCode,
      message: `批量进度 ${completed}/${symbols.length}`,
      payload: { status: 'running', progress: progressPct },
    })
  }

  const totalSuccess = results.filter((r) => r.success).length
  const totalFail = results.length - totalSuccess
  const totalLatencyMs = Date.now() - batchStart
  logger.info('[collectionPipeline · runBatchTrace] 批量任务完成', {
    dimensionCode,
    bpTaskId,
    totalSymbols: symbols.length,
    totalSuccess,
    totalFail,
    totalLatencyMs,
    avgLatencyMs: totalLatencyMs / Math.max(1, symbols.length),
    successRatePct: Math.round((totalSuccess / Math.max(1, symbols.length)) * 100),
  })

  emit(COLLECTION_EVENTS.TASK_STATUS, {
    traceId: bpTaskId,
    taskId: bpTaskId,
    dimensionCode,
    message: '批量任务完成',
    payload: { status: 'completed', total: symbols.length, success: totalSuccess },
  })

  return results
}

/**
 * runSingleTrace — withLogging 包装版本（自动记录入口参数/耗时/返回结果/异常）。
 */
export const runSingleTrace = withLogging(
  'collectionPipeline',
  'runSingleTrace',
  runSingleTraceImpl,
  { resultKeys: ['success', 'symbol', 'source', 'latency', 'fallbackCount', 'error'] },
)

/**
 * runBatchTrace — withLogging 包装版本（自动记录入口参数/耗时/返回结果/异常）。
 */
export const runBatchTrace = withLogging(
  'collectionPipeline',
  'runBatchTrace',
  runBatchTraceImpl,
  { level: 'info' },
)

// ── 配置辅助 ──
// 注：upgradeDimensionsToPipeline 的 canonical 实现已下沉至
// src/lib/collection/pipeline.ts（P1-12 分层合规），本文件顶部 export 自 lib，
// 保持 API 零破坏；原本地副本 _unused_upgradeDimensionsLocally_ 已于
// 2026-08-23 卫生整改中删除（死代码，无调用方）。

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
