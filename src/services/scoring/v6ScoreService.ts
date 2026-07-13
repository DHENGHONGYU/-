/**
 * V6 评分服务 — 统一入口
 *
 * F4 整改：将原启发式 9 因子逻辑切换到 v6-engine L-1~L8 分层引擎。
 * 通过 createV6Engine().calculateAll() 执行 11 层加权评分，
 * 结果映射为 V6Score 持久化到 IndexedDB。
 */

import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import type { DataLayerResult, DailyQuotes, Stock, V6Score } from '@/data/types'
import {
  createV6Engine,
  stockToBasicData,
  quotesToQuoteData,
  ALL_LAYER_IDS,
} from '@/services/scoring/v6-engine'
import type { CompositeScore, FinancialData, V6ScoreInput } from '@/services/scoring/v6-engine'
import { nanoid } from 'nanoid'
import {
  V6ScoreTaskScheduler,
  type BatchScoreStats,
} from '@/services/workers/v6ScoreTaskScheduler'

const logger = getLogger()

/**
 * 从 financialReports store 读取真实财务数据，映射为引擎 FinancialData。
 *
 * 若数据库中无记录，返回空对象（引擎各层会降级处理）。
 */
export async function buildFinancialData(symbol: string): Promise<FinancialData> {
  logger.info('[v6ScoreService] buildFinancialData 开始读取财务数据', { symbol })

  const reportResult = await dataBridge.query<{
    revenue: number
    revenueYoY: number
    netProfit: number
    netProfitYoY: number
    grossMargin: number
    netMargin: number
    operatingCF: number
    rdRatio: number
    receivables: number
    inventoryTurnoverDays: number
    interestBearingDebt: number
    goodwill: number
    netAssets: number
    shareholderPledge: number
    reportDate: string
  }>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.financialReports,
    key: symbol,
    source: MODULE_ID.analyzer,
  })

  if (!reportResult.success || !reportResult.data) {
    logger.info('[v6ScoreService] buildFinancialData 未找到财务数据，返回空对象', { symbol })
    return {}
  }
  const report = reportResult.data

  const financialData: FinancialData = {
    revenue: report.revenue,
    revenueYoY: report.revenueYoY,
    netProfit: report.netProfit,
    netProfitYoY: report.netProfitYoY,
    grossMargin: report.grossMargin,
    netMargin: report.netMargin,
    operatingCF: report.operatingCF,
    rdRatio: report.rdRatio,
    receivables: report.receivables,
    inventoryTurnoverDays: report.inventoryTurnoverDays,
    interestBearingDebt: report.interestBearingDebt,
    goodwill: report.goodwill,
    netAssets: report.netAssets,
    shareholderPledge: report.shareholderPledge,
  }

  logger.info('[v6ScoreService] buildFinancialData 财务数据加载成功', {
    symbol,
    reportDate: report.reportDate,
    revenue: financialData.revenue,
    netProfit: financialData.netProfit,
    grossMargin: financialData.grossMargin,
    netMargin: financialData.netMargin,
    rdRatio: financialData.rdRatio,
    fieldCount: Object.values(financialData).filter(v => v !== undefined).length,
  })

  return financialData
}

/**
 * 组装 v6-engine 输入
 */
async function buildEngineInput(stock: Stock, quotes: DailyQuotes | null): Promise<V6ScoreInput> {
  // 输入校验：确保 stock.price 有效
  if (!Number.isFinite(stock.price)) {
    logger.warn(`[v6ScoreService] buildEngineInput: stock.price 无效 (${stock.price})，使用 0`)
  }

  const stockData = stockToBasicData(stock)
  const financials = await buildFinancialData(stock.symbol)
  const quotesData = quotes
    ? quotesToQuoteData(quotes)
    : { latestClose: stock.price, history: [], volumeHistory: [] }

  // 验证 quotesData 的 latestClose
  if (!Number.isFinite(quotesData.latestClose)) {
    logger.warn(`[v6ScoreService] buildEngineInput: quotesData.latestClose 无效，使用 stock.price`)
    quotesData.latestClose = Number.isFinite(stock.price) ? stock.price : 0
  }

  return {
    symbol: stock.symbol,
    stock: stockData,
    financials,
    quotes: quotesData,
  }
}

/**
 * 将 CompositeScore 映射为 V6Score 持久化结构
 */
