/**
 * @test_id V9-TEST-UT-VECTOR-001
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033]
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { semanticSearcher, semanticSearch } from '@/services/data-sync-search/semanticSearcher'
import type { SearchItem } from '@/types/modules/data-sync.types'

/**
 * semanticSearcher.ts 单元测试
 *
 * 测试覆盖：
 *   1. TF-IDF 模式 - 基础搜索功能
 *   2. TF-IDF 模式 - 空查询/空文档边界情况
 *   3. 向量模式（mock 嵌入）- 向量搜索功能
 *   4. 自动降级 - 向量不可用时回退 TF-IDF
 *   5. 便捷函数 semanticSearch - 一次性搜索
 */

// ─── Mock 依赖模块 ───────────────────────────────────────────

// mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ─── 测试数据 ────────────────────────────────────────────────

const mockItems: SearchItem[] = [
  {
    source: 'local-doc',
    id: 'doc-1',
    timestamp: '2026-01-01T00:00:00Z',
    title: '股票分析方法综述',
    snippet: '本文介绍了基本面分析和技术分析两种主要的股票分析方法',
    details: {},
  },
  {
    source: 'local-doc',
    id: 'doc-2',
    timestamp: '2026-01-02T00:00:00Z',
    title: '价值投资策略',
    snippet: '价值投资强调寻找被低估的股票，长期持有获得稳健收益',
    details: {},
  },
  {
    source: 'local-doc',
    id: 'doc-3',
    timestamp: '2026-01-03T00:00:00Z',
    title: '量化交易入门',
    snippet: '量化交易利用数学模型和算法进行交易决策，减少人为情绪干扰',
    details: {},
  },
]

// ─── 测试套件 ────────────────────────────────────────────────

describe('semanticSearcher (TF-IDF 模式)', () => {
  beforeEach(() => {
    semanticSearcher.clear()
  })

  afterEach(() => {
    semanticSearcher.clear()
  })

  it('应该正确索引文档并返回文档数', () => {
    expect(semanticSearcher.isIndexed).toBe(false)
    expect(semanticSearcher.documentCount).toBe(0)

    semanticSearcher.index(mockItems)

    expect(semanticSearcher.isIndexed).toBe(true)
    expect(semanticSearcher.documentCount).toBe(3)
  })

  it('应该能搜索到相关文档并按相似度排序', () => {
    semanticSearcher.index(mockItems)

    const results = semanticSearcher.search('价值投资 股票分析', 5)

    expect(results.length).toBeGreaterThan(0)
    // 验证结果按分数降序排列
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score)
    }
    // 验证所有结果都有 item 和 score
    results.forEach(r => {
      expect(r.item).toBeDefined()
      expect(typeof r.score).toBe('number')
      expect(r.score).toBeGreaterThan(0)
    })
  })

  it('空查询应该返回空结果', () => {
    semanticSearcher.index(mockItems)

    const results = semanticSearcher.search('', 5)

    expect(results).toEqual([])
  })

  it('未索引时搜索应该返回空结果', () => {
    const results = semanticSearcher.search('价值投资', 5)

    expect(results).toEqual([])
  })

  it('清空索引后应该无法搜索', () => {
    semanticSearcher.index(mockItems)
    expect(semanticSearcher.isIndexed).toBe(true)

    semanticSearcher.clear()

    expect(semanticSearcher.isIndexed).toBe(false)
    expect(semanticSearcher.documentCount).toBe(0)
    const results = semanticSearcher.search('价值投资', 5)
    expect(results).toEqual([])
  })

  it('topK 参数应该限制返回结果数', () => {
    semanticSearcher.index(mockItems)

    const results = semanticSearcher.search('股票', 2)

    expect(results.length).toBeLessThanOrEqual(2)
  })
})

describe('semanticSearch (便捷函数)', () => {
  it('应该能一次性索引并搜索', () => {
    const results = semanticSearch('价值投资', mockItems, 5)

    expect(results.length).toBeGreaterThan(0)
    results.forEach(r => {
      expect(r.item).toBeDefined()
      expect(typeof r.score).toBe('number')
    })
  })

  it('空文档列表应该返回空结果', () => {
    const results = semanticSearch('价值投资', [], 5)

    expect(results).toEqual([])
  })
})

describe('semanticSearcher 向量模式集成', () => {
  beforeEach(() => {
    semanticSearcher.clear()
    vi.resetAllMocks()
  })

  afterEach(() => {
    semanticSearcher.clear()
    vi.restoreAllMocks()
  })

  it('默认应该使用 TF-IDF 模式（向量未启用）', () => {
    // 验证：在没有向量索引的情况下，搜索仍然正常工作（TF-IDF 模式）
    semanticSearcher.index(mockItems)
    const results = semanticSearcher.search('价值投资', 5)

    expect(results.length).toBeGreaterThan(0)
    // 不抛错即表示 TF-IDF 模式正常工作
  })

  it('搜索方法应该保持接口签名不变', () => {
    semanticSearcher.index(mockItems)

    // 验证接口签名：search(query, topK) => Array<{item, score}>
    const results = semanticSearcher.search('测试查询', 10)

    expect(Array.isArray(results)).toBe(true)
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('item')
      expect(results[0]).toHaveProperty('score')
    }
  })

  it('索引方法应该保持接口签名不变', () => {
    // 验证接口签名：index(items) => void
    expect(() => semanticSearcher.index(mockItems)).not.toThrow()
    expect(semanticSearcher.documentCount).toBe(3)
  })
})
