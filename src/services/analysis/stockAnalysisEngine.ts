/**
 * V6 个股 L0-L8 九层漏斗分析引擎
 *
 * 架构定义 + 接口实现。LLM 调用部分当前使用占位符，后续接入真实 LLM 服务。
 *
 * 九层结构：
 *   L0 宏观(STEEP)  → L1 护城河    → L2 竞品对比
 *   L3 财务健康     → L4 估值       → L5 情景分析
 *   L6 T+0策略      → L7 Hype情绪   → L8 第二曲线+筹码
 *
 * 综合评分 = 各层加权聚合（默认权重可配置，LLM 评分由外部注入）
 */

import { getLogger } from '@/lib/logger'
import { isLlmConfigured, type PartialLlmConfig } from '@/config/llmConfig'
import { chat } from '@/services/llm/llmClient'
import type { LlmMessage } from '@/services/llm/llmTypes'

const logger = getLogger()

// ============================================================
// 默认权重配置
// ============================================================

const V6_LAYER_WEIGHTS = {
  l0: 0.10,
  l1: 0.15,
  l2: 0.10,
  l3: 0.15,
  l4: 0.10,
  l5: 0.10,
  l6: 0.10,
  l7: 0.10,
  l8: 0.10,
} as const

// ============================================================
// 分析引擎阈值常量
// ============================================================

const STOCK_ANALYSIS_THRESHOLDS = {
  MOAT: {
    PATENT_COUNT_THRESHOLD: 10,
    MARKET_SHARE_THRESHOLD: 15,
    WIDE_MOAT_MIN_TYPES: 3,
    NARROW_MOAT_MIN_TYPES: 1,
    BRAND_SCORE_DEFAULT: 60,
    BRAND_SCORE_NO_VALUE: 30,
    PATENT_SCORE_MULTIPLIER: 5,
    MARKET_SHARE_SCORE_MULTIPLIER: 3,
    SWITCH_COST_HIGH_SCORE: 80,
    SWITCH_COST_MEDIUM_SCORE: 50,
    SWITCH_COST_LOW_SCORE: 20,
    NETWORK_EFFECT_STRONG_SCORE: 80,
    NETWORK_EFFECT_MODERATE_SCORE: 50,
    NETWORK_EFFECT_WEAK_SCORE: 20,
    WIDE_DURABILITY_YEARS: 10,
    NARROW_DURABILITY_YEARS: 5,
    NONE_DURABILITY_YEARS: 2,
  },
  COMPETITOR: {
    RANK_PERCENTILE: 0.5,
    RANK_SCORE_MAX: 90,
    RANK_SCORE_PENALTY_MAX: 40,
    TOP_RANK: 3,
  },
  FINANCE: {
    REVENUE_GROWTH_MIN: -10,
    REVENUE_GROWTH_MAX: 50,
    ROE_MIN: 0,
    ROE_MAX: 30,
    DEBT_RATIO_MAX: 80,
    CURRENT_RATIO_MIN: 0.5,
    CURRENT_RATIO_MAX: 3,
    CASH_FLOW_POSITIVE_SCORE: 80,
    CASH_FLOW_NEGATIVE_SCORE: 30,
  },
  VALUATION: {
    PE_SCORE_WEIGHT: 100,
    PEG_UNDERVALUED: 0.8,
    PEG_OVERVALUED: 1.5,
    PEG_UNDERVALUED_SCORE: 90,
    PEG_MID_SCORE: 60,
    PEG_OVERVALUED_SCORE: 30,
    DCF_SCORE_WEIGHT: 100,
    FALLBACK_SCORE: 50,
    MARGIN_SAFETY_UNDERVALUED: 20,
    MARGIN_SAFETY_OVERVALUED: -10,
    DCF_PRICE_LOW_MULTIPLIER: 0.8,
    DCF_PRICE_HIGH_MULTIPLIER: 1.2,
  },
  SCENARIO: {
    BULL_PROBABILITY: 0.3,
    BULL_RETURN: 30,
    BASE_PROBABILITY: 0.5,
    BASE_RETURN: 10,
    BEAR_PROBABILITY: 0.2,
    BEAR_RETURN: -20,
    RETURN_SCORE_BASE: 50,
    RETURN_SCORE_COEFFICIENT: 0.5,
  },
  T0_STRATEGY: {
    VOLATILITY_MIN: 0.5,
    VOLATILITY_MAX: 5,
    VOLUME_MIN: 1000000,
    VOLUME_MAX: 50000000,
    SPREAD_MAX: 0.5,
    SIGNAL_SCORE: 70,
    NO_SIGNAL_SCORE: 40,
    SUITABLE_THRESHOLD: 60,
    STOP_LOSS_MULTIPLIER: 0.97,
    TAKE_PROFIT_MULTIPLIER: 1.03,
  },
  HYPE: {
    SOCIAL_VOLUME_MAX: 10000,
    SEARCH_TREND_MAX: 100,
    ANALYST_BUY_WEIGHT: 30,
    ANALYST_BASE_SCORE: 20,
    TREND_RISING: 60,
    TREND_FALLING: 40,
  },
  SECOND_CURVE: {
    NEW_BIZ_MAX: 50,
    RD_RATIO_MAX: 20,
    CHIP_CONCENTRATION_MAX: 80,
    INST_HOLDING_MAX: 60,
    SHAREHOLDER_DECREASING_SCORE: 80,
    SHAREHOLDER_STABLE_SCORE: 50,
    SHAREHOLDER_INCREASING_SCORE: 20,
    CURVE_HIGH_NEW_BIZ: 30,
    CURVE_HIGH_RD: 10,
    CURVE_MEDIUM_NEW_BIZ: 15,
    CURVE_MEDIUM_RD: 5,
    CHIP_CONCENTRATED: 60,
    CHIP_DISPERSED: 30,
    INST_ACCUMULATING_HOLDING: 40,
    INST_DISTRIBUTING_HOLDING: 15,
  },
  COMMON: {
    RISK_HIGH: 50,
    SCORE_DEFAULT: 40,
  },
} as const

