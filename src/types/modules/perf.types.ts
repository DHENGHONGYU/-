/**
 * @fileoverview 性能度量类型定义
 *
 * 支撑数据处理能力测算页（P2-6）：V6 评分引擎、双策略分析、轮动检测等
 * 计算密集型任务的时序指标采集与压测报告。
 *
 * @module types/modules/perf.types
 * @created 2026-07-13
/** 单次任务性能度量 */
export interface PerfMetric {
  /** 任务名称（如 v6Score / dualStrategy / rotationDetection） */
  taskName: string
  /** 标的代码 */
  symbol: string
  /** 执行耗时（毫秒） */
  durationMs: number
  /** 开始时间戳 */
  startedAt: number
  /** 是否成功 */
  success: boolean
  /** 错误信息（失败时填充） */
  error?: string
}

/** 单次压测运行结果 */
export interface StressTestResult {
  /** 运行 ID */
  runId: string
  /** 运行时间戳 */
  timestamp: number
  /** 测试标的列表 */
  symbols: string[]
  /** 全部度量明细 */
  metrics: PerfMetric[]
  /** 总体统计摘要 */
  summary: StressTestSummary
  /** 按任务分类统计 */
  taskSummaries: Record<string, TaskStatSummary>
}

/** 总体统计摘要 */
export interface StressTestSummary {
  totalDurationMs: number
  avgPerStockMs: number
  maxMs: number
  minMs: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  successCount: number
  failCount: number
  /** 平均每只股票的 V6 评分耗时 */
  avgV6ScoreMs: number
  /** 平均每只股票的双策略耗时 */
  avgDualStrategyMs: number
  /** 平均每只股票的轮动检测耗时 */
  avgRotationDetectionMs: number
}

/** 单任务统计 */
export interface TaskStatSummary {
  taskName: string
  avgMs: number
  p95Ms: number
  minMs: number
  maxMs: number
  count: number
  successCount: number
}

/** 压测配置 */
export interface StressTestConfig {
  /** 测试标的数量（默认 20） */
  symbolCount?: number
  /** 是否包含 V6 评分（默认 true） */
  includeV6Score?: boolean
  /** 是否包含双策略分析（默认 true） */
  includeDualStrategy?: boolean
  /** 是否包含轮动检测（默认 true） */
  includeRotationDetection?: boolean
  /** 并行模式（默认 true，false 为串行兜底） */
  parallelMode?: boolean
  /** 性能门限（毫秒，超过则告警） */
  thresholdMs?: number
}

/** 压测阶段事件 */
export interface StressTestEvent {
  type: 'start' | 'symbol' | 'task' | 'complete' | 'error'
  message: string
  symbol?: string
  taskName?: string
  elapsedMs?: number
  payload?: unknown
}