function compositeToV6Score(
  stock: Stock,
  composite: CompositeScore,
): V6Score {
  // 分数校验：确保 composite.score 是有效数字
  const validScore = Number.isFinite(composite.score) ? composite.score : 0

  // 各层得分明细（layerId → score）
  const factors: Record<string, number> = {}
  const layerDetails: Record<string, { score: number; summary: string; weight: number }> = {}

  for (const [layerId, layer] of Object.entries(composite.layers)) {
    // 校验每层分数
    const layerScore = Number.isFinite(layer.score) ? layer.score : 0
    factors[layerId] = layerScore
    layerDetails[layerId] = {
      score: layerScore,
      summary: layer.summary,
      weight: layer.weight,
    }
  }

  // 数据完整度检查
  const totalLayers = Object.keys(composite.layers).length
  const scoredLayers = Object.values(composite.layers).filter((l) => l.score > 0).length
  const dataCompleteness = totalLayers > 0 ? (scoredLayers / totalLayers) * 100 : 0

  const v6Score: V6Score = {
    symbol: stock.symbol,
    score: validScore,
    factors,
    algorithmVersion: composite.engineVersion,
    calculatedAt: composite.timestamp,
    dataVersion: stock.dataVersion,
    // F4 扩展字段
    rating: composite.rating,
    layerDetails,
    allRisks: composite.allRisks,
    recommendation: composite.recommendation,
    engineVersion: composite.engineVersion,
    // 质量警告
    ...(dataCompleteness < 100 && {
      qualityWarning: `数据完整度 ${dataCompleteness.toFixed(0)}%，${scoredLayers}/${totalLayers} 层有效评分`,
    }),
  }

  return v6Score
}

// ─── 公共 API ─────────────────────────────────────────────

/**
 * 获取全部 V6 评分（只读）
 */
export async function getAllV6Scores(): Promise<DataLayerResult<V6Score[]>> {
  try {
    const result = await dataBridge.query<V6Score[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.v6Scores,
      source: MODULE_ID.analyzer,
    })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: result.data ?? [] }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export interface V6ScoreQuality {
  dataCompleteness: number
  hasQuotes: boolean
  hasBasicData: boolean
  missingLayers: string[]
}

/**
 * 执行 V6 分层评分（主入口）
 *
 * 调用 v6-engine L-1~L8 共 11 层计算器，结果持久化到 IndexedDB。
 */
