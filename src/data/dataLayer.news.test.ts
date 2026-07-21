/**
 * @fileoverview dataLayer — News 单元测试（从原 dataLayer.test.ts 拆分）
 *
 * 覆盖：newsStore(5) / newsStockMapStore(3) / sentimentCacheStore(4) 共 12 个用例
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mockQuery,
  mockQueryGetSuccess,
  mockQueryListSuccess,
  mockForwardSuccess,
  makeNewsArticle,
  makeNewsStockMap,
  makeSentimentCache,
} from './dataLayer.test-utils'
import { newsStore, newsStockMapStore, sentimentCacheStore } from './dataLayer'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('newsStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await newsStore.save(makeNewsArticle())
    expect(result.success).toBe(true)
  })

  it('get: 查询到文章', async () => {
    mockQueryGetSuccess(makeNewsArticle())

    const result = await newsStore.get('news-001')
    expect(result?.title).toContain('茅台')
  })

  it('getByHash: 通过哈希查询', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [makeNewsArticle()] })

    const result = await newsStore.getByHash('abc123hash')
    expect(result?.hash).toBe('abc123hash')
  })

  it('getByHash: 无匹配返回 undefined', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [] })

    const result = await newsStore.getByHash('nonexistent')
    expect(result).toBeUndefined()
  })

  it('list: 返回全部', async () => {
    mockQueryListSuccess([makeNewsArticle()])

    const result = await newsStore.list()
    expect(result).toHaveLength(1)
  })
})

describe('newsStockMapStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await newsStockMapStore.save(makeNewsStockMap())
    expect(result.success).toBe(true)
  })

  it('listBySymbol: 按股票查询', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [makeNewsStockMap()] })

    const result = await newsStockMapStore.listBySymbol('600519')
    expect(result).toHaveLength(1)
  })

  it('listByNews: 按资讯查询', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [makeNewsStockMap()] })

    const result = await newsStockMapStore.listByNews('news-001')
    expect(result).toHaveLength(1)
  })
})

describe('sentimentCacheStore', () => {
  it('save: 成功保存', async () => {
    mockForwardSuccess()

    const result = await sentimentCacheStore.save(makeSentimentCache())
    expect(result.success).toBe(true)
  })

  it('get: 查询到缓存', async () => {
    mockQueryGetSuccess(makeSentimentCache())

    const result = await sentimentCacheStore.get('sent_abc123')
    expect(result?.sentiment).toBe('positive')
  })

  it('getByContentHash: 通过内容哈希查询', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [makeSentimentCache()] })

    const result = await sentimentCacheStore.getByContentHash('abc123')
    expect(result?.contentHash).toBe('abc123')
  })

  it('getByContentHash: 无匹配返回 undefined', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [] })

    const result = await sentimentCacheStore.getByContentHash('nonexistent')
    expect(result).toBeUndefined()
  })
})
