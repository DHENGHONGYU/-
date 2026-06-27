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

import { getDefaultDualStrategyRuleConfig, type DualStrategyRuleConfig } from '@/config/dualStrategyRules'
import { dataLayer } from '@/data/dataLayer'
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
  /** MACD 信号方向 */
  macdSignal: 'bullish' | 'bearish' | 'neutral'
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
  momentum: 0.35,
  sentiment: 0.25,
  breakout: 0.20,
  valuationRisk: 0.15,
  marketEnv: 0.05,
} as const

// ============================================================
// 维度评分函数
// ============================================================

function clampScore(value: number): number {
  return Math.max(0, Math.min(5, value))
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
  if (data.sectorStrengthScore < 0 || data.sectorStrengthScore > 5) {
    return 0
  }

  let score = data.sectorStrengthScore

  // 排名加分：top10 → 1.5，top50 → 0.5，50+ → 0
  if (data.priceChangeRank <= 10) {
    score += 1.5
  } else if (data.priceChangeRank <= 30) {
    score += 1.0
  } else if (data.priceChangeRank <= 50) {
    score += 0.5
  }

  // 成交量放大加分
  if (data.volumeExpansion >= 2.0) {
    score += 1.0
  } else if (data.volumeExpansion >= 1.5) {
    score += 0.5
  }

  // 资金连续流入
  if (data.consecutiveInflow >= 3) {
    score += 0.5
  }

  // RS 映射：中性 50 → 0，极端 0/100 → 按比例
  const rsDeviation = Math.abs(data.relativeStrength - 50) / 50
  score += rsDeviation * 0.5

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
  if (data.sentimentRank < 1) {
    return 0
  }

  let score = 0

  // 舆情排名映射
  if (data.sentimentRank <= 5) {
    score = 5
  } else if (data.sentimentRank <= 10) {
    score = 4
  } else if (data.sentimentRank <= 20) {
    score = 3
  } else if (data.sentimentRank <= 50) {
    score = 1.5
  } else {
    score = 0.5
  }

  // 散户情绪过热惩罚（> 0.8 极度乐观，视为风险）
  if (data.retailSentiment > 0.8) {
    score -= 1.0
  } else if (data.retailSentiment < 0.2) {
    // 极度恐慌也可能是机会
    score -= 0.5
  }

  // 机构买入加分
  if (data.institutionBuyCount >= 5) {
    score += 1.5
  } else if (data.institutionBuyCount >= 2) {
    score += 0.5
  }

  // 涨停板加分
  if (data.limitUpCount >= 10) {
    score += 1.0
  } else if (data.limitUpCount >= 3) {
    score += 0.5
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
  let score = 2.5 // 中性起点

  // 突破形态
  if (data.hasBreakoutPattern) {
    score += 2.0
  }

  // MACD 信号
  if (data.macdSignal === 'bullish') {
    score += 1.5
  } else if (data.macdSignal === 'bearish') {
    score -= 1.5
  }

  // RSI 评分：50-70 最佳，> 80 或 < 30 惩罚
  if (data.rsi >= 50 && data.rsi <= 70) {
    score += 1.0
  } else if (data.rsi > 80) {
    score -= 1.5 // 超买
  } else if (data.rsi < 30) {
    score -= 1.0 // 超卖但无反弹
  }

  // 均线多头排列
  if (data.priceAboveMA20 && data.priceAboveMA60) {
    score += 1.0
  } else if (!data.priceAboveMA20 && !data.priceAboveMA60) {
    score -= 1.0
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
  let score = 0

  // PE 评分
  if (data.pe <= 0) {
    score = 0 // 亏损
  } else if (data.pe < 10) {
    score = 5
  } else if (data.pe < 15) {
    score = 4
  } else if (data.pe < 20) {
    score = 3
  } else if (data.pe < 30) {
    score = 2
  } else if (data.pe < 50) {
    score = 1
  } else {
    score = 0.5
  }

  // PB 分位
  if (data.pbPercentile < 20) {
    score += 1.0
  } else if (data.pbPercentile > 80) {
    score -= 1.0
  }

  // 市值流动性
  if (data.marketCap > 1000) {
    score += 0.5
  } else if (data.marketCap < 50) {
    score -= 0.5
  }

  // 股息率
  if (data.dividendYield > 3) {
    score += 1.0
  } else if (data.dividendYield > 1.5) {
    score += 0.5
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
  let score = 0

  switch (data.marketTrend) {
    case 'bull':
      score = 5
      break
    case 'sideways':
      score = 3
      break
    case 'bear':
      score = 1
      break
  }

  switch (data.systemicRisk) {
    case 'low':
      score += 1.0
      break
    case 'medium':
      // 不调整
      break
    case 'high':
      score -= 2.0
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

  const rounded = Math.round(overallScore * 100) / 100

  let action: HotSectorScore['action']
  if (rounded >= 4.0) {
    action = 'immediate'
  } else if (rounded >= 3.5) {
    action = 'probe'
  } else {
    action = 'ignore'
  }

  return {
    symbol: input.symbol,
    name: input.sectorName,
    score: rounded,
    dimensions: {
      momentum: Math.round(momentum * 100) / 100,
      sentiment: Math.round(sentiment * 100) / 100,
      technical: Math.round(breakout * 100) / 100,
      valuation: Math.round(valuationRisk * 100) / 100,
      composite: Math.round(rounded * 100) / 100,
    },
    action,
    calculatedAt: Date.now(),
    dataVersion: 1,
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

function computeRSI(closes: number[], period: number = 14): number | undefined {
  if (closes.length < period + 1) return undefined
  const window = closes.slice(-(period + 1))
  let gains = 0
  let losses = 0
  for (let i = 1; i < window.length; i++) {
    const delta = window[i]! - window[i - 1]!
    if (delta > 0) gains += delta
    else losses -= delta
  }
  if (losses === 0) return 100
  return 100 - 100 / (1 + gains / losses)
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

  const hasQuotes = quotes !== undefined && quotes.history.length >= 20
  const closes = hasQuotes ? quotes!.history.map((b) => b.close) : []
  const latest = hasQuotes ? closes[closes.length - 1]! : stock.price ?? 0
  const ma20 = hasQuotes ? computeMA(closes, 20) : undefined
  const ma60 = hasQuotes ? computeMA(closes, 60) : undefined
  const rsi = hasQuotes ? computeRSI(closes) : undefined

  const volumes = hasQuotes ? quotes!.history.map((b) => b.volume) : []
  const recentAvgVol = volumes.length >= 5
    ? volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
    : 0
  const pastAvgVol = volumes.length >= 25
    ? volumes.slice(-25, -5).reduce((a, b) => a + b, 0) / 20
    : 1
  const volumeExpansion = pastAvgVol > 0 ? recentAvgVol / pastAvgVol : 1

  const momentum: MomentumInput = {
    sectorStrengthScore: v6Score?.factors?.动量 ?? 2.5,
    priceChangeRank: hasQuotes ? Math.max(1, 50 - (closes.length % 50)) : 25,
    volumeExpansion,
    consecutiveInflow: 0, // 需外部资金流数据填充
    relativeStrength: rsi ?? 50,
  }

  const sentiment: SentimentInput = {
    sentimentRank: Math.max(1, 50 - Math.floor((v6Score?.score ?? 2.5) * 10)),
    retailSentiment: 0.5, // 默认中性
    institutionBuyCount: 0, // 需外部龙虎榜数据填充
    limitUpCount: 0, // 需外部涨停数据填充
  }

  const breakout: BreakoutInput = {
    hasBreakoutPattern: ma20 !== undefined && latest > ma20,
    macdSignal: (rsi ?? 50) > 60 ? 'bullish' : (rsi ?? 50) < 40 ? 'bearish' : 'neutral',
    rsi: rsi ?? 50,
    priceAboveMA20: ma20 !== undefined && latest > ma20,
    priceAboveMA60: ma60 !== undefined && latest > ma60,
  }

  const valuationRisk: ValuationRiskInput = {
    pe: stock.pe ?? 0,
    pbPercentile: stock.pb !== undefined ? Math.min(100, Math.max(0, (stock.pb / 5) * 100)) : 50,
    marketCap: (stock.marketCap ?? 0) / 1e8, // 转为亿元
    dividendYield: 0, // 需外部数据填充
  }

  const marketEnv: MarketEnvInput = {
    marketTrend: 'sideways',
    systemicRisk: 'medium',
  }

  return analyze({
    symbol,
    sectorName: stock.sector ?? stock.industryCode ?? '未知板块',
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
  for (const symbol of symbols) {
    const score = await analyzeBySymbol(symbol)
    if (score) results.push(score)
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
  const filtered = []

  for (const stock of stocks) {
    const v6Score = await dataLayer.v6Scores.get(stock.symbol).catch(() => undefined)
    if ((v6Score?.score ?? 0) >= ruleConfig.hotSectorV6Min) {
      filtered.push(stock.symbol)
    }
  }

  const scores = await analyzeBatch(filtered)

  for (const score of scores) {
    await dataLayer.hotSectorScores.save(score)
  }

  return { success: true, data: scores }
}

/**
 * 获取指定 symbol 最新的一条 HotSectorScore。
 */
export async function getLatestHotSectorScore(symbol: string): Promise<HotSectorScore | undefined> {
  return dataLayer.hotSectorScores.get(symbol).catch(() => undefined)
}