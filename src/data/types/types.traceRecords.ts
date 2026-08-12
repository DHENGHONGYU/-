/**
 * @fileoverview 采集链路追踪记录类型
 *
 * 对应 IndexedDB `trace_records` store，持久化单次采集链路追踪段。
/** 采集生命周期阶段  * @doc [V9-DOC-QA-066]
*/
export type CollectionLifecycleStage =
  | 'triggered'
  | 'source:start'
  | 'source:success'
  | 'source:fail'
  | 'fallback'
  | 'transform'
  | 'write:start'
  | 'write:success'
  | 'write:fail'
  | 'complete'
  | 'task:status'

/** 数据源标识 */
export type QuoteDataSourceId = 'tencent' | 'sina' | 'netease' | 'akshare' | 'mock'

/** 采集阶段记录 */
export interface CollectionStageRecord {
  stage: CollectionLifecycleStage
  sourceId?: QuoteDataSourceId
  timestamp: number
  durationMs?: number
  message: string
  error?: string
}

/** 单次采集链路追踪段 */
export interface CollectionTraceSpan {
  /** 追踪 ID */
  traceId: string
  /** 任务 ID */
  taskId?: string
  /** 维度 code */
  dimensionCode: string
  /** 标的代码 */
  symbol: string
  /** 各阶段记录 */
  stages: CollectionStageRecord[]
  /** 最终结果 */
  result: 'success' | 'fail' | 'partial'
  /** 总耗时（毫秒） */
  totalDurationMs: number
  /** 单次耗时（毫秒，简化版查询用） */
  durationMs?: number
  /** 附加元数据 */
  metadata?: Record<string, unknown>
  /** 最终数据源 */
  finalSource?: QuoteDataSourceId
  /** 降级次数 */
  fallbackCount: number
  /** 错误信息 */
  error?: string
  /** 开始时间 */
  startedAt: number
  /** 完成时间 */
  completedAt?: number
}
