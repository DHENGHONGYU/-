/**
 * @fileoverview 热门板块评分数据获取与编排
 *
 * 从 hotSectorAnalyzer.ts 拆分而来，职责：
 * - 实现 analyzeBySymbol：根据 symbol 从 dataLayer 获取数据并执行五维评分
 * - 实现 analyzeBatch：批量分析多只股票
 *
 * 拆分原因：将编排逻辑独立，避免 hotSectorPersistence.ts 与 hotSectorAnalyzer.ts (barrel) 形成循环依赖。
 *
 * @module services/scoring/hotSectorOrchestrator
 * @created 2026-07-07 - 从 hotSectorAnalyzer.ts 拆分
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-021, V9-DOC-BACK-033, V9-DOC-BACK-027]
*/

import { HOT_SECTOR_THRESHOLDS } from '@/config/thresholds'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import { checkStrategyScoreFreshness } from '@/core/freshnessGuard'
import type { Stock, V6Score, DailyQuotes } from '@/data/types'
import type { HotSectorScore } from '@/data/types'
import { getLogger } from '@/lib/logger'

import {
  analyze,
  type BreakoutInput,
  type MarketEnvInput,
  type MomentumInput,
  type SentimentInput,
  type ValuationRiskInput,
} from './hotSectorDimensions'
import { computeMA, computeRSI } from './hotSectorIndicators'

const logger = getLogger()

/**
 * 根据 symbol 从 dataLayer 获取数据并执行五维评分。
 * 返回 null 表示数据不足无法评分。
 */
