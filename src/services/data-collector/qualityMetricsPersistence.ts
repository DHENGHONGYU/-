/**
 * @fileoverview 采集质量指标历史持久化服务（v37 新增，P0-2 整改）
 *
 * 职责：
 * - 将 QualityMetricsCollector 的内存快照固化为 quality_metrics_history 记录
 * - 通过 DataBridge.forward() 写入 IndexedDB（MODULE_ID.fetcher → saveQualityMetricsHistory）
 *
 * 设计：
 * - 采集周期收尾（无论成功/失败/部分失败）调用一次，保证每轮采集都留下质量足迹
 * - 写入失败仅记日志、不阻塞主链路（与本地文件落盘同一原则）
 * - 空窗口（totalCollects=0 且 writeTotal=0）跳过，避免污染趋势
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import { getQualityMetrics } from './qualityMetricsCollector'
import type { QualityMetricsHistoryRecord } from '@/data/types/types.qualityMetricsHistory'

const logger = getLogger()

/**
 * 将当前质量指标快照持久化到 quality_metrics_history。
 *
 * @param opts.reason 采集收尾场景标签（如 'collection-complete' / 'collection-partial-fail'），
 *   附加到记录便于趋势归因（可选）
 * @returns 是否实际写入（空窗口或写入失败均返回 false）
 */
export async function persistQualitySnapshot(opts?: { reason?: string }): Promise<boolean> {
  const metrics = getQualityMetrics().snapshot()

  // 空窗口跳过：既无采集也无写入，说明本轮没有产生任何质量数据
  if (metrics.totalCollects === 0 && metrics.writeTotal === 0) {
    logger.debug('[QualityMetricsPersistence] 空窗口，跳过快照持久化', {
      reason: opts?.reason,
    })
    return false
  }

  const capturedAt = Date.now()
  const record: QualityMetricsHistoryRecord = {
    id: `qmh-${capturedAt}`,
    capturedAt,
    since: metrics.since,
    totalCollects: metrics.totalCollects,
    successCollects: metrics.successCollects,
    mockCollects: metrics.mockCollects,
    mockSuccesses: metrics.mockSuccesses,
    successRate: metrics.successRate,
    realSuccessRate: metrics.realSuccessRate,
    completeness: metrics.completeness,
    sourceCounts: { ...metrics.sourceCounts },
    fallbackCount: metrics.fallbackCount,
    writeSuccess: metrics.writeSuccess,
    writeTotal: metrics.writeTotal,
    writeRate: metrics.writeRate,
    mockWrites: metrics.mockWrites,
    avgLatency: metrics.avgLatency,
    totalLatency: metrics.totalLatency,
    ...(metrics.lastError ? { lastError: metrics.lastError } : {}),
  }

  try {
    await dataBridge.forward({
      meta: {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveQualityMetricsHistory,
        traceId: `quality-snapshot-${capturedAt}`,
        timestamp: Date.now(),
      },
      payload: record,
    })
    logger.info('[QualityMetricsPersistence] 质量指标快照已持久化', {
      id: record.id,
      reason: opts?.reason,
      totalCollects: record.totalCollects,
      realSuccessRate: record.realSuccessRate,
      completeness: record.completeness,
    })
    return true
  } catch (err) {
    // 写入失败不阻塞主链路，仅记录日志
    logger.warn('[QualityMetricsPersistence] 质量指标快照持久化失败（不阻塞）', {
      error: err instanceof Error ? err.message : String(err),
      id: record.id,
    })
    return false
  }
}
