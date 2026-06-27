import { describe, test, expect } from 'vitest'
import {
  calculateCatalyst,
  calculateValuationMargin,
  calculateChipStructure,
  calculateRotationPosition,
  calculateLiquidity,
  analyze,
} from './valuePitAnalyzer'
import type {
  CatalystInput,
  ValuationMarginInput,
  ChipStructureInput,
  RotationPositionInput,
  LiquidityInput,
  ValuePitAnalyzerInput,
} from './valuePitAnalyzer'

// ============================================================
// calculateCatalyst 测试
// ============================================================

describe('calculateCatalyst', () => {
  const baseInput: CatalystInput = {
    policyCatalyst: 2.5,
    cycleTurningPoint: 2.5,
    techBreakthrough: 2.5,
    orderSurge: 2.5,
  }

  test('max signal is returned as base', () => {
    const result = calculateCatalyst({
      ...baseInput,
      policyCatalyst: 4.0,
    })
    expect(result).toBeGreaterThanOrEqual(4.0)
  })

  test('cycle + order double confirmation gives bonus', () => {
    const base = calculateCatalyst(baseInput)
    const double = calculateCatalyst({
      ...baseInput,
      cycleTurningPoint: 3.5,
      orderSurge: 3.5,
    })
    expect(double).toBeGreaterThan(base)
  })

  test('policy + tech double confirmation gives bonus', () => {
    const base = calculateCatalyst(baseInput)
    const double = calculateCatalyst({
      ...baseInput,
      policyCatalyst: 3.5,
      techBreakthrough: 3.5,
    })
    expect(double).toBeGreaterThan(base)
  })

  test('all four signals strong gives high score', () => {
    const result = calculateCatalyst({
      policyCatalyst: 5,
      cycleTurningPoint: 5,
      techBreakthrough: 5,
      orderSurge: 5,
    })
    expect(result).toBeGreaterThanOrEqual(5)
  })

  test('result is clamped to 0-5', () => {
    const result = calculateCatalyst({
      policyCatalyst: 5,
      cycleTurningPoint: 5,
      techBreakthrough: 5,
      orderSurge: 5,
    })
    expect(result).toBeLessThanOrEqual(5)
    expect(result).toBeGreaterThanOrEqual(0)
  })

  test('weak signals give low score', () => {
    const result = calculateCatalyst({
      policyCatalyst: 0.5,
      cycleTurningPoint: 0.5,
      techBreakthrough: 0.5,
      orderSurge: 0.5,
    })
    expect(result).toBeLessThan(1.0)
  })
})

// ============================================================
// calculateValuationMargin 测试
// ============================================================