export async function analyzeBySymbol(symbol: string): Promise<HotSectorScore | null> {
  logger.info(`[hotSectorAnalyzer] 开始分析 ${symbol}`)

  const [stockResult, quotesResult, v6ScoreResult] = await Promise.all([
    dataBridge.query<Stock>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.stocks, key: symbol }),
    dataBridge.query<DailyQuotes>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.dailyQuotes, key: symbol }).catch(() => ({ success: false, data: undefined })),
    dataBridge.query<V6Score>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.v6Scores, key: symbol }).catch(() => ({ success: false, data: undefined })),
  ])

  const stock = stockResult.success ? stockResult.data : undefined
  const quotes = quotesResult.success ? quotesResult.data : undefined
  const v6Score = v6ScoreResult.success ? v6ScoreResult.data : undefined

  if (!stock) {
    logger.warn(`[hotSectorAnalyzer] 股票数据缺失: ${symbol}`)
    return null
  }

  const now = Date.now()
  const v6CalculatedAt = v6Score?.calculatedAt ?? now
  const freshness = checkStrategyScoreFreshness(now, v6CalculatedAt, 'hot_sector_score')
  logger.info(`[hotSectorAnalyzer] ${symbol} freshness check`, {
    valid: freshness.valid,
    outputTime: freshness.outputTime,
    inputTime: freshness.inputTime,
  })

  const hasQuotes =
    quotes !== undefined && quotes.history.length >= HOT_SECTOR_THRESHOLDS.KLINE_MIN_DAYS
  const closes = hasQuotes ? quotes.history.map((b) => b.close) : []
  const latest = hasQuotes ? closes[closes.length - 1]! : stock.price ?? HOT_SECTOR_THRESHOLDS.SCORE_MIN
  const ma20 = hasQuotes ? computeMA(closes, HOT_SECTOR_THRESHOLDS.MA20_PERIOD) : undefined
  const ma60 = hasQuotes ? computeMA(closes, HOT_SECTOR_THRESHOLDS.MA60_PERIOD) : undefined
  const rsi = hasQuotes ? computeRSI(closes) : undefined

  const volumes = hasQuotes ? quotes.history.map((b) => b.volume) : []
  const recentAvgVol =
    volumes.length >= HOT_SECTOR_THRESHOLDS.VOLUME_RECENT_DAYS
      ? volumes
          .slice(-HOT_SECTOR_THRESHOLDS.VOLUME_RECENT_DAYS)
          .reduce((a, b) => a + b, 0) / HOT_SECTOR_THRESHOLDS.VOLUME_RECENT_DAYS
      : HOT_SECTOR_THRESHOLDS.SCORE_MIN
  const pastAvgVol =
    volumes.length >= HOT_SECTOR_THRESHOLDS.VOLUME_PAST_TOTAL_DAYS
      ? volumes
          .slice(-HOT_SECTOR_THRESHOLDS.VOLUME_PAST_TOTAL_DAYS, -HOT_SECTOR_THRESHOLDS.VOLUME_RECENT_DAYS)
          .reduce((a, b) => a + b, 0) / HOT_SECTOR_THRESHOLDS.VOLUME_PAST_DAYS
      : HOT_SECTOR_THRESHOLDS.VOLUME_DEFAULT_PAST_AVG
  const volumeExpansion =
    pastAvgVol > HOT_SECTOR_THRESHOLDS.VOLUME_EXPANSION_ZERO_THRESHOLD
      ? recentAvgVol / pastAvgVol
      : HOT_SECTOR_THRESHOLDS.VOLUME_DEFAULT_EXPANSION

  const momentum: MomentumInput = {
    sectorStrengthScore:
      v6Score?.factors?.动量 ?? HOT_SECTOR_THRESHOLDS.DEFAULT_SECTOR_STRENGTH_SCORE,
    priceChangeRank: hasQuotes
      ? Math.max(
          HOT_SECTOR_THRESHOLDS.RANK_MIN,
          HOT_SECTOR_THRESHOLDS.SECTOR_RANK_BASE - (closes.length % HOT_SECTOR_THRESHOLDS.SECTOR_RANK_BASE),
        )
      : HOT_SECTOR_THRESHOLDS.DEFAULT_PRICE_CHANGE_RANK,
    volumeExpansion,
    consecutiveInflow: HOT_SECTOR_THRESHOLDS.SCORE_MIN, // 需外部资金流数据填充
    relativeStrength: rsi ?? HOT_SECTOR_THRESHOLDS.RSI_DEFAULT,
  }

  const sentiment: SentimentInput = {
    sentimentRank: Math.max(
      HOT_SECTOR_THRESHOLDS.RANK_MIN,
      HOT_SECTOR_THRESHOLDS.SECTOR_RANK_BASE -
        Math.floor((v6Score?.score ?? HOT_SECTOR_THRESHOLDS.DEFAULT_V6_SCORE) * HOT_SECTOR_THRESHOLDS.SECTOR_RANK_MULTIPLIER),
    ),
    retailSentiment: HOT_SECTOR_THRESHOLDS.DEFAULT_RETAIL_SENTIMENT, // 默认中性
    institutionBuyCount: HOT_SECTOR_THRESHOLDS.SCORE_MIN, // 需外部龙虎榜数据填充
    limitUpCount: HOT_SECTOR_THRESHOLDS.SCORE_MIN, // 需外部涨停数据填充
  }

  const breakout: BreakoutInput = {
    hasBreakoutPattern: ma20 !== undefined && latest > ma20,
    rsiSignal:
      (rsi ?? HOT_SECTOR_THRESHOLDS.RSI_DEFAULT) > HOT_SECTOR_THRESHOLDS.RSI_SIGNAL_BULLISH_THRESHOLD
        ? 'bullish'
        : (rsi ?? HOT_SECTOR_THRESHOLDS.RSI_DEFAULT) < HOT_SECTOR_THRESHOLDS.RSI_SIGNAL_BEARISH_THRESHOLD
          ? 'bearish'
          : 'neutral',
    rsi: rsi ?? HOT_SECTOR_THRESHOLDS.RSI_DEFAULT,
    priceAboveMA20: ma20 !== undefined && latest > ma20,
    priceAboveMA60: ma60 !== undefined && latest > ma60,
  }

  const valuationRisk: ValuationRiskInput = {
    pe: stock.pe ?? HOT_SECTOR_THRESHOLDS.SCORE_MIN,
    pbPercentile:
      stock.pb !== undefined
        ? Math.min(
            HOT_SECTOR_THRESHOLDS.PB_PERCENTILE_MAX,
            Math.max(
              HOT_SECTOR_THRESHOLDS.PB_PERCENTILE_MIN,
              (stock.pb / HOT_SECTOR_THRESHOLDS.PB_PERCENTILE_REFERENCE) * HOT_SECTOR_THRESHOLDS.PB_PERCENTILE_MAX,
            ),
          )
        : HOT_SECTOR_THRESHOLDS.DEFAULT_PB_PERCENTILE,
    marketCap:
      (stock.marketCap ?? HOT_SECTOR_THRESHOLDS.SCORE_MIN) / HOT_SECTOR_THRESHOLDS.MARKET_CAP_YUAN_TO_BILLION, // 转为亿元
    dividendYield: HOT_SECTOR_THRESHOLDS.SCORE_MIN, // 需外部数据填充
  }

  const marketEnv: MarketEnvInput = {
    marketTrend: HOT_SECTOR_THRESHOLDS.DEFAULT_MARKET_TREND,
    systemicRisk: HOT_SECTOR_THRESHOLDS.DEFAULT_SYSTEMIC_RISK,
  }

  return analyze({
    symbol,
    sectorName:
      stock.sector ?? stock.industryCode ?? HOT_SECTOR_THRESHOLDS.DEFAULT_SECTOR_NAME,
    momentum,
    sentiment,
    breakout,
    valuationRisk,
    marketEnv,
  })
}

/**
 * 批量分析多只股票。
 */
export async function analyzeBatch(symbols: string[]): Promise<HotSectorScore[]> {
  const results: HotSectorScore[] = []
  const settled = await Promise.allSettled(symbols.map((symbol) => analyzeBySymbol(symbol)))
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value) {
      results.push(result.value)
    }
  }
  logger.info(`[hotSectorAnalyzer] 批量分析完成: ${results.length}/${symbols.length}`)
  return results
}
