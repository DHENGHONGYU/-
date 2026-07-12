/**
 * @fileoverview 评分域 Zod schema（PR-2 运行时校验）
 *
 * 与 types/types.score.ts 类型定义保持一致，用于数据输入/输出边界校验。
 *
 * @module data/schemas/schema.score
 * @updated 2026-07-07 - PR-2：新增 Zod schema
 */

import { z } from 'zod'

// ============================================================
// V6 评分结果
// ============================================================

/** V6 评级枚举 */
export const v6RatingSchema = z.enum([
  'strong_buy',
  'buy',
  'hold',
  'sell',
  'strong_sell',
])

/** 单层评分明细 */
export const layerDetailSchema = z.object({
  score: z.number({ error: 'score 必须为数字' }),
  summary: z.string(),
  weight: z.number({ error: 'weight 必须为数字' }),
})

export const v6ScoreSchema = z.object({
  symbol: z.string({ error: 'symbol 不能为空' }).min(1),
  score: z.number({ error: 'score 必须为数字' }),
  factors: z.record(z.string(), z.number()),
  algorithmVersion: z.string({ error: 'algorithmVersion 不能为空' }).min(1),
  calculatedAt: z.number({ error: 'calculatedAt 不能为空' }).int().positive(),
  dataVersion: z.number().int().min(0),
  qualityWarning: z.string().optional(),
  rating: v6RatingSchema.optional(),
  layerDetails: z.record(z.string(), layerDetailSchema).optional(),
  allRisks: z.array(z.string()).optional(),
  recommendation: z.string().optional(),
  engineVersion: z.string().optional(),
})

// ============================================================
// 智能评分维度
// ============================================================

export const dimensionScoreSchema = z.object({
  name: z.string({ error: '维度 name 不能为空' }).min(1),
  score: z.number().nullable(),
  rationale: z.string(),
  evidence: z.array(z.string()),
  weight: z.number({ error: 'weight 必须为数字' }),
})