describe('calculateValuationMargin', () => {
  const baseInput: ValuationMarginInput = {
    pePercentile: 50,
    pbPercentile: 50,
    dividendYield: 0,
    peg: 1.0,
  }

  test('low PE percentile gives high score', () => {
    const result = calculateValuationMargin({ ...baseInput, pePercentile: 10, pbPercentile: 10 })
    expect(result).toBeGreaterThanOrEqual(4)
  })

  test('high PE percentile gives low score', () => {
    const result = calculateValuationMargin({ ...baseInput, pePercentile: 90, pbPercentile: 90 })
    expect(result).toBeLessThan(2)
  })

  test('PE/PB average is used', () => {
    const result = calculateValuationMargin({ ...baseInput, pePercentile: 10, pbPercentile: 90 })
    expect(result).toBeGreaterThan(2)
    expect(result).toBeLessThan(4)
  })

  test('high dividend yield gives bonus', () => {
    const result = calculateValuationMargin({ ...baseInput, dividendYield: 5 })
    expect(result).toBeGreaterThan(3)
  })

  test('low PEG gives bonus', () => {
    const result = calculateValuationMargin({ ...baseInput, peg: 0.3 })
    expect(result).toBeGreaterThan(3)
  })

  test('high PEG penalizes', () => {
    const result = calculateValuationMargin({ ...baseInput, peg: 3.0 })
    expect(result).toBeLessThan(3)
  })

  test('PEG == 0 does not affect score', () => {
    const withPeg = calculateValuationMargin({ ...baseInput, peg: 1.0 })
    const noPeg = calculateValuationMargin({ ...baseInput, peg: 0 })
    // PEG 0 is treated as no adjustment (not in any bonus/penalty range)
    expect(noPeg).toBeLessThanOrEqual(withPeg)
  })

  test('result is clamped to 0-5', () => {
    const result = calculateValuationMargin({
      pePercentile: 5,
      pbPercentile: 5,
      dividendYield: 10,
      peg: 0.1,
    })
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// calculateChipStructure 测试
// ============================================================

describe('calculateChipStructure', () => {
  const baseInput: ChipStructureInput = {
    northBoundChange: 0,
    fundPositionChange: 0,
    shareholderChange: 0,
  }

  test('neutral gives ~2.5', () => {
    const result = calculateChipStructure(baseInput)
    expect(result).toBeCloseTo(2.5, 0)
  })

  test('strong northbound inflow gives bonus', () => {
    const result = calculateChipStructure({ ...baseInput, northBoundChange: 3 })
    expect(result).toBeGreaterThan(4)
  })

  test('northbound outflow penalizes', () => {
    const result = calculateChipStructure({ ...baseInput, northBoundChange: -2 })
    expect(result).toBeLessThan(2.5)
  })

  test('strong fund addition gives bonus', () => {
    const result = calculateChipStructure({ ...baseInput, fundPositionChange: 6 })
    expect(result).toBeGreaterThan(4)
  })

  test('fund reduction penalizes', () => {
    const result = calculateChipStructure({ ...baseInput, fundPositionChange: -4 })
    expect(result).toBeLessThan(2.5)
  })

  test('shareholder concentration gives bonus', () => {
    const result = calculateChipStructure({ ...baseInput, shareholderChange: -15 })
    expect(result).toBeGreaterThan(4)
  })

  test('shareholder dispersion penalizes', () => {
    const result = calculateChipStructure({ ...baseInput, shareholderChange: 15 })
    expect(result).toBeLessThan(2.5)
  })

  test('all three positive gives high score', () => {
    const result = calculateChipStructure({
      northBoundChange: 3,
      fundPositionChange: 6,
      shareholderChange: -15,
    })
    expect(result).toBeGreaterThanOrEqual(5)
  })

  test('result is clamped to 0-5', () => {
    const result = calculateChipStructure({
      northBoundChange: 5,
      fundPositionChange: 10,
      shareholderChange: -20,
    })
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// calculateRotationPosition 测试
// ============================================================

describe('calculateRotationPosition', () => {
  const baseInput: RotationPositionInput = {
    sectorVolumePercentile: 50,
    capitalInflowStrength: 2.5,
    hasGoldenCross: false,
  }

  test('low volume percentile gives high score', () => {
    const result = calculateRotationPosition({ ...baseInput, sectorVolumePercentile: 10 })
    expect(result).toBeGreaterThan(3.5)
  })

  test('high volume percentile gives low score', () => {
    const result = calculateRotationPosition({ ...baseInput, sectorVolumePercentile: 90 })
    expect(result).toBeLessThan(2.5)
  })

  test('golden cross gives bonus', () => {
    const result = calculateRotationPosition({ ...baseInput, hasGoldenCross: true })
    expect(result).toBeGreaterThan(3.5)
  })

  test('strong capital inflow + golden cross gives high score', () => {
    const result = calculateRotationPosition({
      sectorVolumePercentile: 10,
      capitalInflowStrength: 5,
      hasGoldenCross: true,
    })
    expect(result).toBeGreaterThan(4)
  })

  test('result is clamped to 0-5', () => {
    const result = calculateRotationPosition({
      sectorVolumePercentile: 5,
      capitalInflowStrength: 5,
      hasGoldenCross: true,
    })
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// calculateLiquidity 测试
// ============================================================

describe('calculateLiquidity', () => {
  const baseInput: LiquidityInput = {
    avgDailyAmount: 50000, // 5亿 = 50000万
    turnoverRate: 2,
    marketCap: 200,
  }

  test('high daily amount gives high score', () => {
    const result = calculateLiquidity({ ...baseInput, avgDailyAmount: 100000 })
    expect(result).toBeGreaterThanOrEqual(4)
  })

  test('low daily amount gives low score', () => {
    const result = calculateLiquidity({ ...baseInput, avgDailyAmount: 3000 })
    expect(result).toBeLessThan(3)
  })

  test('optimal turnover rate (1-3%) gives bonus', () => {
    const result = calculateLiquidity({ ...baseInput, turnoverRate: 2 })
    expect(result).toBeGreaterThan(4)
  })

  test('high turnover rate (>10%) penalizes', () => {
    const result = calculateLiquidity({ ...baseInput, turnoverRate: 15 })
    expect(result).toBeLessThan(4)
  })

  test('low turnover rate (<0.3%) penalizes', () => {
    const result = calculateLiquidity({ ...baseInput, turnoverRate: 0.1 })
    expect(result).toBeLessThan(4)
  })

  test('large market cap gives bonus', () => {
    const result = calculateLiquidity({ ...baseInput, marketCap: 1000 })
    expect(result).toBeGreaterThan(4)
  })

  test('small market cap penalizes relative to large cap', () => {
    const largeCap = calculateLiquidity({ ...baseInput, marketCap: 500 })
    const smallCap = calculateLiquidity({ ...baseInput, marketCap: 20 })
    expect(smallCap).toBeLessThan(largeCap)
  })

  test('result is clamped to 0-5', () => {
    const result = calculateLiquidity({
      avgDailyAmount: 1000000,
      turnoverRate: 2,
      marketCap: 5000,
    })
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// analyze 综合测试
// ============================================================

describe('analyze', () => {
  function makeInput(overrides: Partial<ValuePitAnalyzerInput> = {}): ValuePitAnalyzerInput {
    return {
      symbol: '000858.SZ',
      sectorName: '白酒',
      catalyst: {
        policyCatalyst: 3.0,
        cycleTurningPoint: 2.5,
        techBreakthrough: 2.5,
        orderSurge: 2.5,
      },
      valuationMargin: {
        pePercentile: 30,
        pbPercentile: 35,
        dividendYield: 2.0,
        peg: 0.8,
      },
      chipStructure: {
        northBoundChange: 1.0,
        fundPositionChange: 2.0,
        shareholderChange: -5,
      },
      rotationPosition: {
        sectorVolumePercentile: 25,
        capitalInflowStrength: 3.0,
        hasGoldenCross: true,
      },
      liquidity: {
        avgDailyAmount: 80000,
        turnoverRate: 2.0,
        marketCap: 500,
      },
      ...overrides,
    }
  }

  test('strong value pit gives build status', () => {
    const result = analyze(makeInput())
    expect(result.symbol).toBe('000858.SZ')
    expect(result.name).toBe('白酒')
    expect(result.action).toBe('immediate')
    expect(result.score).toBeGreaterThanOrEqual(4.0)
  })

  test('weak value pit gives wait_signal status', () => {
    const result = analyze(makeInput({
      catalyst: {
        policyCatalyst: 1.0,
        cycleTurningPoint: 1.0,
        techBreakthrough: 1.0,
        orderSurge: 1.0,
      },
      valuationMargin: {
        pePercentile: 80,
        pbPercentile: 80,
        dividendYield: 0.5,
        peg: 2.5,
      },
      chipStructure: {
        northBoundChange: -1,
        fundPositionChange: -3,
        shareholderChange: 10,
      },
      rotationPosition: {
        sectorVolumePercentile: 80,
        capitalInflowStrength: 1.0,
        hasGoldenCross: false,
      },
      liquidity: {
        avgDailyAmount: 5000,
        turnoverRate: 0.2,
        marketCap: 20,
      },
    }))
    expect(result.action).toBe('ignore')
    expect(result.score).toBeLessThan(3.5)
  })

  test('test status at boundary', () => {
    const result = analyze(makeInput({
      catalyst: {
        policyCatalyst: 3.5,
        cycleTurningPoint: 3.0,
        techBreakthrough: 3.0,
        orderSurge: 3.0,
      },
      valuationMargin: {
        pePercentile: 25,
        pbPercentile: 45,
        dividendYield: 1.5,
        peg: 1.0,
      },
      chipStructure: {
        northBoundChange: 0,
        fundPositionChange: 0,
        shareholderChange: 0,
      },
      rotationPosition: {
        sectorVolumePercentile: 30,
        capitalInflowStrength: 3.5,
        hasGoldenCross: false,
      },
      liquidity: {
        avgDailyAmount: 50000,
        turnoverRate: 2.0,
        marketCap: 200,
      },
    }))
    expect(result.score).toBeGreaterThanOrEqual(3.5)
    expect(result.score).toBeLessThan(4.0)
    expect(result.action).toBe('probe')
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
})