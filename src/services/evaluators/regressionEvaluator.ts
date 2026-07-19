/**
 * @module services/evaluators/regressionEvaluator
 * @description RegressionEvaluator — 对比实际输出与基线，检测回归退化
 */

import { getLogger } from '@/lib/logger'
import type { EvaluatorContext, EvaluatorFn, EvaluationResult, RegressionEvaluatorParams } from './evaluatorTypes'

const logger = getLogger()

/**
 * REGRESSION_EVALUATOR_ID
 */
export const REGRESSION_EVALUATOR_ID = 'regression-evaluator'

type FlatMap = Map<string, string>

function flatten(obj: unknown, prefix = '', result: FlatMap = new Map()): FlatMap {
  if (obj === null || obj === undefined) {
    result.set(prefix, String(obj))
    return result
  }

  if (Array.isArray(obj)) {
    // 数组按 JSON 字符串整体比较，避免索引漂移导致大量差异
    result.set(prefix, JSON.stringify(obj))
    return result
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj)
    if (keys.length === 0) {
      result.set(prefix, '{}')
    } else {
      for (const key of keys) {
        const path = prefix ? `${prefix}.${key}` : key
        flatten((obj as Record<string, unknown>)[key], path, result)
      }
    }
    return result
  }

  const normalizedValue = typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean'
    ? String(obj)
    : JSON.stringify(obj)

  result.set(prefix, normalizedValue)
  return result
}

function isIgnored(path: string, ignorePaths: string[]): boolean {
  return ignorePaths.some((p) => path === p || path.startsWith(`${p}.`))
}

/**
 * regressionEvaluator
 */
export const regressionEvaluator: EvaluatorFn = (ctx: EvaluatorContext): EvaluationResult => {
  const startedAt = Date.now()
  const params = ctx.params as RegressionEvaluatorParams | undefined
  const threshold = params?.threshold ?? 0.9
  const ignorePaths = params?.ignorePaths ?? []

  logger.info(`[${REGRESSION_EVALUATOR_ID}] 开始回归检测`, {
    symbol: ctx.symbol,
    skillId: ctx.skillId,
    threshold,
  })

  if (ctx.expected === undefined) {
    return {
      evaluatorId: REGRESSION_EVALUATOR_ID,
      status: 'failed',
      score: 0,
      threshold,
      issues: [{
        severity: 'high',
        message: '缺少 expected 基线，无法执行回归检测',
        suggestion: '在 ctx.expected 中传入期望输出或历史基线',
      }],
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  const actualFlat = flatten(ctx.actual)
  const expectedFlat = flatten(ctx.expected)
  const allPaths = new Set([...actualFlat.keys(), ...expectedFlat.keys()])

  let total = 0
  let matched = 0
  const issues = []

  for (const path of allPaths) {
    if (isIgnored(path, ignorePaths)) continue

    const actualValue = actualFlat.get(path)
    const expectedValue = expectedFlat.get(path)
    total++

    if (actualValue === expectedValue) {
      matched++
      continue
    }

    if (actualValue === undefined) {
      issues.push({
        severity: 'medium' as const,
        message: `字段缺失: ${path} 在 actual 中不存在`,
        path,
        suggestion: '检查输出是否遗漏了该字段',
      })
    } else if (expectedValue === undefined) {
      issues.push({
        severity: 'medium' as const,
        message: `新增字段: ${path} 在基线中不存在`,
        path,
        suggestion: '确认新增字段是否为预期变更',
      })
    } else {
      issues.push({
        severity: 'high' as const,
        message: `值变更: ${path} 从 ${expectedValue} 变为 ${actualValue}`,
        path,
        suggestion: '检查该字段变更是否引入回归',
      })
    }
  }

  const score = total === 0 ? 1 : Math.round((matched / total) * 10000) / 10000
  const status = score >= threshold ? 'passed' : score > 0 ? 'partial' : 'failed'
  const durationMs = Date.now() - startedAt

  logger.info(`[${REGRESSION_EVALUATOR_ID}] 回归检测完成`, {
    symbol: ctx.symbol,
    skillId: ctx.skillId,
    score,
    threshold,
    changedFields: issues.length,
    totalFields: total,
  })

  return {
    evaluatorId: REGRESSION_EVALUATOR_ID,
    status,
    score,
    threshold,
    issues,
    metrics: [
      { name: 'matchedFields', value: matched, description: '匹配字段数' },
      { name: 'totalFields', value: total, description: '总字段数' },
      { name: 'changedFields', value: issues.length, description: '变更字段数' },
    ],
    meta: { startedAt, durationMs },
  }
}