// ============================================================
// 评分评级阈值
// ============================================================

const SCORE_RATING_THRESHOLDS = {
  macro: {
    favorable: 70,
    adverse: 30,
  },
  financialHealth: {
    excellent: 80,
    good: 60,
    poor: 30,
  },
  sentiment: {
    overheated: 85,
    positive: 60,
    negative: 40,
    panic: 20,
  },
  composite: {
    strongBuy: 80,
    buy: 65,
    sell: 40,
    strongSell: 25,
  },
} as const

// ============================================================
// 各层输入/输出类型定义
// ============================================================

/** L0: 宏观 STEEP 分析 */
export interface L0MacroInput {
  /** 股票代码 */
  symbol: string
  /** 所属行业 */
  sector: string
  /** 社会因子 (Social) */
  socialFactors: string[]
  /** 技术因子 (Technological) */
  techFactors: string[]
  /** 经济因子 (Economic) */
  economicFactors: string[]
  /** 环境因子 (Environmental) */
  envFactors: string[]
  /** 政策因子 (Political) */
  politicalFactors: string[]
}

export interface L0MacroOutput {
  /** STEEP 综合评分 0-100 */
  score: number
  /** 各维度分项评分 */
  dimensions: {
    social: number
    technological: number
    economic: number
    environmental: number
    political: number
  }
  /** 评级：favorable | neutral | adverse */
  rating: 'favorable' | 'neutral' | 'adverse'
  /** 分析摘要 */
  summary: string
  /** 关键风险提示 */
  risks: string[]
  /** 权重（默认 0.10） */
  weight: number
}

/** L1: 护城河分析 */
export interface L1MoatInput {
  symbol: string
  /** 行业地位 */
  industryRank: number
  /** 市场份额 */
  marketShare: number
  /** 品牌价值评估 */
  brandValue: string
  /** 专利/技术壁垒 */
  patentCount: number
  /** 转换成本 */
  switchingCost: 'high' | 'medium' | 'low'
  /** 网络效应 */
  networkEffect: 'strong' | 'moderate' | 'weak'
}

export interface L1MoatOutput {
  score: number
  /** 护城河宽度：wide | narrow | none */
  moatWidth: 'wide' | 'narrow' | 'none'
  /** 护城河类型 */
  moatType: string[]
  /** 竞争优势持续时间估计（年） */
  durabilityYears: number
  summary: string
  risks: string[]
  weight: number
}

/** L2: 竞品对比 */
export interface L2CompetitorInput {
  symbol: string
  /** 竞品列表 */
  competitors: Array<{
    symbol: string
    name: string
    marketCap: number
    revenue: number
    growthRate: number
  }>
}

export interface L2CompetitorOutput {
  score: number
  /** 行业排名 */
  rank: number
  /** 总竞品数 */
  totalCompetitors: number
  /** 相对优势 */
  advantages: string[]
  /** 相对劣势 */
  disadvantages: string[]
  summary: string
  weight: number
}

/** L3: 财务健康 */
export interface L3FinanceInput {
  symbol: string
  /** 营收增长率 */
  revenueGrowth: number
  /** 净利润增长率 */
  netProfitGrowth: number
  /** ROE */
  roe: number
  /** 资产负债率 */
  debtRatio: number
  /** 流动比率 */
  currentRatio: number
  /** 自由现金流 */
  freeCashFlow: number
  /** 毛利率 */
  grossMargin: number
  /** 净利率 */
  netMargin: number
}

export interface L3FinanceOutput {
  score: number
  /** 财务健康评级：excellent | good | fair | poor */
  healthRating: 'excellent' | 'good' | 'fair' | 'poor'
  /** 各指标分项 */
  metrics: {
    growth: number
    profitability: number
    solvency: number
    liquidity: number
    cashFlow: number
  }
  summary: string
  risks: string[]
  weight: number
}

/** L4: 估值分析 */
export interface L4ValuationInput {
  symbol: string
  /** 当前 PE */
  pe: number
  /** 行业平均 PE */
  industryPE: number
  /** 历史 PE 分位 (0-100) */
  pePercentile: number
  /** 当前 PB */
  pb: number
  /** 行业平均 PB */
  industryPB: number
  /** PEG */
  peg: number
  /** DCF 估值 */
  dcfValue: number
  /** 当前价格 */
  currentPrice: number
}

export interface L4ValuationOutput {
  score: number
  /** 估值状态：undervalued | fair | overvalued */
  valuationStatus: 'undervalued' | 'fair' | 'overvalued'
  /** 安全边际 */
  marginOfSafety: number
  /** 目标价区间 */
  targetPriceRange: { low: number; high: number }
  /** 估值方法评分 */
  methods: {
    peScore: number
    pbScore: number
    pegScore: number
    dcfScore: number
  }
  summary: string
  weight: number
}

/** L5: 情景分析 */
export interface L5ScenarioInput {
  symbol: string
  /** 基准情景假设 */
  baseCase: string
  /** 乐观情景假设 */
  bullCase: string
  /** 悲观情景假设 */
  bearCase: string
}

export interface L5ScenarioOutput {
  score: number
  scenarios: {
    bull: { probability: number; return: number; narrative: string }
    base: { probability: number; return: number; narrative: string }
    bear: { probability: number; return: number; narrative: string }
  }
  /** 期望收益 */
  expectedReturn: number
  /** 下行风险 */
  downsideRisk: number
  summary: string
  weight: number
}

/** L6: T+0 策略 */
export interface L6T0StrategyInput {
  symbol: string
  /** 日内波动率 */
  intradayVolatility: number
  /** 成交量 */
  volume: number
  /** 买卖盘口价差 */
  spread: number
  /** 技术指标信号 */
  technicalSignals: string[]
}

