import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import {
  analyzeText,
  analyzeNewsArticle,
  getOrAnalyzeSentiment,
  getSentimentFromCache,
  hashContent,
} from '@/services/news/sentimentAnalyzer'

describe('sentimentAnalyzer', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.sentimentCache)
  })

  it('classifies positive text', () => {
    const result = analyzeText('公司盈利大幅增长，股价强劲上涨')
    expect(result.score).toBeGreaterThan(0.2)
    expect(result.sentiment).toBe('positive')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('classifies negative text', () => {
    const result = analyzeText('业绩亏损，股价暴跌，市场恐慌')
    expect(result.score).toBeLessThan(-0.2)
    expect(result.sentiment).toBe('negative')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('classifies neutral text', () => {
    const result = analyzeText('这是一条普通的新闻内容')
    expect(Math.abs(result.score)).toBeLessThan(0.2)
    expect(result.sentiment).toBe('neutral')
  })

  it('flips sentiment on negation words', () => {
    const negated = analyzeText('公司没有增长，业务并不强劲')
    const plain = analyzeText('公司增长，业务强劲')
    expect(negated.score).toBeLessThan(plain.score)
    expect(negated.sentiment).toBe('negative')
  })

  it('amplifies sentiment with degree words', () => {
    const strong = analyzeText('公司非常强劲，利润极其丰厚')
    const weak = analyzeText('公司强劲，利润丰厚')
    expect(strong.score).toBeGreaterThan(weak.score)
  })

  it('weights title higher than content', () => {
    const result = analyzeNewsArticle({
      title: '业绩大涨',
      content: '整体平稳',
    })
    expect(result.sentiment).toBe('positive')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('hashes content deterministically', () => {
    const hash1 = hashContent('利好大涨')
    const hash2 = hashContent('利好大涨')
    expect(hash1).toBe(hash2)
    expect(hash1.length).toBeGreaterThan(0)
  })

  it('caches sentiment analysis by content hash', async () => {
    const content = '利好大涨'
    const first = await getOrAnalyzeSentiment(content)
    expect(first.sentiment).toBe('positive')

    const cached = await getSentimentFromCache(first.contentHash)
    expect(cached).toBeDefined()
    expect(cached?.sentiment).toBe('positive')

    const second = await getOrAnalyzeSentiment(content)
    expect(second.contentHash).toBe(first.contentHash)
    expect(second.sentiment).toBe(first.sentiment)
  })
})
