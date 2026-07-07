/**
 * V6 评分服务 — 统一入口
 *
 * F4 整改：将原启发式 9 因子逻辑切换到 v6-engine L-1~L8 分层引擎。
 * 通过 createV6Engine().calculateAll() 执行 11 层加权评分，
 * 结果映射为 V6Score 持久化到 IndexedDB。
 */

import { dataLayer } from '@/data/dataLayer'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult, DailyQuotes, Stock, V6Score } from '@/data/types'
import {
  createV6Engine,
  stockToBasicData,
  quotesToQuoteData,
  ALL_LAYER_IDS,
} from '@/services/scoring/v6-engine'
import type { CompositeScore, FinancialData, V6ScoreInput } from '@/services/scoring/v6-engine'

const logger = getLogger()

/**
 * 从 financialReports store 读取真实财务数据，映射为引擎 FinancialData。
 *
 * 若数据库中无记录，返回空对象（引擎各层会降级处理）。
 */
async function buildFinancialData(symbol: string): Promise<FinancialData> {
  logger.info('[v6ScoreService] buildFinancialData 开始读取财务数据', { symbol })

  const report = await dataLayer.financialReports.get(symbol)

  if (!report) {
    logger.info('[v6ScoreService] buildFinancialData 未找到财务数据，返回空对象', { symbol })
    return {}
  }

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
    const list = await dataLayer.v6Scores.list()
    return { success: true, data: list }
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

  const stock = await dataLayer.stocks.get(symbol)
  if (!stock) {
    logger.warn(`[v6ScoreService] runV6Score Stock 不存在`, { symbol })
    return { success: false, error: `Stock not found: ${symbol}` }
  }

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

  const quotes = await dataLayer.dailyQuotes.get(symbol)
  const quotesOrNull = quotes ?? null

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
    const result = await dataLayer.v6Scores.save(v6Score)
    if (!result.success) {
      logger.error(`[v6ScoreService] runV6Score 持久化失败`, {
        symbol,
        error: result.error,
      })
      return { success: false, error: result.error }
    }

    logger.info(`[v6ScoreService] runV6Score 评分完成并已持久化`, {
      symbol,
      score: v6Score.score.toFixed(2),
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
