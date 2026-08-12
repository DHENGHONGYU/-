/**
 * @fileoverview 股票基础域 Zod schema（PR-2 运行时校验）
 *
 * 与 types/types.stock.ts 类型定义保持一致，用于数据输入/输出边界校验。
 *
 * @module data/schemas/schema.stock
 * @updated 2026-07-07 - PR-2：新增 Zod schema
  * @doc []
*/

import { z } from 'zod'

// ============================================================
// 数据源枚举（与 dbConfig DataSource 保持一致）
// ============================================================

export const dataSourceSchema = z.enum([
  'akshare',
  'tencent',
  'sina',
  'netease',
  'mock',
  'manual',
  'unknown',
])

/** 研究状态（与 pool.constants ResearchStatus 保持一致） */
export const researchStatusSchema = z.enum([
  'pending',
  'researching',
  'researched',
  'archived',
])

// ============================================================
// 股票数据质量
// ============================================================

export const stockDataQualitySchema = z.object({
  basic: z.boolean(),
  kline: z.boolean(),
  finance: z.boolean(),
  lastChecked: z.number().int().positive().optional(),
})

// ============================================================
// 财务报告
// ============================================================

export const financialReportSchema = z.object({
  symbol: z.string({ error: 'symbol 不能为空' }).min(1),
  reportDate: z.string({ error: 'reportDate 不能为空' }).min(1),
  revenue: z.number().optional(),
  revenueYoY: z.number().optional(),
  netProfit: z.number().optional(),
  netProfitYoY: z.number().optional(),
  grossMargin: z.number().optional(),
  netMargin: z.number().optional(),
  operatingCF: z.number().optional(),
  rdRatio: z.number().optional(),
  receivables: z.number().optional(),
  inventoryTurnoverDays: z.number().optional(),
  interestBearingDebt: z.number().optional(),
  goodwill: z.number().optional(),
  netAssets: z.number().optional(),
  shareholderPledge: z.number().optional(),
  updatedAt: z.number({ error: 'updatedAt 不能为空' }).int().positive(),
})

// ============================================================
// 股票主数据
// ============================================================

export const stockSchema = z.object({
  symbol: z.string({ error: 'symbol 不能为空' }).min(1),
  name: z.string({ error: 'name 不能为空' }).min(1),
  price: z.number().nonnegative().optional(),
  pe: z.number().optional(),
  pb: z.number().optional(),
  roe: z.number().optional(),
  marketCap: z.number().nonnegative().optional(),
  researchStatus: researchStatusSchema,
  source: dataSourceSchema,
  dataVersion: z.number().int().min(0),
  dataQuality: stockDataQualitySchema.optional(),
  ingestedAt: z.number().int().positive().optional(),
  updatedAt: z.number().int().positive().optional(),
  industryCode: z.string().optional(),
  theme: z.array(z.string()).optional(),
  sector: z.string().optional(),
  group: z.string().optional(),
})
