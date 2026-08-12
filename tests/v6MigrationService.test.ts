/**
 * @test_id V9-TEST-UT-068
 * @covers_docs [V9-DOC-PROJ-114, V9-DOC-PROJ-053, V9-DOC-FRONT-012, V9-DOC-PROJ-066]
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import {
  transformV6Stock,
  transformV6Order,
  transformV6DailyQuotes,
  transformV6Score,
  transformV6ScoreToDoc,
  transformV6SectorScore,
  transformV6RotationScore,
  transformV6StrategySnapshot,
  transformV6NewsArticle,
  transformV6SentimentCache,
  transformV6ToV9,
  importToV9,
  runV6Migration,
  sentimentNumberToLabel,
  parseTimestamp,
  type V6ExportShape,
} from '@/services/system/v6MigrationService'

const sampleV6Export: V6ExportShape = {
  stocks: [
    {
      symbol: '600519.SH',
      name: '贵州茅台',
      market: 'A股',
      industryL1: '食品饮料',
      industryL2: '白酒',
      conceptTags: ['白酒龙头'],
      hotTrack: '消费复苏',
      isFavorite: true,
      source: '手动添加',
      tags: ['核心资产'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
  daily_quotes: [
    {
      symbol: '600519.SH',
      tradeDate: '2026-06-05',
      open: 1575,
      high: 1580,
      low: 1570,
      price: 1575,
      volume: 9000,
      amount: 1.4e9,
      updatedAt: '2026-06-05T15:00:00.000Z',
    },
    {
      symbol: '600519.SH',
      tradeDate: '2026-06-06',
      open: 1580,
      high: 1620,
      low: 1570,
      price: 1600,
      volume: 10000,
      amount: 1.6e9,
      updatedAt: '2026-06-06T15:00:00.000Z',
    },
  ],
  v6_scores: [
    {
      symbol: '600519.SH',
      scoreDate: '2026-06-06',
      composite: 4.2,
      l3v: 4.5,
      layers: {
        L0: { score: 4.5, reason: '', weight: 0.1 },
        L3V: { score: 4.2, reason: '', weight: 0.15 },
      },
      modelUsed: 'deepseek-chat',
      promptVersion: 'V6-L0L8-v1',
      createdAt: '2026-06-06T08:00:00.000Z',
    },
  ],
  orders: [
    {
      id: '1717750000000-abc123',
      symbol: '600519.SH',
      type: 'buy',
      date: '2026-06-06',
      time: '10:30',
      price: 1600,
      shares: 100,
      amount: 160000,
      createdAt: '2026-06-06T10:30:00.000Z',
    },
  ],
  sector_scores: [
    {
      sectorCode: 'AI',
      scoreDate: '2026-06-06',
      dimensions: { planAlignment: 4.5, policySupport: 4.2, usChinaParity: 4.0 },
      composite: 4.5,
      isCore: true,
      modelUsed: 'deepseek-chat',
      createdAt: '2026-06-06T08:00:00.000Z',
    },
  ],
  rotation_scores: [
    {
      sectorCode: 'SW_白酒',
      sectorName: '白酒',
      swLevel1: '食品饮料',
      swLevel2: '白酒',
      scoreDate: '2026-06-06',
      f1Jingqi: 35,
      f2Zijin: 25,
      f3Guzhi: 12,
      f4Beta: 8,
      f5Nengliang: 4,
      total: 84,
      resonance: 9,
      signal: '强信号',
      alertLevel: '常态锁仓',
      declineType: '杀估值',
      poolStocks: ['600519.SH'],
      poolStockNames: ['贵州茅台'],
      modelUsed: 'deepseek-chat',
      createdAt: '2026-06-06T08:00:00.000Z',
    },
  ],
  score_docs: [],
  strategy_snapshots: [
    {
      id: 'snapshot_1717750000000',
      version: 1,
      timestamp: '2026-06-06T10:30:00.000Z',
      date: '2026-06-06',
      time: '10:30:00',
      stockCount: 50,
      core: {
        count: 1,
        avgComposite: 4.8,
        maxComposite: 4.8,
        symbols: ['600519.SH'],
        items: [
          {
            symbol: '600519.SH',
            name: '贵州茅台',
            composite: 4.8,
            l1Score: 4.5,
            classification: 'core',
          },
        ],
      },
      hot: { count: 0, avgComposite: 0, maxComposite: 0, symbols: [], items: [] },
      value: { count: 0, avgComposite: 0, maxComposite: 0, symbols: [], items: [] },
      trigger: 'manual',
    },
  ],
  local_docs: [],
  news: [
    {
      id: 'news_xxx',
      title: '贵州茅台业绩超预期',
      content: '...',
      url: 'https://example.com/1',
      source: 'sina',
      category: '个股',
      publishTime: '2026-06-06T09:00:00.000Z',
      fetchTime: '2026-06-06T09:05:00.000Z',
      sentiment: 0.5,
      sentimentConfidence: 0.85,
      relatedStocks: ['600519.SH'],
      keywords: ['茅台'],
      hash: 'hash_xxx',
    },
  ],
  news_stock_map: [
    {
      id: '600519.SH_news_xxx',
      symbol: '600519.SH',
      newsId: 'news_xxx',
      relevanceScore: 0.85,
      isTitleMatch: true,
      isContentMatch: false,
      industryMatch: false,
    },
  ],
  sentiment_cache: [
    {
      id: 'sent_xxx',
      contentHash: 'hash_xxx',
      sentiment: 0.5,
      confidence: 0.85,
      method: 'rule',
      analyzedAt: '2026-06-06T09:05:00.000Z',
    },
  ],
}

describe('v6MigrationService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    dataBridge.invalidateCache(STORE_NAME.orders)
    dataBridge.invalidateCache(STORE_NAME.rotationScores)
    dataBridge.invalidateCache(STORE_NAME.news)
    dataBridge.invalidateCache(STORE_NAME.sentimentCache)
    dataBridge.invalidateCache(STORE_NAME.strategySnapshots)
  })

  describe('sentimentNumberToLabel', () => {
    it('maps positive, negative, neutral correctly', () => {
      expect(sentimentNumberToLabel(0.5)).toBe('positive')
      expect(sentimentNumberToLabel(-0.5)).toBe('negative')
      expect(sentimentNumberToLabel(0)).toBe('neutral')
      expect(sentimentNumberToLabel(0.2)).toBe('neutral')
    })
  })

  describe('parseTimestamp', () => {
    it('parses ISO string to ms', () => {
      expect(parseTimestamp('2026-01-01T00:00:00.000Z')).toBe(1767225600000)
    })

    it('returns undefined for invalid input', () => {
      expect(parseTimestamp(undefined)).toBeUndefined()
      expect(parseTimestamp('invalid')).toBeUndefined()
      expect(parseTimestamp(NaN)).toBeUndefined()
    })
  })

  describe('transformV6Stock', () => {
    it('maps fields per migration spec', () => {
      const v6 = sampleV6Export.stocks![0]!
      const stock = transformV6Stock(v6)
      expect(stock.symbol).toBe('600519.SH')
      expect(stock.name).toBe('贵州茅台')
      expect(stock.researchStatus).toBe('watching')
      expect(stock.source).toBe('manual')
      expect(stock.industryCode).toBe('食品饮料')
      expect(stock.sector).toBe('白酒')
      expect(stock.theme).toContain('白酒龙头')
      expect(stock.theme).toContain('消费复苏')
      expect(stock.group).toBe('核心资产')
      expect(stock.ingestedAt).toBe(1767225600000)
      expect(stock.updatedAt).toBe(1767312000000)
    })
  })

  describe('transformV6Order', () => {
    it('maps buy type and computes createdAt', () => {
      const v6 = sampleV6Export.orders![0]!
      const order = transformV6Order(v6)
      expect(order.symbol).toBe('600519.SH')
      expect(order.direction).toBe('buy')
      expect(order.quantity).toBe(100)
      expect(order.price).toBe(1600)
      expect(order.amount).toBe(160000)
      expect(order.status).toBe('filled')
      expect(order.accountType).toBe('paper')
      expect(order.createdAt).toBe(1780741800000)
    })
  })

  describe('transformV6DailyQuotes', () => {
    it('groups by symbol and builds history + latest', () => {
      const quotes = transformV6DailyQuotes(sampleV6Export.daily_quotes!)
      expect(quotes).toHaveLength(1)
      const quote = quotes[0]!
      expect(quote.symbol).toBe('600519.SH')
      expect(quote.history).toHaveLength(2)
      expect(quote.latest.date).toBe('2026-06-06')
      expect(quote.latest.close).toBe(1600)
      expect(quote.period).toBe('daily')
      expect(quote.adjust).toBe('qfq')
    })
  })

  describe('transformV6Score', () => {
    it('creates V9 v6_scores record', () => {
      const v6 = sampleV6Export.v6_scores![0]!
      const score = transformV6Score(v6)
      expect(score.symbol).toBe('600519.SH')
      expect(score.score).toBe(4.2)
      expect(score.factors.L0).toBe(4.5)
      expect(score.factors.L3V).toBe(4.2)
      expect(score.algorithmVersion).toBe('deepseek-chat__V6-L0L8-v1')
      expect(score.calculatedAt).toBe(1780704000000)
    })
  })

  describe('transformV6ScoreToDoc', () => {
    it('creates ScoreDocVersion from V6 score', () => {
      const v6 = sampleV6Export.v6_scores![0]!
      const doc = transformV6ScoreToDoc(v6)
      expect(doc.symbol).toBe('600519.SH')
      expect(doc.composite).toBe(4.2)
      expect(doc.l3v).toBe(4.5)
      expect(doc.version).toBe(1)
      expect(doc.docId.startsWith('600519.SH__V1__')).toBe(true)
    })
  })

  describe('transformV6SectorScore', () => {
    it('preserves dimensions and composite', () => {
      const v6 = sampleV6Export.sector_scores![0]!
      const score = transformV6SectorScore(v6)
      expect(score.sectorCode).toBe('AI')
      expect(score.composite).toBe(4.5)
      expect(score.isCore).toBe(true)
      expect(score.dimensions.planAlignment).toBe(4.5)
    })
  })

  describe('transformV6RotationScore', () => {
    it('merges poolStocks and poolStockNames into objects', () => {
      const v6 = sampleV6Export.rotation_scores![0]!
      const score = transformV6RotationScore(v6)
      expect(score.sectorCode).toBe('SW_白酒')
      expect(score.poolStocks).toHaveLength(1)
      expect(score.poolStocks[0]).toEqual({ symbol: '600519.SH', name: '贵州茅台' })
    })
  })

  describe('transformV6StrategySnapshot', () => {
    it('converts timestamp to ms and trims items', () => {
      const v6 = sampleV6Export.strategy_snapshots![0]!
      const snapshot = transformV6StrategySnapshot(v6)
      expect(snapshot.timestamp).toBe(1780741800000)
      const firstItem = snapshot.core.items[0]!
      expect(firstItem).toEqual({
        symbol: '600519.SH',
        name: '贵州茅台',
        composite: 4.8,
        classification: 'core',
      })
      expect('l1Score' in firstItem).toBe(false)
    })
  })

  describe('transformV6NewsArticle', () => {
    it('converts sentiment number to label', () => {
      const v6 = sampleV6Export.news![0]!
      const article = transformV6NewsArticle(v6)
      expect(article.sentiment).toBe('positive')
      expect(article.sentimentConfidence).toBe(0.85)
      expect(article.relatedStocks).toContain('600519.SH')
    })
  })

  describe('transformV6SentimentCache', () => {
    it('converts sentiment and analyzedAt', () => {
      const v6 = sampleV6Export.sentiment_cache![0]!
      const cache = transformV6SentimentCache(v6)
      expect(cache.sentiment).toBe('positive')
      expect(cache.analyzedAt).toBe(1780736700000)
    })
  })

  describe('transformV6ToV9', () => {
    it('transforms all supported stores', () => {
      const v9 = transformV6ToV9(sampleV6Export)
      expect(v9.stocks).toHaveLength(1)
      expect(v9.dailyQuotes).toHaveLength(1)
      expect(v9.v6Scores).toHaveLength(1)
      expect(v9.scoreDocsFromScores).toHaveLength(1)
      expect(v9.orders).toHaveLength(1)
      expect(v9.sectorScores).toHaveLength(1)
      expect(v9.rotationScores).toHaveLength(1)
      expect(v9.strategySnapshots).toHaveLength(1)
      expect(v9.news).toHaveLength(1)
      expect(v9.newsStockMaps).toHaveLength(1)
      expect(v9.sentimentCache).toHaveLength(1)
    })
  })

  describe('importToV9', () => {
    it('imports transformed data into V9 stores', async () => {
      const v9 = transformV6ToV9(sampleV6Export)
      const report = await importToV9(v9)
      expect(report.success).toBe(true)
      expect(report.summary.importedRecords).toBeGreaterThan(0)

      const stock = await dataLayer.stocks.get('600519.SH')
      expect(stock).toBeDefined()

      const quote = await dataLayer.dailyQuotes.get('600519.SH')
      expect(quote).toBeDefined()

      const order = await dataLayer.orders.list()
      expect(order).toHaveLength(1)
    })

    it('skips existing records by default', async () => {
      const v9 = transformV6ToV9(sampleV6Export)
      await importToV9(v9)
      const report = await importToV9(v9)
      expect(report.summary.skippedRecords).toBeGreaterThan(0)
    })

    it('overwrites existing records when enabled', async () => {
      const v9 = transformV6ToV9(sampleV6Export)
      await importToV9(v9)
      const report = await importToV9(v9, { overwriteExisting: true })
      expect(report.summary.importedRecords).toBeGreaterThan(0)
      expect(report.summary.skippedRecords).toBe(0)
    })
  })

  describe('runV6Migration', () => {
    it('runs full parse-transform-import pipeline', async () => {
      const result = await runV6Migration(sampleV6Export)
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.summary.importedRecords).toBeGreaterThan(0)
    })

    it('returns error for invalid JSON', async () => {
      const result = await runV6Migration('not an object')
      expect(result.success).toBe(false)
      expect(result.error).toContain('必须是对象')
    })
  })
})