export interface L6T0StrategyOutput {
  score: number
  /** 是否适合 T+0 */
  suitable: boolean
  /** 建议操作 */
  suggestedAction: 'buy' | 'sell' | 'hold' | 'none'
  /** 止损位 */
  stopLoss: number
  /** 止盈位 */
  takeProfit: number
  /** 仓位建议 */
  positionAdvice: string
  summary: string
  risks: string[]
  weight: number
}

/** L7: Hype 情绪分析 */
export interface L7HypeInput {
  symbol: string
  /** 社交媒体热度 */
  socialVolume: number
  /** 新闻情绪评分 -1 到 1 */
  newsSentiment: number
  /** 搜索趋势 */
  searchTrend: number
  /** 分析师评级分布 */
  analystRatings: { buy: number; hold: number; sell: number }
  /** 舆情关键词 */
  keywords: string[]
}

export interface L7HypeOutput {
  score: number
  /** 情绪状态：overheated | positive | neutral | negative | panic */
  sentiment: 'overheated' | 'positive' | 'neutral' | 'negative' | 'panic'
  /** 是否过热 */
  isOverheated: boolean
  /** 情绪趋势 */
  trend: 'rising' | 'stable' | 'falling'
  summary: string
  risks: string[]
  weight: number
}

/** L8: 第二曲线 + 筹码 */
export interface L8SecondCurveInput {
  symbol: string
  /** 新业务收入占比 */
  newBizRevenueRatio: number
  /** 研发投入占比 */
  rdRatio: number
  /** 筹码集中度 */
  chipConcentration: number
  /** 机构持仓比例 */
  institutionalHolding: number
  /** 股东人数变化趋势 */
  shareholderTrend: 'increasing' | 'stable' | 'decreasing'
  /** 限售股解禁时间表 */
  lockupExpiration: string[]
}

export interface L8SecondCurveOutput {
  score: number
  /** 第二曲线潜力 */
  curvePotential: 'high' | 'medium' | 'low'
  /** 筹码结构 */
  chipStructure: 'concentrated' | 'dispersed' | 'balanced'
  /** 机构态度 */
  institutionalAttitude: 'accumulating' | 'holding' | 'distributing'
  summary: string
  risks: string[]
  weight: number
}

// ============================================================
// 综合评分聚合类型
// ============================================================

/** 九层漏斗完整输出 */
export interface StockAnalysisResult {
  /** 股票代码 */
  symbol: string
  /** 分析时间戳 */
  timestamp: number
  /** 各层分析结果 */
  layers: {
    l0: L0MacroOutput
    l1: L1MoatOutput
    l2: L2CompetitorOutput
    l3: L3FinanceOutput
    l4: L4ValuationOutput
    l5: L5ScenarioOutput
    l6: L6T0StrategyOutput
    l7: L7HypeOutput
    l8: L8SecondCurveOutput
  }
  /** 综合评分 0-100 */
  compositeScore: number
  /** 综合评级 */
  compositeRating: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  /** 各层权重配置 */
  weights: Record<string, number>
  /** 综合建议 */
  recommendation: string
  /** 关键风险汇总 */
  allRisks: string[]
}

/** 九层漏斗分析输入 */
export interface StockAnalysisInput {
  symbol: string
  sector: string
  l0: L0MacroInput
  l1: L1MoatInput
  l2: L2CompetitorInput
  l3: L3FinanceInput
  l4: L4ValuationInput
  l5: L5ScenarioInput
  l6: L6T0StrategyInput
  l7: L7HypeInput
  l8: L8SecondCurveInput
}

// ============================================================
// 默认权重配置
// ============================================================

const DEFAULT_WEIGHTS = V6_LAYER_WEIGHTS

// ============================================================
// 各层分析函数（占位符实现，后续接入 LLM）
// ============================================================

/**
 * L0: 宏观 STEEP 分析
 * @remarks 当前使用简化评分逻辑，后续接入 LLM 进行深度分析
 */
export function analyzeL0Macro(input: L0MacroInput): L0MacroOutput {
  logger.info(`[StockAnalysisEngine] L0 宏观分析: symbol=${input.symbol}`)

  const social = scoreFromFactors(input.socialFactors)
  const technological = scoreFromFactors(input.techFactors)
  const economic = scoreFromFactors(input.economicFactors)
  const environmental = scoreFromFactors(input.envFactors)
  const political = scoreFromFactors(input.politicalFactors)

  const score = Math.round(
    social * 0.15 + technological * 0.25 + economic * 0.30 + environmental * 0.15 + political * 0.15,
  )

  const thresholds = SCORE_RATING_THRESHOLDS.macro
  let rating: L0MacroOutput['rating'] = 'neutral'
  if (score >= thresholds.favorable) rating = 'favorable'
  else if (score < thresholds.adverse) rating = 'adverse'

  return {
    score,
    dimensions: { social, technological, economic, environmental, political },
    rating,
    summary: `[占位符] ${input.symbol} STEEP 宏观分析综合评分 ${score}，评级: ${rating}。后续接入 LLM 生成详细分析。`,
    risks: score < 50 ? ['宏观经济下行风险', '政策不确定性'] : [],
    weight: DEFAULT_WEIGHTS.l0,
  }
}

/**
 * L1: 护城河分析
 * @remarks 当前使用简化评分逻辑，后续接入 LLM 进行深度分析
 */
