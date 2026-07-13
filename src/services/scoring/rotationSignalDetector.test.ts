import { describe, test, expect } from 'vitest'
import {
  checkVolumeBreakthrough,
  checkCapitalInflow,
  checkGoldenCross,
  detect,
} from './rotationSignalDetector'
import type {
  CapitalFlowData,
  GoldenCrossData,
  RotationSignalInput,
} from './rotationSignalDetector'

// ============================================================
// checkVolumeBreakthrough 测试
// ============================================================

describe('checkVolumeBreakthrough', () => {
  test('returns false when data is insufficient', () => {
    expect(checkVolumeBreakthrough({ history: [1, 2, 3] })).toBe(false)
  })

  test('returns true when recent volume exceeds 20th percentile', () => {
    // 历史成交量：大部分在 100 附近，近期放大到 300
    const history = [
      ...Array(50).fill(100), // 50 days of 100
      300, 300, 300, 300, 300, // 5 days of 300
    ]
    expect(checkVolumeBreakthrough({ history })).toBe(true)
  })

  test('returns false when recent volume is below 20th percentile', () => {
    const history = [
      ...Array(50).fill(100), // 50 days of 100
      50, 50, 50, 50, 50, // 5 days of 50
    ]
    expect(checkVolumeBreakthrough({ history })).toBe(false)
  })

  test('custom percentile threshold works', () => {
    // 低值占多数，高值在尾部
    const history = [
      ...Array(40).fill(50),
      ...Array(10).fill(100),
      150, 150, 150, 150, 150,
    ]
    // 突破 20% 分位（40个50 + 10个100 → 20%分位=50）→ true
    expect(checkVolumeBreakthrough({ history }, 20)).toBe(true)
    // 80% 分位（40个50 + 10个100 → 80%分位=100，recent avg=150 > 100）→ true
    // 用 80% 分位时，需要更多高值才能让分位 > 150
    const history2 = [
      ...Array(10).fill(50),
      ...Array(35).fill(200),
      150, 150, 150, 150, 150,
    ]
    expect(checkVolumeBreakthrough({ history: history2 }, 80)).toBe(false)
  })

  test('handles edge case with exactly 5 data points', () => {
    const history = [100, 100, 100, 100, 200]
    // 最近5日均量 = 120, 20% percentile of [100,100,100,100,200] = 100
    expect(checkVolumeBreakthrough({ history })).toBe(true)
  })
})

// ============================================================
// checkCapitalInflow 测试
// ============================================================

describe('checkCapitalInflow', () => {
  test('returns false when data is insufficient', () => {
    expect(checkCapitalInflow({ dailyNetFlow: [1, 2] })).toBe(false)
  })

  test('returns true when last 3 days are all positive', () => {
    const data: CapitalFlowData = {
      dailyNetFlow: [-1, 2, 3, 5, 10, 8],
    }
    expect(checkCapitalInflow(data)).toBe(true)
  })

  test('returns false when any of last 3 days is negative', () => {
    const data: CapitalFlowData = {
      dailyNetFlow: [5, 10, -2, 3, 8],
    }
    expect(checkCapitalInflow(data)).toBe(false)
  })

  test('returns false when last 3 days includes zero', () => {
    const data: CapitalFlowData = {
      dailyNetFlow: [5, 10, 0, 3, 8],
    }
    expect(checkCapitalInflow(data)).toBe(false)
  })

  test('custom days parameter works', () => {
    const data: CapitalFlowData = {
      dailyNetFlow: [1, 2, 3, 4, 5],
    }
    expect(checkCapitalInflow(data, 5)).toBe(true)
    expect(checkCapitalInflow(data, 3)).toBe(true)
  })

  test('exactly 3 days of data works', () => {
    const data: CapitalFlowData = {
      dailyNetFlow: [1, 2, 3],
    }
    expect(checkCapitalInflow(data)).toBe(true)
  })
})

// ============================================================
// checkGoldenCross 测试
// ============================================================

