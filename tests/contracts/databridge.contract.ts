/**
 * @fileoverview DataBridge 契约验证器
 * @description 定义 DataBridge 跨层数据交互的运行时契约
 *
 * 契约来源：src/types/modules/databridge.types.ts
 */

import { z } from 'zod'

// ============================================================
// DataBridge 契约定义
// ============================================================

/**
 * BridgeQueryResult 契约
 * 对应类型：src/types/modules/databridge.types.ts::BridgeQueryResult<T>
 *
 * 验证 DataBridge.query() 返回结果的数据形状
 */
export const BridgeQueryResultSchema = z.object({
  /** 是否成功 */
  success: z.boolean(),
  /** 响应数据（可选，类型由具体查询决定） */
  data: z.unknown().optional(),
  /** 错误信息（可选） */
  error: z.string().optional(),
  /** 是否来自缓存（可选） */
  fromCache: z.boolean().optional(),
  /** 追踪 ID（必填） */
  traceId: z.string().min(1, 'traceId 不能为空'),
})

/**
 * BridgeQueryOptions 契约
 * 对应类型：src/types/modules/databridge.types.ts::BridgeQueryOptions
 */
export const BridgeQueryOptionsSchema = z.object({
  /** 超时时间（毫秒，可选） */
  timeout: z.number().int().positive().optional(),
  /** 失败时是否回退到缓存（可选） */
  fallbackToCache: z.boolean().optional(),
  /** 重试次数（可选） */
  retryCount: z.number().int().nonnegative().optional(),
})

/**
 * DataBridgeAdapterConfig 契约
 * 对应类型：src/types/modules/databridge.types.ts::DataBridgeAdapterConfig
 */
export const DataBridgeAdapterConfigSchema = z.object({
  /** 是否启用降级队列（可选） */
  enableFallbackQueue: z.boolean().optional(),
  /** 默认查询超时（毫秒，可选） */
  defaultTimeout: z.number().int().positive().optional(),
})

/**
 * DataBridgeAdapterStats 契约
 * 对应类型：src/types/modules/databridge.types.ts::DataBridgeAdapterStats
 */
export const DataBridgeAdapterStatsSchema = z.object({
  /** 待处理查询数量 */
  pendingQueries: z.number().int().nonnegative(),
  /** 是否启用降级队列 */
  enableFallbackQueue: z.boolean(),
})

// ============================================================
// DataAction 枚举验证
// ============================================================

/**
 * DataAction 契约
 * 对应类型：src/types/modules/databridge.types.ts::DataAction
 */
export const DataActionSchema = z.enum([
  'FETCH_NEWS',
  'FETCH_STOCKS',
  'FETCH_SCORES',
  'FETCH_DAILY_QUOTES',
  'FETCH_INDUSTRY_SCORES',
  'FETCH_INTELLIGENT_SCORES',
  'FETCH_STRATEGY_SNAPSHOTS',
  'FETCH_LOCAL_DOCS',
  'SAVE_NEWS',
  'SAVE_STOCK',
  'SAVE_SCORE',
  'UPDATE_WATCHLIST',
  'DELETE_NEWS',
  'DELETE_STOCK',
])

// ============================================================
// 工厂函数（生成符合契约的测试数据）
// ============================================================

/**
 * 创建符合 BridgeQueryResult 契约的测试数据
 */
export function createMockBridgeQueryResult(
  overrides: Partial<z.infer<typeof BridgeQueryResultSchema>> = {},
): z.infer<typeof BridgeQueryResultSchema> {
  return {
    success: true,
    traceId: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ...overrides,
  }
}

/**
 * 创建符合 BridgeQueryOptions 契约的测试数据
 */
export function createMockBridgeQueryOptions(
  overrides: Partial<z.infer<typeof BridgeQueryOptionsSchema>> = {},
): z.infer<typeof BridgeQueryOptionsSchema> {
  return {
    timeout: 5000,
    fallbackToCache: true,
    retryCount: 3,
    ...overrides,
  }
}

// ============================================================
// 导出类型
// ============================================================

export type BridgeQueryResultContract = z.infer<typeof BridgeQueryResultSchema>
export type BridgeQueryOptionsContract = z.infer<typeof BridgeQueryOptionsSchema>
export type DataBridgeAdapterConfigContract = z.infer<typeof DataBridgeAdapterConfigSchema>
export type DataBridgeAdapterStatsContract = z.infer<typeof DataBridgeAdapterStatsSchema>
export type DataActionContract = z.infer<typeof DataActionSchema>
