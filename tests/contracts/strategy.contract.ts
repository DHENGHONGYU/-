/**
 * @fileoverview Strategy 模块契约验证器
 * @description 定义策略核心类型的运行时契约
 *
 * 契约来源：src/types/modules/strategy.types.ts
 */

import { z } from 'zod'

// ============================================================
// HotSectorDimensions 契约定义
// ============================================================

/**
 * HotSectorDimensions 契约
 * 对应类型：src/types/modules/strategy.types.ts::HotSectorDimensions
 *
 * 热门板块五维评分维度
 */
export const HotSectorDimensionsSchema = z.object({
  /** 动量强度，权重 35%，0-5 分 */
  momentum: z.number().min(0).max(5),
  /** 情绪热度，权重 25%，0-5 分 */
  sentiment: z.number().min(0).max(5),
  /** 技术突破，权重 20%，0-5 分 */
  breakout: z.number().min(0).max(5),
  /** 估值风险，权重 15%，0-5 分 */
  valuationRisk: z.number().min(0).max(5),
  /** 大盘环境，权重 5%，0-5 分 */
  marketEnv: z.number().min(0).max(5),
})

// ============================================================
// HotSectorScore 契约定义
// ============================================================

/**
 * HotSectorScore 契约
 * 对应类型：src/types/modules/strategy.types.ts::HotSectorScore
 *
 * 热门板块策略评分输出
 */
export const HotSectorScoreSchema = z.object({
  /** 标的代码 */
  symbol: z.string(),
  /** 板块名称 */
  sectorName: z.string(),
  /** 综合评分 0-5 */
  overallScore: z.number().min(0).max(5),
  /** 五维维度得分 */
  dimensions: HotSectorDimensionsSchema,
  /** 交易信号 */
  signal: z.enum(['buy', 'hold', 'avoid']),
  /** 生成时间戳 */
  generatedAt: z.number(),
})

// ============================================================
// ValuePitDimensions 契约定义
// ============================================================

/**
 * ValuePitDimensions 契约
 * 对应类型：src/types/modules/strategy.types.ts::ValuePitDimensions
 *
 * 价值洼地五维评分维度
 */
export const ValuePitDimensionsSchema = z.object({
  /** 催化确定性，权重 30%，0-5 分 */
  catalyst: z.number().min(0).max(5),
  /** 估值安全垫，权重 25%，0-5 分 */
  valuationMargin: z.number().min(0).max(5),
  /** 筹码结构，权重 20%，0-5 分 */
  chipStructure: z.number().min(0).max(5),
  /** 轮动位置，权重 15%，0-5 分 */
  rotationPosition: z.number().min(0).max(5),
  /** 流动性，权重 10%，0-5 分 */
  liquidity: z.number().min(0).max(5),
})

// ============================================================
// ValuePitScore 契约定义
// ============================================================

/**
 * ValuePitScore 契约
 * 对应类型：src/types/modules/strategy.types.ts::ValuePitScore
 *
 * 价值洼地策略评分输出
 */
export const ValuePitScoreSchema = z.object({
  /** 标的代码 */
  symbol: z.string(),
  /** 板块名称 */
  sectorName: z.string(),
  /** 综合评分 0-5 */
  overallScore: z.number().min(0).max(5),
  /** 五维维度得分 */
  dimensions: ValuePitDimensionsSchema,
  /** 建仓状态 */
  status: z.enum(['build', 'test', 'wait_signal']),
  /** 生成时间戳 */
  generatedAt: z.number(),
})

// ============================================================
// RotationConditions 契约定义
// ============================================================

/**
 * RotationConditions 契约
 * 对应类型：src/types/modules/strategy.types.ts::RotationConditions
 *
 * 轮动信号触发条件检测结果
 */
export const RotationConditionsSchema = z.object({
  /** 成交量突破 20% 历史分位 */
  volumeBreakthrough: z.boolean(),
  /** 资金连续 3 日净流入 */
  capitalInflow: z.boolean(),
  /** 技术指标金叉 */
  goldenCross: z.boolean(),
})

