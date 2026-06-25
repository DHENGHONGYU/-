/**
 * @module DataBridgeTypes
 * @lifecycle @Global
 * @description DataBridge 扩展适配层类型契约
 */

/** DataBridgeAdapter 配置 */
export interface DataBridgeAdapterConfig {
  /** 是否启用降级队列 */
  enableFallbackQueue?: boolean
  /** 默认查询超时（毫秒） */
  defaultTimeout?: number
}

/** 数据操作动作枚举 */
export type DataAction =
  | 'FETCH_NEWS'
  | 'FETCH_STOCKS'
  | 'FETCH_SCORES'
  | 'FETCH_DAILY_QUOTES'
  | 'FETCH_INDUSTRY_SCORES'
  | 'FETCH_INTELLIGENT_SCORES'
  | 'FETCH_STRATEGY_SNAPSHOTS'
  | 'FETCH_LOCAL_DOCS'
  | 'SAVE_NEWS'
  | 'SAVE_STOCK'
  | 'SAVE_SCORE'
  | 'UPDATE_WATCHLIST'
  | 'DELETE_NEWS'
  | 'DELETE_STOCK'

/** 查询选项 */
export interface BridgeQueryOptions {
  /** 超时时间（毫秒） */
  timeout?: number
  /** 失败时是否回退到缓存 */
  fallbackToCache?: boolean
  /** 重试次数 */
  retryCount?: number
}

/** 查询结果泛型结构 */
export interface BridgeQueryResult<T = unknown> {
  /** 是否成功 */
  success: boolean
  /** 响应数据 */
  data?: T
  /** 错误信息 */
  error?: string
  /** 是否来自缓存 */
  fromCache?: boolean
  /** 追踪 ID */
  traceId: string
}

/** Adapter 统计快照 */
export interface DataBridgeAdapterStats {
  /** 待处理查询数量 */
  pendingQueries: number
  /** 是否启用降级队列 */
  enableFallbackQueue: boolean
}
