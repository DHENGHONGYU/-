/**
 * @module services/evaluators/consistencyEvaluator
 * @description ConsistencyEvaluator — 检查 SKILL 输出与上游/预期结果的一致性
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type { ConsistencyEvaluatorParams, ConsistencyRule, EvaluatorContext, EvaluatorFn, EvaluationResult } from './evaluatorTypes'

const logger = getLogger()

/**
 * CONSISTENCY_EVALUATOR_ID
 */
export const CONSISTENCY_EVALUATOR_ID = 'consistency-evaluator'

function getValueByPath(obj: unknown, path: string): unknown {
  if (typeof obj !== 'object' || obj === null) return undefined
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current
}

const RATING_ORDER: Record<string, number> = {
  strong_buy: 2,
  buy: 1,
  hold: 0,
  sell: -1,
  strong_sell: -2,
}

function ratingScore(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return RATING_ORDER[value]
  return undefined
}

function isContradictory(source: unknown, target: unknown): boolean {
  const s = ratingScore(source)
  const t = ratingScore(target)
  if (s === undefined || t === undefined) return false
  return s * t < 0
}

function isSameDirection(source: unknown, target: unknown): boolean {
  const s = ratingScore(source)
  const t = ratingScore(target)
  if (s === undefined || t === undefined) return source === target
  return (s > 0 && t > 0) || (s < 0 && t < 0) || s === t
}

function evaluateRule(ctx: EvaluatorContext, rule: ConsistencyRule): { passed: boolean; targetValue?: unknown } {
  const sourceValue = getValueByPath(ctx.actual, rule.sourcePath)
  let targetValue: unknown

  if (rule.targetSource === 'upstream') {
    const upstream = ctx.upstreamResults?.[rule.upstreamSkillId ?? '']
    targetValue = getValueByPath(upstream?.data, rule.targetPath)
  } else {
    targetValue = getValueByPath(ctx.expected, rule.targetPath)
  }

  switch (rule.operator) {
    case 'eq':
      return { passed: sourceValue === targetValue, targetValue }
    case 'sameDirection':
      return { passed: isSameDirection(sourceValue, targetValue), targetValue }
    case 'contains':
      return {
        passed: typeof targetValue === 'string'
          ? targetValue.includes(String(sourceValue))
          : Array.isArray(targetValue) && targetValue.some((v) => v === sourceValue),
        targetValue,
      }
    case 'notContradict':
      return { passed: !isContradictory(sourceValue, targetValue), targetValue }
    default:
      return { passed: false, targetValue }
  }
}

/**
 * consistencyEvaluator
 */
export const consistencyEvaluator: EvaluatorFn = (ctx: EvaluatorContext): EvaluationResult => {
  const startedAt = Date.now()
  const params = ctx.params as ConsistencyEvaluatorParams | undefined
  const rules = params?.rules ?? []
  const threshold = params?.threshold ?? 0.8

  logger.info(`[${CONSISTENCY_EVALUATOR_ID}] 开始一致性评估`, {
    symbol: ctx.symbol,
    skillId: ctx.skillId,
    ruleCount: rules.length,
  })

  if (rules.length === 0) {
    return {
      evaluatorId: CONSISTENCY_EVALUATOR_ID,
      status: 'failed',
      score: 0,
      threshold,
      issues: [{
        severity: 'high',
        message: '缺少一致性规则 params.rules',
        suggestion: '在 params 中传入 ConsistencyRule 数组',
      }],
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  const totalWeight = rules.reduce((sum, r) => sum + (r.weight ?? 1), 0) || 1
  let weightedScore = 0
  const issues = []

  for (const rule of rules) {
    const { passed, targetValue } = evaluateRule(ctx, rule)
    const weight = rule.weight ?? 1
    weightedScore += (passed ? weight : 0) / totalWeight

    if (!passed) {
      issues.push({
        severity: 'high' as const,
        message: `不一致: ${rule.description} (源: ${String(getValueByPath(ctx.actual, rule.sourcePath))}, 目标: ${String(targetValue)})`,
        path: rule.sourcePath,
        suggestion: `检查 ${rule.sourcePath} 与 ${rule.targetSource === 'upstream' ? rule.upstreamSkillId : 'expected'}.${rule.targetPath} 是否满足 ${rule.operator}`,
      })
    }
  }

  const score = Math.round(weightedScore * 10000) / 10000
  const status = score >= threshold ? 'passed' : score > 0 ? 'partial' : 'failed'
  const durationMs = Date.now() - startedAt

  logger.info(`[${CONSISTENCY_EVALUATOR_ID}] 一致性评估完成`, {
    symbol: ctx.symbol,
    skillId: ctx.skillId,
    score,
    threshold,
    passedCount: rules.length - issues.length,
    totalCount: rules.length,
  })

  return {
    evaluatorId: CONSISTENCY_EVALUATOR_ID,
    status,
    score,
    threshold,
    issues,
    metrics: [
      { name: 'passedRules', value: rules.length - issues.length, description: '通过的一致性规则数' },
      { name: 'totalRules', value: rules.length, description: '总一致性规则数' },
    ],
    meta: { startedAt, durationMs },
  }
}
