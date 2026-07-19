/**
 * V9 基础类型定义
 *
 * @description
 * 本文件定义跨模块通用的基础泛型接口与工具类型。
 * 所有模块的 IOModule 契约均基于此处的泛型基类扩展。
 *
 * @module types/base
 * @created 2026-06-28 - P1-4 IOModule 泛型化改造
  * @doc [V9-DOC-QA-066]
*/

// ============================================================
// IO Module 泛型基类
// ============================================================

/**
 * 模块 IO 契约泛型基类
 *
 * @description
 * 所有遵循"输入-输出"模式的模块均应基于此泛型接口扩展。
 * 泛型参数 TInput 为输入类型，TOutput 为输出类型。
 *
 * @example
 * ```ts
 * interface WidgetIOModule extends IOModuleBase<WidgetModuleInput, WidgetModuleOutput> {}
 * ```
 */
export interface IOModuleBase<TInput = unknown, TOutput = unknown> {
  input: TInput
  output: TOutput
}

// ============================================================
// 通用工具类型
// ============================================================

/** 可空类型 */
export type Nullable<T> = T | null | undefined

/** 异步返回值 */
export type AsyncResult<T> = Promise<{ success: boolean; data?: T; error?: string }>

/** 分页参数 */
export interface PaginationParams {
  page: number
  pageSize: number
}

/** 分页结果 */
export interface PaginatedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 时间范围 */
export interface TimeRange {
  start: number
  end: number
}

/** 排序选项 */
export interface SortOption {
  field: string
  order: 'asc' | 'desc'
}
