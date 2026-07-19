/**
 * @fileoverview 因子预测与周期复盘类型定义
 *
 * 定义预测校验、周期复盘、因子画板所需的全部类型。
 *
 * @module types/modules/prediction
 * @created 2026-07-15 - 输出模块补强
/** 市场周期阶段 */
export type MarketCycle = 'left-bottom' | 'right-up' | 'top' | 'left-down'

/** 预测方向 */
export type PredictionDirection = 'bullish' | 'bearish' | 'neutral'

/** 预测时间窗口 */
export type PredictionHorizon = '5d' | '10d' | '20d' | '60d'

/** 预测校验状态 */
export type PredictionStatus = 'pending' | 'verified' | 'expired'

/** 因子有效性状态 */
export type FactorEffectiveness = 'effective' | 'weakening' | 'ineffective'

/** 因子预测记录 */
export interface FactorPrediction {
  readonly predictionId: string
  readonly generatedAt: string
  readonly symbol: string
  readonly stockName: string
  readonly direction: PredictionDirection
  readonly predictedReturnRange: {
    readonly min: number
    readonly max: number
  }
  readonly timeWindow: number
  readonly horizon: PredictionHorizon
  readonly drivingFactors: ReadonlyArray<{
    readonly factorId: string
    readonly factorName: string
    readonly factorScore: number
    readonly contribution: number
  }>
  readonly confidence: number
  readonly marketCycle: MarketCycle
  readonly sentimentDominant: boolean
  status: PredictionStatus
  actualReturn?: number
  hitDirection?: boolean
  hitRange?: boolean
  verifiedAt?: string
}

/** 周期阶段识别输入 */
export interface CycleMetrics {
  readonly indexMA5: number
  readonly indexMA20: number
  readonly indexMA60: number
  readonly volume20d: number
  readonly volume60d: number
  readonly northFlow5d: number
  readonly rsi14: number
}

/** 因子 IC/IR 统计 */
export interface FactorICStat {
  readonly factorId: string
  readonly factorName: string
  readonly ic: number
  readonly ir: number
  readonly hitRate: number
  readonly status: FactorEffectiveness
  readonly sampleCount: number
}

/** 周期复盘报告 */
export interface CycleRetrospectiveReport {
  readonly period: string
  readonly marketCycle: MarketCycle
  readonly totalPredictions: number
  readonly directionAccuracy: number
  readonly rangeAccuracy: number
  readonly factorICs: ReadonlyArray<FactorICStat>
  readonly cycleAdaptation: Record<MarketCycle, number>
  readonly weightAdjustments: ReadonlyArray<{
    readonly factorId: string
    readonly factorName: string
    readonly currentWeight: number
    readonly suggestedWeight: number
    readonly reason: string
  }>
  readonly generatedAt: string
}

/** 因子画板数据 */
export interface FactorDashboardData {
  readonly marketCycle: MarketCycle
  readonly cycleConfidence: number
  readonly activeFactors: ReadonlyArray<{
    readonly factorId: string
    readonly factorName: string
    readonly score: number
    readonly weight: number
    readonly ic: number
    readonly effectiveness: FactorEffectiveness
  }>
  readonly topPredictions: ReadonlyArray<{
    readonly symbol: string
    readonly stockName: string
    readonly direction: PredictionDirection
    readonly confidence: number
    readonly predictedReturn: string
  }>
  readonly alerts: ReadonlyArray<{
    readonly level: 'info' | 'warning' | 'critical'
    readonly message: string
    readonly factorId?: string
  }>
  readonly generatedAt: string
}

/** 周期适配权重表 */
export type CycleWeightTable = Record<MarketCycle, Record<string, number>>

/** 失效预警阈值 */
export const IC_THRESHOLDS = {
  effective: 0.05,
  weakening: 0.02,
  ineffective: 0,
} as const

/** 右侧机会默认权重调整 */
export const RIGHT_UP_WEIGHTS: Record<string, number> = {
  F3_6: 2.0, F3_7: 2.0, F2_8: 1.8,
  F3_1: 1.5, F3_2: 1.5, F3_9: 1.5,
  F3_4: 1.5, F3_5: 1.5, F3_8: 1.6,
  F1_8: 0.5, F2_6: 0.5,
  F1_1: 0.8, F1_2: 0.8, F1_3: 0.8,
} as const
