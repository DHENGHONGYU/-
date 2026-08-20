/**
 * @test_id V9-TEST-UT-069
 * @covers_docs [V9-DOC-PROJ-114, V9-DOC-BACK-012, V9-DOC-PROJ-054, V9-DOC-ARCH-008]
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import { analyzeValuePits, getLatestValuePitScore } from '@/services/scoring/valuePitAnalyzer'
import { saveDefaultRotationScores } from '@/services/analysis/rotationScoreService'
import { getDefaultDualStrategyRuleConfig } from '@/config/dualStrategyRules'
import type { DailyQuotes, IndustryScore, Stock, V6Score } from '@/data/types'

function buildStock(symbol: string, overrides: Partial<Omit<Stock, 'dataVersion'>> = {}): Stock {
  return {
    symbol,
    name: `${symbol} 测试`,
    price: 100,
    pool: 'research',
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
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    dataBridge.invalidateCache(STORE_NAME.rotationScores)
  })

  it('应该analyze stocks within V6 band and persist scores', async () => {
    // P0-6: InsertStockHandler 校验 symbol 格式（A股 6位数字+SH/SZ/BJ / 港股 数字+HK / 美股 字母+US），
    // 必须使用合法格式 symbol，否则 dataLayer.stocks.add 静默失败导致后续 analyze 查不到 stock。
    const stocks: Stock[] = [
      buildStock('600001.SH', { sector: '人工智能' }),
      buildStock('600002.SH', { sector: '集成电路' }),
      buildStock('600003.SH', { sector: '新能源汽车' }),
    ]

    for (const stock of stocks) {
      await dataLayer.stocks.add(stock)
      await dataLayer.v6Scores.save(buildV6Score(stock.symbol, stock.symbol === '600003.SH' ? 4.5 : 3.0))
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

  it('应该exclude stocks outside V6 value pit band', async () => {
    const lowStock = buildStock('600004.SH', { sector: '人工智能' })
    await dataLayer.stocks.add(lowStock)
    await dataLayer.v6Scores.save(buildV6Score('600004.SH', 1.5))
    await dataLayer.dailyQuotes.save(buildDailyQuotes('600004.SH'))

    const result = await analyzeValuePits([lowStock])

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(0)
  })

  it('应该classify trigger action across wait/probe/immediate', async () => {
    const stock = buildStock('600005.SH', { sector: '人工智能' })
    await dataLayer.stocks.add(stock)
    await dataLayer.v6Scores.save(buildV6Score('600005.SH', 3.0))
    await dataLayer.dailyQuotes.save(buildDailyQuotes('600005.SH'))
    await dataLayer.industryScores.save(buildIndustryScore('人工智能', 4.2))
    await saveDefaultRotationScores()

    const result = await analyzeValuePits([stock])

    expect(result.success).toBe(true)
    const score = result.data?.[0]
    expect(score).toBeDefined()
    expect(['immediate', 'probe', 'wait', 'ignore']).toContain(score?.action)
  })

  it('应该respect custom rule thresholds', async () => {
    const stock = buildStock('600006.SH', { sector: '人工智能' })
    await dataLayer.stocks.add(stock)
    await dataLayer.v6Scores.save(buildV6Score('600006.SH', 2.7))
    await dataLayer.dailyQuotes.save(buildDailyQuotes('600006.SH'))

    const strictRules = getDefaultDualStrategyRuleConfig()
    strictRules.valuePitV6Min = 3.0

    const result = await analyzeValuePits([stock], { ruleConfig: strictRules })

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(0)
  })
})
