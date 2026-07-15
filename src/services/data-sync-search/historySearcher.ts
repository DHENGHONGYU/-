/**
 * @fileoverview 历史记录检索器
 *
 * 从 IndexedDB collection_history store 检索采集/更新历史记录，
 * 支持关键词、时间范围、通道、标的、维度、状态等多条件筛选。
 *
 * @module services/data-sync-search/historySearcher
 * @created 2026-07-14 - 双通道整改 P2-2
 */

import { getLogger } from '@/lib/logger'
import type { CollectionHistoryEntry, SearchCriteria, SearchItem } from '@/types/modules/data-sync.types'

const logger = getLogger()

/**
 * 检索采集历史记录
 *
 * @param criteria - 检索条件
 * @param records - 历史记录数组（从 Store 或 IndexedDB 获取）
 * @returns 检索结果项数组
 */
export function searchHistory(
  criteria: SearchCriteria,
  records: readonly CollectionHistoryEntry[],
): SearchItem[] {
  let filtered = [...records]

  // 关键词搜索
  if (criteria.keyword) {
    const kw = criteria.keyword.toLowerCase()
    filtered = filtered.filter(r =>
      r.collectionInfo.symbols.some(s => s.toLowerCase().includes(kw)) ||
      r.collectionInfo.fileName?.toLowerCase().includes(kw) ||
      r.errorMessage?.toLowerCase().includes(kw) ||
      r.channel.toLowerCase().includes(kw),
    )
  }

  // 时间范围
  if (criteria.dateRange?.start) {
    filtered = filtered.filter(r => r.timestamp >= criteria.dateRange!.start!)
  }
  if (criteria.dateRange?.end) {
    filtered = filtered.filter(r => r.timestamp <= criteria.dateRange!.end!)
  }

  // 通道筛选
  if (criteria.channels?.length) {
    filtered = filtered.filter(r => criteria.channels!.includes(r.channel))
  }

  // 标的筛选
  if (criteria.symbols?.length) {
    filtered = filtered.filter(r =>
      r.collectionInfo.symbols.some(s => criteria.symbols!.includes(s)),
    )
  }

  // 维度筛选
  if (criteria.dimensions?.length) {
    filtered = filtered.filter(r =>
      r.collectionInfo.dimensions.some(d => criteria.dimensions!.includes(d)),
    )
  }

  // 状态筛选
  if (criteria.statuses?.length) {
    filtered = filtered.filter(r => criteria.statuses!.includes(r.status))
  }

  // 排序
  const sortBy = criteria.sortBy ?? 'timestamp'
  const sortOrder = criteria.sortOrder ?? 'desc'
  filtered.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'timestamp') cmp = a.timestamp.localeCompare(b.timestamp)
    else if (sortBy === 'channel') cmp = a.channel.localeCompare(b.channel)
    else if (sortBy === 'status') cmp = a.status.localeCompare(b.status)
    return sortOrder === 'asc' ? cmp : -cmp
  })

  // 分页
  const page = criteria.page ?? 1
  const pageSize = criteria.pageSize ?? 20
  const offset = (page - 1) * pageSize
  const paged = filtered.slice(offset, offset + pageSize)

  logger.info('[searchHistory] 历史检索完成', {
    total: records.length,
    filtered: filtered.length,
    returned: paged.length,
    page,
  })

  return paged.map(toSearchItem)
}

/**
 * 将历史记录转换为检索结果项
 */
function toSearchItem(entry: CollectionHistoryEntry): SearchItem {
  const symbols = entry.collectionInfo.symbols.join(', ')
  const dims = entry.collectionInfo.dimensions.join(', ')
  const fileName = entry.collectionInfo.fileName ?? ''
  const snippet = `${entry.channel} | ${symbols} | 维度:${dims} | ${entry.status}${fileName ? ` | ${fileName}` : ''}`

  return {
    source: 'collection-history',
    id: entry.id,
    timestamp: entry.timestamp,
    title: `${entry.channel} — ${symbols || fileName || '未知'}`,
    snippet,
    details: {
      channel: entry.channel,
      symbols: entry.collectionInfo.symbols,
      dimensions: entry.collectionInfo.dimensions,
      status: entry.status,
      fileName,
      recordsAdded: entry.updateInfo.recordsAdded,
      conflictsDetected: entry.updateInfo.conflictsDetected,
    },
  }
}

/**
 * 计算历史记录的分面统计
 * @param records - 全部历史记录
 * @returns 分面统计
 */
export function computeHistoryFacets(records: readonly CollectionHistoryEntry[]) {
  const byChannel: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const byDimension: Record<string, number> = {}

  for (const r of records) {
    byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    for (const d of r.collectionInfo.dimensions) {
      byDimension[d] = (byDimension[d] ?? 0) + 1
    }
  }

  return { byChannel, byStatus, byDimension }
}
