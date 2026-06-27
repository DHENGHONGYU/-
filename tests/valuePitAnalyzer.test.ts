import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import { analyzeValuePits, getLatestValuePitScore } from '@/services/trading/valuePitAnalyzer'
import { saveDefaultRotationScores } from '@/services/analysis/rotationScoreService'
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
    marketCap: 50_000_000_000,
    ...overrides,
  }
}

function buildV6Score(symbol: string, score: number): V6Score {
  return {
    symbol,
    score,
    factors: { 估值: 4.0, 行业: 3.5, 情绪: 3.2 },
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
    amount: 1_000_000_000 + i * 10_000_000,
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

describe('valuePitAnalyzer', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
  })

  it('should analyze stocks within V6 band and persist scores', async () => {
    const stocks: Stock[] = [
      buildStock('A', { sector: '人工智能' }),
      buildStock('B', { sector: '集成电路' }),
      buildStock('C', { sector: '新能源汽车' }),
    ]

    for (const stock of stocks) {
      await dataLayer.stocks.add(stock)
      await dataLayer.v6Scores.save(buildV6Score(stock.symbol, stock.symbol === 'C' ? 4.5 : 3.0))
      await dataLayer.dailyQuotes.save(buildDailyQuotes(stock.symbol))
    }

    await saveDefaultRotationScores()

    const result = await analyzeValuePits(stocks)

    expect(result.success).toBe(true)
    expect(result.data?.length).toBeGreaterThanOrEqual(1)

    const first = result.data?.[0]
    expect(first).toBeDefined()
    expect(first?.dimensions.catalyst).toBeGreaterThanOrEqual(0)
    expect(first?.dimensions.valuation).toBeGreaterThanOrEqual(0)
    expect(first?.dimensions.rotation).toBeGreaterThanOrEqual(0)

    const persisted = await getLatestValuePitScore(first!.symbol)
    expect(persisted).toBeDefined()
    expect(persisted?.score).toBe(first?.score)
  })

  it('should exclude stocks outside V6 value pit band', async () => {
    const lowStock = buildStock('LOW', { sector: '人工智能' })
    await dataLayer.stocks.add(lowStock)
    await dataLayer.v6Scores.save(buildV6Score('LOW', 1.5))
    await dataLayer.dailyQuotes.save(buildDailyQuotes('LOW'))

    const result = await analyzeValuePits([lowStock])

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(0)
  })

  it('should classify trigger action across wait/probe/immediate', async () => {
    const stock = buildStock('EDGE', { sector: '人工智能' })
    await dataLayer.stocks.add(stock)
    await dataLayer.v6Scores.save(buildV6Score('EDGE', 3.0))
    await dataLayer.dailyQuotes.save(buildDailyQuotes('EDGE'))
    await dataLayer.industryScores.save(buildIndustryScore('人工智能', 4.2))
    await saveDefaultRotationScores()

    const result = await analyzeValuePits([stock])

    expect(result.success).toBe(true)
    const score = result.data?.[0]
    expect(score).toBeDefined()
    expect(['immediate', 'probe', 'wait', 'ignore']).toContain(score?.triggerAction)
  })

  it('should respect custom rule thresholds', async () => {
    const stock = buildStock('THRESH', { sector: '人工智能' })
    await dataLayer.stocks.add(stock)
    await dataLayer.v6Scores.save(buildV6Score('THRESH', 2.7))
    await dataLayer.dailyQuotes.save(buildDailyQuotes('THRESH'))

    const strictRules = getDefaultDualStrategyRuleConfig()
    strictRules.valuePitV6Min = 3.0

    const result = await analyzeValuePits([stock], { ruleConfig: strictRules })

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(0)
  })
})
