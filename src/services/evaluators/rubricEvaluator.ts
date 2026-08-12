/**
 * @module services/evaluators/rubricEvaluator
 * @description RubricEvaluator — 基于可配置评分细则的加权评估
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type { EvaluatorContext, EvaluatorFn, EvaluationResult, RubricCriterion, RubricEvaluatorParams } from './evaluatorTypes'

const logger = getLogger()

/**
 * RUBRIC_EVALUATOR_ID
 */
export const RUBRIC_EVALUATOR_ID = 'rubric-evaluator'

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

function getDisplayString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function evaluateCriterion(actual: unknown, criterion: RubricCriterion): boolean {
  const value = getValueByPath(actual, criterion.path)

  switch (criterion.operator) {
    case 'exists':
      return value !== undefined
    case 'notEmpty':
      return value !== undefined && value !== null
        && (Array.isArray(value) ? value.length > 0 : getDisplayString(value).length > 0)
    case 'gte':
      return typeof value === 'number' && value >= (criterion.threshold as number)
    case 'lte':
      return typeof value === 'number' && value <= (criterion.threshold as number)
    case 'gt':
      return typeof value === 'number' && value > (criterion.threshold as number)
    case 'lt':
      return typeof value === 'number' && value < (criterion.threshold as number)
    case 'eq':
      return value === criterion.threshold
    case 'in':
      return Array.isArray(criterion.threshold) && criterion.threshold.includes(String(value))
    case 'lengthGte':
      return Array.isArray(value) && value.length >= (criterion.threshold as number)
    case 'lengthLte':
      return Array.isArray(value) && value.length <= (criterion.threshold as number)
    default:
      return false
  }
}

/**
 * rubricEvaluator
 */
export const rubricEvaluator: EvaluatorFn = (ctx: EvaluatorContext): EvaluationResult => {
  const startedAt = Date.now()
  const params = ctx.params as RubricEvaluatorParams | undefined
  const criteria = params?.criteria ?? []
  const threshold = params?.threshold ?? 0.7

  logger.info(`[${RUBRIC_EVALUATOR_ID}] 开始 Rubric 评估`, {
    symbol: ctx.symbol,
    skillId: ctx.skillId,
    criterionCount: criteria.length,
  })

  if (criteria.length === 0) {
    return {
      evaluatorId: RUBRIC_EVALUATOR_ID,
      status: 'failed',
      score: 0,
      threshold,
      issues: [{
        severity: 'high',
        message: '缺少评分细则 params.criteria',
        suggestion: '在 params 中传入 RubricCriterion 数组',
      }],
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0) || 1
  let weightedScore = 0
  const issues = []

  for (const criterion of criteria) {
    const passed = evaluateCriterion(ctx.actual, criterion)
    const contribution = (passed ? criterion.weight : 0) / totalWeight
    weightedScore += contribution

    if (!passed) {
      issues.push({
        severity: 'medium' as const,
        message: `未通过: ${criterion.description} (路径: ${criterion.path})`,
        path: criterion.path,
        suggestion: `检查 ${criterion.path} 是否满足 ${criterion.operator} ${String(criterion.threshold ?? '')}`,
      })
    }
  }

  const score = Math.round(weightedScore * 10000) / 10000
  const status = score >= threshold ? 'passed' : score > 0 ? 'partial' : 'failed'
  const durationMs = Date.now() - startedAt

  logger.info(`[${RUBRIC_EVALUATOR_ID}] Rubric 评估完成`, {
    symbol: ctx.symbol,
    skillId: ctx.skillId,
    score,
    threshold,
    passedCount: criteria.length - issues.length,
    totalCount: criteria.length,
  })

  return {
    evaluatorId: RUBRIC_EVALUATOR_ID,
    status,
    score,
    threshold,
    issues,
    metrics: [
      { name: 'passedCriteria', value: criteria.length - issues.length, description: '通过的评分项数' },
      { name: 'totalCriteria', value: criteria.length, description: '总评分项数' },
    ],
    meta: { startedAt, durationMs },
  }
}
