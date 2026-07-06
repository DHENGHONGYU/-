/**
 * HotSectorAnalyzer — 热门板块五维评分引擎
 *
 * 基于双策略体系，对热门板块标的进行五维评分：
 * - 动量强度 (momentum):        35%
 * - 情绪热度 (sentiment):       25%
 * - 技术突破 (breakout):         20%
 * - 估值风险 (valuationRisk):    15%
 * - 大盘环境 (marketEnv):        5%
 *
 * 输出：HotSectorScore { overallScore: 0-5, signal: 'buy'|'hold'|'avoid' }
 *
 * @module services/scoring/hotSectorAnalyzer
 * @created 2026-06-27 - 基于双策略体系修正
 */

import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import { getDefaultDualStrategyRuleConfig, type DualStrategyRuleConfig } from '@/config/dualStrategyRules'
import { HOT_SECTOR_THRESHOLDS } from '@/config/thresholds'
import { EnvelopeFactory } from '@/core/envelope'
import { dataLayer } from '@/data/dataLayer'
import { checkStrategyScoreFreshness } from '@/core/freshnessGuard'
import type { DataLayerResult, HotSectorScore, Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 输入类型
// ============================================================

export interface MomentumInput {
  /** 板块强度评分 0-5 */
  sectorStrengthScore: number
  /** 涨跌幅排名（1=最高） */
  priceChangeRank: number
  /** 成交量放大倍数（近5日/近20日） */
  volumeExpansion: number
  /** 资金连续流入天数 */
  consecutiveInflow: number
  /** 相对强弱 RS 值 */
  relativeStrength: number
}

export interface SentimentInput {
  /** 舆情热度排名（1=最高） */
  sentimentRank: number
  /** 散户情绪 0-1（1=极度乐观） */
  retailSentiment: number
  /** 龙虎榜机构买入家数 */
  institutionBuyCount: number
  /** 涨停板数量 */
  limitUpCount: number
}

export interface BreakoutInput {
  /** 是否有突破形态 */
  hasBreakoutPattern: boolean
  /** RSI 信号方向（多头/空头/中性，基于 RSI 阈值推导） */
  rsiSignal: 'bullish' | 'bearish' | 'neutral'
  /** RSI(14) 值 */
  rsi: number
  /** 价格是否站上 MA20 */
  priceAboveMA20: boolean
  /** 价格是否站上 MA60 */
  priceAboveMA60: boolean
}

export interface ValuationRiskInput {
  /** 当前 PE */
  pe: number
  /** PB 历史分位 0-100 */
  pbPercentile: number
  /** 市值（亿元） */
  marketCap: number
  /** 股息率 % */
  dividendYield: number
}

export interface MarketEnvInput {
  /** 大盘趋势 */
  marketTrend: 'bull' | 'bear' | 'sideways'
  /** 系统性风险等级 */
  systemicRisk: 'low' | 'medium' | 'high'
}

/** 各维度计算所需的聚合输入 */
export interface HotSectorAnalyzerInput {
  symbol: string
  sectorName: string
  momentum: MomentumInput
  sentiment: SentimentInput
  breakout: BreakoutInput
  valuationRisk: ValuationRiskInput
  marketEnv: MarketEnvInput
}

// ============================================================
// 输出类型复用 data/types.ts 中的 HotSectorScore
// 维度映射：breakout → technical，valuationRisk → valuation，composite 为加权综合分
// ============================================================

export type { HotSectorScore }

// ============================================================
// 权重常量
// ============================================================

const WEIGHTS = {
  momentum: HOT_SECTOR_THRESHOLDS.WEIGHT_MOMENTUM,
  sentiment: HOT_SECTOR_THRESHOLDS.WEIGHT_SENTIMENT,
  breakout: HOT_SECTOR_THRESHOLDS.WEIGHT_BREAKOUT,
  valuationRisk: HOT_SECTOR_THRESHOLDS.WEIGHT_VALUATION_RISK,
  marketEnv: HOT_SECTOR_THRESHOLDS.WEIGHT_MARKET_ENV,
} as const

// ============================================================
// 维度评分函数
// ============================================================

function clampScore(value: number): number {
  return Math.max(
    HOT_SECTOR_THRESHOLDS.SCORE_MIN,
    Math.min(HOT_SECTOR_THRESHOLDS.SCORE_MAX, value),
  )
}

/**
 * 动量强度评分（权重 35%）
 *
 * 评分逻辑：
 * - 板块强度分直接映射到 0-5
 * - 排名越靠前加分越多（top10 → +1.5, top50 → 0）
 * - 量比 > 2.0 → +1, 1.0-2.0 → +0.5
 * - 资金连续流入 3 天以上 → +0.5
 * - RS 值偏离中位数映射
 */
export function calculateMomentum(data: MomentumInput): number {
  if (
    data.sectorStrengthScore < HOT_SECTOR_THRESHOLDS.SCORE_MIN ||
    data.sectorStrengthScore > HOT_SECTOR_THRESHOLDS.SCORE_MAX
  ) {
    return HOT_SECTOR_THRESHOLDS.SCORE_MIN
  }

  let score = data.sectorStrengthScore

  // 排名加分
  if (data.priceChangeRank <= HOT_SECTOR_THRESHOLDS.MOMENTUM_RANK_TOP10) {
    score += HOT_SECTOR_THRESHOLDS.MOMENTUM_RANK_TOP10_BONUS
  } else if (data.priceChangeRank <= HOT_SECTOR_THRESHOLDS.MOMENTUM_RANK_TOP30) {
    score += HOT_SECTOR_THRESHOLDS.MOMENTUM_RANK_TOP30_BONUS
  } else if (data.priceChangeRank <= HOT_SECTOR_THRESHOLDS.MOMENTUM_RANK_TOP50) {
    score += HOT_SECTOR_THRESHOLDS.MOMENTUM_RANK_TOP50_BONUS
  }

  // 成交量放大加分
  if (data.volumeExpansion >= HOT_SECTOR_THRESHOLDS.MOMENTUM_VOLUME_EXPANSION_HIGH) {
    score += HOT_SECTOR_THRESHOLDS.MOMENTUM_VOLUME_EXPANSION_HIGH_BONUS
  } else if (data.volumeExpansion >= HOT_SECTOR_THRESHOLDS.MOMENTUM_VOLUME_EXPANSION_MEDIUM) {
    score += HOT_SECTOR_THRESHOLDS.MOMENTUM_VOLUME_EXPANSION_MEDIUM_BONUS
  }

  // 资金连续流入
  if (data.consecutiveInflow >= HOT_SECTOR_THRESHOLDS.MOMENTUM_CONSECUTIVE_INFLOW_DAYS) {
    score += HOT_SECTOR_THRESHOLDS.MOMENTUM_CONSECUTIVE_INFLOW_BONUS
  }

  // RS 映射：中性基准 → 0，极端 0/100 → 按比例
  const rsDeviation =
    Math.abs(data.relativeStrength - HOT_SECTOR_THRESHOLDS.MOMENTUM_RS_BASE) /
    HOT_SECTOR_THRESHOLDS.MOMENTUM_RS_BASE
  score += rsDeviation * HOT_SECTOR_THRESHOLDS.MOMENTUM_RS_DEVIATION_MULTIPLIER

  return clampScore(score)
}

/**
 * 情绪热度评分（权重 25%）
 *
 * 评分逻辑：
 * - 舆情排名 top5 → 5，top20 → 3，top50 → 1.5
 * - 散户情绪极度乐观/悲观 → 低分（过热/恐慌），中性 → 高分
 * - 机构买入家数 ≥ 5 → +1.5，≥ 2 → +0.5
 * - 涨停板数量 ≥ 10 → +1，≥ 3 → +0.5
 */
export function calculateSentiment(data: SentimentInput): number {
  if (data.sentimentRank < HOT_SECTOR_THRESHOLDS.RANK_MIN) {
    return HOT_SECTOR_THRESHOLDS.SCORE_MIN
  }

  let score = HOT_SECTOR_THRESHOLDS.SCORE_MIN

  // 舆情排名映射
  if (data.sentimentRank <= HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP5) {
    score = HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP5_SCORE
  } else if (data.sentimentRank <= HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP10) {
    score = HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP10_SCORE
  } else if (data.sentimentRank <= HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP20) {
    score = HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP20_SCORE
  } else if (data.sentimentRank <= HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP50) {
    score = HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP50_SCORE
  } else {
    score = HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_OTHER_SCORE
  }

  // 散户情绪过热惩罚（极度乐观，视为风险）
  if (data.retailSentiment > HOT_SECTOR_THRESHOLDS.SENTIMENT_RETAIL_OVERHEATED) {
    score -= HOT_SECTOR_THRESHOLDS.SENTIMENT_RETAIL_OVERHEATED_PENALTY
  } else if (data.retailSentiment < HOT_SECTOR_THRESHOLDS.SENTIMENT_RETAIL_PANIC) {
    // 极度恐慌也可能是机会
    score -= HOT_SECTOR_THRESHOLDS.SENTIMENT_RETAIL_PANIC_PENALTY
  }

  // 机构买入加分
  if (data.institutionBuyCount >= HOT_SECTOR_THRESHOLDS.SENTIMENT_INSTITUTION_BUY_HIGH) {
    score += HOT_SECTOR_THRESHOLDS.SENTIMENT_INSTITUTION_BUY_HIGH_BONUS
  } else if (data.institutionBuyCount >= HOT_SECTOR_THRESHOLDS.SENTIMENT_INSTITUTION_BUY_MEDIUM) {
    score += HOT_SECTOR_THRESHOLDS.SENTIMENT_INSTITUTION_BUY_MEDIUM_BONUS
  }

  // 涨停板加分
  if (data.limitUpCount >= HOT_SECTOR_THRESHOLDS.SENTIMENT_LIMIT_UP_HIGH) {
    score += HOT_SECTOR_THRESHOLDS.SENTIMENT_LIMIT_UP_HIGH_BONUS
  } else if (data.limitUpCount >= HOT_SECTOR_THRESHOLDS.SENTIMENT_LIMIT_UP_MEDIUM) {
    score += HOT_SECTOR_THRESHOLDS.SENTIMENT_LIMIT_UP_MEDIUM_BONUS
  }

  return clampScore(score)
}

/**
 * 技术突破评分（权重 20%）
 *
 * 评分逻辑：
 * - 突破形态 → +2
 * - MACD 金叉 → +1.5，死叉 → -1
 * - RSI 50-70 为最佳区间，极端值惩罚
 * - 均线多头排列（价格 > MA20 > MA60）→ +1
 */
export function calculateBreakout(data: BreakoutInput): number {
  let score = HOT_SECTOR_THRESHOLDS.BREAKOUT_NEUTRAL_BASE

  // 突破形态
  if (data.hasBreakoutPattern) {
    score += HOT_SECTOR_THRESHOLDS.BREAKOUT_PATTERN_BONUS
  }

  // RSI 信号方向
  if (data.rsiSignal === 'bullish') {
    score += HOT_SECTOR_THRESHOLDS.BREAKOUT_RSI_SIGNAL_BULLISH_BONUS
  } else if (data.rsiSignal === 'bearish') {
    score -= HOT_SECTOR_THRESHOLDS.BREAKOUT_RSI_SIGNAL_BEARISH_PENALTY
  }

  // RSI 评分：最佳区间，极端值惩罚
  if (
    data.rsi >= HOT_SECTOR_THRESHOLDS.BREAKOUT_RSI_OPTIMAL_LOW &&
    data.rsi <= HOT_SECTOR_THRESHOLDS.BREAKOUT_RSI_OPTIMAL_HIGH
  ) {
    score += HOT_SECTOR_THRESHOLDS.BREAKOUT_RSI_OPTIMAL_BONUS
  } else if (data.rsi > HOT_SECTOR_THRESHOLDS.BREAKOUT_RSI_OVERBOUGHT) {
    score -= HOT_SECTOR_THRESHOLDS.BREAKOUT_RSI_OVERBOUGHT_PENALTY // 超买
  } else if (data.rsi < HOT_SECTOR_THRESHOLDS.BREAKOUT_RSI_OVERSOLD) {
    score -= HOT_SECTOR_THRESHOLDS.BREAKOUT_RSI_OVERSOLD_PENALTY // 超卖但无反弹
  }

  // 均线多头排列
  if (data.priceAboveMA20 && data.priceAboveMA60) {
    score += HOT_SECTOR_THRESHOLDS.BREAKOUT_MA_ALIGNMENT_BONUS
  } else if (!data.priceAboveMA20 && !data.priceAboveMA60) {
    score -= HOT_SECTOR_THRESHOLDS.BREAKOUT_MA_MISALIGNMENT_PENALTY
  }

  return clampScore(score)
}

/**
 * 估值风险评分（权重 15%）
 *
 * 评分逻辑：
 * - PE < 10 → 5，10-20 → 4-3，20-50 → 3-2，> 50 → 1-0
 * - PB 分位越低越好：< 20% → +1，> 80% → -1
 * - 市值越大流动性越好 → 加分
 * - 股息率 > 3% → +1，> 1.5% → +0.5
 */
export function calculateValuationRisk(data: ValuationRiskInput): number {
  let score = HOT_SECTOR_THRESHOLDS.SCORE_MIN

  // PE 评分
  if (data.pe <= HOT_SECTOR_THRESHOLDS.VALUATION_PE_NEGATIVE) {
    score = HOT_SECTOR_THRESHOLDS.VALUATION_PE_NEGATIVE_SCORE // 亏损
  } else if (data.pe < HOT_SECTOR_THRESHOLDS.VALUATION_PE_LOW) {
    score = HOT_SECTOR_THRESHOLDS.VALUATION_PE_LOW_SCORE
  } else if (data.pe < HOT_SECTOR_THRESHOLDS.VALUATION_PE_MEDIUM_LOW) {
    score = HOT_SECTOR_THRESHOLDS.VALUATION_PE_MEDIUM_LOW_SCORE
  } else if (data.pe < HOT_SECTOR_THRESHOLDS.VALUATION_PE_MEDIUM) {
    score = HOT_SECTOR_THRESHOLDS.VALUATION_PE_MEDIUM_SCORE
  } else if (data.pe < HOT_SECTOR_THRESHOLDS.VALUATION_PE_HIGH) {
    score = HOT_SECTOR_THRESHOLDS.VALUATION_PE_HIGH_SCORE
  } else if (data.pe < HOT_SECTOR_THRESHOLDS.VALUATION_PE_VERY_HIGH) {
    score = HOT_SECTOR_THRESHOLDS.VALUATION_PE_VERY_HIGH_SCORE
  } else {
    score = HOT_SECTOR_THRESHOLDS.VALUATION_PE_EXTREME_SCORE
  }

  // PB 分位
  if (data.pbPercentile < HOT_SECTOR_THRESHOLDS.VALUATION_PB_PERCENTILE_LOW) {
    score += HOT_SECTOR_THRESHOLDS.VALUATION_PB_LOW_BONUS
  } else if (data.pbPercentile > HOT_SECTOR_THRESHOLDS.VALUATION_PB_PERCENTILE_HIGH) {
    score -= HOT_SECTOR_THRESHOLDS.VALUATION_PB_HIGH_PENALTY
  }

  // 市值流动性
  if (data.marketCap > HOT_SECTOR_THRESHOLDS.VALUATION_MARKET_CAP_LARGE) {
    score += HOT_SECTOR_THRESHOLDS.VALUATION_MARKET_CAP_LARGE_BONUS
  } else if (data.marketCap < HOT_SECTOR_THRESHOLDS.VALUATION_MARKET_CAP_SMALL) {
    score -= HOT_SECTOR_THRESHOLDS.VALUATION_MARKET_CAP_SMALL_PENALTY
  }

  // 股息率
  if (data.dividendYield > HOT_SECTOR_THRESHOLDS.VALUATION_DIVIDEND_YIELD_HIGH) {
    score += HOT_SECTOR_THRESHOLDS.VALUATION_DIVIDEND_YIELD_HIGH_BONUS
  } else if (data.dividendYield > HOT_SECTOR_THRESHOLDS.VALUATION_DIVIDEND_YIELD_MEDIUM) {
    score += HOT_SECTOR_THRESHOLDS.VALUATION_DIVIDEND_YIELD_MEDIUM_BONUS
  }

  return clampScore(score)
}

/**
 * 大盘环境评分（权重 5%）
 *
 * 评分逻辑：
 * - 牛市 → 5，震荡 → 3，熊市 → 1
 * - 系统性风险低 → +1，高 → -2
 */
export function calculateMarketEnv(data: MarketEnvInput): number {
  let score = HOT_SECTOR_THRESHOLDS.SCORE_MIN

  switch (data.marketTrend) {
    case 'bull':
      score = HOT_SECTOR_THRESHOLDS.MARKET_ENV_BULL_SCORE
      break
    case 'sideways':
      score = HOT_SECTOR_THRESHOLDS.MARKET_ENV_SIDEWAYS_SCORE
      break
    case 'bear':
      score = HOT_SECTOR_THRESHOLDS.MARKET_ENV_BEAR_SCORE
      break
  }

  switch (data.systemicRisk) {
    case 'low':
      score += HOT_SECTOR_THRESHOLDS.MARKET_ENV_SYSTEMIC_RISK_LOW_BONUS
      break
    case 'medium':
      // 不调整
      break
    case 'high':
      score -= HOT_SECTOR_THRESHOLDS.MARKET_ENV_SYSTEMIC_RISK_HIGH_PENALTY
      break
  }

  return clampScore(score)
}

// ============================================================
// 综合评分
// ============================================================

/**
 * 执行五维综合评分，输出 HotSectorScore。
 */
export function analyze(input: HotSectorAnalyzerInput): HotSectorScore {
  const momentum = calculateMomentum(input.momentum)
  const sentiment = calculateSentiment(input.sentiment)
  const breakout = calculateBreakout(input.breakout)
  const valuationRisk = calculateValuationRisk(input.valuationRisk)
  const marketEnv = calculateMarketEnv(input.marketEnv)

  const overallScore =
    momentum * WEIGHTS.momentum +
    sentiment * WEIGHTS.sentiment +
    breakout * WEIGHTS.breakout +
    valuationRisk * WEIGHTS.valuationRisk +
    marketEnv * WEIGHTS.marketEnv

  const rounded =
    Math.round(overallScore * HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION) /
    HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION

  let action: HotSectorScore['action']
  if (rounded >= HOT_SECTOR_THRESHOLDS.ACTION_IMMEDIATE_THRESHOLD) {
    action = 'immediate'
  } else if (rounded >= HOT_SECTOR_THRESHOLDS.ACTION_PROBE_THRESHOLD) {
    action = 'probe'
  } else {
    action = 'ignore'
  }

  return {
    symbol: input.symbol,
    name: input.sectorName,
    score: rounded,
    dimensions: {
      momentum:
        Math.round(momentum * HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION) /
        HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION,
      sentiment:
        Math.round(sentiment * HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION) /
        HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION,
      technical:
        Math.round(breakout * HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION) /
        HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION,
      valuation:
        Math.round(valuationRisk * HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION) /
        HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION,
      composite: rounded,
      marketEnv:
        Math.round(marketEnv * HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION) /
        HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION,
    },
    action,
    calculatedAt: Date.now(),
    dataVersion: HOT_SECTOR_THRESHOLDS.DATA_VERSION,
  }
}

// ============================================================
// 数据获取与编排
// ============================================================

function computeMA(closes: number[], period: number): number | undefined {
  if (closes.length < period) return undefined
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function computeRSI(
  closes: number[],
  period: number = HOT_SECTOR_THRESHOLDS.RSI_PERIOD,
): number | undefined {
  if (closes.length < period + 1) return undefined
  const window = closes.slice(-(period + 1))
  let gains = 0
  let losses = 0
  for (let i = 1; i < window.length; i++) {
    const delta = window[i]! - window[i - 1]!
    if (delta > 0) gains += delta
    else losses -= delta
  }
  if (losses === HOT_SECTOR_THRESHOLDS.SCORE_MIN)
    return HOT_SECTOR_THRESHOLDS.RSI_MAX
  return (
    HOT_SECTOR_THRESHOLDS.RSI_MAX -
    HOT_SECTOR_THRESHOLDS.RSI_MAX /
      (HOT_SECTOR_THRESHOLDS.RSI_FORMULA_OFFSET + gains / losses)
  )
}

/**
 * 根据 symbol 从 dataLayer 获取数据并执行五维评分。
 * 返回 null 表示数据不足无法评分。
 */
export async function analyzeBySymbol(symbol: string): Promise<HotSectorScore | null> {
  logger.info(`[hotSectorAnalyzer] 开始分析 ${symbol}`)

  const [stock, quotes, v6Score] = await Promise.all([
    dataLayer.stocks.get(symbol),
    dataLayer.dailyQuotes.get(symbol).catch(() => undefined),
    dataLayer.v6Scores.get(symbol).catch(() => undefined),
  ])

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
  const closes = hasQuotes ? quotes!.history.map((b) => b.close) : []
  const latest = hasQuotes ? closes[closes.length - 1]! : stock.price ?? HOT_SECTOR_THRESHOLDS.SCORE_MIN
  const ma20 = hasQuotes ? computeMA(closes, HOT_SECTOR_THRESHOLDS.MA20_PERIOD) : undefined
  const ma60 = hasQuotes ? computeMA(closes, HOT_SECTOR_THRESHOLDS.MA60_PERIOD) : undefined
  const rsi = hasQuotes ? computeRSI(closes) : undefined

  const volumes = hasQuotes ? quotes!.history.map((b) => b.volume) : []
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

export interface HotSectorAnalyzerOptions {
  ruleConfig?: DualStrategyRuleConfig
}

/**
 * 对股票列表执行热门板块策略分析。
 *
 * 过滤逻辑：
 * - 只保留 V6 评分不低于 hotSectorV6Min 的股票
 * - 为每只股票计算 HotSectorScore 并持久化
 */
export async function analyzeHotSectors(
  stocks: Stock[],
  options: HotSectorAnalyzerOptions = {},
): Promise<DataLayerResult<HotSectorScore[]>> {
  const ruleConfig = options.ruleConfig ?? getDefaultDualStrategyRuleConfig()
  const filtered: string[] = []

  const v6Settled = await Promise.allSettled(
    stocks.map((stock) => dataLayer.v6Scores.get(stock.symbol).catch(() => undefined))
  )
  for (let i = 0; i < stocks.length; i++) {
    const result = v6Settled[i]!
    const v6Score = result.status === 'fulfilled' ? result.value : undefined
    if ((v6Score?.score ?? HOT_SECTOR_THRESHOLDS.SCORE_MIN) >= ruleConfig.hotSectorV6Min) {
      filtered.push(stocks[i]!.symbol)
    }
  }

  const scores = await analyzeBatch(filtered)

  // 动态导入 dataBridge 避免循环依赖（databridge.ts 也引用了 hotSectorAnalyzer）
  const { dataBridge } = await import('@/core/databridge')

  for (const score of scores) {
    if (score.dataVersion == null) {
      logger.warn('[hotSectorAnalyzer] 字段缺失，使用默认值', { field: 'dataVersion', context: `symbol=${score.symbol}` })
    }
    const baseVersion = score.dataVersion ?? 0
    score.dataVersion = baseVersion + 1
    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.analyzer,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.saveHotSectorScores,
          traceId: `hs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
        score,
      )
      await dataBridge.forward(envelope)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[hotSectorAnalyzer] DataBridge.forward failed for ${score.symbol}`, { error: message })
    }
  }

  return { success: true, data: scores }
}

/**
 * 获取指定 symbol 最新的一条 HotSectorScore。
 */
export async function getLatestHotSectorScore(symbol: string): Promise<HotSectorScore | undefined> {
  return dataLayer.hotSectorScores.get(symbol).catch(() => undefined)
}