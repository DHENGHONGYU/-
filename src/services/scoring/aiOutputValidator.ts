/**
 * aiOutputValidator — 三道校验关
 *
 * 在 AI 输出（IntelligentScore）持久化前执行三道校验：
 * 1. 数值校验：LLM 生成的财务数字与 v6 引擎/库内实际值比对
 * 2. 引用核对：每维度评分依据是否引用可查来源
 * 3. 时间一致性：评分时间戳是否与基础数据版本一致
 *
 * 使用方式：`validateScoreBeforeSave(score, { v6EngineScore })`
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-021, V9-DOC-BACK-033, V9-DOC-BACK-027]
*/

import { getLogger } from '@/lib/logger'
import type { IntelligentScore } from '@/data/types'

const logger = getLogger()

// ============================================================
// 校验结果类型
// ============================================================

export interface ValidationIssue {
  check: 'numeric' | 'citation' | 'timestamp'
  severity: 'info' | 'warn' | 'block'
  field: string
  message: string
  expected?: string | number
  actual?: string | number
}

export interface ValidationReport {
  passed: boolean
  severity: 'block' | 'warn' | 'info'
  issues: ValidationIssue[]
  score: number
}

// ============================================================
// 阈值常量（零硬编码）
// ============================================================

/** 数值偏差容忍度：v6 引擎分与 LLM 合成分差异 > 此值即告警 */
const SCORE_DEVIATION_THRESHOLD = 1.5
/** 维度得分有效范围 [min, max] */
const SCORE_RANGE: [number, number] = [0, 5]
/** 评分依据最低字数要求（少于视为无实质依据） */
const MIN_RATIONALE_LENGTH = 10

// ============================================================
// 第一关：数值校验
// ============================================================

/**
 * 校验维度得分是否在有效范围内
 * 当 v6 引擎分可用时，比对 LLM 分与 v6 分的偏差
 */
function checkNumericValidity(
  score: IntelligentScore,
  v6EngineScore?: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // 1a. 综合分范围校验
  if (score.overallScore !== null) {
    if (score.overallScore < SCORE_RANGE[0] || score.overallScore > SCORE_RANGE[1]) {
      issues.push({
        check: 'numeric',
        severity: 'block',
        field: 'overallScore',
        message: `综合分 ${score.overallScore} 超出有效范围 [${SCORE_RANGE[0]}, ${SCORE_RANGE[1]}]`,
        expected: `[${SCORE_RANGE[0]}, ${SCORE_RANGE[1]}]`,
        actual: score.overallScore,
      })
    }
  }

  // 1b. v6 引擎比对（当 v6 分可用时）
  if (v6EngineScore !== undefined && score.overallScore !== null) {
    const deviation = Math.abs(score.overallScore - v6EngineScore)
    if (deviation > SCORE_DEVIATION_THRESHOLD) {
      issues.push({
        check: 'numeric',
        severity: 'warn',
        field: 'overallScore',
        message: `综合分 ${score.overallScore.toFixed(2)} 偏离 v6 引擎分 ${v6EngineScore.toFixed(2)} 超过 ${SCORE_DEVIATION_THRESHOLD}`,
        expected: v6EngineScore,
        actual: score.overallScore,
      })
    }
  }

  // 1c. 每维度分数范围校验
  for (const dim of score.dimensionScores) {
    if (dim.score !== null) {
      if (dim.score < SCORE_RANGE[0] || dim.score > SCORE_RANGE[1]) {
        issues.push({
          check: 'numeric',
          severity: 'block',
          field: `dimensionScores.${dim.name}.score`,
          message: `维度 "${dim.name}" 得分 ${dim.score} 超出有效范围`,
          expected: `[${SCORE_RANGE[0]}, ${SCORE_RANGE[1]}]`,
          actual: dim.score,
        })
      }
    }
  }

  return issues
}

// ============================================================
// 第二关：引用核对
// ============================================================

/**
 * 校验每维度是否包含评分依据（evidence）和足够说明（rationale）
 */
