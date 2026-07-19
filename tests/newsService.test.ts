/**
 * @test_id V9-TEST-UT-036
 * @covers_docs [V9-DOC-DATA-013, V9-DOC-BACK-027, V9-DOC-DATA-052, V9-DOC-DATA-042, V9-DOC-DATA-051]
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import type { NewsArticle } from '@/data/types'
import {
  saveNewsArticle,
  saveNewsArticles,
  listNews,
  getNewsBySymbol,
  getNewsByHash,
  generateMockArticles,
  generateNewsHash,
} from '@/services/news/newsService'
import { DEFAULT_STOCK_LIBRARY } from '@/services/news/stockLinker'

function makeArticle(
  overrides: Partial<Omit<NewsArticle, 'id' | 'sentiment' | 'sentimentConfidence' | 'relatedStocks' | 'hash'>> = {},
): Omit<NewsArticle, 'id' | 'sentiment' | 'sentimentConfidence' | 'relatedStocks' | 'hash'> {
  return {
    title: '贵州茅台业绩大涨',
    content: '600519贵州茅台发布年报，盈利超预期，白酒行业向好',
    url: 'https://example.com/news/1',
    source: 'test',
    category: '公司',
    publishTime: '2026-06-24T10:00:00.000Z',
    fetchTime: '2026-06-24T11:00:00.000Z',
    keywords: [],
    ...overrides,
  }
}

describe('newsService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.news)
    dataBridge.invalidateCache(STORE_NAME.newsStockMap)
  })

  it('generates mock articles', () => {
    const articles = generateMockArticles(3)
    expect(articles.length).toBe(3)
    expect(articles.every((article) => article.hash.length > 0)).toBe(true)
    expect(articles.every((article) => article.id.length > 0)).toBe(true)
    expect(articles.some((article) => article.sentiment === 'positive')).toBe(true)
    expect(articles.some((article) => article.sentiment === 'negative')).toBe(true)
  })

  it('saves a single article with sentiment and stock linking', async () => {
    const article = makeArticle()
    const result = await saveNewsArticle(article)

    expect(result.success).toBe(true)
    expect(result.data?.hash).toBe(generateNewsHash(`${article.title}\x00${article.content}`))
    expect(result.data?.id).toBe(`news_${result.data?.hash}`)
    expect(result.data?.sentiment).not.toBe('neutral')
    expect(result.data?.sentimentConfidence).toBeGreaterThan(0)
    expect(result.data?.relatedStocks).toContain('600519.SH')

    const maps = await dataLayer.newsStockMap.listByNews(result.data!.id)
    expect(maps.length).toBeGreaterThan(0)
    expect(maps.some((map) => map.symbol === '600519.SH')).toBe(true)
  })

  it('deduplicates articles by hash', async () => {
    const article = makeArticle()
    const first = await saveNewsArticle(article)
    expect(first.success).toBe(true)

    const second = await saveNewsArticle(makeArticle())
    expect(second.success).toBe(true)
    expect(second.data?.id).toBe(first.data?.id)

    const all = await dataLayer.news.list()
    expect(all.length).toBe(1)
  })

  it('filters news by source and category', async () => {
    await saveNewsArticle(
      makeArticle({
        title: 'A股早盘走强',
        content: '市场普涨',
        source: 's1',
        category: 'c1',
        publishTime: '2026-06-24T09:00:00.000Z',
      }),
    )
    await saveNewsArticle(
      makeArticle({
        title: '港股收盘综述',
        content: '恒生指数下跌',
        source: 's2',
        category: 'c2',
        publishTime: '2026-06-24T10:00:00.000Z',
      }),
    )

    const bySource = await listNews({ source: 's1' })
    expect(bySource.data?.length).toBe(1)
    expect(bySource.data?.[0]?.source).toBe('s1')

    const byCategory = await listNews({ category: 'c2' })
    expect(byCategory.data?.length).toBe(1)
    expect(byCategory.data?.[0]?.category).toBe('c2')
  })

  it('filters news by sentiment', async () => {
    await saveNewsArticle(
      makeArticle({
        title: '业绩暴涨',
        content: '公司盈利超预期',
        source: 's1',
        category: '公司',
      }),
    )
    await saveNewsArticle(
      makeArticle({
        title: '业绩暴雷',
        content: '公司出现亏损',
        source: 's2',
        category: '公司',
      }),
    )

    const positive = await listNews({ sentiment: 'positive' })
    expect(positive.data?.length).toBe(1)

    const negative = await listNews({ sentiment: 'negative' })
    expect(negative.data?.length).toBe(1)
  })

  it('filters news by keyword', async () => {
    await saveNewsArticle(makeArticle({ title: '贵州茅台业绩大涨', content: '白酒行业向好' }))
    await saveNewsArticle(
      makeArticle({
        title: '比亚迪销量创新高',
        content: '新能源汽车销量大增',
      }),
    )

    const result = await listNews({ keyword: '比亚迪' })
    expect(result.data?.length).toBe(1)
    expect(result.data?.[0]?.title).toContain('比亚迪')
  })

  it('filters news by linked symbol', async () => {
    await saveNewsArticle(makeArticle(), { stocks: DEFAULT_STOCK_LIBRARY })

    const bySymbol = await listNews({ symbol: '600519.SH' })
    expect(bySymbol.data?.length).toBe(1)
  })

  it('filters news by publish time range', async () => {
    await saveNewsArticle(
      makeArticle({
        title: '早盘',
        content: '早盘内容',
        publishTime: '2026-06-24T09:00:00.000Z',
      }),
    )
    await saveNewsArticle(
      makeArticle({
        title: '午盘',
        content: '午盘内容',
        publishTime: '2026-06-24T12:00:00.000Z',
      }),
    )

    const result = await listNews({
      fromTime: '2026-06-24T10:00:00.000Z',
      toTime: '2026-06-24T23:00:00.000Z',
    })
    expect(result.data?.length).toBe(1)
    expect(result.data?.[0]?.title).toBe('午盘')
  })

  it('gets news by symbol', async () => {
    const article = makeArticle()
    await saveNewsArticle(article, { stocks: DEFAULT_STOCK_LIBRARY })

    const result = await getNewsBySymbol('600519.SH')
    expect(result.success).toBe(true)
    expect(result.data?.length).toBe(1)
    expect(result.data?.[0]?.relatedStocks).toContain('600519.SH')
  })

  it('gets news by hash', async () => {
    const article = makeArticle()
    const saved = await saveNewsArticle(article)
    expect(saved.success).toBe(true)

    const result = await getNewsByHash(saved.data!.hash)
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe(saved.data?.id)
  })

  it('batch saves articles', async () => {
    const articles = [
      makeArticle({ title: 'Batch 1', content: 'batch content 1' }),
      makeArticle({ title: 'Batch 2', content: 'batch content 2' }),
    ]

    const result = await saveNewsArticles(articles, { stocks: DEFAULT_STOCK_LIBRARY })
    expect(result.success).toBe(true)
    expect(result.data?.length).toBe(2)

    const all = await dataLayer.news.list()
    expect(all.length).toBe(2)
  })
})
