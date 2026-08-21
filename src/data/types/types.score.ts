/**
 * @fileoverview 评分域类型（L1 评分业务域）
 *
 * 包含 V6 评分、维度评分、智能评分、行业评分等类型。
 *
 * @module data/types/types.score
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-BACK-005, V9-DOC-BACK-010, V9-DOC-PROJ-003]
*/

import type { Stock } from './types.stock'

/** V6 评分结果 */
export interface V6Score {
  symbol: string
  /** 证券名称（runV6Score 由 Stock.name 填充，提供名称兜底用） */
  name?: string
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

/**
 * 双轨评分分歧度（Champion-Challenger 影子评分模式）
 *
 * 当 V6 规则引擎（冠军，主分来源）与 LLM 影子评分（挑战者，仅比对不参与主分计算）
 * 同时存在时记录两者偏离度，用于置信分层路由：
 * consistent=一致（高置信）→ 直接放行；moderate=中度分歧 → 降置信标记；
 * divergent=高度分歧 → 建议人工复核。分歧即认知不确定性，分歧大的样本最需人工介入。
 */
export interface DualTrackDivergence {
  /** V6 引擎综合分（冠军分，主分来源，0-5 分制） */
  v6OverallScore: number
  /** LLM 影子综合分（挑战者分，已评分因子均值，1-5 分制钳位） */
  llmOverallScore: number
  /** 综合分分歧 |LLM - V6|（0-4 分制） */
  compositeDelta: number
  /** 因子级最大分歧 |LLM - V6|（0-4 分制） */
  maxFactorDelta: number
  /** 分歧最大的前 3 个因子（按 delta 降序） */
  topDivergentFactors: Array<{
    name: string
    v6Score: number | null
    llmScore: number | null
    delta: number
  }>
  /** 置信分层路由结果 */
  tier: 'consistent' | 'moderate' | 'divergent'
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
  /** 双轨评分分歧度（V6 冠军分 vs LLM 影子分，仅 V6 驱动且 LLM 响应可解析时填充） */
  dualTrackDivergence?: DualTrackDivergence
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
