/**
 * @fileoverview 数据层基础类型（L0 基础层）
 *
 * 从 @/config/dbConfig re-export 核心枚举类型，并定义数据层通用泛型结果。
 * 所有其他 types.* 子文件可依赖本文件。
 *
 * @module data/types/types.dataLayer
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
 */

import type {
  AccountType,
  DataSource,
  OrderDirection,
  OrderStatus,
  ResearchStatus,
} from '@/config/dbConfig'

// 从 dbConfig 重新导出，供其他模块使用
export type { AccountType, DataSource, OrderDirection, OrderStatus, ResearchStatus }

/**
 * 数据层统一结果封装。
 * 用于 DataBridge.query / DataBridge.forward 等异步操作的返回值。
 */
export interface DataLayerResult<T> {
  success: boolean
  data?: T
  error?: string
}