export async function runV6Score(symbol: string): Promise<DataLayerResult<V6Score>> {
  logger.info(`[v6ScoreService] runV6Score 开始`, { symbol })

  const stockResult = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: symbol,
    source: MODULE_ID.analyzer,
  })
  if (!stockResult.success || !stockResult.data) {
    logger.warn(`[v6ScoreService] runV6Score Stock 不存在`, { symbol })
    return { success: false, error: `Stock not found: ${symbol}` }
  }
  const stock = stockResult.data

  logger.info(`[v6ScoreService] runV6Score Stock 已加载`, {
    symbol,
    name: stock.name,
    price: stock.price,
    pe: stock.pe,
    pb: stock.pb,
    roe: stock.roe,
    marketCap: stock.marketCap,
    dataVersion: stock.dataVersion,
    industryCode: stock.industryCode,
  })

  const quotesResult = await dataBridge.query<DailyQuotes>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.dailyQuotes,
    key: symbol,
    source: MODULE_ID.analyzer,
  })
  const quotesOrNull = quotesResult.success && quotesResult.data ? quotesResult.data : null

  logger.info(`[v6ScoreService] runV6Score K线数据状态`, {
    symbol,
    hasQuotes: quotesOrNull !== null,
    historyLength: quotesOrNull?.history.length ?? 0,
    latestClose: quotesOrNull?.latest?.close,
    latestDate: quotesOrNull?.latest?.date,
    hasBasicData: stock.price !== undefined,
  })

  try {
    logger.info(`[v6ScoreService] runV6Score 创建引擎实例`, { symbol })
    const engine = createV6Engine()

    logger.info(`[v6ScoreService] runV6Score 构建引擎输入`, { symbol })
    const input = await buildEngineInput(stock, quotesOrNull)

    logger.info(`[v6ScoreService] runV6Score 引擎输入详情`, {
      symbol,
      stockSymbol: input.stock.symbol,
      stockName: input.stock.name,
      stockPrice: input.stock.price,
      stockPe: input.stock.pe,
      stockPb: input.stock.pb,
      stockRoe: input.stock.roe,
      stockMarketCap: input.stock.marketCap,
      quotesLatestClose: input.quotes.latestClose,
      quotesReturn20d: input.quotes.return20d,
      quotesReturn60d: input.quotes.return60d,
      quotesVolatility20d: input.quotes.volatility20d,
      quotesHistoryLength: input.quotes.history?.length ?? 0,
      hasIndustryScore: input.industryScore !== undefined,
      hasZeroToOneEvents: input.zeroToOneEvents !== undefined,
      zeroToOneEventsCount: input.zeroToOneEvents?.length ?? 0,
    })

    logger.info(`[v6ScoreService] runV6Score 开始执行 11 层评分计算`, { symbol })
    const composite = await engine.calculateAll(input)

    logger.info(`[v6ScoreService] runV6Score 引擎计算完成`, {
      symbol,
      compositeScore: composite.score,
      compositeRating: composite.rating,
      totalLayers: Object.keys(composite.layers).length,
      allRisksCount: composite.allRisks.length,
      recommendation: composite.recommendation,
      engineVersion: composite.engineVersion,
      timestamp: composite.timestamp,
    })

    // 记录各层评分明细
    const layerScores: Record<string, { score: number; summary: string; weight: number }> = {}
    for (const [layerId, layer] of Object.entries(composite.layers)) {
      layerScores[layerId] = {
        score: layer.score,
        summary: layer.summary,
        weight: layer.weight,
      }
    }
    logger.info(`[v6ScoreService] runV6Score 各层评分明细`, {
      symbol,
      layerScores,
    })

    const v6Score = compositeToV6Score(stock, composite)

    logger.info(`[v6ScoreService] runV6Score V6Score 映射完成`, {
      symbol,
      score: v6Score.score.toFixed(2),
      rating: v6Score.rating,
      layersScored: Object.keys(v6Score.layerDetails ?? {}).length,
      risks: v6Score.allRisks?.length ?? 0,
      qualityWarning: v6Score.qualityWarning,
      algorithmVersion: v6Score.algorithmVersion,
      dataVersion: v6Score.dataVersion,
    })

    logger.info(`[v6ScoreService] runV6Score 准备持久化到 IndexedDB`, { symbol })
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.analyzer,
        target: 'db' as const,
        action: ENVELOPE_ACTION.saveScores,
        traceId: `v6score-${nanoid(8)}-${symbol}`,
      },
      v6Score,
    )
    try {
      await dataBridge.forward(envelope)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error(`[v6ScoreService] runV6Score 持久化失败`, {
        symbol,
        error: errorMsg,
      })
      return { success: false, error: errorMsg }
    }

    logger.info(`[v6ScoreService] runV6Score 评分完成并已持久化`, {
      symbol,
      score: v6Score.score.toFixed(2),
      rating: v6Score.rating,
    })

    // 发出信号 — 通知 UI 刷新
    eventBus.emit('V6_SCORE_COMPLETED', {
      symbol,
      score: v6Score.score,
      rating: v6Score.rating,
    })

    return { success: true, data: v6Score }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    logger.error(`[v6ScoreService] runV6Score 评分失败`, {
      symbol,
      error: message,
      stack,
    })
    return { success: false, error: message }
  }
}

/**
 * 批量 V6 分层评分（Worker 并行化）
 *
 * 流程：
 * 1. 主线程并行读取所有 stock / quotes / financials
 * 2. 组装 V6ScoreInput[]
 * 3. 提交 TaskScheduler（Worker 池或主线程回退）
 * 4. 结果映射并批量持久化
 * 5. 返回统计 + 结果
 *
 * @param symbols    股票代码列表
 * @param options    批量选项（Worker 数、进度回调等）
 */
export interface BatchScoreOptions {
  /** Worker 实例数上限（默认 min(硬件并发, 4)） */
  maxWorkers?: number
  /** 单任务超时（ms），默认 30s */
  taskTimeoutMs?: number
  /** 强制主线程回退（调试用） */
  forceMainThread?: boolean
  /** 进度回调 (completed, total) */
  onProgress?: (completed: number, total: number) => void
}

export interface BatchScoreResult {
  scores: V6Score[]
  stats: BatchScoreStats
  errors: { symbol: string; error: string }[]
}

