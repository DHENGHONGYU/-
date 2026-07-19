/**
 * @module tracePersistenceService
 * @description 采集链路追踪持久化服务。
 *
 * 负责将 `CollectionTraceSpan` 写入/读取 IndexedDB 的 `trace_records` store，
 * 所有操作通过 `DataBridge` 完成，禁止 service 直接写 DB。
 */

import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID, ENVELOPE_TARGET } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import type { CollectionTraceSpan } from '@/types/modules/collection.types'

const logger = getLogger()

interface TraceRecord extends CollectionTraceSpan {
  persistedAt: number
}

/**
 * 保存单条 trace 记录。
 * @param span 采集链路追踪对象
 */
export async function saveTraceRecord(span: CollectionTraceSpan): Promise<void> {
  try {
    await dataBridge.forward({
      meta: {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveTraceRecord,
        traceId: span.traceId,
        timestamp: Date.now(),
      },
      payload: {
        ...span,
        persistedAt: Date.now(),
      } satisfies TraceRecord,
    })
    logger.info('[tracePersistenceService] trace 持久化成功', { traceId: span.traceId })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logger.error('[tracePersistenceService] trace 持久化失败', { traceId: span.traceId, error })
    throw err
  }
}

/**
 * 批量保存 trace 记录。
 * @param spans 采集链路追踪对象列表
 */
export async function saveTraceRecords(spans: CollectionTraceSpan[]): Promise<void> {
  await Promise.all(spans.map((span) => saveTraceRecord(span)))
}

interface QueryTracesOptions {
  /** 按标的过滤 */
  symbol?: string
  /** 按维度过滤 */
  dimensionCode?: string
  /** 按结果过滤 */
  result?: CollectionTraceSpan['result']
  /** 最大返回条数，默认 100 */
  limit?: number
  /** 最早时间戳（毫秒），默认 7 天前 */
  since?: number
}

/**
 * 查询历史 trace 记录，按 startedAt 降序。
 */
export async function queryTraceRecords(options: QueryTracesOptions = {}): Promise<CollectionTraceSpan[]> {
  const { symbol, dimensionCode, result, limit = 100, since = Date.now() - 7 * 24 * 60 * 60 * 1000 } = options

  try {
    const response = await dataBridge.query<TraceRecord[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.traceRecords,
      source: MODULE_ID.fetcher,
    })

    const records = Array.isArray(response?.data) ? response.data : []
    const filtered = records
      .filter((record) => record.startedAt >= since)
      .filter((record) => (symbol ? record.symbol === symbol : true))
      .filter((record) => (dimensionCode ? record.dimensionCode === dimensionCode : true))
      .filter((record) => (result ? record.result === result : true))
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit)

    return filtered.map((record) => {
      const span = { ...record }
      delete (span as Record<string, unknown>).persistedAt
      return span
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logger.error('[tracePersistenceService] 查询 trace 失败', { error })
    return []
  }
}

/**
 * 根据 traceId 查询单条记录。
 */
export async function getTraceRecord(traceId: string): Promise<CollectionTraceSpan | undefined> {
  try {
    const response = await dataBridge.query<TraceRecord>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.traceRecords,
      source: MODULE_ID.fetcher,
      key: traceId,
    })
    const record = response?.data
    if (!record) return undefined
    const span = { ...record }
    delete (span as Record<string, unknown>).persistedAt
    return span
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logger.error('[tracePersistenceService] 查询单条 trace 失败', { traceId, error })
    return undefined
  }
}
