/**
 * @module crossValidator
 * @description V6 评分引擎交叉验证规则引擎。
 *
 * 检测多维度评分之间的矛盾与不一致，防止"数据好看但逻辑冲突"的评分误导决策。
 * 纯规则引擎，零 LLM 依赖，完全离线运行。
 *
 * 验证规则（可配置阈值）：
 * 1. 财务好但估值高（L3f 高分 + L3v 低分）→ 矛盾
 * 2. 增长好但财务差（L7 高分 + L3f 低分）→ 矛盾
 * 3. Hype 泡沫期 + 情景积极（L6 泡沫/纯概念 + L4 高分）→ 高风险组合
 * 4. 综合分高但覆盖率低（score ≥ 4.0 + coverageRate ≤ 0.5）→ 低置信度
 * 5. 行业评分与个股评分严重背离（L-1 与综合分差 > 2.0）→ 背离
 *
 * @see src/services/scoring/v6-engine/engine.ts - aggregate() 中调用
 */

import type { CompositeScore, LayerId } from './types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 验证告警级别 */
export type ValidationSeverity = 'info' | 'warning' | 'critical'

/** 单条交叉验证结果 */
export interface CrossValidationIssue {
  /** 规则 ID */
  ruleId: string
  /** 告警级别 */
  severity: ValidationSeverity
  /** 告警标题 */
  title: string
  /** 详细说明 */
  description: string
  /** 涉及的层 */
  layers: LayerId[]
  /** 相关分值（用于调试） */
  scores: Record<string, number | string>
}

/** 交叉验证总结果 */
export interface CrossValidationResult {
  /** 是否通过（无任何 critical） */
  passed: boolean
  /** 所有检测到的 issue */
  issues: CrossValidationIssue[]
  /** 告警统计 */
  summary: {
    critical: number
    warning: number
    info: number
  }
}

/** 可配置的验证阈值 */
export interface CrossValidatorConfig {
  /** 财务好但估值高：L3f ≥ 此值且 L3v ≤ 此值为矛盾 */
  financialGoodValuationHigh: { l3fMin: number; l3vMax: number }
  /** 增长好但财务差：L7 ≥ 此值且 L3f ≤ 此值为矛盾 */
  growthGoodFinancialBad: { l7Min: number; l3fMax: number }
  /** Hype 泡沫 + 情景积极：L6 关键词 + L4 ≥ 此值为高风险 */
  hypeBubbleScenarioPositive: { l4Min: number; l6Keywords: string[] }
  /** 综合分高但覆盖率低 */
  highScoreLowCoverage: { scoreMin: number; coverageRateMax: number }
  /** 行业与个股背离 */
  industryDivergence: { maxDiff: number }
}

// ============================================================
// 默认配置
// ============================================================

/**
 * DEFAULT_CROSS_VALIDATOR_CONFIG
 */
export const DEFAULT_CROSS_VALIDATOR_CONFIG: CrossValidatorConfig = {
  financialGoodValuationHigh: { l3fMin: 4.0, l3vMax: 2.5 },
  growthGoodFinancialBad: { l7Min: 4.0, l3fMax: 2.5 },
  hypeBubbleScenarioPositive: {
    l4Min: 4.0,
    l6Keywords: ['泡沫', '纯概念', '期望膨胀期（纯概念）'],
  },
  highScoreLowCoverage: { scoreMin: 4.0, coverageRateMax: 0.5 },
  industryDivergence: { maxDiff: 2.0 },
}

// ============================================================
// 规则引擎
// ============================================================

function getLayerScore(composite: CompositeScore, layerId: LayerId): number | undefined {
  const layer = composite.layers[layerId]
  if (!layer) return undefined
  return Number.isFinite(layer.score) ? layer.score : undefined
}

function getLayerSummary(composite: CompositeScore, layerId: LayerId): string {
  return composite.layers[layerId]?.summary ?? ''
}

/** 规则 1：财务好但估值高 */
function checkFinancialGoodValuationHigh(
  composite: CompositeScore,
  config: CrossValidatorConfig,
): CrossValidationIssue | undefined {
  const l3f = getLayerScore(composite, 'l3f')
  const l3v = getLayerScore(composite, 'l3v')
  const { l3fMin, l3vMax } = config.financialGoodValuationHigh

  if (l3f !== undefined && l3v !== undefined && l3f >= l3fMin && l3v <= l3vMax) {
    return {
      ruleId: 'R001',
      severity: 'warning',
      title: '财务健康但估值偏高',
      description: `L3a 财务健康评分 ${l3f.toFixed(2)}（优秀），但 L3b 估值水平 ${l3v.toFixed(2)}（偏高），存在"财务好但买贵了"的矛盾风险。建议重新审视估值安全边际。`,
      layers: ['l3f', 'l3v'],
      scores: { l3f, l3v, thresholdL3f: l3fMin, thresholdL3v: l3vMax },
    }
  }
  return undefined
}