export function analyzeL1Moat(input: L1MoatInput): L1MoatOutput {
  logger.info(`[StockAnalysisEngine] L1 护城河分析: symbol=${input.symbol}`)

  const { MOAT } = STOCK_ANALYSIS_THRESHOLDS
  const moatType: string[] = []
  if (input.patentCount > MOAT.PATENT_COUNT_THRESHOLD) moatType.push('技术壁垒')
  if (input.marketShare > MOAT.MARKET_SHARE_THRESHOLD) moatType.push('规模优势')
  if (input.switchingCost === 'high') moatType.push('高转换成本')
  if (input.networkEffect === 'strong') moatType.push('网络效应')

  let moatWidth: L1MoatOutput['moatWidth'] = 'none'
  if (moatType.length >= MOAT.WIDE_MOAT_MIN_TYPES) moatWidth = 'wide'
  else if (moatType.length >= MOAT.NARROW_MOAT_MIN_TYPES) moatWidth = 'narrow'

  const brandScore = input.brandValue ? MOAT.BRAND_SCORE_DEFAULT : MOAT.BRAND_SCORE_NO_VALUE
  const patentScore = Math.min(100, input.patentCount * MOAT.PATENT_SCORE_MULTIPLIER)
  const shareScore = Math.min(100, input.marketShare * MOAT.MARKET_SHARE_SCORE_MULTIPLIER)
  const switchScore = input.switchingCost === 'high' ? MOAT.SWITCH_COST_HIGH_SCORE
    : input.switchingCost === 'medium' ? MOAT.SWITCH_COST_MEDIUM_SCORE
    : MOAT.SWITCH_COST_LOW_SCORE
  const networkScore = input.networkEffect === 'strong' ? MOAT.NETWORK_EFFECT_STRONG_SCORE
    : input.networkEffect === 'moderate' ? MOAT.NETWORK_EFFECT_MODERATE_SCORE
    : MOAT.NETWORK_EFFECT_WEAK_SCORE

  const score = Math.round(
    brandScore * 0.15 + patentScore * 0.25 + shareScore * 0.25 + switchScore * 0.20 + networkScore * 0.15,
  )

  return {
    score,
    moatWidth,
    moatType,
    durabilityYears: moatWidth === 'wide' ? MOAT.WIDE_DURABILITY_YEARS
      : moatWidth === 'narrow' ? MOAT.NARROW_DURABILITY_YEARS
      : MOAT.NONE_DURABILITY_YEARS,
    summary: `[占位符] ${input.symbol} 护城河评分 ${score}，宽度: ${moatWidth}，类型: ${moatType.join('、') || '无'}。后续接入 LLM 生成详细分析。`,
    risks: moatWidth === 'none' ? ['缺乏可持续竞争优势', '市场份额面临侵蚀风险'] : [],
    weight: DEFAULT_WEIGHTS.l1,
  }
}

/**
 * L2: 竞品对比分析
 * @remarks 当前使用简化评分逻辑，后续接入 LLM 进行深度分析
 */
export function analyzeL2Competitor(input: L2CompetitorInput): L2CompetitorOutput {
  logger.info(`[StockAnalysisEngine] L2 竞品分析: symbol=${input.symbol}，竞品数=${input.competitors.length}`)

  const { COMPETITOR } = STOCK_ANALYSIS_THRESHOLDS
  const total = input.competitors.length + 1
  const rank = Math.max(1, Math.min(total, Math.ceil(total * COMPETITOR.RANK_PERCENTILE)))
  const rankScore = Math.round(COMPETITOR.RANK_SCORE_MAX - ((rank - 1) / total) * COMPETITOR.RANK_SCORE_PENALTY_MAX)

  const score = rankScore
  const advantages = rank <= COMPETITOR.TOP_RANK ? ['行业领先地位', '规模优势'] : []
  const disadvantages = rank > total * 0.5 ? ['市场份额偏小', '竞争压力较大'] : []

  return {
    score,
    rank,
    totalCompetitors: total,
    advantages,
    disadvantages,
    summary: `[占位符] ${input.symbol} 行业排名 ${rank}/${total}，竞品对比评分 ${score}。后续接入 LLM 生成详细分析。`,
    weight: DEFAULT_WEIGHTS.l2,
  }
}

/**
 * L3: 财务健康分析
 * @remarks 当前使用简化评分逻辑，后续接入 LLM 进行深度分析
 */
export function analyzeL3Finance(input: L3FinanceInput): L3FinanceOutput {
  logger.info(`[StockAnalysisEngine] L3 财务分析: symbol=${input.symbol}`)

  const { FINANCE, COMMON } = STOCK_ANALYSIS_THRESHOLDS
  const growthScore = normalizeScore(input.revenueGrowth, FINANCE.REVENUE_GROWTH_MIN, FINANCE.REVENUE_GROWTH_MAX, 60)
  const profitabilityScore = normalizeScore(input.roe, FINANCE.ROE_MIN, FINANCE.ROE_MAX, 60)
  const solvencyScore = normalizeScore(100 - input.debtRatio, 0, FINANCE.DEBT_RATIO_MAX, 60)
  const liquidityScore = normalizeScore(input.currentRatio, FINANCE.CURRENT_RATIO_MIN, FINANCE.CURRENT_RATIO_MAX, 60)
  const cashFlowScore = input.freeCashFlow > 0 ? FINANCE.CASH_FLOW_POSITIVE_SCORE : FINANCE.CASH_FLOW_NEGATIVE_SCORE

  const score = Math.round(
    growthScore * 0.20 +
    profitabilityScore * 0.25 +
    solvencyScore * 0.20 +
    liquidityScore * 0.15 +
    cashFlowScore * 0.20,
  )

  const thresholds = SCORE_RATING_THRESHOLDS.financialHealth
  let healthRating: L3FinanceOutput['healthRating'] = 'fair'
  if (score >= thresholds.excellent) healthRating = 'excellent'
  else if (score >= thresholds.good) healthRating = 'good'
  else if (score < thresholds.poor) healthRating = 'poor'

  return {
    score,
    healthRating,
    metrics: {
      growth: growthScore,
      profitability: profitabilityScore,
      solvency: solvencyScore,
      liquidity: liquidityScore,
      cashFlow: cashFlowScore,
    },
    summary: `[占位符] ${input.symbol} 财务健康评分 ${score}，评级: ${healthRating}。后续接入 LLM 生成详细分析。`,
    risks: score < COMMON.RISK_HIGH ? ['财务指标偏弱', '需关注现金流状况'] : [],
    weight: DEFAULT_WEIGHTS.l3,
  }
}

