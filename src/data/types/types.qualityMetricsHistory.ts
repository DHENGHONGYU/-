/**
 * @fileoverview 采集质量指标历史持久化类型（v37 新增，P0-2 整改）
 *
 * quality_metrics_history store 的记录类型。
 * 每次采集周期结束时，将 QualityMetricsCollector 的快照固化一条记录，
 * 解决质量指标纯内存、刷新即丢的问题，支撑 KPI 历史趋势与质量回归对比。
 *
 * 存储约定：
 * - keyPath: id（由采集器生成，形如 `qmh-${capturedAt}`）
 * - 索引: by-captured-at（capturedAt，用于按时间倒序读取趋势）
 * - 写入方: 采集管线收尾（MODULE_ID.fetcher → DataBridge.forward）
 */

import type { QuoteDataSourceId } from '@/types/modules/collection.types'

/** 与 QualityMetrics.sourceCounts 同源类型：报价链源 + MCP 多维源 */
export type QualityMetricsSourceKey = QuoteDataSourceId | 'westock' | 'tencentnews'

/**
 * 采集质量指标历史快照记录
 *
 * 字段与 QualityMetrics 一一对应，额外附加存储主键与捕获时间戳。
 */
export interface QualityMetricsHistoryRecord {
  /** 存储主键，形如 `qmh-${capturedAt}` */
  id: string
  /** 快照捕获时间戳（ms） */
  capturedAt: number
  /** 时间窗口起始 */
  since: number
  /** 采集总次数 */
  totalCollects: number
  /** 采集成功次数（含 mock） */
  successCollects: number
  /** mock 采集次数 */
  mockCollects: number
  /** mock 采集成功次数 */
  mockSuccesses: number
  /** 采集成功率（含 mock，0-100） */
  successRate: number
  /** 真实数据源采集成功率（排除 mock，0-100） */
  realSuccessRate: number
  /** 数据完整率（0-100） */
  completeness: number
  /** 各数据源使用次数（动态递增，无需全量 key） */
  sourceCounts: Partial<Record<QualityMetricsSourceKey, number>>
  /** 降级次数 */
  fallbackCount: number
  /** 写入成功次数 */
  writeSuccess: number
  /** 写入总次数 */
  writeTotal: number
  /** 写入成功率（0-100） */
  writeRate: number
  /** mock 写入次数 */
  mockWrites: number
  /** 平均延迟 (ms) */
  avgLatency: number
  /** 总延迟 (ms) */
  totalLatency: number
  /** 最后一次错误（可选） */
  lastError?: string
}
