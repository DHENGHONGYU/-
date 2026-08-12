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

/**
 * 维度编码映射表：采集链路写入 traceRecords 使用两数字编码（'01'~'08'），
 * 但进度展示组件 dataDimensions 定义使用下划线完整编码（'01_basic'等）。
 * 建立双向映射，确保采集数据能正确匹配到进度展示。
 *
 * 对应关系（与 dataDimensions.ts 一致，去除 '08_research' 为七维度）：
 *   01 ↔ 01_basic   | 02 ↔ 02_kline    | 03 ↔ 03_chip
 *   04 ↔ 04_events  | 05 ↔ 05_news     | 06 ↔ 06_industry
 *   07 ↔ 07_index
 */
const NUMERIC_TO_FULL: Readonly<Record<string, DataDimensionType>> = {
  '01': '01_basic',
  '02': '02_kline',
  '03': '03_chip',
  '04': '04_events',
  '05': '05_news',
  '06': '06_industry',
  '07': '07_index',
}

const FULL_TO_NUMERIC: Readonly<Record<DataDimensionType, string>> = DATA_DIMENSIONS.reduce(
  (acc, dim) => {
    const numeric = dim.code.slice(0, 2)
    acc[dim.code] = numeric
    return acc
  },
  {} as Record<DataDimensionType, string>,
)

/** 将采集链路写入的两数字维度编码归一化为完整编码 */
export function normalizeDimensionCode(code: string): DataDimensionType | null {
  // 已为完整编码直接返回
  if ((DATA_DIMENSIONS as Array<{ code: string }>).some((d) => d.code === code)) {
    return code as DataDimensionType
  }
  // 两数字编码 → 映射为完整编码
  const mapped = NUMERIC_TO_FULL[code]
  if (mapped) return mapped
  // 尝试取前两位做兜底匹配
  const prefix = code.slice(0, 2)
  return NUMERIC_TO_FULL[prefix] ?? null
}

/** 将完整维度编码转换为采集链路使用的两数字编码 */
export function dimensionCodeToNumeric(fullCode: DataDimensionType): string {
  return FULL_TO_NUMERIC[fullCode] ?? fullCode.slice(0, 2)
}

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

/** 批次信息 */
export interface BatchInfo {
  parentTaskId: string
  startedAt: number
  successCount: number
  failCount: number
  totalCount: number
  isLatest: boolean
  hasSuccess: boolean
}

/** 个股采集进度总览 */
export interface CollectionProgress {
  symbol: string
  dimensions: DimensionProgress[]
  completedCount: number
  totalDimensions: number
  completionPercent: number
  qualityRating: 'excellent' | 'good' | 'fair' | 'poor'
  /** 最近一次采集批次信息（可能为失败批次） */
  lastBatch: BatchInfo | null
  /** 当前显示的进度是否来自历史成功批次（最近批次完全失败时为 true） */
  isFromHistoricalBatch: boolean
}

// ============================================================
// 质量评级
// ============================================================

function calcQualityRating(completedCount: number, total: number, hasPartial: boolean): CollectionProgress['qualityRating'] {
  const ratio = completedCount / total
  if (ratio >= 0.85 && !hasPartial) return 'excellent'
  if (ratio >= 0.7) return 'good'
  if (ratio >= 0.4) return 'fair'
  return 'poor'
}

// ============================================================
// 批次级智能选择
// ============================================================

interface BatchGroup {
  parentTaskId: string
  startedAt: number
  traces: CollectionTraceSpan[]
  successCount: number
  failCount: number
  totalCount: number
}

function groupTracesByBatch(traces: CollectionTraceSpan[]): BatchGroup[] {
  const batchMap = new Map<string, BatchGroup>()

  for (const trace of traces) {
    const batchId = trace.parentTaskId ?? `__single__${trace.traceId}`
    let batch = batchMap.get(batchId)
    if (!batch) {
      batch = {
        parentTaskId: batchId,
        startedAt: trace.startedAt,
        traces: [],
        successCount: 0,
        failCount: 0,
        totalCount: 0,
      }
      batchMap.set(batchId, batch)
    }
    batch.traces.push(trace)
    batch.totalCount++
    if (trace.result === 'success') batch.successCount++
    else if (trace.result === 'fail') batch.failCount++
    if (trace.startedAt < batch.startedAt) batch.startedAt = trace.startedAt
  }

  // 按 startedAt 降序排列（最新批次在前）
  return Array.from(batchMap.values()).sort((a, b) => b.startedAt - a.startedAt)
}

function selectBestBatch(batches: BatchGroup[]): { batch: BatchGroup; isFromHistorical: boolean } | null {
  if (batches.length === 0) return null

  // 最新批次有成功记录 → 直接使用
  const latest = batches[0]!
  if (latest.successCount > 0) {
    return { batch: latest, isFromHistorical: false }
  }

  // 最新批次完全失败 → 回溯查找最近有成功记录的批次
  for (let i = 1; i < batches.length; i++) {
    const candidate = batches[i]!
    if (candidate.successCount > 0) {
      logger.info('[collectionProgress] 最新批次完全失败，回溯至历史成功批次', {
        latestBatch: latest.parentTaskId,
        fallbackBatch: candidate.parentTaskId,
        latestFailCount: latest.failCount,
      })
      return { batch: candidate, isFromHistorical: true }
    }
  }

  // 所有批次都无成功记录 → 使用最新批次（全失败）
  return { batch: latest, isFromHistorical: false }
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

    // 按批次分组并智能选择最佳批次
    const batches = groupTracesByBatch(traces)
    const selected = selectBestBatch(batches)

    // 构建维度映射（来自选中批次的 trace）
    const dimMap = new Map<DataDimensionType, CollectionTraceSpan>()
    if (selected) {
      for (const trace of selected.batch.traces) {
        const code = normalizeDimensionCode(trace.dimensionCode)
        if (!code) continue
        const existing = dimMap.get(code)
        if (!existing || trace.startedAt > existing.startedAt) {
          dimMap.set(code, trace)
        }
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

    // 构建批次信息
    const lastBatch: BatchInfo | null = batches.length > 0 ? {
      parentTaskId: batches[0]!.parentTaskId,
      startedAt: batches[0]!.startedAt,
      successCount: batches[0]!.successCount,
      failCount: batches[0]!.failCount,
      totalCount: batches[0]!.totalCount,
      isLatest: true,
      hasSuccess: batches[0]!.successCount > 0,
    } : null

    return {
      symbol,
      dimensions,
      completedCount,
      totalDimensions: total,
      completionPercent: Math.round((completedCount / total) * 100),
      qualityRating: calcQualityRating(completedCount, total, hasPartial),
      lastBatch,
      isFromHistoricalBatch: selected?.isFromHistorical ?? false,
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
      lastBatch: null,
      isFromHistoricalBatch: false,
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
