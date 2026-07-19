/**
 * @module services/evaluators/schemaEvaluator
 * @description SchemaEvaluator — 基于 Zod Schema 的结构化输出校验
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type { EvaluatorContext, EvaluatorFn, EvaluationResult } from './evaluatorTypes'

const logger = getLogger()

/**
 * SCHEMA_EVALUATOR_ID
 */
export const SCHEMA_EVALUATOR_ID = 'schema-evaluator'

/**
 * schemaEvaluator
 */
export const schemaEvaluator: EvaluatorFn = (ctx: EvaluatorContext): EvaluationResult => {
  const startedAt = Date.now()
  const schema = ctx.params?.schema as import('zod').ZodSchema | undefined

  logger.info(`[${SCHEMA_EVALUATOR_ID}] 开始 Schema 校验`, { symbol: ctx.symbol, skillId: ctx.skillId })

  if (!schema) {
    return {
      evaluatorId: SCHEMA_EVALUATOR_ID,
      status: 'failed',
      score: 0,
      issues: [{
        severity: 'high',
        message: '缺少 params.schema，无法执行 Schema 校验',
        suggestion: '在 params 中传入用于校验的 Zod Schema',
      }],
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  const parsed = schema.safeParse(ctx.actual)
  const durationMs = Date.now() - startedAt

  if (parsed.success) {
    logger.info(`[${SCHEMA_EVALUATOR_ID}] Schema 校验通过`, { symbol: ctx.symbol, skillId: ctx.skillId })
    return {
      evaluatorId: SCHEMA_EVALUATOR_ID,
      status: 'passed',
      score: 1,
      issues: [],
      metrics: [{ name: 'schemaErrors', value: 0, description: 'Zod Schema 校验错误数' }],
      meta: { startedAt, durationMs },
    }
  }

  const issues = parsed.error.issues.map((issue) => ({
    severity: 'high' as const,
    message: issue.message,
    path: issue.path.join('.') || undefined,
    suggestion: `请检查字段 ${issue.path.join('.') || 'root'} 的类型与约束`,
  }))

  logger.warn(`[${SCHEMA_EVALUATOR_ID}] Schema 校验失败`, {
    symbol: ctx.symbol,
    skillId: ctx.skillId,
    errorCount: issues.length,
  })

  return {
    evaluatorId: SCHEMA_EVALUATOR_ID,
    status: 'failed',
    score: 0,
    issues,
    metrics: [{ name: 'schemaErrors', value: issues.length, description: 'Zod Schema 校验错误数' }],
    meta: { startedAt, durationMs },
  }
}
