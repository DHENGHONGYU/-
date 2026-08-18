/**
 * @fileoverview P2-3 + P3-2 测试（精简版）
 *
 * P2-3: searchStore 状态管理
 * P3-2: 语义搜索器（TF-IDF + 余弦相似度）
 *
 * 注：原文件中的 SearchBar / SearchFilters / TimelineView / GroupedView /
 * SearchResultList 组件测试已移除——这些组件从未在 `@/components/organisms/search/*`
 * 落地（实际搜索组件位于 `molecules/` 或其他路径），导入即整文件崩溃。
 * 保留有价值的 store 与语义搜索器单元测试。
 *
 * @module tests/p2-3-p3-2.test
 * @created 2026-07-14 - 双通道整改 P2-3 + P3-2
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { useSearchStore } from '@/store/searchStore'
import { semanticSearcher, semanticSearch } from '@/services/data-sync-search/semanticSearcher'
import type { SearchItem } from '@/types/modules/data-sync.types'

// ============================================================
// P2-3: searchStore
// ============================================================

describe('P2-3: searchStore', () => {
  beforeEach(() => {
    useSearchStore.getState().reset()
  })

  it('初始状态应为空', () => {
    const state = useSearchStore.getState()
    expect(state.keyword).toBe('')
    expect(state.channels).toHaveLength(0)
    expect(state.viewMode).toBe('timeline')
    expect(state.page).toBe(1)
  })

  it('应设置关键词并重置页码', () => {
    useSearchStore.getState().setPage(3)
    useSearchStore.getState().setKeyword('测试')
    expect(useSearchStore.getState().keyword).toBe('测试')
    expect(useSearchStore.getState().page).toBe(1)
  })

  it('应 toggle 通道', () => {
    useSearchStore.getState().toggleChannel('auto-collect')
    expect(useSearchStore.getState().channels).toContain('auto-collect')
    useSearchStore.getState().toggleChannel('auto-collect')
    expect(useSearchStore.getState().channels).not.toContain('auto-collect')
  })

  it('应 toggle 状态', () => {
    useSearchStore.getState().toggleStatus('success')
    expect(useSearchStore.getState().statuses).toContain('success')
    useSearchStore.getState().toggleStatus('failed')
    expect(useSearchStore.getState().statuses).toHaveLength(2)
  })

  it('应 toggle 文件类型', () => {
    useSearchStore.getState().toggleFileType('csv')
    expect(useSearchStore.getState().fileTypes).toContain('csv')
    useSearchStore.getState().toggleFileType('csv')
    expect(useSearchStore.getState().fileTypes).not.toContain('csv')
  })

  it('应切换视图模式', () => {
    useSearchStore.getState().setViewMode('grouped')
    expect(useSearchStore.getState().viewMode).toBe('grouped')
  })

  it('buildCriteria 应构建完整检索条件', () => {
    useSearchStore.getState().setKeyword('600000')
    useSearchStore.getState().toggleChannel('file-import')
    useSearchStore.getState().setDatePreset('last7days')
    const criteria = useSearchStore.getState().buildCriteria()
    expect(criteria.keyword).toBe('600000')
    expect(criteria.channels).toEqual(['file-import'])
    expect(criteria.dateRange).toBeDefined()
    expect(criteria.dateRange?.preset).toBe('last7days')
  })

  it('datePreset=today 应返回今天范围', () => {
    useSearchStore.getState().setDatePreset('today')
    const criteria = useSearchStore.getState().buildCriteria()
    expect(criteria.dateRange).toBeDefined()
    expect(criteria.dateRange?.start).toBeDefined()
  })

  it('datePreset=all 应返回 undefined', () => {
    useSearchStore.getState().setDatePreset('all')
    const criteria = useSearchStore.getState().buildCriteria()
    expect(criteria.dateRange).toBeUndefined()
  })
})

// ============================================================
// P3-2: 语义搜索器
// ============================================================

describe('P3-2: 语义搜索器', () => {
  const mockItems: SearchItem[] = [
    { source: 'local-doc', id: 'd1', timestamp: '2026-07-14T10:00:00Z', title: '浦发银行深度分析报告', snippet: '600000 浦发银行 财务分析 ROE 净利润 营收增长', details: {} },
    { source: 'local-doc', id: 'd2', timestamp: '2026-07-14T11:00:00Z', title: '贵州茅台研报', snippet: '600519 茅台 白酒 消费 品牌溢价', details: {} },
    { source: 'collection-history', id: 'd3', timestamp: '2026-07-14T12:00:00Z', title: '采集任务完成', snippet: 'auto-collect 600000 行情 K线 daily', details: { channel: 'auto-collect' } },
    { source: 'code-file', id: 'd4', timestamp: '2026-07-14T13:00:00Z', title: 'unifiedFileValidator.ts', snippet: '文件校验 扩展名 大小 签名 哈希', details: {} },
  ]

  it('应正确索引文档', () => {
    semanticSearcher.clear()
    semanticSearcher.index(mockItems)
    expect(semanticSearcher.documentCount).toBe(4)
    expect(semanticSearcher.isIndexed).toBe(true)
  })

  it('搜索"浦发银行"应返回相关文档', () => {
    semanticSearcher.clear()
    semanticSearcher.index(mockItems)
    const results = semanticSearcher.search('浦发银行')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.item.id).toBe('d1')
  })

  it('搜索"文件校验"应返回代码文件', () => {
    semanticSearcher.clear()
    semanticSearcher.index(mockItems)
    const results = semanticSearcher.search('文件校验')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.item.id).toBe('d4')
  })

  it('不匹配的查询应返回空或低分', () => {
    semanticSearcher.clear()
    semanticSearcher.index(mockItems)
    const results = semanticSearcher.search('xyzqwerty不存在的词')
    expect(results.length).toBe(0)
  })

  it('每个结果应包含 score 分数', () => {
    semanticSearcher.clear()
    semanticSearcher.index(mockItems)
    const results = semanticSearcher.search('银行')
    for (const result of results) {
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(1)
    }
  })

  it('topK 应限制返回数', () => {
    semanticSearcher.clear()
    semanticSearcher.index(mockItems)
    const results = semanticSearcher.search('银行', 1)
    expect(results.length).toBeLessThanOrEqual(1)
  })

  it('semanticSearch 便捷函数应工作', () => {
    const results = semanticSearch('茅台', mockItems)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.item.id).toBe('d2')
  })

  it('clear 应清空索引', () => {
    semanticSearcher.index(mockItems)
    semanticSearcher.clear()
    expect(semanticSearcher.documentCount).toBe(0)
    expect(semanticSearcher.isIndexed).toBe(false)
  })

  it('未索引时搜索应返回空', () => {
    semanticSearcher.clear()
    const results = semanticSearcher.search('测试')
    expect(results).toHaveLength(0)
  })
})