/**
 * L4: 估值分析
 * @remarks 当前使用简化评分逻辑，后续接入 LLM 进行深度分析
 */
export function analyzeL4Valuation(input: L4ValuationInput): L4ValuationOutput {
  logger.info(`[StockAnalysisEngine] L4 估值分析: symbol=${input.symbol}`)

  const { VALUATION } = STOCK_ANALYSIS_THRESHOLDS
  const peScore = input.pe > 0 ? Math.min(100, Math.round((input.industryPE / input.pe) * VALUATION.PE_SCORE_WEIGHT)) : VALUATION.FALLBACK_SCORE
  const pbScore = input.pb > 0 ? Math.min(100, Math.round((input.industryPB / input.pb) * VALUATION.PE_SCORE_WEIGHT)) : VALUATION.FALLBACK_SCORE
  const pegScore = input.peg > 0 ? (input.peg < VALUATION.PEG_UNDERVALUED ? VALUATION.PEG_UNDERVALUED_SCORE : input.peg < VALUATION.PEG_OVERVALUED ? VALUATION.PEG_MID_SCORE : VALUATION.PEG_OVERVALUED_SCORE) : VALUATION.FALLBACK_SCORE
  const dcfScore = input.dcfValue > 0
    ? Math.min(100, Math.round((input.dcfValue / input.currentPrice) * VALUATION.DCF_SCORE_WEIGHT))
    : VALUATION.FALLBACK_SCORE

  const score = Math.round(peScore * 0.25 + pbScore * 0.20 + pegScore * 0.25 + dcfScore * 0.30)

  const marginOfSafety = input.dcfValue > 0
    ? Math.round(((input.dcfValue - input.currentPrice) / input.currentPrice) * 100)
    : 0

  let valuationStatus: L4ValuationOutput['valuationStatus'] = 'fair'
  if (marginOfSafety > VALUATION.MARGIN_SAFETY_UNDERVALUED) valuationStatus = 'undervalued'
  else if (marginOfSafety < VALUATION.MARGIN_SAFETY_OVERVALUED) valuationStatus = 'overvalued'

  const targetPriceRange = {
    low: input.dcfValue > 0 ? Math.round(input.dcfValue * VALUATION.DCF_PRICE_LOW_MULTIPLIER * 100) / 100 : input.currentPrice * VALUATION.DCF_PRICE_LOW_MULTIPLIER,
    high: input.dcfValue > 0 ? Math.round(input.dcfValue * VALUATION.DCF_PRICE_HIGH_MULTIPLIER * 100) / 100 : input.currentPrice * VALUATION.DCF_PRICE_HIGH_MULTIPLIER,
  }

  return {
    score,
    valuationStatus,
    marginOfSafety,
    targetPriceRange,
    methods: { peScore, pbScore, pegScore, dcfScore },
    summary: `[占位符] ${input.symbol} 估值评分 ${score}，状态: ${valuationStatus}，安全边际: ${marginOfSafety}%。后续接入 LLM 生成详细分析。`,
    weight: DEFAULT_WEIGHTS.l4,
  }
}

/**
 * L5: 情景分析
 * @remarks 当前使用占位符实现，后续接入 LLM 进行深度分析
 */
export function analyzeL5Scenario(input: L5ScenarioInput): L5ScenarioOutput {
  logger.info(`[StockAnalysisEngine] L5 情景分析: symbol=${input.symbol}`)

  const { SCENARIO } = STOCK_ANALYSIS_THRESHOLDS
  const scenarios = {
    bull: { probability: SCENARIO.BULL_PROBABILITY, return: SCENARIO.BULL_RETURN, narrative: `[占位符] 乐观情景: ${input.bullCase}` },
    base: { probability: SCENARIO.BASE_PROBABILITY, return: SCENARIO.BASE_RETURN, narrative: `[占位符] 基准情景: ${input.baseCase}` },
    bear: { probability: SCENARIO.BEAR_PROBABILITY, return: SCENARIO.BEAR_RETURN, narrative: `[占位符] 悲观情景: ${input.bearCase}` },
  }

  const expectedReturn = Math.round(
    scenarios.bull.probability * scenarios.bull.return +
    scenarios.base.probability * scenarios.base.return +
    scenarios.bear.probability * scenarios.bear.return,
  )

  const downsideRisk = Math.abs(scenarios.bear.return) * scenarios.bear.probability
  const score = Math.min(100, Math.max(0, Math.round(SCENARIO.RETURN_SCORE_BASE + expectedReturn * SCENARIO.RETURN_SCORE_COEFFICIENT)))

  return {
    score,
    scenarios,
    expectedReturn,
    downsideRisk: Math.round(downsideRisk * 100) / 100,
    summary: `[占位符] ${input.symbol} 情景分析评分 ${score}，期望收益: ${expectedReturn}%。后续接入 LLM 生成详细分析。`,
    weight: DEFAULT_WEIGHTS.l5,
  }
}

/**
 * L6: T+0 策略分析
 * @remarks 当前使用简化评分逻辑，后续接入 LLM 进行深度分析
 */
