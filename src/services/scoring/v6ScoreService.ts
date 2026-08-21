/**
 * V6 评分服务 — 统一入口
 *
 * F4 整改：将原启发式 9 因子逻辑切换到 v6-engine L-1~L8 分层引擎。
 * 通过 createV6Engine().calculateAll() 执行 11 层加权评分，
 * 结果映射为 V6Score 持久化到 IndexedDB。
  * @doc [V9-DOC-BACK-005, V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-PROJ-113, V9-DOC-PROJ-054]
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
import type { CompositeScore, FinancialData, QuoteData, V6ScoreInput } from '@/services/scoring/v6-engine'
import { validateScoringInput } from '@/services/scoring/scoringInputValidation'
import { nanoid } from 'nanoid'
import {
  V6ScoreTaskScheduler,
  type BatchScoreStats,
} from '@/services/workers/v6ScoreTaskScheduler'

const logger = getLogger()

/**
 * 展示层分数格式化：防御 NaN/±Infinity，兜底输出 "0.00"。
 * 与评分链路 NaN 防护口径一致，防止 future 重构移除上层守卫后 toFixed(NaN) 泄漏到日志/UI。
 */
export function formatScore(score: number): string {
  return Number.isFinite(score) ? score.toFixed(2) : '0.00'
}

/**
 * 从 financialReports store 读取真实财务数据，映射为引擎 FinancialData。
 *
 * 若数据库中无记录，返回空对象（引擎各层会降级处理）。
 */
export async function buildFinancialData(symbol: string): Promise<FinancialData> {
  logger.info(`[v6ScoreService.buildFinancialData] ==== 开始构建财务数据 ====`, { symbol })

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
    logger.warn(`[v6ScoreService.buildFinancialData] 未找到财务数据，标记为 missing`, { symbol, errorCode: reportResult.error ?? 'NO_DATA' })
    return { dataStatus: 'missing' }
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

  const fieldCount = Object.values(financialData).filter((v) => v !== undefined).length
  const totalFields = Object.keys(financialData).length
  financialData.dataStatus = fieldCount === 0 ? 'missing' : fieldCount < totalFields ? 'partial' : 'complete'

  logger.info(`[v6ScoreService.buildFinancialData] ==== 财务数据构建完成 ====`, {
    symbol,
    dataStatus: financialData.dataStatus,
    fieldCount,
    totalFields,
    missingCount: totalFields - fieldCount,
    reportDate: report.reportDate,
    revenue: financialData.revenue,
    netProfit: financialData.netProfit,
    grossMargin: financialData.grossMargin,
  })

  return financialData
}

/**
 * 组装 v6-engine 输入
 */
async function buildEngineInput(stock: Stock, quotes: DailyQuotes | null): Promise<V6ScoreInput> {
  const buildStart = Date.now()
  logger.info(`[v6ScoreService.buildEngineInput] ==== 开始构建引擎输入 ====`, {
    symbol: stock.symbol,
    stockName: stock.name,
    hasQuotes: quotes !== null,
    quotesHistoryLen: quotes?.history?.length ?? 0,
  })

  // 输入校验：确保 stock.price 有效
  if (!Number.isFinite(stock.price)) {
    logger.warn(`[v6ScoreService.buildEngineInput] stock.price 无效 (${stock.price})，使用 0`, {
      symbol: stock.symbol,
      priceValue: stock.price,
      priceType: typeof stock.price,
    })
  }

  const stockData = stockToBasicData(stock)
  logger.debug(`[v6ScoreService.buildEngineInput] stock 映射完成`, {
    symbol: stock.symbol,
    stockDataPrice: stockData.price,
    stockDataPE: stockData.pe,
    stockDataPB: stockData.pb,
  })

  const financials = await buildFinancialData(stock.symbol)
  logger.debug(`[v6ScoreService.buildEngineInput] 财务数据构建完成`, {
    symbol: stock.symbol,
    dataStatus: financials.dataStatus,
    fieldCount: Object.keys(financials).length - 1, // 减去 dataStatus
  })

  const quotesData = quotes
    ? quotesToQuoteData(quotes)
    : { latestClose: stock.price, history: [], volumeHistory: [] }

  // 验证 quotesData 的 latestClose
  if (!Number.isFinite(quotesData.latestClose)) {
    logger.warn(`[v6ScoreService.buildEngineInput] quotesData.latestClose 无效，使用 stock.price`, {
      symbol: stock.symbol,
      invalidLatestClose: quotesData.latestClose,
      fallbackPrice: stock.price,
    })
    quotesData.latestClose = Number.isFinite(stock.price) ? stock.price : 0
  }

  logger.debug(`[v6ScoreService.buildEngineInput] K线数据构建完成`, {
    symbol: stock.symbol,
    latestClose: quotesData.latestClose,
    historyCount: quotesData.history?.length ?? 0,
    volumeHistoryCount: quotesData.volumeHistory?.length ?? 0,
    return20d: quotesData.return20d,
    return60d: quotesData.return60d,
    volatility20d: quotesData.volatility20d,
  })

  // P0-3：评分输入数据契约校验（warn-only，不阻断评分）
  const validation = validateScoringInput({
    stock: stockData,
    financials,
    quotes: quotesData,
  })
  if (!validation.allOk) {
    logger.warn(`[v6ScoreService.buildEngineInput] 输入数据校验发现 ${validation.totalIssues} 个问题`, {
      symbol: stock.symbol,
      stockIssues: validation.stock.issues.map(i => `[${i.severity}] ${i.field}: ${i.message}`).join(' | '),
      financialIssues: validation.financials.issues.map(i => `[${i.severity}] ${i.field}: ${i.message}`).join(' | '),
      quoteIssues: validation.quotes.issues.map(i => `[${i.severity}] ${i.field}: ${i.message}`).join(' | '),
    })
  } else {
    logger.info(`[v6ScoreService.buildEngineInput] 输入数据校验通过，全部OK`, {
      symbol: stock.symbol,
    })
  }

  const result = {
    symbol: stock.symbol,
    stock: stockData,
    financials,
    quotes: quotesData,
  }

  logger.info(`[v6ScoreService.buildEngineInput] ==== 引擎输入构建完成 ====`, {
    symbol: stock.symbol,
    totalDurationMs: Date.now() - buildStart,
    validationPassed: validation.allOk,
    validationIssues: validation.totalIssues,
  })

  return result
}

