/**
 * @fileoverview 文档检索器
 *
 * 从本地知识库文档中检索相关内容，支持关键词匹配。
 * 复用 localDocService 的文档数据。
 *
 * @module services/data-sync-search/docSearcher
 * @created 2026-07-14 - 双通道整改 P2-2
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type { SearchCriteria, SearchItem } from '@/types/modules/data-sync.types'

const logger = getLogger()

/** 简化的文档记录接口 */
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
 * 检索本地文档
 *
 * @param criteria - 检索条件
 * @param docs - 文档记录数组
 * @returns 检索结果项数组
 */
export function searchDocs(
  criteria: SearchCriteria,
  docs: readonly DocRecord[],
): SearchItem[] {
  let filtered = [...docs]

  // 关键词搜索（标题 + 内容）
  if ((criteria.keyword ?? '') !== '') {
    const kw = criteria.keyword!.toLowerCase()
    filtered = filtered.filter(d =>
      d.title.toLowerCase().includes(kw) ||
      d.content.toLowerCase().includes(kw) ||
      d.fileName.toLowerCase().includes(kw) ||
      ((d.symbols ?? []).some(s => s.includes(kw))),
    )
  }

  // 文件类型筛选
  if ((criteria.fileTypes?.length ?? 0) > 0) {
    filtered = filtered.filter(d => {
      const ext = d.fileName.split('.').pop()?.toLowerCase() ?? ''
      return ext !== '' && criteria.fileTypes!.includes(ext)
    })
  }

  // 时间范围
  if ((criteria.dateRange?.start ?? 0) !== 0) {
    filtered = filtered.filter(d => d.lastModifiedAt >= criteria.dateRange!.start!)
  }
  if ((criteria.dateRange?.end ?? 0) !== 0) {
    filtered = filtered.filter(d => d.lastModifiedAt <= criteria.dateRange!.end!)
  }

  // 标的筛选
  if ((criteria.symbols?.length ?? 0) > 0) {
    filtered = filtered.filter(d =>
      ((d.symbols ?? []).some(s => criteria.symbols!.includes(s))),
    )
  }

  // 排序（按时间倒序）
  filtered.sort((a, b) => b.lastModifiedAt.localeCompare(a.lastModifiedAt))

  // 分页
  const page = criteria.page ?? 1
  const pageSize = criteria.pageSize ?? 20
  const offset = (page - 1) * pageSize
  const paged = filtered.slice(offset, offset + pageSize)

  logger.info('[searchDocs] 文档检索完成', {
    total: docs.length,
    filtered: filtered.length,
    returned: paged.length,
  })

  return paged.map(toSearchItem)
}

/**
 * 将文档记录转换为检索结果项
 */
function toSearchItem(doc: DocRecord): SearchItem {
  // 提取关键词附近的片段
  const snippet = doc.content.slice(0, 200) + (doc.content.length > 200 ? '...' : '')

  return {
    source: 'local-doc',
    id: doc.id,
    timestamp: doc.lastModifiedAt,
    title: doc.title || doc.fileName,
    snippet,
    details: {
      fileName: doc.fileName,
      category: doc.category,
      symbols: doc.symbols,
      contentLength: doc.content.length,
    },
  }
}

/**
 * 计算文档的分面统计
 */
export function computeDocFacets(docs: readonly DocRecord[]) {
  const byFileType: Record<string, number> = {}

  for (const d of docs) {
    const ext = d.fileName.split('.').pop()?.toLowerCase() ?? 'unknown'
    byFileType[ext] = (byFileType[ext] ?? 0) + 1
  }

  return { byFileType }
}
