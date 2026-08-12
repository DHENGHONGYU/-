/**
 * @module services/evaluators/evaluatorTypes
 * @description Batch C 评估体系统一类型定义
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-QA-066, V9-DOC-BACK-023]
*/

import type { ZodSchema } from 'zod'
import type { SkillResult } from '@/services/skills'

/** 评估Issue严重级别 */
export type EvaluationSeverity = 'high' | 'medium' | 'low'

/** 评估结论状态 */
export type EvaluationStatus = 'passed' | 'failed' | 'partial'

/** 评估发现的单个问题 */
export interface EvaluationIssue {
  /** 严重级别 */
  severity: EvaluationSeverity
  /** 问题描述 */
  message: string
  /** 问题所在字段路径（可选） */
  path?: string
  /** 修正建议（可选） */
  suggestion?: string
}

/** 评估指标项 */
export interface EvaluationMetric {
  /** 指标名称 */
  name: string
  /** 指标值 */
  value: number
  /** 指标说明（可选） */
  description?: string
}

/** 评估结果统一结构 */
export interface EvaluationResult {
  /** 评估器唯一标识 */
  evaluatorId: string
  /** 评估状态 */
  status: EvaluationStatus
  /** 综合得分 0-1 */
  score: number
  /** 阈值 0-1 */
  threshold?: number
  /** 问题列表 */
  issues: EvaluationIssue[]
  /** 指标集合 */
  metrics?: EvaluationMetric[]
  /** 评估耗时与元信息 */
  meta: {
    startedAt: number
    durationMs: number
  }
}

/** 评估器输入上下文 */
export interface EvaluatorContext {
  /** 股票代码 */
  symbol: string
  /** 来源 SKILL 标识 */
  skillId?: string
  /** 待评估的实际输出 */
  actual: unknown
  /** 期望输出/基线（可选） */
  expected?: unknown
  /** 上游 SKILL 结果（用于一致性评估） */
  upstreamResults?: Record<string, SkillResult>
  /** 额外参数 */
  params?: Record<string, unknown>
}

/** 评估器函数签名 */
export type EvaluatorFn = (ctx: EvaluatorContext) => EvaluationResult | Promise<EvaluationResult>

/** Schema 评估参数 */
export interface SchemaEvaluatorParams {
  /** 用于校验的 Zod Schema */
  schema: ZodSchema
}

/** Rubric 评分单项规则 */
export interface RubricCriterion {
  /** 规则ID */
  id: string
  /** 规则描述 */
  description: string
  /** 权重 0-1 */
  weight: number
  /** 字段路径（支持点号） */
  path: string
  /** 比较操作符 */
  operator: 'exists' | 'notEmpty' | 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'in' | 'lengthGte' | 'lengthLte'
  /** 阈值/参照值 */
  threshold?: number | string | string[]
}

/** Rubric 评估参数 */
export interface RubricEvaluatorParams {
  /** 评分阈值，默认 0.7 */
  threshold?: number
  /** 评分规则列表 */
  criteria: RubricCriterion[]
}

/** 一致性规则 */
export interface ConsistencyRule {
  /** 规则ID */
  id: string
  /** 规则描述 */
  description: string
  /** 源字段路径（actual 输出上） */
  sourcePath: string
  /** 目标字段路径（上游结果或 expected 上） */
  targetPath: string
  /** 目标来源：upstream 或 expected */
  targetSource: 'upstream' | 'expected'
  /** 上游 SKILL ID（targetSource=upstream 时必填） */
  upstreamSkillId?: string
  /** 比较操作符 */
  operator: 'eq' | 'sameDirection' | 'contains' | 'notContradict'
  /** 权重 0-1 */
  weight?: number
}

/** 一致性评估参数 */
export interface ConsistencyEvaluatorParams {
  /** 通过阈值 0-1，默认 0.8 */
  threshold?: number
  /** 一致性规则列表 */
  rules: ConsistencyRule[]
}

/** 回归检测参数 */
export interface RegressionEvaluatorParams {
  /** 通过阈值 0-1，默认 0.9 */
  threshold?: number
  /** 需要忽略的字段路径 */
  ignorePaths?: string[]
}
