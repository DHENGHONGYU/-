/**
 * @fileoverview DataBridge 共享类型定义
 *
 * 本文件用于打破 databridge.ts 与 databridgeRouter.ts 之间的循环依赖。
 * databridgeRouter.ts 需要使用 QueryRequest 类型，而该类型原本定义在 databridge.ts 中。
 * 将共享类型提取到独立文件后，两者均可单向依赖本文件，解除循环引用。
 *
 * @module core/databridge.types
 * @since 2026-08-10 (P0-1 循环依赖修复)
 */

import { ENVELOPE_ACTION, type ModuleId, type StoreName } from '@/config/dbConfig'

/**
 * 查询请求参数
 */
export interface QueryRequest {
  /** 查询动作：queryGet/queryList/queryByIndex */
  action: typeof ENVELOPE_ACTION.queryGet | typeof ENVELOPE_ACTION.queryList | typeof ENVELOPE_ACTION.queryByIndex
  /** 目标存储 */
  store: StoreName
  /** 主键（queryGet 时必填） */
  key?: string
  /** 索引名（queryByIndex 时必填） */
  indexName?: string
  /** 索引值（queryByIndex 时必填） */
  indexValue?: unknown
  /** 调用模块 */
  source?: ModuleId
}

/**
 * 查询结果
 */
export interface QueryResult<T> {
  success: boolean
  data?: T
  error?: string
}
