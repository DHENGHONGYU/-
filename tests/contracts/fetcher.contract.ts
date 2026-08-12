/**
 * @fileoverview 外部 API 响应契约验证器
 * @description 定义数据采集模块外部 API 响应的运行时契约
 *
 * 契约来源：src/services/fetcher/fetcherTypes.ts
 */

import { z } from 'zod'

// ============================================================
// 外部 API 响应契约定义
// ============================================================

/**
 * CollectResponse 契约
 * 对应类型：src/services/fetcher/fetcherTypes.ts::CollectResponse<T>
 *
 * 验证数据采集模块 API 响应的数据形状
 */
export const CollectResponseSchema = <T extends z.ZodTypeAny>(dataType: T) =>
  z.object({
    /** 是否成功 */
    success: z.boolean(),
    /** 股票代码 */
    symbol: z.string(),
    /** 数据维度 */
    dimension: z.string(),
    /** 响应数据（可以是任意类型或 null） */
    data: z.union([dataType, z.null()]),
    /** 记录数 */
    records: z.number().int().nonnegative(),
    /** 错误信息（可以是字符串或 null） */
    error: z.union([z.string(), z.null()]),
    /** 获取时间（ISO 8601 格式） */
    fetched_at: z.string(),
  })

/**
 * HealthCheckResponse 契约
 * 对应类型：src/services/fetcher/fetcherTypes.ts::HealthCheckResponse
 */
export const HealthCheckResponseSchema = z.object({
  /** 服务状态 */
  status: z.enum(['ok', 'error']),
  /** 服务名称 */
  service: z.string(),
  /** 版本号（可选） */
  version: z.string().optional(),
  /** 错误信息（可选） */
  error: z.string().optional(),
})

/**
 * CollectBasicData 契约
 * 对应类型：src/services/fetcher/fetcherTypes.ts::CollectBasicData
 */
export const CollectBasicDataSchema = z.object({
  /** 股票名称（可选） */
  name: z.string().optional(),
  /** 当前价格（可选） */
  price: z.number().optional(),
  /** 市盈率（可选） */
  pe: z.number().optional(),
  /** 市净率（可选） */
  pb: z.number().optional(),
  /** 净资产收益率（可选） */
  roe: z.number().optional(),
  /** 市值（可选） */
  market_cap: z.number().optional(),
})

/**
 * CollectKlineData 契约
 * 对应类型：src/services/fetcher/fetcherTypes.ts::CollectKlineData
 */
export const CollectKlineDataSchema = z.object({
  /** 最新 K 线数据（可选） */
  latest: z
    .object({
      date: z.string(),
      open: z.number(),
      high: z.number(),
      low: z.number(),
      close: z.number(),
      volume: z.number(),
      amount: z.number(),
    })
    .optional(),
  /** 历史 K 线数据（可选） */
  history: z
    .array(
      z.object({
        date: z.string(),
        open: z.number(),
        high: z.number(),
        low: z.number(),
        close: z.number(),
        volume: z.number(),
        amount: z.number(),
      }),
    )
    .optional(),
})

// ============================================================
// 工厂函数（生成符合契约的测试数据）
// ============================================================

/**
 * 创建符合 CollectResponse 契约的测试数据
 */
export function createMockCollectResponse<T extends z.ZodTypeAny>(
  _dataType: T,
  overrides: {
    success?: boolean
    symbol?: string
    dimension?: string
    data?: z.infer<T> | null
    records?: number
    error?: string | null
    fetched_at?: string
  } = {},
): z.infer<ReturnType<typeof CollectResponseSchema<T>>> {
  return {
    success: overrides.success ?? true,
    symbol: overrides.symbol ?? '000001.SZ',
    dimension: overrides.dimension ?? 'basic',
    data: overrides.data ?? null,
    records: overrides.records ?? 0,
    error: overrides.error ?? null,
    fetched_at: overrides.fetched_at ?? new Date().toISOString(),
  } as z.infer<ReturnType<typeof CollectResponseSchema<T>>>
}

/**
 * 创建符合 HealthCheckResponse 契约的测试数据
 */
export function createMockHealthCheckResponse(
  overrides: Partial<z.infer<typeof HealthCheckResponseSchema>> = {},
): z.infer<typeof HealthCheckResponseSchema> {
  return {
    status: 'ok',
    service: 'test-service',
    version: '1.0.0',
    ...overrides,
  }
}

/**
 * 创建符合 CollectBasicData 契约的测试数据
 */
export function createMockCollectBasicData(
  overrides: Partial<z.infer<typeof CollectBasicDataSchema>> = {},
): z.infer<typeof CollectBasicDataSchema> {
  return {
    name: '测试股票',
    price: 10.5,
    pe: 15.2,
    pb: 1.8,
    roe: 12.5,
    market_cap: 10000000000,
    ...overrides,
  }
}

// ============================================================
// 导出类型
// ============================================================

export type HealthCheckResponseContract = z.infer<typeof HealthCheckResponseSchema>
export type CollectBasicDataContract = z.infer<typeof CollectBasicDataSchema>
export type CollectKlineDataContract = z.infer<typeof CollectKlineDataSchema>
