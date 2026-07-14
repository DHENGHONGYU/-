/**
 * @fileoverview 评分域类型（L1 评分业务域）
 *
 * 包含 V6 评分、维度评分、智能评分、行业评分等类型。
 *
 * @module data/types/types.score
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
 */

import type { Stock } from './types.stock'

/** V6 评分结果 */
export interface V6Score {
  symbol: string
  score: number
  factors: Record<string, number>
  algorithmVersion: string
  calculatedAt: number
  dataVersion: number
  /** 评分质量警告（当数据完整度低于 100% 时填充） */
  qualityWarning?: string
  // ── F4 扩展：v6-engine CompositeScore 字段 ──
  /** 综合评级 */
  rating?: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  /** 各层评分明细（layerId → { score, summary, weight }） */
  layerDetails?: Record<string, { score: number; summary: string; weight: number }>
  /** 风险汇总 */
  allRisks?: string[]
  /** 投资建议 */
  recommendation?: string
  /** 引擎版本号 */
  engineVersion?: string
}

/** 智能评分维度 */
export interface DimensionScore {
  name: string
  score: number | null
  rationale: string
  evidence: string[]
  weight: number
  /** 该因子是否使用了 LLM 增强（透明度标记） */
  usedLlm?: boolean
}

/** 智能评分结果 */
export interface IntelligentScore {
  id?: number
  symbol: string
  overallScore: number | null
  dimensionScores: DimensionScore[]
  summary: string
  basis: string
  missingFields: string[]
  sourceSnapshot: {
    stock: Stock | undefined
    fileNames: string[]
    reportLength: number
  }
  configSnapshot: {
    model: string
    baseURL: string
    /** 如果使用 v6 实时因子引擎，记录引擎版本 */
    v6EngineVersion?: string
    /** 如果使用 v6 实时因子引擎，记录引擎综合分 */
    v6Score?: number
  }
  modelResponse: string
  dataVersion: number
  scoredAt: number
  /** 评分决策来源（透明度标记）：data-driven=v6 引擎基于采集数据计算；llm-synthetic=LLM 黑箱合成（无采集数据支撑） */
  scoreProvenance?: 'data-driven' | 'llm-synthetic'
  /** 底层评分所依据数据的血缘（继承自 stock.dataProvenance）：real / mock / unknown */
  dataProvenance?: 'real' | 'mock' | 'unknown'
}

/** 行业评分维度 */
export interface IndustryDimensionScore {
  name: string
  score: number | null
  rationale: string
  evidence: string[]
  weight: number
}

/** 行业评分结果 */
export interface IndustryScore {
  id?: number
  code: string
  name: string
  overallScore: number | null
  dimensionScores: IndustryDimensionScore[]
  summary: string
  basis: string
  missingFields: string[]
  sectorSnapshot: {
    composite: number
    recommendation: string
    positionPct: string
    subTracks: string[]
  }
  configSnapshot: {
    model: string
    baseURL: string
    /** 如果使用 v6 实时因子引擎，记录引擎版本 */
    v6EngineVersion?: string
    /** 如果使用 v6 实时因子引擎，记录引擎综合分 */
    v6Score?: number
  }
  modelResponse: string
  scoredAt: number
}