export function analyzeL6T0Strategy(input: L6T0StrategyInput): L6T0StrategyOutput {
  logger.info(`[StockAnalysisEngine] L6 T+0策略: symbol=${input.symbol}`)

  const { T0_STRATEGY } = STOCK_ANALYSIS_THRESHOLDS
  const volatilityScore = normalizeScore(input.intradayVolatility * 100, T0_STRATEGY.VOLATILITY_MIN, T0_STRATEGY.VOLATILITY_MAX, 50)
  const volumeScore = normalizeScore(input.volume, T0_STRATEGY.VOLUME_MIN, T0_STRATEGY.VOLUME_MAX, 50)
  const spreadScore = normalizeScore(100 - input.spread * 100, 0, T0_STRATEGY.SPREAD_MAX, 50)
  const signalScore = input.technicalSignals.length > 0 ? T0_STRATEGY.SIGNAL_SCORE : T0_STRATEGY.NO_SIGNAL_SCORE

  const score = Math.round(
    volatilityScore * 0.30 + volumeScore * 0.25 + spreadScore * 0.20 + signalScore * 0.25,
  )

  const suitable = score >= T0_STRATEGY.SUITABLE_THRESHOLD
  const currentPrice = 100 // 占位价格，实际使用时由外部传入
  const stopLoss = Math.round(currentPrice * T0_STRATEGY.STOP_LOSS_MULTIPLIER * 100) / 100
  const takeProfit = Math.round(currentPrice * T0_STRATEGY.TAKE_PROFIT_MULTIPLIER * 100) / 100

  return {
    score,
    suitable,
    suggestedAction: suitable ? 'hold' : 'none',
    stopLoss,
    takeProfit,
    positionAdvice: suitable ? '轻仓试探，严格止损' : '不建议 T+0 操作',
    summary: `[占位符] ${input.symbol} T+0 策略评分 ${score}，${suitable ? '适合' : '不适合'}日内交易。后续接入 LLM 生成详细分析。`,
    risks: suitable ? ['日内波动风险', '流动性风险'] : [],
    weight: DEFAULT_WEIGHTS.l6,
  }
}

/**
 * L7: Hype 情绪分析
 * @remarks 当前使用简化评分逻辑，后续接入 LLM 进行深度分析
 */
export function analyzeL7Hype(input: L7HypeInput): L7HypeOutput {
  logger.info(`[StockAnalysisEngine] L7 Hype情绪: symbol=${input.symbol}`)

  const { HYPE } = STOCK_ANALYSIS_THRESHOLDS
  const socialScore = normalizeScore(input.socialVolume, 0, HYPE.SOCIAL_VOLUME_MAX, 50)
  const newsScore = Math.round((input.newsSentiment + 1) * 50)
  const trendScore = normalizeScore(input.searchTrend, 0, HYPE.SEARCH_TREND_MAX, 50)

  const totalAnalysts = input.analystRatings.buy + input.analystRatings.hold + input.analystRatings.sell
  const analystScore = totalAnalysts > 0
    ? Math.round((input.analystRatings.buy / totalAnalysts) * HYPE.ANALYST_BUY_WEIGHT + HYPE.ANALYST_BASE_SCORE)
    : 50

  const score = Math.round(
    socialScore * 0.25 + newsScore * 0.30 + trendScore * 0.20 + analystScore * 0.25,
  )

  const thresholds = SCORE_RATING_THRESHOLDS.sentiment
  let sentiment: L7HypeOutput['sentiment'] = 'neutral'
  if (score >= thresholds.overheated) sentiment = 'overheated'
  else if (score >= thresholds.positive) sentiment = 'positive'
  else if (score < thresholds.panic) sentiment = 'panic'
  else if (score < thresholds.negative) sentiment = 'negative'

  const isOverheated = sentiment === 'overheated'

  return {
    score,
    sentiment,
    isOverheated,
    trend: score > HYPE.TREND_RISING ? 'rising' : score < HYPE.TREND_FALLING ? 'falling' : 'stable',
    summary: `[占位符] ${input.symbol} 情绪评分 ${score}，状态: ${sentiment}${isOverheated ? '（过热警告）' : ''}。后续接入 LLM 生成详细分析。`,
    risks: isOverheated ? ['市场情绪过热，警惕回调', '追高风险'] : [],
    weight: DEFAULT_WEIGHTS.l7,
  }
}

/**
 * L8: 第二曲线 + 筹码分析
 * @remarks 当前使用简化评分逻辑，后续接入 LLM 进行深度分析
 */
export function analyzeL8SecondCurve(input: L8SecondCurveInput): L8SecondCurveOutput {
  logger.info(`[StockAnalysisEngine] L8 第二曲线+筹码: symbol=${input.symbol}`)

  const { SECOND_CURVE } = STOCK_ANALYSIS_THRESHOLDS
  const curveScore = normalizeScore(input.newBizRevenueRatio * 100, 0, SECOND_CURVE.NEW_BIZ_MAX, 50)
  const rdScore = normalizeScore(input.rdRatio * 100, 0, SECOND_CURVE.RD_RATIO_MAX, 50)
  const chipScore = normalizeScore(input.chipConcentration * 100, 0, SECOND_CURVE.CHIP_CONCENTRATION_MAX, 50)
  const instScore = normalizeScore(input.institutionalHolding * 100, 0, SECOND_CURVE.INST_HOLDING_MAX, 50)

  const shareholderScore = input.shareholderTrend === 'decreasing' ? SECOND_CURVE.SHAREHOLDER_DECREASING_SCORE
    : input.shareholderTrend === 'stable' ? SECOND_CURVE.SHAREHOLDER_STABLE_SCORE
    : SECOND_CURVE.SHAREHOLDER_INCREASING_SCORE

  const score = Math.round(
    curveScore * 0.25 + rdScore * 0.20 + chipScore * 0.20 + instScore * 0.20 + shareholderScore * 0.15,
  )

  let curvePotential: L8SecondCurveOutput['curvePotential'] = 'low'
  if (input.newBizRevenueRatio > SECOND_CURVE.CURVE_HIGH_NEW_BIZ && input.rdRatio > SECOND_CURVE.CURVE_HIGH_RD) curvePotential = 'high'
  else if (input.newBizRevenueRatio > SECOND_CURVE.CURVE_MEDIUM_NEW_BIZ || input.rdRatio > SECOND_CURVE.CURVE_MEDIUM_RD) curvePotential = 'medium'

  let chipStructure: L8SecondCurveOutput['chipStructure'] = 'balanced'
  if (input.chipConcentration > SECOND_CURVE.CHIP_CONCENTRATED) chipStructure = 'concentrated'
  else if (input.chipConcentration < SECOND_CURVE.CHIP_DISPERSED) chipStructure = 'dispersed'

  let institutionalAttitude: L8SecondCurveOutput['institutionalAttitude'] = 'holding'
  if (input.institutionalHolding > SECOND_CURVE.INST_ACCUMULATING_HOLDING && input.shareholderTrend === 'decreasing') {
    institutionalAttitude = 'accumulating'
  } else if (input.institutionalHolding < SECOND_CURVE.INST_DISTRIBUTING_HOLDING || input.shareholderTrend === 'increasing') {
    institutionalAttitude = 'distributing'
  }

  return {
    score,
    curvePotential,
    chipStructure,
    institutionalAttitude,
    summary: `[占位符] ${input.symbol} 第二曲线评分 ${score}，潜力: ${curvePotential}，筹码: ${chipStructure}。后续接入 LLM 生成详细分析。`,
    risks: curvePotential === 'low' ? ['第二曲线不清晰', '增长动力不足'] : [],
    weight: DEFAULT_WEIGHTS.l8,
  }
}