/** 规则 2：增长好但财务差 */
function checkGrowthGoodFinancialBad(
  composite: CompositeScore,
  config: CrossValidatorConfig,
): CrossValidationIssue | undefined {
  const l7 = getLayerScore(composite, 'l7')
  const l3f = getLayerScore(composite, 'l3f')
  const { l7Min, l3fMax } = config.growthGoodFinancialBad

  if (l7 !== undefined && l3f !== undefined && l7 >= l7Min && l3f <= l3fMax) {
    return {
      ruleId: 'R002',
      severity: 'critical',
      title: '第二曲线强但财务差',
      description: `L7 第二曲线评分 ${l7.toFixed(2)}（强催化），但 L3a 财务健康 ${l3f.toFixed(2)}（差），存在"增长故事好但基本面不支撑"的高风险矛盾。可能存在财务造假或激进会计。`,
      layers: ['l7', 'l3f'],
      scores: { l7, l3f, thresholdL7: l7Min, thresholdL3f: l3fMax },
    }
  }
  return undefined
}

/** 规则 3：Hype 泡沫期 + 情景积极 */
function checkHypeBubbleScenarioPositive(
  composite: CompositeScore,
  config: CrossValidatorConfig,
): CrossValidationIssue | undefined {
  const l4 = getLayerScore(composite, 'l4')
  const l6Summary = getLayerSummary(composite, 'l6')
  const { l4Min, l6Keywords } = config.hypeBubbleScenarioPositive

  const isHypeBubble = l6Summary && l6Keywords.some((kw) => l6Summary.includes(kw))

  if (l4 !== undefined && isHypeBubble && l4 >= l4Min) {
    return {
      ruleId: 'R003',
      severity: 'critical',
      title: 'Hype 泡沫期 + 情景乐观',
      description: `L6 处于 Hype 泡沫期（${l6Summary}），但 L4 情景推演 ${l4.toFixed(2)}（乐观），存在"概念炒作 + 乐观预期"的高风险组合。建议回避或极小仓位。`,
      layers: ['l4', 'l6'],
      scores: { l4, l6Summary, thresholdL4: l4Min },
    }
  }
  return undefined
}

/** 规则 4：综合分高但覆盖率低 */
function checkHighScoreLowCoverage(
  composite: CompositeScore,
  config: CrossValidatorConfig,
): CrossValidationIssue | undefined {
  const { scoreMin, coverageRateMax } = config.highScoreLowCoverage
  const score = composite.score
  const coverageRate = composite.coverageRate ?? 1

  if (Number.isFinite(score) && score >= scoreMin && coverageRate <= coverageRateMax) {
    return {
      ruleId: 'R004',
      severity: 'warning',
      title: '高分但数据覆盖不足',
      description: `综合评分 ${score.toFixed(2)}（高），但数据覆盖率仅 ${(coverageRate * 100).toFixed(0)}%（低于 ${(coverageRateMax * 100).toFixed(0)}%），高分可能由"幸存者偏差"导致（缺失层多为低分层）。建议补充数据后重评。`,
      layers: ALL_LAYERS,
      scores: { score, coverageRate, thresholdScore: scoreMin, thresholdCoverage: coverageRateMax },
    }
  }
  return undefined
}

/** 规则 5：行业评分与个股评分严重背离 */
function checkIndustryDivergence(
  composite: CompositeScore,
  config: CrossValidatorConfig,
): CrossValidationIssue | undefined {
  const lMinus1 = getLayerScore(composite, 'lMinus1')
  const score = composite.score
  const { maxDiff } = config.industryDivergence

  if (lMinus1 !== undefined && Number.isFinite(score)) {
    const diff = Math.abs(lMinus1 - score)
    if (diff > maxDiff) {
      return {
        ruleId: 'R005',
        severity: 'info',
        title: '行业评分与个股评分背离',
        description: `L-1 行业评分 ${lMinus1.toFixed(2)} 与综合评分 ${score.toFixed(2)} 差距 ${diff.toFixed(2)}（阈值 ${maxDiff}），存在行业与个股表现背离。${lMinus1 > score ? '个股跑输行业，需排查个股特有风险。' : '个股跑赢行业，需确认是否有 alpha 来源。'}`,
        layers: ['lMinus1'],
        scores: { lMinus1, compositeScore: score, diff, threshold: maxDiff },
      }
    }
  }
  return undefined
}

// ============================================================
// 入口
// ============================================================

const ALL_LAYERS: LayerId[] = [
  'lMinus1', 'l0', 'l1', 'l2', 'l3f', 'l3v', 'l4', 'l5', 'l6', 'l7', 'l8',
]

/**
 * 对 CompositeScore 执行交叉验证。
 *
 * @param composite - V6 综合评分结果
 * @param config - 验证阈值配置（可选，默认使用 DEFAULT_CROSS_VALIDATOR_CONFIG）
 * @returns 验证结果
 */
export function crossValidate(
  composite: CompositeScore,
  config: CrossValidatorConfig = DEFAULT_CROSS_VALIDATOR_CONFIG,
): CrossValidationResult {
  const issues: CrossValidationIssue[] = []

  const checks = [
    checkFinancialGoodValuationHigh(composite, config),
    checkGrowthGoodFinancialBad(composite, config),
    checkHypeBubbleScenarioPositive(composite, config),
    checkHighScoreLowCoverage(composite, config),
    checkIndustryDivergence(composite, config),
  ]

  for (const issue of checks) {
    if (issue) issues.push(issue)
  }

  const summary = {
    critical: issues.filter((i) => i.severity === 'critical').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
  }

  const passed = summary.critical === 0

  if (issues.length > 0) {
    logger.warn(`[CrossValidator] 检测到 ${issues.length} 项交叉验证问题`, {
      critical: summary.critical,
      warning: summary.warning,
      info: summary.info,
    })
  }

  return { passed, issues, summary }
}
