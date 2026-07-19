/**
 * @fileoverview 行情数据域 Zod schema（PR-2 运行时校验）
 *
 * 与 types/types.marketData.ts 类型定义保持一致，用于数据输入/输出边界校验。
 *
 * @module data/schemas/schema.marketData
 * @updated 2026-07-07 - PR-2：新增 Zod schema
  * @doc []
*/

import { z } from 'zod'

// ============================================================
// 单根 K 线
// ============================================================

export const klineBarSchema = z.object({
  date: z.string({ error: 'date 不能为空' }).min(1),
  open: z.number({ error: 'open 必须为数字' }).nonnegative('open 不能为负'),
  high: z.number({ error: 'high 必须为数字' }).nonnegative('high 不能为负'),
  low: z.number({ error: 'low 必须为数字' }).nonnegative('low 不能为负'),
  close: z.number({ error: 'close 必须为数字' }).nonnegative('close 不能为负'),
  volume: z.number({ error: 'volume 必须为数字' }).nonnegative('volume 不能为负'),
  amount: z.number({ error: 'amount 必须为数字' }).nonnegative('amount 不能为负'),
})

// ============================================================
// 日线行情（含历史）
// ============================================================

export const dailyQuotesSchema = z.object({
  symbol: z.string({ error: 'symbol 不能为空' }).min(1),
  latest: klineBarSchema,
  history: z.array(klineBarSchema),
  period: z.string({ error: 'period 不能为空' }).min(1),
  adjust: z.string({ error: 'adjust 不能为空' }).min(1),
  updatedAt: z.number({ error: 'updatedAt 不能为空' }).int().positive(),
})
