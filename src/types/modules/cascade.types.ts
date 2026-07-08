/**
 * @fileoverview 级联删除策略相关类型定义
 *
 * 与 DataBridge DeleteHandler 配套使用（见 src/core/databridgeHandlers.ts）。
 * DeleteHandler 在 db.delete() 前调用 cascadeExecutor.execute(store, id)，
 * 当级联策略为 RESTRICT 且存在依赖时抛出 CascadeError。
 */

/** 级联策略类型 */
export type CascadeStrategy = 'CASCADE' | 'RESTRICT' | 'SET_NULL' | 'SOFT_DELETE' | 'NONE'

/** 单个级联目标（被级联影响的 store 及记录数） */
export interface CascadeTarget {
  /** 受影响的 store 名称 */
  store: string
  /** 采用的级联策略 */
  strategy: CascadeStrategy
  /** 受影响的记录数 */
  affectedCount: number
}

/** 级联执行结果 */
export interface CascadeResult {
  targets: CascadeTarget[]
}

/** 级联策略阻止删除时抛出的错误（对应 RESTRICT 策略） */
export class CascadeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CascadeError'
  }
}