function checkCitationIntegrity(score: IntelligentScore): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const dim of score.dimensionScores) {
    // 2a. 评分依据长度检查（过短 = 无实质依据）
    if (!dim.rationale || dim.rationale.length < MIN_RATIONALE_LENGTH) {
      issues.push({
        check: 'citation',
        severity: 'warn',
        field: `dimensionScores.${dim.name}.rationale`,
        message: `维度 "${dim.name}" 评分依据过短（${(dim.rationale?.length ?? 0)} 字 < ${MIN_RATIONALE_LENGTH} 字）`,
        expected: `≥ ${MIN_RATIONALE_LENGTH} 字`,
        actual: dim.rationale?.length ?? 0,
      })
    }

    // 2b. 证据列表为空时告警（v6 因子应有 evidence）
    if (!dim.usedLlm && (!dim.evidence || dim.evidence.length === 0)) {
      issues.push({
        check: 'citation',
        severity: 'info',
        field: `dimensionScores.${dim.name}.evidence`,
        message: `维度 "${dim.name}" 无支撑证据项（非 LLM 因子应含证据）`,
      })
    }
  }

  // 2c. 整体 summary 存在性
  if (!score.summary || score.summary.length < MIN_RATIONALE_LENGTH) {
    issues.push({
      check: 'citation',
      severity: 'warn',
      field: 'summary',
      message: `AI 总结过短（${(score.summary?.length ?? 0)} 字）或无内容`,
      expected: `≥ ${MIN_RATIONALE_LENGTH} 字`,
      actual: score.summary?.length ?? 0,
    })
  }

  // 2d. basis 存在性
  if (!score.basis || score.basis.length < MIN_RATIONALE_LENGTH) {
    issues.push({
      check: 'citation',
      severity: 'warn',
      field: 'basis',
      message: `评分依据描述过短或无内容`,
      expected: `≥ ${MIN_RATIONALE_LENGTH} 字`,
      actual: score.basis?.length ?? 0,
    })
  }

  return issues
}

// ============================================================
// 第三关：时间一致性
// ============================================================

/**
 * 校验评分时间戳与数据版本一致性
 * - scoredAt 不能早于数据版本时间
 * - scoredAt 不能是未来时间（允许 60s 时钟偏差）
 */
function checkTimestampConsistency(score: IntelligentScore): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const now = Date.now()
  const MAX_CLOCK_SKEW_MS = 60_000

  // 3a. 未来时间检查
  if (score.scoredAt > now + MAX_CLOCK_SKEW_MS) {
    issues.push({
      check: 'timestamp',
      severity: 'block',
      field: 'scoredAt',
      message: `评分时间 ${new Date(score.scoredAt).toISOString()} 在未来（时钟偏差 > ${MAX_CLOCK_SKEW_MS / 1000}s）`,
      expected: `≤ ${new Date(now + MAX_CLOCK_SKEW_MS).toISOString()}`,
      actual: new Date(score.scoredAt).toISOString(),
    })
  }

  // 3b. 评分时间不能太旧（超过 7 天视为过期数据）
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  if (score.scoredAt < now - SEVEN_DAYS_MS) {
    issues.push({
      check: 'timestamp',
      severity: 'info',
      field: 'scoredAt',
      message: `评分为 7 天前的数据（${new Date(score.scoredAt).toISOString()}），可能已过期`,
      expected: `≥ ${new Date(now - SEVEN_DAYS_MS).toISOString()}`,
      actual: new Date(score.scoredAt).toISOString(),
    })
  }

  return issues
}

// ============================================================
// 综合校验入口
// ============================================================

/**
 * 对 IntelligentScore 执行三道校验，返回校验报告
 * @param score 待校验的评分对象
 * @param v6EngineScore 可选的 v6 引擎得分（用于数值比对）
 */
export function validateScoreBeforeSave(
  score: IntelligentScore,
  options?: { v6EngineScore?: number },
): ValidationReport {
  const allIssues: ValidationIssue[] = [
    ...checkNumericValidity(score, options?.v6EngineScore),
    ...checkCitationIntegrity(score),
    ...checkTimestampConsistency(score),
  ]

  // 聚合 severity
  let severity: ValidationReport['severity'] = 'info'
  for (const issue of allIssues) {
    if (issue.severity === 'block') {
      severity = 'block'
      break
    }
    if (issue.severity === 'warn') {
      severity = 'warn'
    }
  }

  const passed = severity !== 'block'

  if (allIssues.length > 0) {
    logger.info('[AIOutputValidator] 三道校验结果', {
      symbol: score.symbol,
      passed,
      severity,
      issueCount: allIssues.length,
      blockCount: allIssues.filter((i) => i.severity === 'block').length,
      warnCount: allIssues.filter((i) => i.severity === 'warn').length,
    })
  }

  return {
    passed,
    severity,
    issues: allIssues,
    score: score.overallScore ?? 0,
  }
}