// ============================================================
// RotationSignal 契约定义
// ============================================================

/**
 * RotationSignal 契约
 * 对应类型：src/types/modules/strategy.types.ts::RotationSignal
 *
 * 轮动信号输出
 */
export const RotationSignalSchema = z.object({
  /** 板块/行业标识 */
  sectorId: z.string(),
  /** 是否触发轮动信号（三项全部满足） */
  triggered: z.boolean(),
  /** 各项条件检测结果 */
  conditions: RotationConditionsSchema,
  /** 信号强度 */
  strength: z.enum(['weak', 'medium', 'strong']),
  /** 检测时间戳 */
  detectedAt: z.number(),
})

// ============================================================
// StrategySignal 契约定义
// ============================================================

/**
 * StrategySignal 契约
 * 对应类型：src/types/modules/strategy.types.ts::StrategySignal
 *
 * 策略交易信号
 */
export const StrategySignalSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  direction: z.enum(['buy', 'sell', 'hold', 'watch']),
  type: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  snapshot: z.record(z.string(), z.unknown()),
  createdAt: z.number(),
})

// ============================================================
// WatchlistCandidate 契约定义
// ============================================================

/**
 * WatchlistCandidate 契约
 * 对应类型：src/types/modules/strategy.types.ts::WatchlistCandidate
 *
 * 观察池候选
 */
export const WatchlistCandidateSchema = z.object({
  symbol: z.string(),
  reason: z.string(),
})

// ============================================================
// StrategySummary 契约定义
// ============================================================

/**
 * StrategySummary 契约
 * 对应类型：src/types/modules/strategy.types.ts::StrategySummary
 *
 * 双策略汇总统计
 */
export const StrategySummarySchema = z.object({
  total: z.number().int().nonnegative(),
  hotSectorCount: z.number().int().nonnegative(),
  valuePitCount: z.number().int().nonnegative(),
  signalCount: z.number().int().nonnegative(),
  watchlistCount: z.number().int().nonnegative(),
})

// ============================================================
// DualStrategyResult 契约定义
// ============================================================

/**
 * DualStrategyResult 契约
 * 对应类型：src/types/modules/strategy.types.ts::DualStrategyResult
 *
 * 双策略编排引擎输出汇总
 */
export const DualStrategyResultSchema = z.object({
  /** 热门板块评分列表 */
  hotSectorScores: z.array(HotSectorScoreSchema),
  /** 价值洼地评分列表 */
  valuePitScores: z.array(ValuePitScoreSchema),
  /** 触发轮动信号的交易信号 */
  signals: z.array(StrategySignalSchema),
  /** 未触发轮动信号的观察池候选 */
  watchlistCandidates: z.array(WatchlistCandidateSchema),
  /** 汇总统计 */
  summary: StrategySummarySchema,
})

// ============================================================
// DualStrategyRuleConfig 契约定义
// ============================================================

/**
 * DualStrategyRuleConfig 契约
 * 对应类型：src/types/modules/strategy.types.ts::DualStrategyRuleConfig
 *
 * 双策略规则配置
 */
export const DualStrategyRuleConfigSchema = z.object({
  hotSectorV6Min: z.number(),
  hotSectorImmediateThreshold: z.number(),
  hotSectorProbeThreshold: z.number(),

  valuePitV6Min: z.number(),
  valuePitV6Max: z.number(),
  valuePitImmediateThreshold: z.number(),
  valuePitProbeThreshold: z.number(),
  valuePitWaitThreshold: z.number(),

  rotationVolumeSurgeRatio: z.number(),
  rotationFundFlowConsecutiveDays: z.number(),
  rotationPriceToMA20Threshold: z.number(),

  hotSectorStopLossPct: z.number(),
  hotSectorTakeProfitPct: z.number(),
  hotSectorTakeProfitSellRatio: z.number(),

  valuePitStopLossPct: z.number(),
  valuePitTakeProfitPct: z.number(),
  valuePitTakeProfitSellRatio: z.number(),
})