export async function runV6ScoreBatch(
  symbols: string[],
  options: BatchScoreOptions = {},
): Promise<DataLayerResult<BatchScoreResult>> {
  if (symbols.length === 0) {
    return {
      success: true,
      data: {
        scores: [],
        stats: {
          total: 0, completed: 0, failed: 0, skipped: 0,
          totalMs: 0, avgMs: 0, workerCount: 0, fallbackToMainThread: false,
        },
        errors: [],
      },
    }
  }

  logger.info(`[v6ScoreService] runV6ScoreBatch 开始，共 ${symbols.length} 只股票`, {
    symbolCount: symbols.length,
    maxWorkers: options.maxWorkers,
    forceMainThread: options.forceMainThread,
  })

  const scheduler = new V6ScoreTaskScheduler({
    maxWorkers: options.maxWorkers,
    taskTimeoutMs: options.taskTimeoutMs,
    forceMainThread: options.forceMainThread,
  })

  try {
    // 1. 并行加载所有 stock 数据
    const stockStart = performance.now()
    const stockResults = await Promise.all(
      symbols.map(async (symbol) => {
        const [stockRes, quotesRes] = await Promise.all([
          dataBridge.query<Stock>({
            action: ENVELOPE_ACTION.queryGet,
            store: STORE_NAME.stocks,
            key: symbol,
            source: MODULE_ID.analyzer,
          }),
          dataBridge.query<DailyQuotes>({
            action: ENVELOPE_ACTION.queryGet,
            store: STORE_NAME.dailyQuotes,
            key: symbol,
            source: MODULE_ID.analyzer,
          }),
        ])
        return {
          symbol,
          stock: stockRes.success ? stockRes.data : null,
          quotes: quotesRes.success ? quotesRes.data : null,
        }
      }),
    )
    logger.info(
      `[v6ScoreService] 批量加载 stock/quotes 完成，耗时 ${Math.round(performance.now() - stockStart)}ms`,
      { loaded: stockResults.filter((r) => r.stock).length, total: symbols.length },
    )

    // 2. 组装引擎输入
    const inputs: { stock: Stock; input: V6ScoreInput }[] = []
    const errors: { symbol: string; error: string }[] = []
    for (const r of stockResults) {
      if (!r.stock) {
        errors.push({ symbol: r.symbol, error: 'Stock not found' })
        continue
      }
      try {
        const input = await buildEngineInput(r.stock, r.quotes ?? null)
        inputs.push({ stock: r.stock, input })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push({ symbol: r.symbol, error: msg })
      }
    }

    if (inputs.length === 0) {
      return {
        success: false,
        error: `所有股票数据加载失败: ${errors.map((e) => e.symbol).join(', ')}`,
      }
    }

    // 3. Worker 批量计算
    const { stats, results } = await scheduler.calculateBatch(
      inputs.map((i) => i.input),
      undefined,
      options.onProgress,
    )

    // 4. 映射 + 持久化
    const scores: V6Score[] = []
    const savePromises: Promise<unknown>[] = []

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      if (input == null) continue
      const composite = results[i]
      if (composite == null) {
        errors.push({ symbol: input.stock.symbol, error: 'Calculation failed' })
        continue
      }
      const v6Score = compositeToV6Score(input.stock, composite)
      scores.push(v6Score)

      // 异步持久化（不阻塞后续评分）
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.analyzer,
          target: 'db' as const,
          action: ENVELOPE_ACTION.saveScores,
          traceId: `v6score-batch-${nanoid(6)}-${v6Score.symbol}`,
        },
        v6Score,
      )
      savePromises.push(
        dataBridge.forward(envelope).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err)
          logger.error(`[v6ScoreService] 批量持久化失败`, { symbol: v6Score.symbol, error: msg })
          errors.push({ symbol: v6Score.symbol, error: `Save failed: ${msg}` })
        }),
      )
    }

    await Promise.all(savePromises)

    logger.info('[v6ScoreService] runV6ScoreBatch 完成', {
      total: symbols.length,
      scored: scores.length,
      failed: errors.length,
      workerCount: stats.workerCount,
      fallback: stats.fallbackToMainThread,
      totalMs: stats.totalMs,
      avgMs: stats.avgMs,
    })

    return { success: true, data: { scores, stats, errors } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`[v6ScoreService] runV6ScoreBatch 失败`, { error: msg })
    return { success: false, error: msg }
  } finally {
    // 批量模式：每次批量完成后销毁调度器，避免长期持有 Worker
    // 高频场景下可改用全局单例（getGlobalScheduler）
    scheduler.destroy()
  }
}

/**
 * 获取评分质量指标
 */
export function getV6ScoreQuality(
  _symbol: string,
  factors: Record<string, number>,
): V6ScoreQuality {
  const missingLayers = ALL_LAYER_IDS.filter(
    (id) => factors[id] === undefined || factors[id] === null,
  )
  const validCount = ALL_LAYER_IDS.length - missingLayers.length
  return {
    dataCompleteness: (validCount / ALL_LAYER_IDS.length) * 100,
    hasQuotes: true,
    hasBasicData: validCount >= 3,
    missingLayers,
  }
}
