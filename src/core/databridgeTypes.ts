/**
 * @fileoverview DataBridge 公共类型定义
 *
 * 从 databridge.ts 提取的公共类型，供 databridgeRouter、databridgeHandlers
 * 等模块共享，避免循环依赖。
 *
 * @doc [V9-DOC-BACK-005, V9-DOC-ARCH-008]
 */
import type { ENVELOPE_ACTION } from '@/config/dbConfig'
import type { StoreName, ModuleId } from '@/config/dbConfig'

/**
 * 查询请求参数
 */
export interface QueryRequest {
  /** 查询动作：queryGet/queryList/queryByIndex */
  action:
    | typeof ENVELOPE_ACTION.queryGet
    | typeof ENVELOPE_ACTION.queryList
    | typeof ENVELOPE_ACTION.queryByIndex
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
