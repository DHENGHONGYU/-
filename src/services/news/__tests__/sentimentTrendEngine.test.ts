import { describe, it, expect } from 'vitest'
import type { NewsArticle } from '@/data/types'
import {
  aggregateSentimentTrend,
  extractStockOptions,
  extractIndustryOptions,
} from '@/services/news/sentimentTrendEngine'

function createArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'news-001',
    title: '测试新闻',
    content: '测试内容',
    url: 'https://example.com/1',
    source: '测试源',
    category: '科技',
    publishTime: '2026-01-01T00:00:00Z',
    fetchTime: '2026-01-01T00:00:00Z',
    sentiment: 'positive',
    sentimentConfidence: 0.9,
    relatedStocks: ['AAPL'],
    keywords: ['AI'],
    hash: 'hash-001',
    ...overrides,
  }
}

describe('sentimentTrendEngine', () => {
  it('global 维度按日期聚合三种情感数量与占比', () => {
    const articles = [
      createArticle({ id: '1', sentiment: 'positive', publishTime: '2026-01-01T08:00:00Z' }),
      createArticle({ id: '2', sentiment: 'negative', publishTime: '2026-01-01T12:00:00Z' }),
      createArticle({ id: '3', sentiment: 'neutral', publishTime: '2026-01-02T10:00:00Z' }),
      createArticle({ id: '4', sentiment: 'positive', publishTime: '2026-01-02T14:00:00Z' }),
    ]

    const trend = aggregateSentimentTrend(articles, { dimension: 'global', fillGaps: true })

    expect(trend.dimension).toBe('global')
    expect(trend.data).toHaveLength(2)

    const day1 = trend.data.find((d) => d.date === '2026-01-01')
    expect(day1).toBeDefined()
    expect(day1!.positive).toBe(1)
    expect(day1!.negative).toBe(1)
    expect(day1!.neutral).toBe(0)
    expect(day1!.positiveRatio).toBe(0.5)

    const day2 = trend.data.find((d) => d.date === '2026-01-02')
    expect(day2).toBeDefined()
    expect(day2!.positive).toBe(1)
    expect(day2!.neutral).toBe(1)
    expect(day2!.positiveRatio).toBe(0.5)

    expect(trend.summary.totalArticles).toBe(4)
    expect(trend.summary.positiveCount).toBe(2)
    expect(trend.summary.negativeCount).toBe(1)
    expect(trend.summary.neutralCount).toBe(1)
  })

  it('stock 维度仅统计关联指定股票的资讯', () => {
    const articles = [
      createArticle({ id: '1', sentiment: 'positive', relatedStocks: ['AAPL'], publishTime: '2026-01-01T08:00:00Z' }),
      createArticle({ id: '2', sentiment: 'negative', relatedStocks: ['TSLA'], publishTime: '2026-01-01T10:00:00Z' }),
      createArticle({ id: '3', sentiment: 'positive', relatedStocks: ['AAPL', 'TSLA'], publishTime: '2026-01-02T10:00:00Z' }),
    ]

    const trend = aggregateSentimentTrend(articles, { dimension: 'stock', value: 'AAPL', fillGaps: true })

    expect(trend.value).toBe('AAPL')
    expect(trend.summary.totalArticles).toBe(2)
    expect(trend.summary.positiveCount).toBe(2)
  })

  it('industry 维度按 category 字段筛选', () => {
    const articles = [
      createArticle({ id: '1', sentiment: 'positive', category: '科技', publishTime: '2026-01-01T08:00:00Z' }),
      createArticle({ id: '2', sentiment: 'negative', category: '消费', publishTime: '2026-01-01T10:00:00Z' }),
      createArticle({ id: '3', sentiment: 'neutral', category: '科技', publishTime: '2026-01-02T10:00:00Z' }),
    ]

    const trend = aggregateSentimentTrend(articles, { dimension: 'industry', value: '科技', fillGaps: true })

    expect(trend.value).toBe('科技')
    expect(trend.summary.totalArticles).toBe(2)
    expect(trend.summary.positiveCount).toBe(1)
    expect(trend.summary.neutralCount).toBe(1)
  })

  it('fillGaps 为 true 时填充无资讯日期', () => {
    const articles = [
      createArticle({ id: '1', sentiment: 'positive', publishTime: '2026-01-01T08:00:00Z' }),
      createArticle({ id: '2', sentiment: 'positive', publishTime: '2026-01-03T08:00:00Z' }),
    ]

    const trend = aggregateSentimentTrend(articles, { dimension: 'global', fillGaps: true })

    expect(trend.data).toHaveLength(3)
    expect(trend.data[1]!.date).toBe('2026-01-02')
    expect(trend.data[1]!.total).toBe(0)
    expect(trend.data[1]!.positiveRatio).toBe(0)
  })

  it('fillGaps 为 false 时不填充空日期', () => {
    const articles = [
      createArticle({ id: '1', sentiment: 'positive', publishTime: '2026-01-01T08:00:00Z' }),
      createArticle({ id: '2', sentiment: 'positive', publishTime: '2026-01-03T08:00:00Z' }),
    ]

    const trend = aggregateSentimentTrend(articles, { dimension: 'global', fillGaps: false })

    expect(trend.data).toHaveLength(2)
  })

  it('startDate / endDate 筛选日期范围', () => {
    const articles = [
      createArticle({ id: '1', sentiment: 'positive', publishTime: '2026-01-01T08:00:00Z' }),
      createArticle({ id: '2', sentiment: 'positive', publishTime: '2026-01-05T08:00:00Z' }),
    ]

    const trend = aggregateSentimentTrend(articles, {
      dimension: 'global',
      startDate: '2026-01-01',
      endDate: '2026-01-03',
      fillGaps: true,
    })

    expect(trend.data).toHaveLength(3)
    expect(trend.summary.totalArticles).toBe(1)
  })

  it('extractStockOptions 返回去重排序的股票代码', () => {
    const articles = [
      createArticle({ relatedStocks: ['TSLA', 'AAPL'] }),
      createArticle({ relatedStocks: ['AAPL', 'NVDA'] }),
    ]

    expect(extractStockOptions(articles)).toEqual(['AAPL', 'NVDA', 'TSLA'])
  })

  it('extractIndustryOptions 返回去重排序的分类', () => {
    const articles = [
      createArticle({ category: '消费' }),
      createArticle({ category: '科技' }),
      createArticle({ category: '科技' }),
    ]

    expect(extractIndustryOptions(articles)).toEqual(['消费', '科技'])
  })

  it('空列表返回空序列与零摘要', () => {
    const trend = aggregateSentimentTrend([], { dimension: 'global', fillGaps: true })

    expect(trend.data).toHaveLength(0)
    expect(trend.summary.totalArticles).toBe(0)
    expect(trend.summary.avgDailyArticles).toBe(0)
  })
})
