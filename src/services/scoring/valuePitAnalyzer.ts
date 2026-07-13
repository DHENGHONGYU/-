/**
 * ValuePitAnalyzer — 价值洼地五维评分引擎
 *
 * 基于双策略体系，对价值洼地候选标的进行五维评分：
 * - 催化确定性 (catalyst):           30%
 * - 估值安全垫 (valuationMargin):    25%
 * - 筹码结构 (chipStructure):        20%
 * - 轮动位置 (rotationPosition):     15%
 * - 流动性 (liquidity):               10%
 *
 * 输出：ValuePitScore { overallScore: 0-5, status: 'build'|'test'|'wait_signal' }
 *
 * @module services/scoring/valuePitAnalyzer
 * @created 2026-06-27 - 基于双策略体系修正
 */

import { getDefaultDualStrategyRuleConfig, type DualStrategyRuleConfig } from '@/config/dualStrategyRules'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import { sendWriteEnvelope } from '@/data/dataLayerHelpers'
import type { DataLayerResult, Stock, ValuePitScore, V6Score, DailyQuotes } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 输入类型
// ============================================================

export interface CatalystInput {
  /** 政策催化强度 0-5 */
  policyCatalyst: number
  /** 周期拐点信号 0-5 */
  cycleTurningPoint: number
  /** 技术突破信号 0-5 */
  techBreakthrough: number
  /** 订单爆发信号 0-5 */
  orderSurge: number
}

export interface ValuationMarginInput {
  /** PE 历史分位 0-100 */
  pePercentile: number
  /** PB 历史分位 0-100 */
  pbPercentile: number
  /** 股息率 % */
  dividendYield: number
  /** PEG 值 */
  peg: number
}

export interface ChipStructureInput {
  /** 北向资金持股比例变化（近20日） */
  northBoundChange: number
  /** 基金持仓比例变化（近季度） */
  fundPositionChange: number
  /** 股东户数变化率（负值=集中） */
  shareholderChange: number
}

export interface RotationPositionInput {
  /** 板块成交量历史分位 0-100 */
  sectorVolumePercentile: number
  /** 资金流入强度 0-5 */
  capitalInflowStrength: number
  /** 是否出现技术金叉 */
  hasGoldenCross: boolean
}

export interface LiquidityInput {
  /** 日均成交额（万元） */
  avgDailyAmount: number
  /** 换手率 % */
  turnoverRate: number
  /** 市值规模（亿元） */
  marketCap: number
}

/** 各维度计算所需的聚合输入 */
export interface ValuePitAnalyzerInput {
  symbol: string
  sectorName: string
  catalyst: CatalystInput
  valuationMargin: ValuationMarginInput
  chipStructure: ChipStructureInput
  rotationPosition: RotationPositionInput
  liquidity: LiquidityInput
}

// ============================================================
// 输出类型复用 data/types.ts 中的 ValuePitScore
// 维度映射：valuationMargin → valuation，chipStructure → chip，rotationPosition → rotation，composite 为加权综合分
// ============================================================

export type { ValuePitScore }

// ============================================================
// 权重常量
// ============================================================

const WEIGHTS = {
  catalyst: 0.30,
  valuationMargin: 0.25,
  chipStructure: 0.20,
  rotationPosition: 0.15,
  liquidity: 0.10,
} as const

// ============================================================
// 维度评分函数
// ============================================================

function clampScore(value: number): number {
  return Math.max(0, Math.min(5, value))
}

/**
 * 催化确定性评分（权重 30%）
 *
 * 评分逻辑：
 * - 四类催化信号取最大值（最强催化主导）
 * - 每类催化 ≥ 4 → 该项满分
 * - 周期拐点 + 订单爆发双确认 → 额外 +0.5
 */
export function calculateCatalyst(data: CatalystInput): number {
  const signals = [
    data.policyCatalyst,
    data.cycleTurningPoint,
    data.techBreakthrough,
    data.orderSurge,
  ]

  const maxSignal = Math.max(...signals)
  let score = maxSignal

  // 双确认加分：周期拐点 + 订单爆发同时 ≥ 3
  if (data.cycleTurningPoint >= 3 && data.orderSurge >= 3) {
    score += 0.5
  }

  // 政策催化 + 技术突破同时 ≥ 3
  if (data.policyCatalyst >= 3 && data.techBreakthrough >= 3) {
    score += 0.5
  }

  return clampScore(score)
}