// ============================================================
// StrategyGroupItem 契约定义
// ============================================================

/**
 * StrategyGroupItem 契约
 * 对应类型：src/types/modules/strategy.types.ts::StrategyGroupItem
 *
 * 策略分组项
 */
export const StrategyGroupItemSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  composite: z.number(),
  l3v: z.number(),
  l1Score: z.number().optional(),
  l3fScore: z.number().optional(),
  l7Score: z.number().optional(),
  resonance: z.number().optional(),
  classification: z.enum(['core', 'hot', 'value']),
  reasons: z.array(z.string()),
})

// ============================================================
// 工厂函数
// ============================================================

/**
 * 创建符合 HotSectorScore 契约的测试数据
 */
export function createMockHotSectorScore(
  overrides: Partial<z.infer<typeof HotSectorScoreSchema>> = {},
): z.infer<typeof HotSectorScoreSchema> {
  return {
    symbol: '000001.SZ',
    sectorName: '银行',
    overallScore: 3.5,
    dimensions: {
      momentum: 3.5,
      sentiment: 4.0,
      breakout: 3.0,
      valuationRisk: 2.5,
      marketEnv: 3.8,
    },
    signal: 'buy',
    generatedAt: Date.now(),
    ...overrides,
  }
}

/**
 * 创建符合 ValuePitScore 契约的测试数据
 */
export function createMockValuePitScore(
  overrides: Partial<z.infer<typeof ValuePitScoreSchema>> = {},
): z.infer<typeof ValuePitScoreSchema> {
  return {
    symbol: '600036.SH',
    sectorName: '银行',
    overallScore: 4.2,
    dimensions: {
      catalyst: 4.0,
      valuationMargin: 4.5,
      chipStructure: 3.8,
      rotationPosition: 4.2,
      liquidity: 4.0,
    },
    status: 'build',
    generatedAt: Date.now(),
    ...overrides,
  }
}

/**
 * 创建符合 RotationSignal 契约的测试数据
 */
export function createMockRotationSignal(
  overrides: Partial<z.infer<typeof RotationSignalSchema>> = {},
): z.infer<typeof RotationSignalSchema> {
  return {
    sectorId: 'bank',
    triggered: true,
    conditions: {
      volumeBreakthrough: true,
      capitalInflow: true,
      goldenCross: true,
    },
    strength: 'strong',
    detectedAt: Date.now(),
    ...overrides,
  }
}

/**
 * 创建符合 DualStrategyResult 契约的测试数据
 */
export function createMockDualStrategyResult(
  overrides: Partial<z.infer<typeof DualStrategyResultSchema>> = {},
): z.infer<typeof DualStrategyResultSchema> {
  return {
    hotSectorScores: [createMockHotSectorScore()],
    valuePitScores: [createMockValuePitScore()],
    signals: [],
    watchlistCandidates: [],
    summary: {
      total: 2,
      hotSectorCount: 1,
      valuePitCount: 1,
      signalCount: 0,
      watchlistCount: 0,
    },
    ...overrides,
  }
}

/**
 * 创建符合 StrategySignal 契约的测试数据
 */
export function createMockStrategySignal(
  overrides: Partial<z.infer<typeof StrategySignalSchema>> = {},
): z.infer<typeof StrategySignalSchema> {
  return {
    id: `signal-${Date.now()}`,
    symbol: '000001.SZ',
    direction: 'buy',
    type: 'hot_sector',
    confidence: 0.85,
    rationale: '板块动量强劲，资金持续流入',
    snapshot: {},
    createdAt: Date.now(),
    ...overrides,
  }
}

// ============================================================
// 导出类型
// ============================================================

export type HotSectorScoreContract = z.infer<typeof HotSectorScoreSchema>
export type ValuePitScoreContract = z.infer<typeof ValuePitScoreSchema>
export type RotationSignalContract = z.infer<typeof RotationSignalSchema>
export type DualStrategyResultContract = z.infer<typeof DualStrategyResultSchema>
export type StrategySignalContract = z.infer<typeof StrategySignalSchema>
