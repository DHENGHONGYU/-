/**
 * @fileoverview 多源检索引擎
 *
 * 统一入口，聚合历史记录、本地文档、代码文件三个检索源，
 * 支持跨源关键词检索、分面统计、分页。
 *
 * @module services/data-sync-search/searchEngine
 * @created 2026-07-14 - 双通道整改 P2-2
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type { CollectionHistoryEntry, SearchCriteria, SearchResult, SearchItem } from '@/types/modules/data-sync.types'
import { searchHistory, computeHistoryFacets } from './historySearcher'
import { searchDocs, computeDocFacets } from './docSearcher'
import { searchCode, DEFAULT_CODE_INDEX } from './codeSearcher'
import type { CodeFileIndex } from './codeSearcher'

const logger = getLogger()

/** 文档记录接口（与 docSearcher 一致） */
interface DocRecord {
  id: string
  fileName: string
  title: string
  content: string
  lastModifiedAt: string
  symbols?: string[]
  category?: string
}

/**
 * 多源检索引擎配置
 */
export interface SearchEngineConfig {
  /** 历史记录数据源（从 Store 获取） */
  historyRecords?: readonly CollectionHistoryEntry[]
  /** 文档数据源（从 localDocService 获取） */
  docRecords?: readonly DocRecord[]
  /** 代码文件索引（默认使用 DEFAULT_CODE_INDEX） */
  codeIndex?: readonly CodeFileIndex[]
  /** 启用的检索源 */
  enabledSources?: Array<'history' | 'docs' | 'code'>
}

/** 默认启用的检索源 */
const DEFAULT_ENABLED_SOURCES: Array<'history' | 'docs' | 'code'> = ['history', 'docs', 'code']

/**
 * 执行多源检索
 *
 * @param criteria - 检索条件
 * @param config - 检索引擎配置
 * @returns 统一检索结果
 */
export function search(
  criteria: SearchCriteria,
  config: SearchEngineConfig = {},
): SearchResult {
  const enabledSources = config.enabledSources ?? DEFAULT_ENABLED_SOURCES
  const allItems: SearchItem[] = []

  // 历史记录检索
  if (enabledSources.includes('history') && config.historyRecords) {
    const items = searchHistory(criteria, config.historyRecords)
    allItems.push(...items)
  }

  // 文档检索
  if (enabledSources.includes('docs') && config.docRecords) {
    const items = searchDocs(criteria, config.docRecords)
    allItems.push(...items)
  }

  // 代码检索
  if (enabledSources.includes('code')) {
    const index = config.codeIndex ?? DEFAULT_CODE_INDEX
    const items = searchCode(criteria, index)
    allItems.push(...items)
  }

  // 统一排序（按时间倒序）
  const sortOrder = criteria.sortOrder ?? 'desc'
  allItems.sort((a, b) => {
    const cmp = a.timestamp.localeCompare(b.timestamp)
    return sortOrder === 'asc' ? cmp : -cmp
  })

  // 统一分页
  const page = criteria.page ?? 1
  const pageSize = criteria.pageSize ?? 20
  const offset = (page - 1) * pageSize
  const paged = allItems.slice(offset, offset + pageSize)

  // 分面统计
  const facets = computeFacets(allItems, config)

  logger.info('[search] 多源检索完成', {
    total: allItems.length,
    returned: paged.length,
    page,
    sources: enabledSources,
    facets: {
      channels: Object.keys(facets.byChannel).length,
      fileTypes: Object.keys(facets.byFileType).length,
    },
  })

  return {
    items: paged,
    total: allItems.length,
    page,
    pageSize,
    facets,
  }
}

/**
 * 计算分面统计
 */
function computeFacets(
  items: readonly SearchItem[],
  config: SearchEngineConfig,
): SearchResult['facets'] {
  const byChannel: Record<string, number> = {}
  const byFileType: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const byDimension: Record<string, number> = {}

  // 从历史记录计算分面
  if (config.historyRecords) {
    const historyFacets = computeHistoryFacets(config.historyRecords)
    Object.assign(byChannel, historyFacets.byChannel)
    Object.assign(byStatus, historyFacets.byStatus)
    Object.assign(byDimension, historyFacets.byDimension)
  }

  // 从文档计算文件类型分面
  if (config.docRecords) {
    const docFacets = computeDocFacets(config.docRecords)
    Object.assign(byFileType, docFacets.byFileType)
  }

  // 从检索结果统计来源分面
  for (const item of items) {
    byChannel[item.source] = (byChannel[item.source] ?? 0) + 1
  }

  return { byChannel, byFileType, byStatus, byDimension }
}

/**
 * 快速检索（仅历史记录）
 *
 * @param keyword - 关键词
 * @param historyRecords - 历史记录
 * @returns 检索结果
 */
export function quickSearch(
  keyword: string,
  historyRecords: readonly CollectionHistoryEntry[],
): SearchResult {
  return search(
    { keyword, page: 1, pageSize: 20 },
    { historyRecords, enabledSources: ['history'] },
  )
}