/**
 * 估值安全垫评分（权重 25%）
 *
 * 评分逻辑：
 * - PE 分位：< 20% → 5，20-40% → 4，40-60% → 3，60-80% → 2，> 80% → 1
 * - PB 分位：< 20% → 5，> 80% → 1
 * - 股息率：> 4% → +1，> 2% → +0.5
 * - PEG：< 0.5 → +1，0.5-1 → +0.5，> 2 → -1
 */
export function calculateValuationMargin(data: ValuationMarginInput): number {
  const PE_TIERS = [
    { threshold: 20, score: 5 },
    { threshold: 40, score: 4 },
    { threshold: 60, score: 3 },
    { threshold: 80, score: 2 },
  ]
  const peScore = PE_TIERS.find((t) => data.pePercentile < t.threshold)?.score ?? 1

  const pbScore = data.pbPercentile < 20 ? 5
    : data.pbPercentile < 40 ? 4
    : data.pbPercentile < 60 ? 3
    : data.pbPercentile < 80 ? 2
    : 1
  let score = (peScore + pbScore) / 2

  // 股息率加分
  if (data.dividendYield > 4) {
    score += 1.0
  } else if (data.dividendYield > 2) {
    score += 0.5
  }

  // PEG 调整
  if (data.peg > 0 && data.peg < 0.5) {
    score += 1.0
  } else if (data.peg >= 0.5 && data.peg <= 1.0) {
    score += 0.5
  } else if (data.peg > 2.0) {
    score -= 1.0
  }

  return clampScore(score)
}

/**
 * 筹码结构评分（权重 20%）
 *
 * 评分逻辑：
 * - 北向资金增持 > 2% → +2，> 0 → +1
 * - 基金加仓 > 5% → +2，> 0 → +1
 * - 股东户数减少 > 10% → +2（筹码集中），> 5% → +1
 * - 股东户数增加 > 10% → -1（筹码分散）
 */
export function calculateChipStructure(data: ChipStructureInput): number {
  let score = 2.5 // 中性起点

  // 北向资金
  if (data.northBoundChange > 2) {
    score += 2.0
  } else if (data.northBoundChange > 0) {
    score += 1.0
  } else if (data.northBoundChange < -1) {
    score -= 1.0
  }

  // 基金持仓
  if (data.fundPositionChange > 5) {
    score += 2.0
  } else if (data.fundPositionChange > 0) {
    score += 1.0
  } else if (data.fundPositionChange < -3) {
    score -= 1.0
  }

  // 股东户数变化（负值=集中，正值=分散）
  if (data.shareholderChange < -10) {
    score += 2.0
  } else if (data.shareholderChange < -5) {
    score += 1.0
  } else if (data.shareholderChange > 10) {
    score -= 1.0
  }

  return clampScore(score)
}

/**
 * 轮动位置评分（权重 15%）
 *
 * 评分逻辑：
 * - 板块成交量分位 < 20% → 5（底部区域），20-50% → 3，> 80% → 1
 * - 资金流入强度直接映射到 0-5
 * - 技术金叉 → +1.5
 */
export function calculateRotationPosition(data: RotationPositionInput): number {
  const VOLUME_TIERS = [
    { threshold: 20, score: 5 },
    { threshold: 40, score: 4 },
    { threshold: 60, score: 3 },
    { threshold: 80, score: 2 },
  ]
  const score = VOLUME_TIERS.find((t) => data.sectorVolumePercentile < t.threshold)?.score ?? 1

  // 资金流入强度
  let finalScore = (score + data.capitalInflowStrength) / 2

  // 技术金叉加分
  if (data.hasGoldenCross) {
    finalScore += 1.5
  }

  return clampScore(finalScore)
}

/**
 * 流动性评分（权重 10%）
 *
 * 评分逻辑：
 * - 日均成交额 > 5亿 → 5，1-5亿 → 3，< 5000万 → 1
 * - 换手率 1-3% → 最佳（+1），> 10% → 过热（-1）
 * - 市值 > 500亿 → 大盘（+0.5），< 30亿 → 小盘（-0.5）
 */
