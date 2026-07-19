/**
 * @fileoverview 策略域类型（L1 策略业务域）
 *
 * 包含策略分类、候选标的、策略结果、热门板块/价值洼地评分、双策略编排等类型。
 *
 * @module data/types/types.strategy
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
  * @doc [V9-DOC-BACK-003, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-BACK-006, V9-DOC-DATA-021]
*/

import type { Signal } from './types.signal'

/** 策略分类标签 */
export type StrategyClassification =
  | 'core-scarce'
  | 'value-bargain'
  | 'hot-momentum'
  | 'excluded'

/** 策略候选标的 */
export interface StrategyCandidate {
  symbol: string
  name: string
  composite: number
  valuationScore: number | null
  industryScore: number | null
  momentum: number | null
  sector: string | null
  classification: StrategyClassification
  reasons: string[]
}

/** 策略规则引擎输出结果 */
export interface StrategyResult {
  selected: StrategyCandidate[]
  coreScarce: StrategyCandidate[]
  valueBargain: StrategyCandidate[]
  hotMomentum: StrategyCandidate[]
  rejected: StrategyCandidate[]
  summary: {
    total: number
    selectedCount: number
    coreScarceCount: number
    valueBargainCount: number
    hotMomentumCount: number
  }
}

/** 热门板块策略评分维度 */
export interface HotSectorDimensionScores {
  momentum: number
  sentiment: number
  technical: number
  valuation: number
  composite: number
  marketEnv?: number
}

/** 热门板块策略评分，持久化于 hot_sector_scores Store */
export interface HotSectorScore {
  symbol: string
  /** 板块/标的名称 */
  name: string
  score: number
  dimensions: HotSectorDimensionScores
  action: 'immediate' | 'probe' | 'ignore'
  calculatedAt: number
  dataVersion: number
  qualityWarning?: string
}

/** 价值洼地策略评分维度 */
export interface ValuePitDimensionScores {
  catalyst: number
  valuation: number
  chip: number
  rotation: number
  liquidity: number
  composite: number
}

/** 价值洼地策略评分，持久化于 value_pit_scores Store */
export interface ValuePitScore {
  symbol: string
  /** 板块/标的名称 */
  name: string
  score: number
  dimensions: ValuePitDimensionScores
  rotationSignal: boolean
  action: 'immediate' | 'probe' | 'wait' | 'ignore'
  calculatedAt: number
  dataVersion: number
  qualityWarning?: string
}

/** 双策略编排引擎输出结果 */
export interface DualStrategyResult {
  hotSectorScores: HotSectorScore[]
  valuePitScores: ValuePitScore[]
  signals: Signal[]
  watchlistCandidates: Array<{ symbol: string; reason: string }>
  summary: {
    total: number
    hotSectorCount: number
    valuePitCount: number
    signalCount: number
    watchlistCount: number
  }
}