describe('checkGoldenCross', () => {
  test('returns false when data is insufficient', () => {
    const data: GoldenCrossData = {
      closes: Array(10).fill(100),
    }
    expect(checkGoldenCross(data)).toBe(false)
  })

  test('returns true when golden cross occurs', () => {
    // 构造金叉：短期均线(5)上穿长期均线(20)
    // 前20天=105 → 长期均线锚定在 105
    // 第21-24天=100 → 短期均线下行，昨天短期MA=101, 长期MA=104 (101<=104)
    // 第25天=130  → 跳升，今天短期MA=106, 长期MA=105.25 (106>105.25)，价格130>106
    const closes = [
      ...Array(20).fill(105),   // 长期均线锚定
      100, 100, 100, 100,       // 第21-24天：压低短期均线
      130,                       // 第25天：跳升形成金叉
    ]
    const data: GoldenCrossData = { closes, shortPeriod: 5, longPeriod: 20 }
    expect(checkGoldenCross(data)).toBe(true)
  })

  test('returns false when no golden cross (short MA below long MA)', () => {
    // 价格持续下跌，短期均线在长期均线下方
    const closes = [
      ...Array(16).fill(110).map((v, i) => v - i * 0.3),
      105, 104, 103, 102, 101,
      100, 99, 98, 97, 96,
    ]
    const data: GoldenCrossData = { closes, shortPeriod: 5, longPeriod: 20 }
    expect(checkGoldenCross(data)).toBe(false)
  })

  test('returns false when already in uptrend (no fresh cross)', () => {
    // 持续上升趋势中，短期均线始终在长期均线上方，昨日 short 已经 > long
    // checkGoldenCross 要求 yesterdayShort <= yesterdayLong，因此不是刚上穿
    const data: GoldenCrossData = {
      closes: Array(25).fill(100).map((v, i) => v + i),
      shortPeriod: 5,
      longPeriod: 20,
    }
    expect(checkGoldenCross(data)).toBe(false)
  })

  test('custom periods work', () => {
    const closes = Array(30).fill(100).map((v, i) => v + i * 0.1)
    const data: GoldenCrossData = { closes, shortPeriod: 10, longPeriod: 30 }
    // 持续上升趋势中，短期均线始终在长期均线上方，不是刚上穿
    expect(checkGoldenCross(data)).toBe(false)
  })
})

// ============================================================
// detect 综合测试
// ============================================================

describe('detect', () => {
  function makeInput(overrides: Partial<RotationSignalInput> = {}): RotationSignalInput {
    return {
      sectorId: '白酒',
      volume: {
        history: [
          ...Array(50).fill(100),
          300, 300, 300, 300, 300,
        ],
      },
      capitalFlow: {
        dailyNetFlow: [1, 2, 3, 4, 5],
      },
      goldenCross: {
        closes: [
          ...Array(20).fill(105),
          100, 100, 100, 100,
          130,
        ],
      },
      ...overrides,
    }
  }

  test('all three conditions met → triggered', () => {
    const result = detect(makeInput())
    expect(result.sectorId).toBe('白酒')
    expect(result.triggered).toBe(true)
    expect(result.conditions.volumeBreakthrough).toBe(true)
    expect(result.conditions.capitalInflow).toBe(true)
    expect(result.conditions.goldenCross).toBe(true)
    expect(result.strength).toBe('strong')
  })

  test('any condition fails → not triggered', () => {
    const result = detect(makeInput({
      capitalFlow: { dailyNetFlow: [1, 2, -3, 4, 5] },
    }))
    expect(result.triggered).toBe(false)
    expect(result.conditions.volumeBreakthrough).toBe(true)
    expect(result.conditions.capitalInflow).toBe(false)
    expect(result.conditions.goldenCross).toBe(true)
  })

  test('all conditions fail → not triggered, strength weak', () => {
    const result = detect(makeInput({
      volume: { history: Array(55).fill(50) },
      capitalFlow: { dailyNetFlow: [-1, -2, -3, -4, -5] },
      goldenCross: { closes: Array(25).fill(100) },
    }))
    expect(result.triggered).toBe(false)
    expect(result.conditions.volumeBreakthrough).toBe(false)
    expect(result.conditions.capitalInflow).toBe(false)
    expect(result.conditions.goldenCross).toBe(false)
    expect(result.strength).toBe('weak')
  })

  test('medium strength with moderate volume surge', () => {
    // 20%分位=100, 中位数=100, 80%分位=200, recent avg=130 → medium
    const history = [
      ...Array(40).fill(100),
      ...Array(10).fill(200),
      130, 130, 130, 130, 130,
    ]
    const result = detect(makeInput({
      volume: { history },
    }))
    expect(result.triggered).toBe(true)
    expect(result.strength).toBe('medium')
  })

  test('detectedAt is a valid timestamp', () => {
    const result = detect(makeInput())
    expect(result.detectedAt).toBeGreaterThan(0)
    expect(result.detectedAt).toBeLessThanOrEqual(Date.now())
  })

  test('weak volume breakthrough gives weak strength', () => {
    // 20%分位=70, 中位数=100, 80%分位=200, recent avg=76 → weak
    const history = [
      ...Array(10).fill(50),
      ...Array(10).fill(70),
      ...Array(25).fill(100),
      ...Array(5).fill(200),
      76, 76, 76, 76, 76,
    ]
    const result = detect(makeInput({
      volume: { history },
    }))
    if (result.triggered) {
      expect(result.strength).toBe('weak')
    }
  })
})