/**
 * 将 CompositeScore 映射为 V6Score 持久化结构
 */
export function compositeToV6Score(
  stock: Stock,
  composite: CompositeScore,
  financials?: FinancialData,
): V6Score {
  const mapStartTs = Date.now()
  logger.info(`[v6ScoreService.compositeToV6Score] ==== 开始结果映射 ====`, {
    symbol: stock.symbol,
    compositeScore: composite.score,
    compositeRating: composite.rating,
    layerCount: Object.keys(composite.layers).length,
  })

  // 分数校验：确保 composite.score 是有效数字
  const validScore = Number.isFinite(composite.score) ? composite.score : 0
  if (!Number.isFinite(composite.score)) {
    logger.warn(`[v6ScoreService.compositeToV6Score] composite.score 非有限数 (${composite.score})，强制置 0`, {
      symbol: stock.symbol,
      originalScore: composite.score,
      type: typeof composite.score,
    })
  }

  // 各层得分明细（layerId → score）
  const factors: Record<string, number> = {}
  const layerDetails: Record<string, { score: number; summary: string; weight: number }> = {}

  const layerEntries = Object.entries(composite.layers)
  logger.info(`[v6ScoreService.compositeToV6Score] 开始遍历 ${layerEntries.length} 层构建持久化结构`)
  for (const [layerId, layer] of layerEntries) {
    // 校验每层分数
    const layerScore = Number.isFinite(layer.score) ? layer.score : 0
    if (!Number.isFinite(layer.score)) {
      logger.warn(`[v6ScoreService.compositeToV6Score] ${layerId} 层得分非有限数 (${layer.score})，置 0`, {
        symbol: stock.symbol,
        layerId,
        originalLayerScore: layer.score,
      })
    }

    factors[layerId] = layerScore
    layerDetails[layerId] = {
      score: layerScore,
      summary: layer.summary,
      weight: layer.weight,
    }

    logger.debug(`[v6ScoreService.compositeToV6Score] ${layerId} 层映射`, {
      layerId,
      rawScore: layer.score,
      validScore: layerScore,
      weight: layer.weight,
      summaryLen: layer.summary?.length ?? 0,
      summaryPreview: layer.summary?.slice(0, 50) ?? '',
    })
  }

  // 数据完整度检查
  const totalLayers = layerEntries.length
  const scoredLayers = Object.values(composite.layers).filter((l) => l.score > 0).length
  const validScoreLayers = Object.values(composite.layers).filter((l) => Number.isFinite(l.score)).length
  const dataCompleteness = totalLayers > 0 ? (scoredLayers / totalLayers) * 100 : 0

  logger.info(`[v6ScoreService.compositeToV6Score] 数据完整度统计`, {
    symbol: stock.symbol,
    totalLayers,
    scoredLayers, // score > 0
    validScoreLayers, // 有限数字
    invalidScoreLayers: totalLayers - validScoreLayers,
    dataCompletenessPct: `${Number.isFinite(dataCompleteness) ? dataCompleteness.toFixed(0) : '0'}%`,
    skippedLayers: composite.skippedLayers?.length ? composite.skippedLayers.join(', ') : '无',
  })

  const qualityWarningActive = dataCompleteness < 100
  const missingFinancialsActive = financials?.dataStatus === 'missing'

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
    ...(qualityWarningActive && {
      qualityWarning: `数据完整度 ${Number.isFinite(dataCompleteness) ? dataCompleteness.toFixed(0) : '0'}%，${scoredLayers}/${totalLayers} 层有效评分`,
    }),
    // P1-M2：财务数据缺失显式标记
    ...(missingFinancialsActive && {
      missingFinancials: true,
    }),
  }

  logger.info(`[v6ScoreService.compositeToV6Score] ==== 结果映射完成 ====`, {
    symbol: stock.symbol,
    finalScore: v6Score.score,
    rating: v6Score.rating,
    hasQualityWarning: qualityWarningActive,
    hasMissingFinancials: missingFinancialsActive,
    riskCount: v6Score.allRisks?.length ?? 0,
    totalDurationMs: Date.now() - mapStartTs,
  })

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

    const v6Score = compositeToV6Score(stock, composite, input.financials)

    logger.info(`[v6ScoreService] runV6Score V6Score 映射完成`, {
      symbol,
      score: formatScore(v6Score.score),
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
      score: formatScore(v6Score.score),
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

/**
 * 构建单个标的的引擎输入（扁平化：将 try/catch 收敛到独立辅助函数）。
 * 成功返回 { input }，失败返回 { error }，日志在本函数内完成。
 */
async function buildEngineInputItem(
  stock: Stock,
  quotes: DailyQuotes | null,
  index: number,
  total: number,
): Promise<{ input: V6ScoreInput } | { error: string }> {
  logger.debug(`[v6ScoreService.runV6ScoreBatch] [${index}/${total}] 构建 ${stock.symbol} 输入...`)
  try {
    const input = await buildEngineInput(stock, quotes)
    return { input }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    logger.error(`[v6ScoreService.runV6ScoreBatch] [${index}/${total}] ${stock.symbol} 输入构建失败`, {
      symbol: stock.symbol,
      error: msg,
      stack,
    })
    return { error: msg }
  }
}

/**
 * runV6ScoreBatch
 */
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
    logger.info(`[v6ScoreService.runV6ScoreBatch] 开始组装引擎输入，共 ${stockResults.length} 条数据`)
    const inputs: { stock: Stock; input: V6ScoreInput }[] = []
    const errors: { symbol: string; error: string }[] = []
    let inputIndex = 0
    for (const r of stockResults) {
      inputIndex++
      if (!r.stock) {
        logger.warn(`[v6ScoreService.runV6ScoreBatch] [${inputIndex}/${stockResults.length}] ${r.symbol} Stock 未找到，跳过`)
        errors.push({ symbol: r.symbol, error: 'Stock not found' })
        continue
      }
      const built = await buildEngineInputItem(r.stock, r.quotes ?? null, inputIndex, stockResults.length)
      if ('error' in built) {
        errors.push({ symbol: r.stock.symbol, error: built.error })
        continue
      }
      inputs.push({ stock: r.stock, input: built.input })
      logger.debug(`[v6ScoreService.runV6ScoreBatch] [${inputIndex}/${stockResults.length}] ${r.stock.symbol} 输入构建完成，已累计 ${inputs.length} 条`)
    }
    logger.info(`[v6ScoreService.runV6ScoreBatch] 引擎输入组装完成`, {
      successCount: inputs.length,
      errorCount: errors.length,
      totalAttempted: stockResults.length,
    })

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
    logger.info(`[v6ScoreService.runV6ScoreBatch] 开始结果映射 + 持久化，共 ${inputs.length} 条结果`)
    const scores: V6Score[] = []
    const savePromises: Promise<unknown>[] = []

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      if (input == null) continue
      const composite = results[i]
      const progressInfo = `[${i + 1}/${inputs.length}] ${input.stock.symbol}`

      if (composite == null) {
        logger.warn(`[v6ScoreService.runV6ScoreBatch] ${progressInfo} 计算结果为空，标记为失败`)
        errors.push({ symbol: input.stock.symbol, error: 'Calculation failed' })
        continue
      }

      logger.debug(`[v6ScoreService.runV6ScoreBatch] ${progressInfo} 映射 V6Score，composite.score=${composite.score}`)
      const v6Score = compositeToV6Score(input.stock, composite, input.input.financials)
      scores.push(v6Score)
      logger.debug(`[v6ScoreService.runV6ScoreBatch] ${progressInfo} 映射完成 score=${formatScore(v6Score.score)} rating=${v6Score.rating}`)

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
          logger.error(`[v6ScoreService.runV6ScoreBatch] ${progressInfo} 持久化失败`, { symbol: v6Score.symbol, error: msg })
          errors.push({ symbol: v6Score.symbol, error: `Save failed: ${msg}` })
        }),
      )
    }
    logger.info(`[v6ScoreService.runV6ScoreBatch] 结果映射完成，等待所有持久化写入...`, {
      mappedCount: scores.length,
      pendingSaveCount: savePromises.length,
      errorCountSoFar: errors.length,
    })

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
  symbol: string,
  factors: Record<string, number>,
): V6ScoreQuality {
  const missingLayers = ALL_LAYER_IDS.filter(
    (id) => factors[id] === undefined || factors[id] === null,
  )
  const validCount = ALL_LAYER_IDS.length - missingLayers.length
  const dataCompleteness = (validCount / ALL_LAYER_IDS.length) * 100
  const result: V6ScoreQuality = {
    dataCompleteness,
    hasQuotes: true,
    hasBasicData: validCount >= 3,
    missingLayers,
  }
  logger.info(`[v6ScoreService.getV6ScoreQuality] ==== 评分质量诊断 ====`, {
    symbol,
    totalLayers: ALL_LAYER_IDS.length,
    validCount,
    missingCount: missingLayers.length,
    dataCompletenessPct: `${dataCompleteness.toFixed(0)}%`,
    missingLayers: missingLayers.length > 0 ? missingLayers.join(', ') : '无',
    hasBasicData: result.hasBasicData,
  })
  return result
}

