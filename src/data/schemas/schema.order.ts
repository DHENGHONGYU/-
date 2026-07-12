/**
 * @fileoverview 订单/观察列表域 Zod schema（PR-2 运行时校验）
 *
 * 与 types/types.order.ts 类型定义保持一致，用于数据输入/输出边界校验。
 *
 * @module data/schemas/schema.order
 * @updated 2026-07-07 - PR-2：新增 Zod schema
 */

import { z } from 'zod'

// ============================================================
// 基础枚举（与 dbConfig 保持一致）
// ============================================================

/** 订单方向（与 dbConfig OrderDirection 一致） */
export const orderDirectionSchema = z.enum(['buy', 'sell'])

/** 订单状态（与 dbConfig OrderStatus 一致） */
export const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'partial_filled',
  'filled',
  'cancelled',
  'rejected',
])

/** 账户类型（与 dbConfig AccountType 一致） */
export const accountTypeSchema = z.enum(['real', 'simulated', 'backtest'])

// ============================================================
// 交易订单
// ============================================================

export const orderSchema = z.object({
  id: z.string({ error: '订单 id 不能为空' }).min(1),
  symbol: z.string({ error: 'symbol 不能为空' }).min(1),
  direction: orderDirectionSchema,
  quantity: z.number({ error: 'quantity 必须为数字' }).positive('quantity 必须为正数'),
  price: z.number({ error: 'price 必须为数字' }).positive('price 必须为正数'),
  amount: z.number({ error: 'amount 必须为数字' }).nonnegative('amount 不能为负'),
  status: orderStatusSchema,
  accountType: accountTypeSchema,
  createdAt: z.number({ error: 'createdAt 不能为空' }).int().positive(),
})

// ============================================================
// 观察列表
// ============================================================

export const watchlistSchema = z.object({
  id: z.string({ error: '观察列表 id 不能为空' }).min(1),
  name: z.string({ error: '观察列表 name 不能为空' }).min(1),
  items: z.array(z.string()),
  createdAt: z.number({ error: 'createdAt 不能为空' }).int().positive(),
  updatedAt: z.number({ error: 'updatedAt 不能为空' }).int().positive(),
})
