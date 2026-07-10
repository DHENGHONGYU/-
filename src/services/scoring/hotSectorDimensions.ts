/**
 * @fileoverview 热门板块五维评分维度函数
 *
 * 从 hotSectorAnalyzer.ts 拆分而来，职责：
 * - 定义五维评分输入类型（MomentumInput/SentimentInput/BreakoutInput/ValuationRiskInput/MarketEnvInput）
 * - 实现五维评分函数（calculateMomentum/calculateSentiment/calculateBreakout/calculateValuationRisk/calculateMarketEnv）
 * - 实现 analyze 综合评分函数（加权汇总 → HotSectorScore）
 *
 * 设计原则：纯函数 + 零副作用，所有阈值/权重均从 HOT_SECTOR_THRESHOLDS 注入。
 *
 * @module services/scoring/hotSectorDimensions
 * @created 2026-07-07 - 从 hotSectorAnalyzer.ts 拆分
 */

import { HOT_SECTOR_THRESHOLDS } from '@/config/thresholds'
import type { HotSectorScore } from '@/data/types'

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

  const RANK_TIERS = [
    { threshold: HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP5, score: HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP5_SCORE },
    { threshold: HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP10, score: HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP10_SCORE },
    { threshold: HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP20, score: HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP20_SCORE },
    { threshold: HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP50, score: HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_TOP50_SCORE },
  ]
  const matched = RANK_TIERS.find((t) => data.sentimentRank <= t.threshold)
  let score = matched?.score ?? HOT_SECTOR_THRESHOLDS.SENTIMENT_RANK_OTHER_SCORE

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
  const t = HOT_SECTOR_THRESHOLDS

  const peTiers = [
    { threshold: t.VALUATION_PE_NEGATIVE, score: t.VALUATION_PE_NEGATIVE_SCORE },
    { threshold: t.VALUATION_PE_LOW, score: t.VALUATION_PE_LOW_SCORE },
    { threshold: t.VALUATION_PE_MEDIUM_LOW, score: t.VALUATION_PE_MEDIUM_LOW_SCORE },
    { threshold: t.VALUATION_PE_MEDIUM, score: t.VALUATION_PE_MEDIUM_SCORE },
    { threshold: t.VALUATION_PE_HIGH, score: t.VALUATION_PE_HIGH_SCORE },
    { threshold: t.VALUATION_PE_VERY_HIGH, score: t.VALUATION_PE_VERY_HIGH_SCORE },
  ]
  let score = peTiers.find((tier) => data.pe <= tier.threshold)?.score ?? t.VALUATION_PE_EXTREME_SCORE

  // PB 分位
  if (data.pbPercentile < t.VALUATION_PB_PERCENTILE_LOW) {
    score += t.VALUATION_PB_LOW_BONUS
  } else if (data.pbPercentile > t.VALUATION_PB_PERCENTILE_HIGH) {
    score -= t.VALUATION_PB_HIGH_PENALTY
  }

  // 市值流动性
  if (data.marketCap > t.VALUATION_MARKET_CAP_LARGE) {
    score += t.VALUATION_MARKET_CAP_LARGE_BONUS
  } else if (data.marketCap < t.VALUATION_MARKET_CAP_SMALL) {
    score -= t.VALUATION_MARKET_CAP_SMALL_PENALTY
  }

  // 股息率
  if (data.dividendYield > t.VALUATION_DIVIDEND_YIELD_HIGH) {
    score += t.VALUATION_DIVIDEND_YIELD_HIGH_BONUS
  } else if (data.dividendYield > t.VALUATION_DIVIDEND_YIELD_MEDIUM) {
    score += t.VALUATION_DIVIDEND_YIELD_MEDIUM_BONUS
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
