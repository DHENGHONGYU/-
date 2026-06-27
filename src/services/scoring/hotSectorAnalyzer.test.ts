import { describe, test, expect } from 'vitest'
import {
  calculateMomentum,
  calculateSentiment,
  calculateBreakout,
  calculateValuationRisk,
  calculateMarketEnv,
  analyze,
} from './hotSectorAnalyzer'
import type {
  MomentumInput,
  SentimentInput,
  BreakoutInput,
  ValuationRiskInput,
  HotSectorAnalyzerInput,
} from './hotSectorAnalyzer'

// ============================================================
// calculateMomentum 测试
// ============================================================

describe('calculateMomentum', () => {
  const baseInput: MomentumInput = {
    sectorStrengthScore: 3.0,
    priceChangeRank: 25,
    volumeExpansion: 1.2,
    consecutiveInflow: 0,
    relativeStrength: 50,
  }

  test('invalid sectorStrengthScore returns 0', () => {
    expect(calculateMomentum({ ...baseInput, sectorStrengthScore: -1 })).toBe(0)
    expect(calculateMomentum({ ...baseInput, sectorStrengthScore: 6 })).toBe(0)
  })

  test('top10 rank gives bonus', () => {
    const result = calculateMomentum({ ...baseInput, priceChangeRank: 5 })
    expect(result).toBeGreaterThanOrEqual(4.5)
  })

  test('top30 rank gives moderate bonus', () => {
    const result = calculateMomentum({ ...baseInput, priceChangeRank: 20 })
    expect(result).toBeGreaterThanOrEqual(4.0)
  })

  test('rank > 50 gives no rank bonus', () => {
    const low = calculateMomentum({ ...baseInput, priceChangeRank: 55 })
    const high = calculateMomentum(baseInput)
    expect(low).toBeLessThanOrEqual(high)
  })

  test('high volume expansion gives bonus', () => {
    const result = calculateMomentum({ ...baseInput, volumeExpansion: 2.5 })
    expect(result).toBeGreaterThan(3.5)
  })

  test('consecutive inflow >= 3 gives bonus', () => {
    const result = calculateMomentum({ ...baseInput, consecutiveInflow: 3 })
    expect(result).toBeGreaterThan(3.0)
  })

  test('relative strength deviation adds to score', () => {
    const neutral = calculateMomentum({ ...baseInput, relativeStrength: 50 })
    const extreme = calculateMomentum({ ...baseInput, relativeStrength: 100 })
    expect(extreme).toBeGreaterThanOrEqual(neutral)
  })

  test('result is clamped to 0-5', () => {
    const result = calculateMomentum({
      sectorStrengthScore: 5,
      priceChangeRank: 1,
      volumeExpansion: 3.0,
      consecutiveInflow: 5,
      relativeStrength: 100,
    })
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// calculateSentiment 测试
// ============================================================

describe('calculateSentiment', () => {
  const baseInput: SentimentInput = {
    sentimentRank: 10,
    retailSentiment: 0.5,
    institutionBuyCount: 0,
    limitUpCount: 0,
  }

  test('invalid sentimentRank returns 0', () => {
    expect(calculateSentiment({ ...baseInput, sentimentRank: 0 })).toBe(0)
  })

  test('top5 rank gives max score', () => {
    const result = calculateSentiment({ ...baseInput, sentimentRank: 3 })
    expect(result).toBeGreaterThanOrEqual(4)
  })

  test('rank > 50 gives low score', () => {
    const result = calculateSentiment({ ...baseInput, sentimentRank: 60 })
    expect(result).toBeLessThan(2)
  })

  test('overheated retail sentiment penalizes', () => {
    const normal = calculateSentiment({ ...baseInput, retailSentiment: 0.5 })
    const overheated = calculateSentiment({ ...baseInput, retailSentiment: 0.9 })
    expect(overheated).toBeLessThan(normal)
  })

  test('panic sentiment penalizes less', () => {
    const normal = calculateSentiment({ ...baseInput, retailSentiment: 0.5 })
    const panic = calculateSentiment({ ...baseInput, retailSentiment: 0.1 })
    expect(panic).toBeLessThan(normal)
  })

  test('institution buy >= 5 gives bonus', () => {
    const result = calculateSentiment({ ...baseInput, institutionBuyCount: 5 })
    expect(result).toBeGreaterThanOrEqual(3.5)
  })

  test('limit up >= 10 gives bonus', () => {
    const result = calculateSentiment({ ...baseInput, limitUpCount: 10 })
    expect(result).toBeGreaterThanOrEqual(3.5)
  })

  test('result is clamped to 0-5', () => {
    const result = calculateSentiment({
      sentimentRank: 1,
      retailSentiment: 0.5,
      institutionBuyCount: 10,
      limitUpCount: 20,
    })
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// calculateBreakout 测试
// ============================================================

describe('calculateBreakout', () => {
  const baseInput: BreakoutInput = {
    hasBreakoutPattern: false,
    macdSignal: 'neutral',
    rsi: 50,
    priceAboveMA20: false,
    priceAboveMA60: false,
  }

  test('base neutral gives ~2.5', () => {
    const result = calculateBreakout(baseInput)
    expect(result).toBeCloseTo(2.5, 0)
  })

  test('breakout pattern gives +2', () => {
    const result = calculateBreakout({ ...baseInput, hasBreakoutPattern: true })
    expect(result).toBeGreaterThanOrEqual(4.0)
  })

  test('bullish MACD gives bonus', () => {
    const result = calculateBreakout({ ...baseInput, macdSignal: 'bullish' })
    expect(result).toBeGreaterThan(3.5)
  })

  test('bearish MACD penalizes', () => {
    const result = calculateBreakout({ ...baseInput, macdSignal: 'bearish' })
    expect(result).toBeLessThan(2.0)
  })

  test('RSI 50-70 is optimal', () => {
    const result = calculateBreakout({ ...baseInput, rsi: 60, priceAboveMA20: true })
    expect(result).toBeGreaterThanOrEqual(3.0)
  })

  test('RSI > 80 penalizes (overbought)', () => {
    const result = calculateBreakout({ ...baseInput, rsi: 85 })
    expect(result).toBeLessThan(2.0)
  })

  test('RSI < 30 penalizes (oversold)', () => {
    const result = calculateBreakout({ ...baseInput, rsi: 25 })
    expect(result).toBeLessThan(2.0)
  })

  test('bullish alignment gives bonus', () => {
    const result = calculateBreakout({
      ...baseInput,
      priceAboveMA20: true,
      priceAboveMA60: true,
    })
    expect(result).toBeGreaterThan(3.0)
  })

  test('bearish alignment penalizes', () => {
    const result = calculateBreakout({
      ...baseInput,
      rsi: 40,
      priceAboveMA20: false,
      priceAboveMA60: false,
    })
    expect(result).toBeLessThan(2.0)
  })

  test('result is clamped to 0-5', () => {
    const result = calculateBreakout({
      hasBreakoutPattern: true,
      macdSignal: 'bullish',
      rsi: 60,
      priceAboveMA20: true,
      priceAboveMA60: true,
    })
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// calculateValuationRisk 测试
// ============================================================

describe('calculateValuationRisk', () => {
  const baseInput: ValuationRiskInput = {
    pe: 15,
    pbPercentile: 50,
    marketCap: 200,
    dividendYield: 0,
  }

  test('PE <= 0 returns 0', () => {
    const result = calculateValuationRisk({ ...baseInput, pe: 0 })
    expect(result).toBe(0)
  })

  test('low PE gives high score', () => {
    const result = calculateValuationRisk({ ...baseInput, pe: 8 })
    expect(result).toBeGreaterThanOrEqual(4)
  })

  test('high PE gives low score', () => {
    const result = calculateValuationRisk({ ...baseInput, pe: 60 })
    expect(result).toBeLessThan(2)
  })

  test('low PB percentile gives bonus', () => {
    const result = calculateValuationRisk({ ...baseInput, pbPercentile: 10 })
    expect(result).toBeGreaterThan(3)
  })

  test('high PB percentile penalizes', () => {
    const result = calculateValuationRisk({ ...baseInput, pbPercentile: 90 })
    expect(result).toBeLessThan(3)
  })

  test('large market cap gives bonus', () => {
    const result = calculateValuationRisk({ ...baseInput, marketCap: 2000 })
    expect(result).toBeGreaterThan(3)
  })

  test('small market cap penalizes', () => {
    const result = calculateValuationRisk({ ...baseInput, marketCap: 20 })
    expect(result).toBeLessThan(3)
  })

  test('high dividend yield gives bonus', () => {
    const result = calculateValuationRisk({ ...baseInput, dividendYield: 4 })
    expect(result).toBeGreaterThan(3)
  })

  test('result is clamped to 0-5', () => {
    const result = calculateValuationRisk({
      pe: 5,
      pbPercentile: 5,
      marketCap: 5000,
      dividendYield: 5,
    })
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// calculateMarketEnv 测试
// ============================================================

describe('calculateMarketEnv', () => {
  test('bull market with low risk gives 5', () => {
    const result = calculateMarketEnv({ marketTrend: 'bull', systemicRisk: 'low' })
    expect(result).toBeGreaterThanOrEqual(4.5)
  })

  test('bear market with high risk gives low score', () => {
    const result = calculateMarketEnv({ marketTrend: 'bear', systemicRisk: 'high' })
    expect(result).toBeLessThanOrEqual(0)
  })

  test('sideways with medium risk gives ~3', () => {
    const result = calculateMarketEnv({ marketTrend: 'sideways', systemicRisk: 'medium' })
    expect(result).toBeCloseTo(3, 0)
  })

  test('result is clamped to 0-5', () => {
    const result = calculateMarketEnv({ marketTrend: 'bull', systemicRisk: 'low' })
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// analyze 综合测试
// ============================================================

describe('analyze', () => {
  function makeInput(overrides: Partial<HotSectorAnalyzerInput> = {}): HotSectorAnalyzerInput {
    return {
      symbol: '600519.SH',
      sectorName: '白酒',
      momentum: {
        sectorStrengthScore: 4.0,
        priceChangeRank: 5,
        volumeExpansion: 2.0,
        consecutiveInflow: 3,
        relativeStrength: 65,
      },
      sentiment: {
        sentimentRank: 8,
        retailSentiment: 0.6,
        institutionBuyCount: 3,
        limitUpCount: 5,
      },
      breakout: {
        hasBreakoutPattern: true,
        macdSignal: 'bullish',
        rsi: 60,
        priceAboveMA20: true,
        priceAboveMA60: true,
      },
      valuationRisk: {
        pe: 12,
        pbPercentile: 30,
        marketCap: 2000,
        dividendYield: 2.5,
      },
      marketEnv: {
        marketTrend: 'bull',
        systemicRisk: 'low',
      },
      ...overrides,
    }
  }

  test('strong stock gives buy signal', () => {
    const result = analyze(makeInput())
    expect(result.symbol).toBe('600519.SH')
    expect(result.name).toBe('白酒')
    expect(result.action).toBe('immediate')
    expect(result.score).toBeGreaterThanOrEqual(4.0)
  })

  test('weak stock gives avoid signal', () => {
    const result = analyze(makeInput({
      momentum: {
        sectorStrengthScore: 1.0,
        priceChangeRank: 80,
        volumeExpansion: 0.5,
        consecutiveInflow: 0,
        relativeStrength: 30,
      },
      sentiment: {
        sentimentRank: 60,
        retailSentiment: 0.9,
        institutionBuyCount: 0,
        limitUpCount: 0,
      },
      breakout: {
        hasBreakoutPattern: false,
        macdSignal: 'bearish',
        rsi: 25,
        priceAboveMA20: false,
        priceAboveMA60: false,
      },
      valuationRisk: {
        pe: 80,
        pbPercentile: 90,
        marketCap: 20,
        dividendYield: 0,
      },
      marketEnv: {
        marketTrend: 'bear',
        systemicRisk: 'high',
      },
    }))
    expect(result.action).toBe('ignore')
    expect(result.score).toBeLessThan(3.5)
  })

  test('dimensions are rounded to 2 decimal places', () => {
    const result = analyze(makeInput())
    for (const key of Object.keys(result.dimensions) as Array<keyof typeof result.dimensions>) {
      const val = result.dimensions[key]
      expect(val.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
    }
  })

  test('calculatedAt is a valid timestamp', () => {
    const result = analyze(makeInput())
    expect(result.calculatedAt).toBeGreaterThan(0)
    expect(result.calculatedAt).toBeLessThanOrEqual(Date.now())
  })

  test('hold signal at boundary', () => {
    // Create input that gives score between 3.5 and 4.0
    const result = analyze(makeInput({
      momentum: {
        sectorStrengthScore: 3.0,
        priceChangeRank: 30,
        volumeExpansion: 1.0,
        consecutiveInflow: 0,
        relativeStrength: 50,
      },
      sentiment: {
        sentimentRank: 20,
        retailSentiment: 0.5,
        institutionBuyCount: 0,
        limitUpCount: 0,
      },
      breakout: {
        hasBreakoutPattern: false,
        macdSignal: 'neutral',
        rsi: 50,
        priceAboveMA20: true,
        priceAboveMA60: false,
      },
    }))
    expect(result.score).toBeGreaterThanOrEqual(3.5)
    expect(result.score).toBeLessThan(4.0)
    expect(result.action).toBe('probe')
  })
})