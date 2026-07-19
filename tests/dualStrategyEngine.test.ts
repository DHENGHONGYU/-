/**
 * @test_id V9-TEST-UT-019
 * @covers_docs [V9-DOC-PROJ-054, V9-DOC-PROJ-114, V9-DOC-PROJ-066, V9-DOC-ARCH-008]
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import { saveDefaultRotationScores } from '@/services/analysis/rotationScoreService'
import { runDualStrategy } from '@/services/trading/dualStrategyEngine'
import type { DailyQuotes, IndustryScore, Stock, V6Score } from '@/data/types'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'

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
    factors: { 估值: 3.8, 情绪: 3.5, 行业: 3.2 },
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
    // 收盘价走低：制造「无技术金叉」场景，使价值洼地评分落入 wait 区间，
    // 从而在轮动信号未触发时进入观察清单（runDualStrategy 对 wait 才生成观察候选）。
    close: 200 - i * 0.5,
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

describe('dualStrategyEngine', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    dataBridge.invalidateCache(STORE_NAME.rotationScores)
  })

  it('应该返回 empty result for empty stocks', async () => {
    const result = await runDualStrategy([])

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.summary.total).toBe(0)
    expect(result.data!.hotSectorScores).toHaveLength(0)
    expect(result.data!.valuePitScores).toHaveLength(0)
  })

  it('应该orchestrate hot sector and value pit analysis', async () => {
    const stocks: Stock[] = [
      buildStock('HOT', { sector: '人工智能' }),
      buildStock('PIT', { sector: '集成电路' }),
    ]

    for (const stock of stocks) {
      await dataLayer.stocks.add(stock)
      // HOT: 高 V6 → 热门路径
      // PIT: 中等 V6 → 洼地路径
      const v6 = stock.symbol === 'HOT' ? 4.2 : 3.0
      await dataLayer.v6Scores.save(buildV6Score(stock.symbol, v6))
      await dataLayer.dailyQuotes.save(buildDailyQuotes(stock.symbol))
      await dataLayer.industryScores.save(buildIndustryScore(stock.sector!, 4.0))
    }

    await saveDefaultRotationScores()

    const result = await runDualStrategy(stocks)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.summary.total).toBe(2)
    expect(result.data!.summary.hotSectorCount).toBeGreaterThanOrEqual(1)
    expect(result.data!.summary.valuePitCount).toBeGreaterThanOrEqual(1)
    expect(result.data!.summary.signalCount + result.data!.summary.watchlistCount).toBeGreaterThanOrEqual(1)
  })

  it('应该持久化 scores when persistScores is true', async () => {
    const stock = buildStock('PERSIST', { sector: '人工智能' })
    await dataLayer.stocks.add(stock)
    await dataLayer.v6Scores.save(buildV6Score('PERSIST', 4.2))
    await dataLayer.dailyQuotes.save(buildDailyQuotes('PERSIST'))
    await dataLayer.industryScores.save(buildIndustryScore('人工智能', 4.0))

    const result = await runDualStrategy([stock])

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    const hotPersisted = await dataLayer.hotSectorScores.get('PERSIST')
    expect(hotPersisted).toBeDefined()
  })
})