// ============================================================
// 综合评分融合
// ============================================================

/**
 * 计算九层加权综合评分
 */
export function computeCompositeScore(layers: StockAnalysisResult['layers']): {
  compositeScore: number
  compositeRating: StockAnalysisResult['compositeRating']
  allRisks: string[]
} {
  const layerEntries = [
    { key: 'l0', output: layers.l0 },
    { key: 'l1', output: layers.l1 },
    { key: 'l2', output: layers.l2 },
    { key: 'l3', output: layers.l3 },
    { key: 'l4', output: layers.l4 },
    { key: 'l5', output: layers.l5 },
    { key: 'l6', output: layers.l6 },
    { key: 'l7', output: layers.l7 },
    { key: 'l8', output: layers.l8 },
  ]

  let totalWeightedScore = 0
  let totalWeight = 0
  const allRisks: string[] = []

  for (const { key, output } of layerEntries) {
    const weight = output.weight ?? (DEFAULT_WEIGHTS as Record<string, number>)[key] ?? 0.1
    totalWeightedScore += output.score * weight
    totalWeight += weight

    if ('risks' in output && Array.isArray(output.risks)) {
      allRisks.push(...(output.risks as string[]))
    }
  }

  const compositeScore = totalWeight > 0
    ? Math.round((totalWeightedScore / totalWeight) * 100) / 100
    : 50

  const thresholds = SCORE_RATING_THRESHOLDS.composite
  let compositeRating: StockAnalysisResult['compositeRating'] = 'hold'
  if (compositeScore >= thresholds.strongBuy) compositeRating = 'strong_buy'
  else if (compositeScore >= thresholds.buy) compositeRating = 'buy'
  else if (compositeScore < thresholds.strongSell) compositeRating = 'strong_sell'
  else if (compositeScore < thresholds.sell) compositeRating = 'sell'

  logger.info(`[StockAnalysisEngine] 综合评分: ${compositeScore}, 评级: ${compositeRating}`)

  return { compositeScore, compositeRating, allRisks }
}

/**
 * 九层漏斗完整分析
 * @remarks 主入口函数，依次执行 L0-L8 分析并聚合结果
 */