// ============================================================
// 行业分析服务注入（v2.9.0 新增）
// ============================================================

/** 行业分析服务接口 */
export interface IndustryAnalysisServices {
  getStockIndustryV4Analysis?: typeof import('@/services/analysis/industryAnalysisService').getStockIndustryV4Analysis
  runFullIndustryAnalysis?: typeof import('@/services/analysis/industryAnalysisService').runFullIndustryAnalysis
  invalidateIndustryCache?: typeof import('@/services/analysis/industryAnalysisService').invalidateIndustryCache
  v4ToIndustryScoreData?: typeof import('@/services/analysis/industryAnalysisService').v4ToIndustryScoreData
  // v2.9.5 增强版
  runFullIndustryAnalysisEnhanced?: typeof import('@/services/analysis/industryAnalysisService').runFullIndustryAnalysisEnhanced
  getStockIndustryV4AnalysisEnhanced?: typeof import('@/services/analysis/industryAnalysisService').getStockIndustryV4AnalysisEnhanced
}

let industryServices: IndustryAnalysisServices = {}

/**
 * 注入行业分析服务
 *
 * 沿用 setXxxServices 模式，避免循环依赖。
 * 在 main.tsx 启动时注入具体实现。
 */
export function setIndustryAnalysisServices(services: IndustryAnalysisServices): void {
  industryServices = { ...industryServices, ...services }
  logger.info('[v6ScoreService] 行业分析服务已注入', {
    hasV4Analysis: typeof services.getStockIndustryV4Analysis === 'function',
    hasFullAnalysis: typeof services.runFullIndustryAnalysis === 'function',
  })
}

