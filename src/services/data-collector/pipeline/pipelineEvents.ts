/**
 * @fileoverview pipelineEvents
 * @description collectionPipeline 拆分（2026-08-23 遗留问题整改 P3）：
 * 采集生命周期事件发射与 trace 广播（永不抛出，失败仅 warn）。
 *
 * @module services/data-collector/pipeline/pipelineEvents
 */

import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import type {
  CollectionTraceSpan,
  CollectionLifecycleEvent,
} from '@/types/modules/collection.types'
import { getQualityMetrics } from '../qualityMetricsCollector'
import { saveTraceRecord } from '../tracePersistenceService'

const logger = getLogger()

/** 发射采集生命周期事件（失败仅 warn，不阻塞主链路） */
export function emit(
  type: (typeof COLLECTION_EVENTS)[keyof typeof COLLECTION_EVENTS],
  params: Omit<CollectionLifecycleEvent, 'type' | 'timestamp'>,
): void {
  try {
    eventBus.emit(type, {
      ...params,
      type,
      timestamp: Date.now(),
    })
  } catch (err) {
    logger.warn('[collectionPipeline] 事件发射失败', { error: err, type })
  }
}

/** 生成单次链路 traceId */
export function traceIdFor(symbol: string, dimensionCode: string): string {
  return `trace-${dimensionCode}-${symbol}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** trace 广播 + 异步持久化（不阻塞主流程；写入成败纳入质量统计） */
export function emitTrace(span: CollectionTraceSpan): void {
  try {
    eventBus.emit('collect:trace', span)
    // 异步持久化，不阻塞主流程；但写入成败需纳入质量统计
    saveTraceRecord(span)
      .then(() => getQualityMetrics().recordWrite(true))
      .catch((err) => {
        getQualityMetrics().recordWrite(false)
        logger.warn('[collectionPipeline] trace 持久化失败', { error: err, traceId: span.traceId })
      })
  } catch (err) {
    logger.warn('[collectionPipeline] trace 广播失败', { error: err })
  }
}
