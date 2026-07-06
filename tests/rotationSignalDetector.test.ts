import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import { saveRotationScore } from '@/services/analysis/rotationScoreService'
import { detectRotationSignals } from '@/services/scoring/rotationSignalDetector'
import { getDefaultDualStrategyRuleConfig } from '@/config/dualStrategyRules'
import type { DailyQuotes, Stock, ValuePitScore } from '@/data/types'

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

function buildDailyQuotes(symbol: string, overrides: Partial<DailyQuotes> = {}): DailyQuotes {
  const history = Array.from({ length: 70 }, (_, i) => {
    const close = 100 + i * 0.6
    return {
      date: `2026-05-${String((i % 30) + 1).padStart(2, '0')}`,
      open: close - 0.5,
      high: close + 0.5,
      low: close - 1,
      close,
      volume: 100000 + i * 1000,
      amount: 10000000 + i * 100000,
    }
  })
  // 强制近 5 日成交量显著高于前 15 日，满足量比条件
  for (let i = history.length - 5; i < history.length; i++) {
    history[i]!.volume = 1000000
    history[i]!.amount = 100000000
  }

  return {
    symbol,
    latest: history[history.length - 1]!,
    history,
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
    ...overrides,
  }
}

function buildValuePitScore(symbol: string, action: ValuePitScore['action']): ValuePitScore {
  return {
    symbol,
    score: 3.2,
    name: '测试板块',
    dimensions: {
      catalyst: 3,
      valuation: 4,
      chip: 3,
      rotation: 3,
      liquidity: 3,
      composite: 3.2,
    },
    rotationSignal: false,
    action,
    calculatedAt: Date.now(),
    dataVersion: 1,
  }
}

async function seedHighFundFlowSector(sectorName: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10)
  await saveRotationScore({
    sectorCode: `TEST-${sectorName}`,
    sectorName,
    scoreDate: date,
    subScores: {
      F1A: 10,
      F1B: 5,
      F1C: 5,
      F1D: 3,
      F1E: 2,
      F2A: 10,
      F2B: 10,
      F2C: 5,
      F2D: 5,
      F3A: 5,
      F3B: 3,
      F3C: 2,
      F4A: 3,
      F4B: 2,
      F5A: 2,
      F5B: 1,
    },
  })
}

describe('rotationSignalDetector', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.rotationScores)
  })

  it('should return empty result for empty input', async () => {
    const result = await detectRotationSignals([])
    expect(result.success).toBe(true)
    expect(result.data?.signals).toHaveLength(0)
    expect(result.data?.watchlistCandidates).toHaveLength(0)
  })

  it('should skip immediate/ignore action scores', async () => {
    const scores: ValuePitScore[] = [
      buildValuePitScore('IMM', 'immediate'),
      buildValuePitScore('IGN', 'ignore'),
    ]

    const result = await detectRotationSignals(scores)
    expect(result.success).toBe(true)
    expect(result.data?.signals).toHaveLength(0)
    expect(result.data?.watchlistCandidates).toHaveLength(0)
  })

  it('should detect rotation signal when all conditions met', async () => {
    const symbol = 'SIGNAL'
    const stock = buildStock(symbol, { sector: '人工智能' })
    await dataLayer.stocks.add(stock)
    await dataLayer.dailyQuotes.save(buildDailyQuotes(symbol))
    await seedHighFundFlowSector('人工智能')

    const score = buildValuePitScore(symbol, 'wait')
    const result = await detectRotationSignals([score])

    expect(result.success).toBe(true)
    expect(result.data?.signals).toHaveLength(1)
    expect(result.data?.signals[0]?.symbol).toBe(symbol)
    expect(result.data?.signals[0]?.type).toBe('buy_rotation')
    expect(result.data?.watchlistCandidates).toHaveLength(0)
  })

  it('should add to watchlist when technical condition fails', async () => {
    const symbol = 'WATCH'
    const stock = buildStock(symbol, { sector: '人工智能' })
    await dataLayer.stocks.add(stock)

    const quotes = buildDailyQuotes(symbol)
    // 让价格跌破 MA20
    for (let i = quotes.history.length - 5; i < quotes.history.length; i++) {
      quotes.history[i]!.close = 50
    }
    await dataLayer.dailyQuotes.save(quotes)
    await seedHighFundFlowSector('人工智能')

    const score = buildValuePitScore(symbol, 'probe')
    const result = await detectRotationSignals([score])

    expect(result.success).toBe(true)
    expect(result.data?.signals).toHaveLength(0)
    expect(result.data?.watchlistCandidates).toHaveLength(1)
    expect(result.data?.watchlistCandidates[0]?.symbol).toBe(symbol)
  })

  it('should add to watchlist when stock data missing', async () => {
    const score = buildValuePitScore('NO-STOCK', 'wait')
    const result = await detectRotationSignals([score])

    expect(result.success).toBe(true)
    expect(result.data?.signals).toHaveLength(0)
    expect(result.data?.watchlistCandidates).toHaveLength(1)
    expect(result.data?.watchlistCandidates[0]?.reason).toContain('基础数据缺失')
  })

  it('should respect custom rule thresholds', async () => {
    const symbol = 'STRICT'
    const stock = buildStock(symbol, { sector: '人工智能' })
    await dataLayer.stocks.add(stock)
    await dataLayer.dailyQuotes.save(buildDailyQuotes(symbol))
    await seedHighFundFlowSector('人工智能')

    const score = buildValuePitScore(symbol, 'wait')
    const strictRules = getDefaultDualStrategyRuleConfig()
    strictRules.rotationVolumeSurgeRatio = 10.0
    strictRules.rotationPriceToMA20Threshold = 1.0

    const result = await detectRotationSignals([score], { ruleConfig: strictRules })

    expect(result.success).toBe(true)
    expect(result.data?.signals).toHaveLength(0)
    expect(result.data?.watchlistCandidates.length).toBeGreaterThanOrEqual(1)
  })
})
