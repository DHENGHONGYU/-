/**
 * @fileoverview Store 状态契约验证器
 * @description 定义各 Store 状态的运行时契约
 *
 * 契约来源：src/store/*.ts
 */

import { z } from 'zod'

// ============================================================
// SignalState 契约定义
// ============================================================

/**
 * SignalState 契约
 * 对应类型：src/store/signalStore.ts::SignalState
 *
 * 验证信号 Store 的状态数据形状
 */
export const SignalStateSchema = z.object({
  /** 信号列表 */
  signals: z.array(z.object({
    id: z.string(),
    symbol: z.string(),
    type: z.string(),
    confidence: z.number(),
    direction: z.enum(['buy', 'sell', 'hold']),
    rationale: z.string(),
    snapshot: z.record(z.string(), z.unknown()),
    createdAt: z.number(),
  })),
  /** 加载状态 */
  loading: z.boolean(),
  /** 错误信息 */
  error: z.string().nullable(),
  /** 最后更新时间戳 */
  lastUpdated: z.number(),
  /** 是否正在刷新 */
  isRefreshing: z.boolean(),
})

/**
 * 创建符合 SignalState 契约的测试数据
 */
export function createMockSignalState(
  overrides: Partial<z.infer<typeof SignalStateSchema>> = {},
): z.infer<typeof SignalStateSchema> {
  return {
    signals: [],
    loading: false,
    error: null,
    lastUpdated: 0,
    isRefreshing: false,
    ...overrides,
  }
}

// ============================================================
// PoolState 契约定义
// ============================================================

/**
 * PoolState 契约
 * 对应类型：src/store/poolStore.ts::PoolState
 *
 * 验证股票池 Store 的状态数据形状
 */
export const PoolStateSchema = z.object({
  /** 股票池全部标的 */
  stocks: z.array(z.any()),
  /** 加载状态 */
  loading: z.boolean(),
  /** 错误信息 */
  error: z.string().nullable(),
  /** 是否正在刷新 */
  isRefreshing: z.boolean(),
  /** 最后更新时间戳 */
  lastUpdated: z.number(),
})

/**
 * 创建符合 PoolState 契约的测试数据
 */
export function createMockPoolState(
  overrides: Partial<z.infer<typeof PoolStateSchema>> = {},
): z.infer<typeof PoolStateSchema> {
  return {
    stocks: [],
    loading: false,
    error: null,
    isRefreshing: false,
    lastUpdated: 0,
    ...overrides,
  }
}

// ============================================================
// MarketDataState 契约定义
// ============================================================

/**
 * MarketDataState 契约
 * 对应类型：src/store/marketDataStore.ts::MarketDataState
 *
 * 验证市场数据 Store 的状态数据形状
 */
export const MarketDataStateSchema = z.object({
  /** 全局运行状态 */
  status: z.enum(['idle', 'loading', 'ready', 'error']),
  /** 按数据源 key 的加载状态映射 */
  dataSources: z.record(z.string(), z.any()),
  /** 合并后的完整 MarketData */
  mergedData: z.any(),
  /** 按实例 ID 的加载状态映射 */
  loadingMap: z.record(z.string(), z.boolean()),
  /** 按实例 ID 的错误映射 */
  errorMap: z.record(z.string(), z.string().nullable()),
  /** 实例 ID → taskId 的映射 */
  taskMap: z.record(z.string(), z.string()),
  /** 全局错误信息 */
  globalError: z.string().nullable(),
})

/**
 * 创建符合 MarketDataState 契约的测试数据
 */
export function createMockMarketDataState(
  overrides: Partial<z.infer<typeof MarketDataStateSchema>> = {},
): z.infer<typeof MarketDataStateSchema> {
  return {
    status: 'idle',
    dataSources: {},
    mergedData: {},
    loadingMap: {},
    errorMap: {},
    taskMap: {},
    globalError: null,
    ...overrides,
  }
}

// ============================================================
// 导出类型
// ============================================================

export type SignalStateContract = z.infer<typeof SignalStateSchema>
export type PoolStateContract = z.infer<typeof PoolStateSchema>
export type MarketDataStateContract = z.infer<typeof MarketDataStateSchema>
