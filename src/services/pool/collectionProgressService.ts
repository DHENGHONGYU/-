/**
 * @fileoverview 个股采集进度统计服务
 *
 * 从 traceRecords store 按 symbol 查询采集链路追踪记录，
 * 计算每只股票在各维度的采集完成状态与质量评分。
 *
 * 七维度：01_basic / 02_kline / 03_chip / 04_events / 05_news / 06_industry / 07_index
 *
 * @module services/pool/collectionProgressService
 * @created 2026-07-19
 */

import { dataBridge, ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/core/databridge'
import { DATA_DIMENSIONS, type DataDimensionType } from '@/config/dataDimensions'
import type { CollectionTraceSpan } from '@/types/modules/collection.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 单维度采集状态 */
export interface DimensionProgress {
  code: DataDimensionType
  name: string
  collected: boolean
  status: 'success' | 'partial' | 'fail' | 'none'
  lastCollectedAt?: number
  durationMs?: number
}

/** 个股采集进度总览 */
export interface CollectionProgress {
  symbol: string
  dimensions: DimensionProgress[]
  completedCount: number
  totalDimensions: number
  completionPercent: number
  qualityRating: 'excellent' | 'good' | 'fair' | 'poor'
}

// ============================================================
// 质量评级
// ============================================================

const ALL_DIMENSIONS = DATA_DIMENSIONS.map((d) => d.code)

function calcQualityRating(completedCount: number, total: number, hasPartial: boolean): CollectionProgress['qualityRating'] {
  const ratio = completedCount / total
  if (ratio >= 0.85 && !hasPartial) return 'excellent'
  if (ratio >= 0.7) return 'good'
  if (ratio >= 0.4) return 'fair'
  return 'poor'
}

// ============================================================
// 核心查询
// ============================================================

export async function getCollectionProgress(symbol: string): Promise<CollectionProgress> {
  try {
    const traceResult = await dataBridge.query<CollectionTraceSpan[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.traceRecords,
      indexName: 'by-symbol',
      indexValue: symbol,
      source: MODULE_ID.pool,
    })

    const traces = (traceResult.success && traceResult.data) ? traceResult.data : []

    const dimMap = new Map<DataDimensionType, CollectionTraceSpan>()
    for (const trace of traces) {
      const code = trace.dimensionCode as DataDimensionType
      if (!ALL_DIMENSIONS.includes(code)) continue
      const existing = dimMap.get(code)
      if (!existing || trace.startedAt > existing.startedAt) {
        dimMap.set(code, trace)
      }
    }

    const dimensions: DimensionProgress[] = DATA_DIMENSIONS.map((dim) => {
      const trace = dimMap.get(dim.code)
      if (!trace) {
        return { code: dim.code, name: dim.name, collected: false, status: 'none' as const }
      }
      return {
        code: dim.code,
        name: dim.name,
        collected: true,
        status: trace.result as 'success' | 'partial' | 'fail',
        lastCollectedAt: trace.completedAt ?? trace.startedAt,
        durationMs: trace.totalDurationMs,
      }
    })

    const completedCount = dimensions.filter((d) => d.status === 'success').length
    const hasPartial = dimensions.some((d) => d.status === 'partial')
    const total = dimensions.length

    return {
      symbol,
      dimensions,
      completedCount,
      totalDimensions: total,
      completionPercent: Math.round((completedCount / total) * 100),
      qualityRating: calcQualityRating(completedCount, total, hasPartial),
    }
  } catch (err) {
    logger.error('[collectionProgress] 查询失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return {
      symbol,
      dimensions: DATA_DIMENSIONS.map((dim) => ({ code: dim.code, name: dim.name, collected: false, status: 'none' as const })),
      completedCount: 0,
      totalDimensions: DATA_DIMENSIONS.length,
      completionPercent: 0,
      qualityRating: 'poor',
    }
  }
}

export async function getBatchCollectionProgress(symbols: string[]): Promise<Map<string, CollectionProgress>> {
  const results = new Map<string, CollectionProgress>()
  const promises = symbols.map(async (symbol) => {
    const progress = await getCollectionProgress(symbol)
    results.set(symbol, progress)
  })
  await Promise.all(promises)
  return results
}
