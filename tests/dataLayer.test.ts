import { describe, expect, it, beforeEach } from 'vitest'
import { dataLayer } from '@/data/dataLayer'
import { db } from '@/data/db'
import { DEFAULT_POOL_GROUP } from '@/config/dbConfig'

describe('dataLayer', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
  })

  it('should add and retrieve a stock', async () => {
    const result = await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
    })

    expect(result.success).toBe(true)

    const stock = await dataLayer.stocks.get('000001.SZ')
    expect(stock).toBeDefined()
    expect(stock?.name).toBe('平安银行')
  })

  it('should default group to default pool group when adding stock', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
    })

    const stock = await dataLayer.stocks.get('000001.SZ')
    expect(stock?.group).toBe(DEFAULT_POOL_GROUP)
  })

  it('should not add duplicate stock', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
    })

    const result = await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
    })

    expect(result.success).toBe(false)
  })

  it('should list stocks by group', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
      group: '核心持仓',
    })
    await dataLayer.stocks.add({
      symbol: '600519.SH',
      name: '贵州茅台',
      researchStatus: 'candidate',
      source: 'manual',
      group: '成长配置',
    })

    const list = await dataLayer.stocks.listByGroup('核心持仓')
    expect(list).toHaveLength(1)
    expect(list[0]?.symbol).toBe('000001.SZ')
  })

  it('should list all distinct groups', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
      group: '核心持仓',
    })
    await dataLayer.stocks.add({
      symbol: '600519.SH',
      name: '贵州茅台',
      researchStatus: 'candidate',
      source: 'manual',
      group: '成长配置',
    })

    const groups = await dataLayer.stocks.listGroups()
    expect(groups).toContain('核心持仓')
    expect(groups).toContain('成长配置')
    expect(groups).toContain(DEFAULT_POOL_GROUP)
  })

  it('should update stock group', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
    })

    const before = await dataLayer.stocks.get('000001.SZ')
    const beforeVersion = before?.dataVersion ?? 1

    const result = await dataLayer.stocks.updateGroup('000001.SZ', '核心持仓')
    expect(result.success).toBe(true)

    const stock = await dataLayer.stocks.get('000001.SZ')
    expect(stock?.group).toBe('核心持仓')
    expect(stock?.dataVersion).toBe(beforeVersion + 1)
  })

  it('should save and retrieve daily quotes', async () => {
    const quotes = {
      symbol: '000001.SZ',
      latest: {
        date: '2026-06-24',
        open: 12.0,
        high: 12.5,
        low: 11.8,
        close: 12.3,
        volume: 12345,
        amount: 151843.5,
      },
      history: [],
      period: 'daily',
      adjust: 'qfq',
      updatedAt: Date.now(),
    }

    const result = await dataLayer.dailyQuotes.save(quotes)
    expect(result.success).toBe(true)

    const saved = await dataLayer.dailyQuotes.get('000001.SZ')
    expect(saved).toBeDefined()
    expect(saved?.latest.close).toBe(12.3)
  })

  it('should save and retrieve rotation score', async () => {
    const score = {
      id: 'AI__2026-06-24',
      sectorCode: 'AI',
      sectorName: '人工智能',
      scoreDate: '2026-06-24',
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
      poolStocks: [],
      modelUsed: 'rotation-v3.1',
      createdAt: new Date().toISOString(),
    }

    const result = await dataLayer.rotationScores.save(score)
    expect(result.success).toBe(true)

    const saved = await dataLayer.rotationScores.get('AI__2026-06-24')
    expect(saved).toBeDefined()
    expect(saved?.total).toBe(84)
  })

  it('should save and retrieve sector score', async () => {
    const score = {
      id: 'AI__2026-06-24',
      sectorCode: 'AI',
      scoreDate: '2026-06-24',
      dimensions: { planAlignment: 5, policySupport: 5, usChinaParity: 4 },
      composite: 4.55,
      isCore: true,
      modelUsed: 'sector-v4-static',
      createdAt: new Date().toISOString(),
    }

    const result = await dataLayer.sectorScores.save(score)
    expect(result.success).toBe(true)

    const saved = await dataLayer.sectorScores.get('AI__2026-06-24')
    expect(saved).toBeDefined()
    expect(saved?.composite).toBe(4.55)
  })

  it('should save and retrieve score doc version', async () => {
    const doc = {
      docId: '000001.SZ__1__1234567890',
      symbol: '000001.SZ',
      stockName: '平安银行',
      version: 1,
      scoreDate: '2026-06-24',
      composite: 4.2,
      l3v: 3.8,
      layers: {},
      recommendation: { key: 'buy', label: '买入', color: '#10b981' },
      targetPrice: { bull: 15, base: 13, bear: 11 },
      keyRisks: [],
      keyCatalysts: [],
      reportMd: '# 测试报告',
      modelUsed: 'v6',
      market: 'A股',
      createdAt: new Date().toISOString(),
    }

    const result = await dataLayer.scoreDocs.save(doc)
    expect(result.success).toBe(true)

    const saved = await dataLayer.scoreDocs.get('000001.SZ__1__1234567890')
    expect(saved).toBeDefined()
    expect(saved?.reportMd).toBe('# 测试报告')
  })
})