export function calculateLiquidity(data: LiquidityInput): number {
  // 日均成交额（万元 → 亿元）
  const dailyAmountYi = data.avgDailyAmount / 10000

  const AMOUNT_TIERS = [
    { threshold: 5, score: 5 },
    { threshold: 3, score: 4 },
    { threshold: 1, score: 3 },
    { threshold: 0.5, score: 2 },
  ]
  let score = AMOUNT_TIERS.find((t) => dailyAmountYi > t.threshold)?.score ?? 1

  // 换手率调整
  if (data.turnoverRate >= 1 && data.turnoverRate <= 3) {
    score += 1.0
  } else if (data.turnoverRate > 10) {
    score -= 1.0
  } else if (data.turnoverRate < 0.3) {
    score -= 0.5
  }

  // 市值调整
  if (data.marketCap > 500) {
    score += 0.5
  } else if (data.marketCap < 30) {
    score -= 0.5
  }

  return clampScore(score)
}

// ============================================================
// 综合评分
// ============================================================

/**
 * 按综合评分阈值解析操作建议。
 * 阈值降序匹配，首个满足即返回（等价原 if-else-if 链）。
 */
function resolveAction(score: number): ValuePitScore['action'] {
  if (score >= 4.0) return 'immediate'
  if (score >= 3.5) return 'probe'
  if (score >= 3.0) return 'wait'
  return 'ignore'
}

/**
 * 执行五维综合评分，输出 ValuePitScore。
 */
export function analyze(input: ValuePitAnalyzerInput): ValuePitScore {
  const catalyst = calculateCatalyst(input.catalyst)
  const valuationMargin = calculateValuationMargin(input.valuationMargin)
  const chipStructure = calculateChipStructure(input.chipStructure)
  const rotationPosition = calculateRotationPosition(input.rotationPosition)
  const liquidity = calculateLiquidity(input.liquidity)

  const overallScore =
    catalyst * WEIGHTS.catalyst +
    valuationMargin * WEIGHTS.valuationMargin +
    chipStructure * WEIGHTS.chipStructure +
    rotationPosition * WEIGHTS.rotationPosition +
    liquidity * WEIGHTS.liquidity

  const rounded = Math.round(overallScore * 100) / 100

  const action = resolveAction(rounded)

  return {
    symbol: input.symbol,
    name: input.sectorName,
    score: rounded,
    dimensions: {
      catalyst: Math.round(catalyst * 100) / 100,
      valuation: Math.round(valuationMargin * 100) / 100,
      chip: Math.round(chipStructure * 100) / 100,
      rotation: Math.round(rotationPosition * 100) / 100,
      liquidity: Math.round(liquidity * 100) / 100,
      composite: Math.round(rounded * 100) / 100,
    },
    rotationSignal: false,
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

/**
 * 根据 symbol 通过 DataBridge 获取数据并执行五维评分。
 * 返回 null 表示数据不足无法评分。
 */
export async function analyzeBySymbol(symbol: string): Promise<ValuePitScore | null> {
  logger.info(`[valuePitAnalyzer] 开始分析 ${symbol}`)

  const [stockResult, quotesResult, v6ScoreResult] = await Promise.all([
    dataBridge.query<Stock>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.stocks, key: symbol }),
    dataBridge.query<DailyQuotes>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.dailyQuotes, key: symbol }).catch(() => ({ success: false, data: undefined })),
    dataBridge.query<V6Score>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.v6Scores, key: symbol }).catch(() => ({ success: false, data: undefined })),
  ])

  const stock = stockResult.success ? stockResult.data : undefined
  const quotes = quotesResult.success ? quotesResult.data : undefined
  const v6Score = v6ScoreResult.success ? v6ScoreResult.data : undefined

  if (!stock) {
    logger.warn(`[valuePitAnalyzer] 股票数据缺失: ${symbol}`)
    return null
  }

  const hasQuotes = quotes !== undefined && quotes.history.length >= 20
  const closes = hasQuotes ? quotes.history.map((b) => b.close) : []
  const latest = hasQuotes ? closes[closes.length - 1]! : (stock.price ?? (() => {
    logger.warn('[valuePitAnalyzer] 字段缺失，使用默认值', { field: 'price', context: `symbol=${symbol}` })
    return 0
  })())
  const ma20 = hasQuotes ? computeMA(closes, 20) : undefined
  const ma60 = hasQuotes ? computeMA(closes, 60) : undefined

  const volumes = hasQuotes ? quotes.history.map((b) => b.volume) : []
  const recentVol = volumes.length >= 5
    ? volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
    : 0
  const amounts = hasQuotes ? quotes.history.map((b) => b.amount).filter((a): a is number => a !== undefined) : []
  const avgAmount = amounts.length >= 5
    ? amounts.slice(-5).reduce((a, b) => a + b, 0) / 5
    : 0

  const v6Factors = v6Score?.factors

  const catalyst: CatalystInput = {
    policyCatalyst: v6Factors?.行业 ?? 2.5,
    cycleTurningPoint: v6Factors?.成长 ?? 2.5,
    techBreakthrough: v6Factors?.质量 ?? 2.5,
    orderSurge: v6Factors?.动量 ?? 2.5,
  }

  const valuationMargin: ValuationMarginInput = {
    pePercentile: stock.pe !== undefined && stock.pe > 0
      ? Math.min(100, Math.max(0, (stock.pe / 30) * 100))
      : 50,
    pbPercentile: stock.pb !== undefined
      ? Math.min(100, Math.max(0, (stock.pb / 5) * 100))
      : 50,
    dividendYield: v6Factors?.估值 !== undefined ? (5 - v6Factors.估值) * 0.8 : 1.5,
    peg: 1.0,
  }

  const chipStructure: ChipStructureInput = {
    northBoundChange: 0,
    fundPositionChange: 0,
    shareholderChange: 0,
  }

  const rotationPosition: RotationPositionInput = {
    sectorVolumePercentile: recentVol > 0 ? Math.min(100, Math.max(0, 50 - recentVol * 10)) : 50,
    capitalInflowStrength: 2.5,
    hasGoldenCross: ma20 !== undefined && ma60 !== undefined && ma20 > ma60 && latest > ma20,
  }

  const liquidity: LiquidityInput = {
    avgDailyAmount: avgAmount,
    turnoverRate: hasQuotes && stock.marketCap && stock.marketCap > 0
      ? (avgAmount / stock.marketCap) * 100
      : 1.5,
    marketCap: (stock.marketCap ?? (() => {
      logger.warn('[valuePitAnalyzer] 字段缺失，使用默认值', { field: 'marketCap', context: `symbol=${symbol}` })
      return 0
    })()) / 1e8,
  }

  return analyze({
    symbol,
    sectorName: stock.sector ?? stock.industryCode ?? '未知板块',
    catalyst,
    valuationMargin,
    chipStructure,
    rotationPosition,
    liquidity,
  })
}

