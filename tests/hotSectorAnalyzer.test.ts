import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import { analyzeHotSectors, getLatestHotSectorScore } from '@/services/scoring/hotSectorAnalyzer'
import { getDefaultDualStrategyRuleConfig } from '@/config/dualStrategyRules'
import type { DailyQuotes, IndustryScore, Stock, V6Score } from '@/data/types'

function buildStock(symbol: string, overrides: Partial<Omit<Stock, 'dataVersion'>> = {}): Stock {
  return {
    symbol,
    name: `${symbol} 测试`,
    price: 100,
    researchStatus: 'candidate',
    source: 'manual',
    dataVersion: 1,
    ...overrides,
  }
}

function buildV6Score(symbol: string, score: number): V6Score {
  return {
    symbol,
    score,
    factors: { 估值: 3.5, 情绪: 3.8, 行业: 3.2 },
    algorithmVersion: 'v9-auto',
    calculatedAt: Date.now(),
    dataVersion: 1,
  }
}

function buildDailyQuotes(symbol: string): DailyQuotes {
  const history = Array.from({ length: 70 }, (_, i) => ({
    date: `2026-05-${String((i % 30) + 1).padStart(2, '0')}`,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100 + i * 0.5,
    volume: 100000 + i * 1000,
    amount: 10000000 + i * 100000,
  }))
  return {
    symbol,
    latest: history[history.length - 1]!,
    history,
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
  }
}

function buildIndustryScore(name: string, overallScore: number): IndustryScore {
  return {
    code: name,
    name,
    overallScore,
    scoredAt: Date.now(),
    dimensionScores: [],
    summary: '',
    basis: '',
    missingFields: [],
    sectorSnapshot: {
      composite: overallScore,
      recommendation: '',
      positionPct: '0%',
      subTracks: [],
    },
    configSnapshot: {
      model: 'test',
      baseURL: '',
    },
    modelResponse: '',
  }
}

describe('hotSectorAnalyzer', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
  })

  it('should analyze stocks above V6 threshold and persist scores', async () => {
    const stocks: Stock[] = [buildStock('A'), buildStock('B'), buildStock('C')]

    for (const stock of stocks) {
      await dataLayer.stocks.add(stock)
      await dataLayer.v6Scores.save(buildV6Score(stock.symbol, stock.symbol === 'C' ? 3.0 : 4.2))
      await dataLayer.dailyQuotes.save(buildDailyQuotes(stock.symbol))
    }

    const result = await analyzeHotSectors(stocks)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data?.map((s) => s.symbol).sort()).toEqual(['A', 'B'])

    const persisted = await getLatestHotSectorScore('A')
    expect(persisted).toBeDefined()
    expect(persisted?.symbol).toBe('A')
    expect(persisted?.score).toBeGreaterThanOrEqual(0)
    expect(persisted?.score).toBeLessThanOrEqual(5)
  })

  it('should return empty array for no matching stocks', async () => {
    const stocks: Stock[] = [buildStock('LOW')]
    await dataLayer.stocks.add(stocks[0]!)
    await dataLayer.v6Scores.save(buildV6Score('LOW', 2.0))

    const result = await analyzeHotSectors(stocks)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(0)
  })

  it('should classify trigger action based on composite score', async () => {
    const stock = buildStock('EDGE', { sector: '半导体' })
    await dataLayer.stocks.add(stock)
    await dataLayer.v6Scores.save(buildV6Score('EDGE', 3.6))
    await dataLayer.dailyQuotes.save(buildDailyQuotes('EDGE'))
    await dataLayer.industryScores.save(buildIndustryScore('半导体', 4.5))

    const result = await analyzeHotSectors([stock])

    expect(result.success).toBe(true)
    const score = result.data?.[0]
    expect(score).toBeDefined()
    expect(['immediate', 'probe', 'ignore']).toContain(score?.action)
  })

  it('should respect custom rule thresholds', async () => {
    const stock = buildStock('THRESH')
    await dataLayer.stocks.add(stock)
    await dataLayer.v6Scores.save(buildV6Score('THRESH', 3.4))

    const strictRules = getDefaultDualStrategyRuleConfig()
    strictRules.hotSectorV6Min = 3.5

    const result = await analyzeHotSectors([stock], { ruleConfig: strictRules })

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(0)
  })
})
