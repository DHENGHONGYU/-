/**
 * @fileoverview 数据层基础类型（L0 基础层）
 *
 * 从 @/config/dbConfig re-export 核心枚举类型，并定义数据层通用泛型结果。
 * 所有其他 types.* 子文件可依赖本文件。
 *
 * @module data/types/types.dataLayer
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
 * @updated 2026-07-13 三分拆：ResearchStatus → PoolStatus/PoolType
  * @doc [V9-DOC-QA-066]
*/

import type { AccountType, DataSource, OrderDirection, OrderStatus } from '@/config/dbConfig'
import type { PoolStatus, PoolType } from '@/types/modules/pool.types'
// 从 dbConfig 重新导出，供其他模块使用
export type { AccountType, DataSource, OrderDirection, OrderStatus }
// 从 pool.types 重新导出股票池相关类型（兼容旧 ResearchStatus 调用方）
export type { PoolStatus, PoolType }
/** @deprecated 使用 PoolStatus */
export type ResearchStatus = PoolStatus

/**
 * 数据层统一结果封装。
 * 用于 DataBridge.query / DataBridge.forward 等异步操作的返回值。
 */
export interface DataLayerResult<T> {
  success: boolean
  data?: T
  error?: string
}
