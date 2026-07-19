/**
 * @test_id V9-TEST-UT-038
 * @fileoverview P2-2 多源检索引擎测试
 *
 * @module tests/p2-2-search.test
 * @created 2026-07-14 - 双通道整改 P2-2
  * @covers_docs []
*/

import { describe, it, expect } from 'vitest'
import { search, quickSearch } from '@/services/data-sync-search/searchEngine'
import { searchHistory, computeHistoryFacets } from '@/services/data-sync-search/historySearcher'
import { searchDocs } from '@/services/data-sync-search/docSearcher'
import { searchCode, DEFAULT_CODE_INDEX } from '@/services/data-sync-search/codeSearcher'
import type { CollectionHistoryEntry } from '@/types/modules/data-sync.types'

function makeHistory(): CollectionHistoryEntry[] {
  return [
    {
      id: 'h1', timestamp: '2026-07-14T22:30:00Z', date: '2026-07-14',
      channel: 'file-import',
      collectionInfo: { symbols: ['600000'], dimensions: ['01'], fileName: 'stocks.csv' },
      updateInfo: { mode: 'batch', recordsAdded: 2, recordsModified: 0, recordsDeleted: 0, recordsUnchanged: 0, conflictsDetected: 0, conflictsResolved: 0 },
      qualityInfo: { successRate: 100, completeness: 100 },
      status: 'success',
    },
    {
      id: 'h2', timestamp: '2026-07-14T09:35:00Z', date: '2026-07-14',
      channel: 'auto-collect',
      collectionInfo: { symbols: ['600000', '600519'], dimensions: ['01', '02'] },
      updateInfo: { mode: 'batch', recordsAdded: 0, recordsModified: 2, recordsDeleted: 0, recordsUnchanged: 0, conflictsDetected: 0, conflictsResolved: 0 },
      qualityInfo: { successRate: 100, completeness: 90 },
      status: 'success',
    },
    {
      id: 'h3', timestamp: '2026-07-13T15:00:00Z', date: '2026-07-13',
      channel: 'auto-collect',
      collectionInfo: { symbols: ['000001'], dimensions: ['03'] },
      updateInfo: { mode: 'incremental', recordsAdded: 0, recordsModified: 0, recordsDeleted: 0, recordsUnchanged: 1, conflictsDetected: 1, conflictsResolved: 0 },
      qualityInfo: { successRate: 50, completeness: 80 },
      status: 'partial',
    },
  ]
}

describe('P2-2: 历史记录检索器', () => {
  it('关键词搜索应匹配标的', () => {
    const results = searchHistory({ keyword: '600000' }, makeHistory())
    expect(results.length).toBeGreaterThanOrEqual(2) // h1 和 h2
  })

  it('通道筛选应正确过滤', () => {
    const results = searchHistory({ channels: ['file-import'] }, makeHistory())
    expect(results).toHaveLength(1)
    expect(results[0]?.details.channel).toBe('file-import')
  })

  it('状态筛选应正确过滤', () => {
    const results = searchHistory({ statuses: ['partial'] }, makeHistory())
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('h3')
  })

  it('时间范围筛选应正确过滤', () => {
    const results = searchHistory({
      dateRange: { start: '2026-07-14T00:00:00Z', end: '2026-07-14T23:59:59Z' },
    }, makeHistory())
    expect(results).toHaveLength(2) // h1 和 h2
  })

  it('分页应正确切片', () => {
    const results = searchHistory({ page: 1, pageSize: 2 }, makeHistory())
    expect(results).toHaveLength(2)
    const page2 = searchHistory({ page: 2, pageSize: 2 }, makeHistory())
    expect(page2).toHaveLength(1)
  })

  it('分面统计应正确计算', () => {
    const facets = computeHistoryFacets(makeHistory())
    expect(facets.byChannel['file-import']).toBe(1)
    expect(facets.byChannel['auto-collect']).toBe(2)
    expect(facets.byStatus['success']).toBe(2)
    expect(facets.byStatus['partial']).toBe(1)
  })
})

describe('P2-2: 文档检索器', () => {
  const docs = [
    { id: 'd1', fileName: 'report.md', title: '浦发银行分析', content: '600000 浦发银行深度分析', lastModifiedAt: '2026-07-14T20:00:00Z', symbols: ['600000'] },
    { id: 'd2', fileName: 'notes.txt', title: '投资笔记', content: '茅台 600519', lastModifiedAt: '2026-07-13T10:00:00Z', symbols: ['600519'] },
  ]

  it('关键词搜索应匹配标题和内容', () => {
    const results = searchDocs({ keyword: '浦发' }, docs)
    expect(results).toHaveLength(1)
    expect(results[0]?.title).toBe('浦发银行分析')
  })

  it('文件类型筛选应正确过滤', () => {
    const results = searchDocs({ fileTypes: ['md'] }, docs)
    expect(results).toHaveLength(1)
    expect(results[0]?.details.fileName).toBe('report.md')
  })

  it('标的筛选应正确过滤', () => {
    const results = searchDocs({ symbols: ['600519'] }, docs)
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('d2')
  })
})

describe('P2-2: 代码检索器', () => {
  it('关键词搜索应匹配文件名和内容', () => {
    const results = searchCode({ keyword: '校验' }, DEFAULT_CODE_INDEX)
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.title.includes('unifiedFileValidator'))).toBe(true)
  })

  it('默认索引应包含双通道相关文件', () => {
    expect(DEFAULT_CODE_INDEX.length).toBeGreaterThanOrEqual(10)
    const paths = DEFAULT_CODE_INDEX.map(f => f.path)
    expect(paths).toContain('src/services/file-import/unifiedFileValidator.ts')
    expect(paths).toContain('src/services/data-sync/globalScheduler.ts')
  })
})

describe('P2-2: 多源检索引擎', () => {
  it('应聚合多源结果', () => {
    const result = search(
      { keyword: '600000' },
      { historyRecords: makeHistory(), enabledSources: ['history', 'code'] },
    )
    expect(result.total).toBeGreaterThan(0)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.facets).toBeDefined()
  })

  it('快速搜索应仅查历史', () => {
    const result = quickSearch('file-import', makeHistory())
    expect(result.total).toBeGreaterThanOrEqual(1)
  })

  it('分页应正确', () => {
    const result = search(
      { page: 1, pageSize: 2 },
      { historyRecords: makeHistory(), enabledSources: ['history'] },
    )
    expect(result.items.length).toBeLessThanOrEqual(2)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(2)
  })

  it('空结果应返回空数组', () => {
    const result = search({ keyword: '不存在的关键词xyz' }, { enabledSources: ['code'] })
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
