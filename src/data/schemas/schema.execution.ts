/**
 * @fileoverview 执行计划域 Zod schema（PR-2 运行时校验）
 *
 * 与 types/types.execution.ts 类型定义保持一致，用于数据输入/输出边界校验。
 *
 * Zod v4 语法参考：src/data/queryBuilder.ts
 *
 * @module data/schemas/schema.execution
 * @updated 2026-07-07 - PR-2：新增 Zod schema
  * @doc []
*/

import { z } from 'zod'
import { EXECUTION_PHASE } from '@/constants/execution.constants'

// ============================================================
// 基础枚举 schema（从常量推导，消除不一致风险）
// ============================================================

/** 执行计划阶段（从 EXECUTION_PHASE 常量推导，确保与常量一致） */
export const executionPhaseSchema = z.enum([
  EXECUTION_PHASE.PLAN,
  EXECUTION_PHASE.CONFIRMED,
  EXECUTION_PHASE.PENDING,
  EXECUTION_PHASE.EXECUTED,
  EXECUTION_PHASE.CANCELLED,
  EXECUTION_PHASE.REVIEWED,
])

/** 风险检查严重等级 */
export const riskSeveritySchema = z.enum([
  'low',
  'medium',
  'high',
  'blocker',
  'warning',
  'info',
])

/** 执行计划方向 */
export const executionDirectionSchema = z.enum(['buy', 'sell'])

/** 执行结果 */
export const executionResultSchema = z.enum(['success', 'failed', 'partial'])

// ============================================================
// 风险检查项
// ============================================================

export const riskCheckItemSchema = z.object({
  id: z.string({ error: '风险检查项 id 不能为空' }).min(1),
  name: z.string({ error: '风险检查项 name 不能为空' }).min(1),
  label: z.string({ error: '风险检查项 label 不能为空' }).min(1),
  passed: z.boolean(),
  detail: z.string(),
  message: z.string(),
  severity: riskSeveritySchema,
})

// ============================================================
// 执行计划
// ============================================================

export const executionPlanSchema = z.object({
  id: z.string({ error: '执行计划 id 不能为空' }).min(1),
  signalId: z.string().optional(),
  symbol: z.string({ error: 'symbol 不能为空' }).min(1),
  name: z.string({ error: '执行计划 name 不能为空' }).min(1),
  phase: executionPhaseSchema,
  direction: executionDirectionSchema,
  quantity: z.number({ error: 'quantity 必须为数字' }).positive('quantity 必须为正数'),
  targetPrice: z.number({ error: 'targetPrice 必须为数字' }).positive('targetPrice 必须为正数'),
  currentPrice: z.number().positive().optional(),
  rationale: z.string(),
  confidence: z.number().min(0).max(1, { error: 'confidence 必须在 0-1 之间' }),
  riskChecks: z.array(riskCheckItemSchema),
  risk: z
    .object({
      passed: z.boolean(),
      preCheck: z.boolean(),
      postCheck: z.boolean(),
      issueCount: z.number().int().min(0),
      checks: z.array(riskCheckItemSchema),
      warnings: z.array(z.string()).optional(),
    })
    .optional(),
  sizing: z
    .object({
      quantity: z.number().positive(),
      positionPct: z.number().min(0).max(100),
      reason: z.string().optional(),
    })
    .optional(),
  result: executionResultSchema.optional(),
  orderId: z.string().optional(),
  errorMessage: z.string().optional(),
  accountType: z.string().optional(),
  confirmedAt: z.number().int().positive().optional(),
  executedAt: z.number().int().positive().optional(),
  reviewedAt: z.number().int().positive().optional(),
  createdAt: z.number({ error: 'createdAt 不能为空' }).int().positive(),
  updatedAt: z.number().int().positive().optional(),
})

// ============================================================
// 执行日志
// ============================================================

export const executionLogSchema = z.object({
  id: z.string({ error: '日志 id 不能为空' }).min(1),
  planId: z.string({ error: 'planId 不能为空' }).min(1),
  symbol: z.string({ error: 'symbol 不能为空' }).min(1),
  action: z.string(),
  actor: z.string().optional(),
  phase: executionPhaseSchema,
  timestamp: z.number({ error: 'timestamp 不能为空' }).int().positive(),
  detail: z.string().optional(),
  success: z.boolean().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.number({ error: 'createdAt 不能为空' }).int().positive(),
})

// ============================================================
// 缺失报告
// ============================================================

export const missingReportSchema = z.object({
  id: z.string({ error: '报告 id 不能为空' }).min(1),
  symbol: z.string({ error: 'symbol 不能为空' }).min(1),
  reportType: z.string(),
  severity: z.string(),
  reason: z.string(),
  createdAt: z.number().int().positive().optional(),
})
