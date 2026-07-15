/**
 * @fileoverview P2-3 + P3-2 测试
 *
 * P2-3: 检索 UI（searchStore 状态管理 + 组件渲染）
 * P3-2: 语义搜索器（TF-IDF + 余弦相似度）
 *
 * @module tests/p2-3-p3-2.test
 * @created 2026-07-14 - 双通道整改 P2-3 + P3-2
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useSearchStore } from '@/store/searchStore'
import { SearchBar } from '@/components/organisms/search/SearchBar'
import { SearchFilters } from '@/components/organisms/search/SearchFilters'
import { TimelineView } from '@/components/organisms/search/TimelineView'
import { GroupedView } from '@/components/organisms/search/GroupedView'
import { SearchResultList } from '@/components/organisms/search/SearchResultList'
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
// P2-3: SearchBar 组件
// ============================================================

describe('P2-3: SearchBar 组件', () => {
  it('应渲染输入框和按钮', () => {
    render(<SearchBar />)
    expect(screen.getByPlaceholderText(/搜索关键词/)).toBeTruthy()
    expect(screen.getByText('搜索')).toBeTruthy()
  })

  it('输入应更新 store', () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/搜索关键词/) as HTMLInputElement
    fireEvent.change(input, { target: { value: '浦发银行' } })
    expect(useSearchStore.getState().keyword).toBe('浦发银行')
  })
})

// ============================================================
// P2-3: SearchFilters 组件
// ============================================================

describe('P2-3: SearchFilters 组件', () => {
  it('应渲染时间范围选项', () => {
    render(<SearchFilters />)
    expect(screen.getByText('全部')).toBeTruthy()
    expect(screen.getByText('今天')).toBeTruthy()
    expect(screen.getByText('近7天')).toBeTruthy()
  })

  it('应渲染通道选项', () => {
    render(<SearchFilters />)
    expect(screen.getByText('自动采集')).toBeTruthy()
    expect(screen.getByText('文件导入')).toBeTruthy()
  })

  it('点击通道应 toggle', () => {
    render(<SearchFilters />)
    const btn = screen.getByText('自动采集')
    fireEvent.click(btn)
    expect(useSearchStore.getState().channels).toContain('auto-collect')
  })
})

// ============================================================
// P2-3: TimelineView 组件
// ============================================================

describe('P2-3: TimelineView 组件', () => {
  const mockItems: SearchItem[] = [
    {
      source: 'collection-history',
      id: '1',
      timestamp: '2026-07-14T22:30:00Z',
      title: '文件导入 — 600000',
      snippet: 'file-import | 600000 | 维度:01 | success | stocks.csv',
      details: { channel: 'file-import', status: 'success' },
    },
    {
      source: 'local-doc',
      id: '2',
      timestamp: '2026-07-14T20:00:00Z',
      title: '浦发银行分析报告',
      snippet: '600000 浦发银行深度分析...',
      details: { channel: 'file-import' },
    },
  ]

  it('应渲染结果项', () => {
    render(<TimelineView items={mockItems} />)
    expect(screen.getByText('文件导入 — 600000')).toBeTruthy()
    expect(screen.getByText('浦发银行分析报告')).toBeTruthy()
  })

  it('空结果应显示提示', () => {
    render(<TimelineView items={[]} />)
    expect(screen.getByText('无检索结果')).toBeTruthy()
  })

  it('点击应触发回调', () => {
    let clicked: SearchItem | null = null
    render(<TimelineView items={mockItems} onItemClick={(item) => { clicked = item }} />)
    fireEvent.click(screen.getByText('浦发银行分析报告'))
    expect(clicked?.id).toBe('2')
  })
})

// ============================================================
// P2-3: GroupedView 组件
// ============================================================

describe('P2-3: GroupedView 组件', () => {
  const mockItems: SearchItem[] = [
    { source: 'collection-history', id: '1', timestamp: '2026-07-14T10:00:00Z', title: '历史1', snippet: 'snippet1', details: { channel: 'auto-collect', status: 'success' } },
    { source: 'collection-history', id: '2', timestamp: '2026-07-14T11:00:00Z', title: '历史2', snippet: 'snippet2', details: { channel: 'file-import', status: 'partial' } },
    { source: 'local-doc', id: '3', timestamp: '2026-07-14T12:00:00Z', title: '文档1', snippet: 'snippet3', details: {} },
  ]

  it('按来源分组应正确显示', () => {
    render(<GroupedView items={mockItems} groupBy="source" />)
    expect(screen.getByText('采集历史')).toBeTruthy()
    expect(screen.getByText('本地文档')).toBeTruthy()
  })

  it('应显示每组计数', () => {
    render(<GroupedView items={mockItems} groupBy="source" />)
    expect(screen.getByText('2 项')).toBeTruthy()
    expect(screen.getByText('1 项')).toBeTruthy()
  })

  it('空结果应显示提示', () => {
    render(<GroupedView items={[]} />)
    expect(screen.getByText('无检索结果')).toBeTruthy()
  })
})

// ============================================================
// P2-3: SearchResultList 组件
// ============================================================

describe('P2-3: SearchResultList 组件', () => {
  const mockItems: SearchItem[] = Array.from({ length: 5 }, (_, i) => ({
    source: 'collection-history' as const,
    id: String(i),
    timestamp: `2026-07-14T${10 + i}:00:00Z`,
    title: `结果 ${i + 1}`,
    snippet: `这是第 ${i + 1} 条结果的摘要`,
    details: { channel: 'auto-collect' },
  }))

  it('应显示总数和视图切换', () => {
    render(<SearchResultList items={mockItems} total={5} page={1} pageSize={20} />)
    expect(screen.getByText(/共 5 条结果/)).toBeTruthy()
    expect(screen.getByText('时间线')).toBeTruthy()
    expect(screen.getByText('分组')).toBeTruthy()
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
    // 浦发银行分析报告应排第一
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
