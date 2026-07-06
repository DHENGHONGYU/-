/**
 * V9 选股策略类型定义
 *
 * @description
 * 定义双策略体系（热门板块策略 + 价值洼地策略）的所有核心类型，
 * 包括评分输出、轮动信号、策略结果等。
 *
 * 实际存储类型仍以 `src/data/types.ts` 为单一真相源（IndexedDB Schema），
 * 本文件提供策略层面的语义类型别名和派生类型，供 scoring 层和 UI 层消费。
 *
 * @module types/modules/strategy.types
 * @created 2026-06-27 - 基于双策略体系修正
 */

// ============================================================
// 策略A：热门板块策略（短线快进快出）
// ============================================================

/** 热门板块五维评分维度 */
export interface HotSectorDimensions {
  /** 动量强度，权重 35%，0-5 分 */
  momentum: number
  /** 情绪热度，权重 25%，0-5 分 */
  sentiment: number
  /** 技术突破，权重 20%，0-5 分 */
  breakout: number
  /** 估值风险，权重 15%，0-5 分 */
  valuationRisk: number
  /** 大盘环境，权重 5%，0-5 分 */
  marketEnv: number
}

/** 热门板块策略评分输出 */
export interface HotSectorScore {
  /** 标的代码 */
  symbol: string
  /** 板块名称 */
  sectorName: string
  /** 综合评分 0-5 */
  overallScore: number
  /** 五维维度得分 */
  dimensions: HotSectorDimensions
  /** 交易信号 */
  signal: 'buy' | 'hold' | 'avoid'
  /** 生成时间戳 */
  generatedAt: number
}

// ============================================================
// 策略B：价值洼地策略（长期轮动等待）
// ============================================================

/** 价值洼地五维评分维度 */
export interface ValuePitDimensions {
  /** 催化确定性，权重 30%，0-5 分 */
  catalyst: number
  /** 估值安全垫，权重 25%，0-5 分 */
  valuationMargin: number
  /** 筹码结构，权重 20%，0-5 分 */
  chipStructure: number
  /** 轮动位置，权重 15%，0-5 分 */
  rotationPosition: number
  /** 流动性，权重 10%，0-5 分 */
  liquidity: number
}

/** 价值洼地策略评分输出 */
export interface ValuePitScore {
  /** 标的代码 */
  symbol: string
  /** 板块名称 */
  sectorName: string
  /** 综合评分 0-5 */
  overallScore: number
  /** 五维维度得分 */
  dimensions: ValuePitDimensions
  /** 建仓状态 */
  status: 'build' | 'test' | 'wait_signal'
  /** 生成时间戳 */
  generatedAt: number
}

// ============================================================
// 轮动信号检测
// ============================================================

/** 轮动信号触发条件检测结果 */
export interface RotationConditions {
  /** 成交量突破 20% 历史分位 */
  volumeBreakthrough: boolean
  /** 资金连续 3 日净流入 */
  capitalInflow: boolean
  /** 技术指标金叉 */
  goldenCross: boolean
}

/** 轮动信号输出 */
export interface RotationSignal {
  /** 板块/行业标识 */
  sectorId: string
  /** 是否触发轮动信号（三项全部满足） */
  triggered: boolean
  /** 各项条件检测结果 */
  conditions: RotationConditions
  /** 信号强度 */
  strength: 'weak' | 'medium' | 'strong'
  /** 检测时间戳 */
  detectedAt: number
}

// ============================================================
// 双策略编排结果
// ============================================================

/** 双策略编排引擎输出汇总 */
export interface DualStrategyResult {
  /** 热门板块评分列表 */
  hotSectorScores: HotSectorScore[]
  /** 价值洼地评分列表 */
  valuePitScores: ValuePitScore[]
  /** 触发轮动信号的交易信号 */
  signals: StrategySignal[]
  /** 未触发轮动信号的观察池候选 */
  watchlistCandidates: WatchlistCandidate[]
  /** 汇总统计 */
  summary: StrategySummary
}

/** 策略交易信号 */
export interface StrategySignal {
  id: string
  symbol: string
  direction: 'buy' | 'sell' | 'hold' | 'watch'
  type: string
  confidence: number
  rationale: string
  snapshot: Record<string, unknown>
  createdAt: number
}

/** 观察池候选 */
export interface WatchlistCandidate {
  symbol: string
  reason: string
}

/** 双策略汇总统计 */
export interface StrategySummary {
  total: number
  hotSectorCount: number
  valuePitCount: number
  signalCount: number
  watchlistCount: number
}

// ============================================================
// 策略规则配置
// ============================================================

/** 双策略规则配置（来自 config 层） */
export interface DualStrategyRuleConfig {
  hotSectorV6Min: number
  hotSectorImmediateThreshold: number
  hotSectorProbeThreshold: number

  valuePitV6Min: number
  valuePitV6Max: number
  valuePitImmediateThreshold: number
  valuePitProbeThreshold: number
  valuePitWaitThreshold: number

  rotationVolumeSurgeRatio: number
  rotationFundFlowConsecutiveDays: number
  rotationPriceToMA20Threshold: number

  hotSectorStopLossPct: number
  hotSectorTakeProfitPct: number
  hotSectorTakeProfitSellRatio: number

  valuePitStopLossPct: number
  valuePitTakeProfitPct: number
  valuePitTakeProfitSellRatio: number
}

// ============================================================
// 策略快照分组
// ============================================================

/** 策略分组项 */
export interface StrategyGroupItem {
  symbol: string
  name: string
  composite: number
  l3v: number
  l1Score?: number
  l3fScore?: number
  l7Score?: number
  resonance?: number
  classification: 'core' | 'hot' | 'value'
  reasons: string[]
}
