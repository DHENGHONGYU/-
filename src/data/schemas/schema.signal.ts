/**
 * @fileoverview 信号域 Zod schema（PR-2 运行时校验）
 *
 * 与 types/types.signal.ts 类型定义保持一致，用于数据输入/输出边界校验。
 *
 * @module data/schemas/schema.signal
 * @updated 2026-07-07 - PR-2：新增 Zod schema
  * @doc [V9-DOC-ARCH-007, V9-DOC-BACK-015]
*/

import { z } from 'zod'

// ============================================================
// 信号快照（技术指标）
// ============================================================

export const signalSnapshotSchema = z.object({
  pePercentile: z.number().min(0).max(100).optional(),
  pbPercentile: z.number().min(0).max(100).optional(),
  priceToMA20: z.number().optional(),
  priceToMA60: z.number().optional(),
  volumeRatio: z.number().nonnegative().optional(),
  rsi14: z.number().min(0).max(100).optional(),
  macdDirection: z.enum(['red', 'green', 'neutral']).optional(),
})

// ============================================================
// 交易信号
// ============================================================

export const signalSchema = z.object({
  id: z.string({ error: '信号 id 不能为空' }).min(1),
  symbol: z.string({ error: 'symbol 不能为空' }).min(1),
  direction: z.enum(['buy', 'sell', 'hold', 'watch']),
  type: z.string({ error: 'type 不能为空' }).min(1),
  strategy: z.string({ error: 'strategy 不能为空' }).min(1),
  confidence: z.number().min(0).max(1, { error: 'confidence 必须在 0-1 之间' }),
  rationale: z.string(),
  snapshot: signalSnapshotSchema,
  createdAt: z.number({ error: 'createdAt 不能为空' }).int().positive(),
})

// ============================================================
// 研究日志
// ============================================================

export const researchLogSchema = z.object({
  id: z.number().int().positive().optional(),
  traceId: z.string({ error: 'traceId 不能为空' }).min(1),
  timestamp: z.number({ error: 'timestamp 不能为空' }).int().positive(),
  actor: z.string({ error: 'actor 不能为空' }).min(1),
  action: z.string({ error: 'action 不能为空' }).min(1),
  targetType: z.string({ error: 'targetType 不能为空' }).min(1),
  targetCode: z.string({ error: 'targetCode 不能为空' }).min(1),
  payload: z.string().optional(),
})