export async function analyzeStock(input: StockAnalysisInput): Promise<StockAnalysisResult> {
  logger.info(`[StockAnalysisEngine] 开始九层漏斗分析: symbol=${input.symbol}`)

  try {
    const layers = {
      l0: analyzeL0Macro(input.l0),
      l1: analyzeL1Moat(input.l1),
      l2: analyzeL2Competitor(input.l2),
      l3: analyzeL3Finance(input.l3),
      l4: analyzeL4Valuation(input.l4),
      l5: analyzeL5Scenario(input.l5),
      l6: analyzeL6T0Strategy(input.l6),
      l7: analyzeL7Hype(input.l7),
      l8: analyzeL8SecondCurve(input.l8),
    }

    const { compositeScore, compositeRating, allRisks } = computeCompositeScore(layers)

    const recommendation = generateRecommendation(compositeRating, allRisks)

    logger.info(`[StockAnalysisEngine] 九层漏斗分析完成: symbol=${input.symbol}, score=${compositeScore}`)

    return {
      symbol: input.symbol,
      timestamp: Date.now(),
      layers,
      compositeScore,
      compositeRating,
      weights: { ...DEFAULT_WEIGHTS },
      recommendation,
      allRisks,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[StockAnalysisEngine] 分析失败: symbol=${input.symbol}`, { error: message })
    throw err
  }
}

// ============================================================
// 辅助函数
// ============================================================

/** 从因子列表计算评分 */
function scoreFromFactors(factors: string[]): number {
  const { COMMON } = STOCK_ANALYSIS_THRESHOLDS
  if (factors.length === 0) return COMMON.SCORE_DEFAULT
  return Math.min(100, Math.max(0, COMMON.SCORE_DEFAULT + factors.length * 10))
}

/** 归一化评分：将值映射到 0-100 区间 */
function normalizeScore(value: number, min: number, max: number, base: number): number {
  if (max <= min) return base
  const normalized = ((value - min) / (max - min)) * 100
  return Math.min(100, Math.max(0, Math.round(normalized)))
}

/** 根据综合评级生成推荐文本 */
function generateRecommendation(
  rating: StockAnalysisResult['compositeRating'],
  risks: string[],
): string {
  const baseMap: Record<string, string> = {
    strong_buy: '强烈推荐买入：九层分析综合评分优秀，建议积极配置。',
    buy: '推荐买入：整体评分良好，可在回调时分批建仓。',
    hold: '建议持有/观望：评分中性，等待更明确的信号。',
    sell: '建议卖出：评分偏弱，考虑减仓或止损。',
    strong_sell: '强烈建议卖出：评分极弱，风险显著，建议清仓。',
  }

  const riskNote = risks.length > 0
    ? ` 主要风险：${risks.slice(0, 3).join('；')}`
    : ''

  return (baseMap[rating] ?? '暂无明确建议。') + riskNote
}

// ============================================================
// LLM 增强版本
// ============================================================

/**
 * 构建单层 LLM 分析 Prompt
 */
function buildLayerAnalysisPrompt(layerKey: string, layerSummary: string, symbol: string, input: Record<string, unknown>): LlmMessage[] {
  return [
    {
      role: 'system',
      content: `你是专业A股分析师。根据提供的该层分析输入数据和当前规则引擎评分，生成更精准的分析摘要。
要求：
- 返回严格 JSON 格式
- 根据输入数据给出专业分析（50-100字）
- 给出一个 0-100 的评分
- 列出关键风险（0-3条）

输出格式：
{
  "score": 75,
  "summary": "专业分析摘要",
  "risks": ["风险1"]
}`,
    },
    {
      role: 'user',
      content: `分析 ${symbol} 的 ${layerKey} 层：

## 规则引擎当前结果
${layerSummary}

## 输入数据
${JSON.stringify(input, null, 2).slice(0, 1500)}

请给出你的专业分析和评分。`,
    },
  ]
}

/** 解析 LLM 单层分析结果 */
function parseLayerLlmResponse(content: string): { score?: number; summary?: string; risks?: string[] } {
  try {
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    const jsonStr = jsonMatch?.[1] ?? content
    return JSON.parse(jsonStr.trim())
  } catch {
    return {}
  }
}

export interface AnalyzeStockOptions {
  /** LLM 配置覆盖 */
  llmConfig?: PartialLlmConfig
  /** 需要用 LLM 增强的层（默认全部） */
  llmLayers?: string[]
  /** 进度回调 */
  onProgress?: (layer: string, status: 'rule' | 'llm' | 'done') => void
}

/**
 * 九层漏斗分析（LLM 增强版）
 *
 * 对指定层先用规则引擎计算基础评分，再用 LLM 补充/覆盖 summary 和 score。
 * LLM 不可用时降级为纯规则引擎。
 */
export async function analyzeStockWithLLM(
  input: StockAnalysisInput,
  options?: AnalyzeStockOptions,
): Promise<StockAnalysisResult> {
  const { llmConfig: llmOverride, onProgress } = options ?? {}

  logger.info(`[StockAnalysisEngine] 开始 LLM 增强九层分析: symbol=${input.symbol}`)

  // 先用规则引擎生成所有层的结果
  const result = await analyzeStock(input)

  // 尝试用 LLM 增强各层
  if (llmOverride) {
    const defaults = { baseURL: '', apiKey: '', model: '', ...llmOverride }
    if (isLlmConfigured(defaults)) {
      const layerMap: Array<{ key: string; summary: string }> = [
        { key: 'L0', summary: result.layers.l0.summary },
        { key: 'L1', summary: result.layers.l1.summary },
        { key: 'L2', summary: result.layers.l2.summary },
        { key: 'L3', summary: result.layers.l3.summary },
        { key: 'L4', summary: result.layers.l4.summary },
        { key: 'L5', summary: result.layers.l5.summary },
        { key: 'L6', summary: result.layers.l6.summary },
        { key: 'L7', summary: result.layers.l7.summary },
        { key: 'L8', summary: result.layers.l8.summary },
      ]

      const targetLayers = options?.llmLayers ?? layerMap.map((l) => l.key)

      for (const layer of layerMap) {
        if (!targetLayers.includes(layer.key)) continue

        try {
          onProgress?.(layer.key, 'llm')
          const inputRecord = input as unknown as Record<string, Record<string, unknown>>
          const messages = buildLayerAnalysisPrompt(
            layer.key,
            layer.summary,
            input.symbol,
            inputRecord[`l${layer.key.slice(1)}`] ?? {},
          )
          const response = await chat(messages, { ...llmOverride, timeout: 30000 } as Record<string, unknown>)
          const parsed = parseLayerLlmResponse(response.content)

          if (typeof parsed.score === 'number') {
            const layers = result.layers as unknown as Record<string, Record<string, unknown>>
            const layerKey = `l${layer.key.slice(1)}` as keyof typeof layers
            if (layers[layerKey]) {
              if (typeof parsed.summary === 'string' && parsed.summary.length > 10) {
                layers[layerKey].summary = parsed.summary
              }
              if (Array.isArray(parsed.risks)) {
                layers[layerKey].risks = parsed.risks
              }
              // 仅当 LLM summary 明确有效时覆盖评分
              if (typeof parsed.summary === 'string' && parsed.summary.length > 20) {
                layers[layerKey].score = Math.max(0, Math.min(100, parsed.score))
              }
            }
          }
          onProgress?.(layer.key, 'done')
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          logger.warn(`[StockAnalysisEngine] ${layer.key} LLM 增强失败，保持规则引擎结果: ${msg}`)
          onProgress?.(layer.key, 'done')
        }
      }

      // 重新计算综合评分
      const { compositeScore, compositeRating, allRisks } = computeCompositeScore(result.layers)
      result.compositeScore = compositeScore
      result.compositeRating = compositeRating
      result.allRisks = allRisks
      result.recommendation = generateRecommendation(compositeRating, allRisks)
      result.timestamp = Date.now()
    }
  }

  return result
}