/**
 * 获取行业分析服务（安全访问）
 */
export function getIndustryAnalysisServices(): IndustryAnalysisServices {
  return industryServices
}

/**
 * 在批量评分时预计算行业 V4 分析结果
 *
 * 在批量评分前调用，将行业分析结果缓存，
 * 供每只股票评分时使用。
 */
export async function precomputeIndustryAnalysisForBatch(
  stocks: Array<{ stock: Stock; financials: FinancialData; quotes: QuoteData }>,
): Promise<void> {
  if (!industryServices.runFullIndustryAnalysis) return

  try {
    await industryServices.runFullIndustryAnalysis(stocks, { forceRefresh: true })
    logger.info('[v6ScoreService] 批量行业V4分析预计算完成')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn(`[v6ScoreService] 批量行业V4分析预计算失败: ${msg}`)
  }
}

/**
 * 为单只股票注入行业 V4 分析结果到评分输入
 */
export function injectIndustryV4ToInput(
  stock: Stock,
  input: V6ScoreInput,
  allV4Analyses: Array<import('@/data/types/types.sector').IndustryV4Analysis>,
): V6ScoreInput {
  if (!industryServices.getStockIndustryV4Analysis || !industryServices.v4ToIndustryScoreData) {
    return input
  }

  try {
    const { bestMatch } = industryServices.getStockIndustryV4Analysis(stock, allV4Analyses)
    if (bestMatch?.v4Composite == null) {
      return input
    }

    const scoreData = industryServices.v4ToIndustryScoreData(bestMatch)
    const v4Input: V6ScoreInput & { industryV4Analysis?: typeof bestMatch } = {
      ...input,
      industryScore: scoreData,
      industryV4Analysis: bestMatch,
    }

    return v4Input
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn(`[v6ScoreService] 注入行业V4分析失败: ${msg}`, { symbol: stock.symbol })
    return input
  }
}