/**
 * 批量分析多只股票。
 */
export async function analyzeBatch(symbols: string[]): Promise<ValuePitScore[]> {
  const results: ValuePitScore[] = []
  for (const symbol of symbols) {
    const score = await analyzeBySymbol(symbol)
    if (score) results.push(score)
  }
  logger.info(`[valuePitAnalyzer] 批量分析完成: ${results.length}/${symbols.length}`)
  return results
}

export interface ValuePitAnalyzerOptions {
  ruleConfig?: DualStrategyRuleConfig
}

/**
 * 对股票列表执行价值洼地策略分析。
 *
 * 过滤逻辑：
 * - 只保留 V6 评分在 [valuePitV6Min, valuePitV6Max] 区间内的股票
 * - 为每只股票计算 ValuePitScore 并持久化
 */
export async function analyzeValuePits(
  stocks: Stock[],
  options: ValuePitAnalyzerOptions = {},
): Promise<DataLayerResult<ValuePitScore[]>> {
  const ruleConfig = options.ruleConfig ?? getDefaultDualStrategyRuleConfig()
  const filtered = []

  for (const stock of stocks) {
    const v6Result = await dataBridge.query<V6Score>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.v6Scores, key: stock.symbol }).catch(() => ({ success: false, data: undefined }))
    const v6Score = v6Result.success ? v6Result.data : undefined
    const score = v6Score?.score ?? 0
    if (score >= ruleConfig.valuePitV6Min && score <= ruleConfig.valuePitV6Max) {
      filtered.push(stock.symbol)
    }
  }

  const scores = await analyzeBatch(filtered)

  for (const score of scores) {
    await sendWriteEnvelope('saveValuePitScores', score, 'analyzer')
  }

  return { success: true, data: scores }
}

/**
 * 获取指定 symbol 最新的一条 ValuePitScore。
 */
export async function getLatestValuePitScore(symbol: string): Promise<ValuePitScore | undefined> {
  const result = await dataBridge.query<ValuePitScore>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.valuePitScores, key: symbol }).catch(() => ({ success: false, data: undefined }))
  return result.success ? result.data : undefined
}