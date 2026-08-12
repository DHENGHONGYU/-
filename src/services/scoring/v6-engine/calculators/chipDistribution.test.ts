/**
 * @test_id V9-TEST-ST-104
 * 筹码分布 + 穿透率（PAS）单元测试
 *
 * 覆盖：calcChipDistribution、calcPAS、pasToScore
 *
 * @doc TASK-03: 补充筹码穿透率（PAS）指标
 * @doc TASK-04: 补充筹码乖离率（BIAS）指标
 * @doc TASK-05: 补充获利盘比例（PRO）指标
 */

import { describe, test, expect, vi } from 'vitest'
import { calcChipDistribution, calcPAS, pasToScore, calcVWAP, calcBias, biasToScore, calcProfitRatio, profitToScore } from './chipDistribution'
import type { ChipDistribution } from './chipDistribution'
import { evaluateChip } from './l7_l8'
import type { LayerInput } from '../types'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

function createBaseInput(overrides?: Partial<LayerInput>): LayerInput {
  return {
    stock: { symbol: 'TEST', name: '测试股' },
    financials: {},
    quotes: {},
    config: { weights: { l7: 0.15, l8: 0.04 } } as any,
    ...overrides,
  }
}

// ============================================================
// calcChipDistribution 筹码分布计算
// ============================================================

describe('calcChipDistribution 筹码分布计算', () => {
  test('60日数据 → 返回有效分布', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 10 + Math.sin(i / 10) * 2)
    const volumes = Array.from({ length: 60 }, () => 1000000 + Math.random() * 500000)
    const dist = calcChipDistribution(closes, volumes, { currentPrice: closes[59] })

    expect(dist.source).toBe('real')
    expect(dist.daysUsed).toBe(60)
    expect(dist.buckets.length).toBe(50)
    expect(dist.totalChips).toBeGreaterThan(0)
    expect(dist.vwap).not.toBeNull()
    expect(dist.vwap!).toBeGreaterThan(8)
    expect(dist.vwap!).toBeLessThan(14)
  })

  test('少量数据（2日）→ 仍可计算', () => {
    const dist = calcChipDistribution([10, 11], [1000, 2000], { currentPrice: 11 })
    expect(dist.source).toBe('real')
    expect(dist.daysUsed).toBe(2)
    expect(dist.buckets.length).toBe(50)
    expect(dist.totalChips).toBeGreaterThan(0)
  })

  test('空数据 → proxy 模式', () => {
    const dist = calcChipDistribution([], [])
    expect(dist.source).toBe('proxy')
    expect(dist.daysUsed).toBe(0)
    expect(dist.buckets.length).toBe(0)
  })

  test('单日数据 → proxy 模式', () => {
    const dist = calcChipDistribution([10], [1000])
    expect(dist.source).toBe('proxy')
    expect(dist.daysUsed).toBe(0)
  })

  test('所有价格相同 → 扩展为微小区间', () => {
    const dist = calcChipDistribution([10, 10, 10], [1000, 2000, 3000])
    expect(dist.source).toBe('real')
    expect(dist.buckets.length).toBe(50)
    expect(dist.totalChips).toBeGreaterThan(0)
  })

  test('时间衰减：越近的交易日权重越高', () => {
    const closes = [10, 10, 20, 20]
    const volumes = [1000, 1000, 1000, 1000]
    const dist = calcChipDistribution(closes, volumes)

    const lowBuckets = dist.buckets.filter((b) => b.priceMax <= 15)
    const highBuckets = dist.buckets.filter((b) => b.priceMin >= 15)
    const lowChips = lowBuckets.reduce((s, b) => s + b.chipAmount, 0)
    const highChips = highBuckets.reduce((s, b) => s + b.chipAmount, 0)

    expect(highChips).toBeGreaterThan(lowChips)
  })

  test('获利盘比例计算正确', () => {
    const closes = [10, 10, 10, 20, 20, 20]
    const volumes = [1000, 1000, 1000, 1000, 1000, 1000]
    const dist = calcChipDistribution(closes, volumes, { currentPrice: 15 })

    expect(dist.profitRatio).not.toBeNull()
    expect(dist.profitRatio!).toBeGreaterThan(0)
    expect(dist.profitRatio!).toBeLessThan(1)
  })
})

// ============================================================
// calcPAS 穿透率计算
// ============================================================

describe('calcPAS 穿透率计算', () => {
  function makeFlatDistribution(): ChipDistribution {
    const closes = Array.from({ length: 30 }, (_, i) => 10 + i * 0.3)
    const volumes = Array.from({ length: 30 }, () => 100000)
    return calcChipDistribution(closes, volumes, { currentPrice: 18 })
  }

  test('向上穿透 → PAS > 0', () => {
    const dist = makeFlatDistribution()
    const pas = calcPAS(dist, 18.5, 17.5, 50000)
    expect(pas).not.toBeNull()
    expect(pas!).toBeGreaterThan(0)
  })

  test('向下穿透 → PAS < 0', () => {
    const dist = makeFlatDistribution()
    const pas = calcPAS(dist, 17.5, 18.5, 50000)
    expect(pas).not.toBeNull()
    expect(pas!).toBeLessThan(0)
  })

  test('价格不变 → PAS = 0', () => {
    const dist = makeFlatDistribution()
    const pas = calcPAS(dist, 18, 18, 50000)
    expect(pas).toBe(0)
  })

  test('成交量为 0 → PAS = 0', () => {
    const dist = makeFlatDistribution()
    const pas = calcPAS(dist, 18.5, 17.5, 0)
    expect(pas).toBe(0)
  })

  test('无分布数据 → PAS = null', () => {
    const emptyDist: ChipDistribution = {
      buckets: [],
      bucketCount: 50,
      daysUsed: 0,
      vwap: null,
      concentration70: null,
      concentration90: null,
      profitRatio: null,
      source: 'proxy',
      totalChips: 0,
    }
    const pas = calcPAS(emptyDist, 10, 9, 1000)
    expect(pas).toBeNull()
  })

  test('股价穿越全部筹码区 → PAS 有效', () => {
    const dist = makeFlatDistribution()
    const pas = calcPAS(dist, 20, 10, 100000)
    expect(pas).not.toBeNull()
    expect(pas!).toBeGreaterThan(0)
    expect(Math.abs(pas!)).toBeLessThan(1)
  })

  test('股价未穿越任何筹码区 → PAS = 0', () => {
    const dist = makeFlatDistribution()
    const pas = calcPAS(dist, 5, 5.1, 50000)
    expect(pas).toBe(0)
  })

  test('穿越筹码越多，PAS 越小（成交量固定）', () => {
    const dist = makeFlatDistribution()
    const smallCross = calcPAS(dist, 18.2, 18, 50000)
    const largeCross = calcPAS(dist, 19, 17, 50000)
    expect(Math.abs(largeCross!)).toBeLessThanOrEqual(Math.abs(smallCross!))
  })

  test('成交量越大，PAS 越大', () => {
    const dist = makeFlatDistribution()
    const smallVol = calcPAS(dist, 18.5, 17.5, 10000)
    const largeVol = calcPAS(dist, 18.5, 17.5, 100000)
    expect(Math.abs(largeVol!)).toBeGreaterThan(Math.abs(smallVol!))
  })
})

// ============================================================
// pasToScore 评分映射
// ============================================================

describe('pasToScore 评分映射', () => {
  test('PAS > 0.3 → 5 分', () => {
    expect(pasToScore(0.5)).toBe(5)
    expect(pasToScore(0.31)).toBe(5)
    expect(pasToScore(1.0)).toBe(5)
  })

  test('0.1 < PAS ≤ 0.3 → 3 分', () => {
    expect(pasToScore(0.2)).toBe(3)
    expect(pasToScore(0.11)).toBe(3)
    expect(pasToScore(0.3)).toBe(3)
  })

  test('0 < PAS ≤ 0.1 → 2 分', () => {
    expect(pasToScore(0.05)).toBe(2)
    expect(pasToScore(0.01)).toBe(2)
    expect(pasToScore(0.1)).toBe(2)
  })

  test('-0.1 ≤ PAS ≤ 0 → 2 分', () => {
    expect(pasToScore(0)).toBe(2)
    expect(pasToScore(-0.05)).toBe(2)
    expect(pasToScore(-0.1)).toBe(2)
  })

  test('-0.3 ≤ PAS < -0.1 → 1.5 分', () => {
    expect(pasToScore(-0.15)).toBe(1.5)
    expect(pasToScore(-0.25)).toBe(1.5)
    expect(pasToScore(-0.3)).toBe(1.5)
  })

  test('PAS < -0.3 → 1 分', () => {
    expect(pasToScore(-0.4)).toBe(1)
    expect(pasToScore(-1.0)).toBe(1)
  })

  test('null → null', () => {
    expect(pasToScore(null)).toBeNull()
  })
})

// ============================================================
// evaluateChip 集成 PAS
// ============================================================

describe('evaluateChip PAS + BIAS + PRO 集成', () => {
  test('有历史数据时 PAS + BIAS + PRO 参与 CSR 计算', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 10 + Math.sin(i / 10) * 2)
    const volumes = Array.from({ length: 60 }, () => 1000000)
    const result = evaluateChip(createBaseInput({
      quotes: {
        return20d: 0.05,
        volatility20d: 0.03,
        avgTurnover20d: 0.02,
        return60d: 0.15,
        history: closes,
        volumeHistory: volumes,
        latestClose: closes[closes.length - 1],
      },
    }))

    expect(result.levels.PAS).not.toBeNull()
    expect(result.levels.BIAS).not.toBeNull()
    expect(result.levels.PRO).not.toBeNull()
    expect(result.distribution).not.toBeNull()
    expect(result.distribution?.source).toBe('real')
    expect(result.pas).not.toBeNull()
    expect(result.bias).not.toBeNull()
    expect(result.profitRatio).not.toBeNull()
  })

  test('无历史数据时 PAS + BIAS + PRO = null，不影响 CSR', () => {
    const result = evaluateChip(createBaseInput({
      quotes: {
        return20d: 0.05,
        volatility20d: 0.03,
        avgTurnover20d: 0.02,
        return60d: 0.15,
      },
    }))

    expect(result.levels.PAS).toBeNull()
    expect(result.levels.BIAS).toBeNull()
    expect(result.levels.PRO).toBeNull()
    expect(result.distribution).toBeNull()
    expect(result.pas).toBeNull()
    expect(result.bias).toBeNull()
    expect(result.profitRatio).toBeNull()
    expect(result.takeProfitWarning).toBe(false)
    expect(result.levels.CSR).not.toBeNull()
  })
})

// ============================================================
// calcVWAP 成交量加权均价
// ============================================================

describe('calcVWAP 成交量加权均价', () => {
  test('正常数据 → 返回加权均价', () => {
    const closes = [10, 11, 12]
    const volumes = [100, 200, 300]
    // VWAP = (10×100 + 11×200 + 12×300) / (100+200+300) = 6800/600 = 11.333
    const vwap = calcVWAP(closes, volumes)
    expect(vwap).not.toBeNull()
    expect(vwap!).toBeCloseTo(11.333, 2)
  })

  test('所有价格相同 → VWAP = 该价格', () => {
    const vwap = calcVWAP([15, 15, 15], [100, 200, 300])
    expect(vwap).toBe(15)
  })

  test('空数组 → null', () => {
    expect(calcVWAP([], [])).toBeNull()
  })

  test('含零成交量的日期 → 跳过该日', () => {
    const vwap = calcVWAP([10, 11, 12], [100, 0, 300])
    // VWAP = (10×100 + 12×300) / (100+300) = 4600/400 = 11.5
    expect(vwap).toBe(11.5)
  })

  test('全部零成交量 → null', () => {
    expect(calcVWAP([10, 11, 12], [0, 0, 0])).toBeNull()
  })

  test('长度不一致 → 取较短长度', () => {
    const vwap = calcVWAP([10, 11, 12, 13], [100, 200])
    // VWAP = (10×100 + 11×200) / 300 = 3200/300 = 10.666...
    expect(vwap).not.toBeNull()
    expect(vwap!).toBeCloseTo(10.666, 2)
  })
})

// ============================================================
// calcBias 筹码乖离率
// ============================================================

describe('calcBias 筹码乖离率', () => {
  test('股价高于 VWAP → 正乖离率', () => {
    const bias = calcBias(10, 11)
    expect(bias).toBe(0.1) // (11-10)/10 = 0.1 = 10%
  })

  test('股价低于 VWAP → 负乖离率', () => {
    const bias = calcBias(10, 9)
    expect(bias).toBe(-0.1) // (9-10)/10 = -0.1 = -10%
  })

  test('股价等于 VWAP → 乖离率为 0', () => {
    const bias = calcBias(10, 10)
    expect(bias).toBe(0)
  })

  test('VWAP 为 null → 返回 null', () => {
    expect(calcBias(null, 10)).toBeNull()
  })

  test('VWAP 为 0 → 返回 null', () => {
    expect(calcBias(0, 10)).toBeNull()
  })

  test('当前股价为 0 → 返回 null', () => {
    expect(calcBias(10, 0)).toBeNull()
  })

  test('VWAP 为负 → 返回 null', () => {
    expect(calcBias(-5, 10)).toBeNull()
  })
})

// ============================================================
// biasToScore 评分映射
// ============================================================

describe('biasToScore 评分映射', () => {
  test('|bias| < 5% → 5 分', () => {
    expect(biasToScore(0)).toBe(5)
    expect(biasToScore(0.03)).toBe(5)
    expect(biasToScore(-0.04)).toBe(5)
    expect(biasToScore(0.049)).toBe(5)
  })

  test('5% ≤ |bias| < 15% → 3 分', () => {
    expect(biasToScore(0.05)).toBe(3)
    expect(biasToScore(0.10)).toBe(3)
    expect(biasToScore(-0.10)).toBe(3)
    expect(biasToScore(0.149)).toBe(3)
    expect(biasToScore(-0.14)).toBe(3)
  })

  test('|bias| ≥ 15% → 1 分', () => {
    expect(biasToScore(0.15)).toBe(1)
    expect(biasToScore(0.20)).toBe(1)
    expect(biasToScore(-0.15)).toBe(1)
    expect(biasToScore(-0.30)).toBe(1)
    expect(biasToScore(1.0)).toBe(1)
  })

  test('null → null', () => {
    expect(biasToScore(null)).toBeNull()
  })
})

// ============================================================
// calcProfitRatio 获利盘比例
// ============================================================

describe('calcProfitRatio 获利盘比例', () => {
  test('当前价高于所有筹码 → ratio = 1', () => {
    const dist = calcChipDistribution([10, 10, 10], [1000, 2000, 3000], { currentPrice: 10 })
    // currentPrice 等于分布最高价 → 全部获利
    const ratio = calcProfitRatio(dist, 100)
    expect(ratio).not.toBeNull()
    expect(ratio).toBeCloseTo(1, 5)
  })

  test('当前价低于所有筹码 → ratio = 0', () => {
    const dist = calcChipDistribution([10, 10, 10], [1000, 2000, 3000], { currentPrice: 10 })
    const ratio = calcProfitRatio(dist, 1)
    expect(ratio).not.toBeNull()
    expect(ratio).toBeCloseTo(0, 5)
  })

  test('当前价在中间 → 0 < ratio < 1', () => {
    const closes = [10, 10, 10, 20, 20, 20]
    const volumes = [1000, 1000, 1000, 1000, 1000, 1000]
    const dist = calcChipDistribution(closes, volumes)
    const ratio = calcProfitRatio(dist, 15)
    expect(ratio).not.toBeNull()
    expect(ratio!).toBeGreaterThan(0)
    expect(ratio!).toBeLessThan(1)
  })

  test('空分布 → null', () => {
    const emptyDist: ChipDistribution = {
      buckets: [],
      bucketCount: 50,
      daysUsed: 0,
      vwap: null,
      concentration70: null,
      concentration90: null,
      profitRatio: null,
      source: 'proxy',
      totalChips: 0,
    }
    expect(calcProfitRatio(emptyDist, 10)).toBeNull()
  })

  test('部分穿越桶按比例计算', () => {
    const dist = calcChipDistribution([10, 20], [1000, 1000], { currentPrice: 15 })
    const ratio = calcProfitRatio(dist, 15)
    // 15 在 [10, 20] 的中间，约一半筹码在下方
    expect(ratio).not.toBeNull()
    expect(ratio!).toBeGreaterThan(0.3)
    expect(ratio!).toBeLessThan(0.7)
  })

  test('分布自带的 profitRatio 与独立计算一致', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 10 + i * 0.2)
    const volumes = Array.from({ length: 30 }, () => 50000)
    const currentPrice = 13
    const dist = calcChipDistribution(closes, volumes, { currentPrice })
    const standaloneRatio = calcProfitRatio(dist, currentPrice)
    expect(dist.profitRatio).not.toBeNull()
    expect(standaloneRatio).not.toBeNull()
    expect(dist.profitRatio!).toBeCloseTo(standaloneRatio!, 5)
  })
})

// ============================================================
// profitToScore 评分映射
// ============================================================

describe('profitToScore 评分映射', () => {
  test('40% ≤ ratio ≤ 60% → 5 分（健康均衡）', () => {
    expect(profitToScore(0.4)).toBe(5)
    expect(profitToScore(0.5)).toBe(5)
    expect(profitToScore(0.6)).toBe(5)
  })

  test('20% ≤ ratio < 40% → 3 分（偏向低）', () => {
    expect(profitToScore(0.2)).toBe(3)
    expect(profitToScore(0.3)).toBe(3)
    expect(profitToScore(0.399)).toBe(3)
  })

  test('60% < ratio ≤ 80% → 3 分（偏向高）', () => {
    expect(profitToScore(0.601)).toBe(3)
    expect(profitToScore(0.7)).toBe(3)
    expect(profitToScore(0.8)).toBe(3)
  })

  test('ratio < 20% → 1 分（极端套牢）', () => {
    expect(profitToScore(0)).toBe(1)
    expect(profitToScore(0.1)).toBe(1)
    expect(profitToScore(0.199)).toBe(1)
  })

  test('ratio > 80% → 1 分（极端获利，止盈风险）', () => {
    expect(profitToScore(0.801)).toBe(1)
    expect(profitToScore(0.9)).toBe(1)
    expect(profitToScore(1.0)).toBe(1)
  })

  test('null → null', () => {
    expect(profitToScore(null)).toBeNull()
  })

  test('边界值：0.4 → 5（含等于）', () => {
    expect(profitToScore(0.4)).toBe(5)
  })

  test('边界值：0.6 → 5（含等于）', () => {
    expect(profitToScore(0.6)).toBe(5)
  })
})

// ============================================================
// takeProfitWarning MATRIX 联动测试
// ============================================================

describe('takeProfitWarning MATRIX 联动', () => {
  test('获利盘 > 80% + MATRIX ≥ 3.5 → 止盈预警 = true', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 10 + i * 0.15)
    const volumes = Array.from({ length: 60 }, () => 1000000)
    const result = evaluateChip(createBaseInput({
      quotes: {
        return20d: 0.08,
        volatility20d: 0.01,
        avgTurnover20d: 0.01,
        return60d: 0.5,
        history: closes,
        volumeHistory: volumes,
        latestClose: closes[closes.length - 1],
      },
    }))

    if (result.profitRatio != null && result.profitRatio > 0.8 && result.levels.MATRIX != null && result.levels.MATRIX >= 3.5) {
      expect(result.takeProfitWarning).toBe(true)
    }
  })

  test('无历史数据 → takeProfitWarning = false', () => {
    const result = evaluateChip(createBaseInput({
      quotes: {
        return20d: 0.05,
        volatility20d: 0.03,
        avgTurnover20d: 0.02,
        return60d: 0.15,
      },
    }))

    expect(result.takeProfitWarning).toBe(false)
  })

  test('获利盘 ≤ 80% → takeProfitWarning = false', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 10 + Math.sin(i / 5) * 3)
    const volumes = Array.from({ length: 60 }, () => 1000000)
    const result = evaluateChip(createBaseInput({
      quotes: {
        return20d: 0.05,
        volatility20d: 0.03,
        avgTurnover20d: 0.02,
        return60d: 0.15,
        history: closes,
        volumeHistory: volumes,
        latestClose: closes[closes.length - 1],
      },
    }))

    if (result.profitRatio != null && result.profitRatio <= 0.8) {
      expect(result.takeProfitWarning).toBe(false)
    }
  })

  test('获利盘 > 80% 但 MATRIX < 3.5 → takeProfitWarning = false', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 10 + i * 0.15)
    const volumes = Array.from({ length: 60 }, () => 1000000)
    const result = evaluateChip(createBaseInput({
      quotes: {
        return20d: -0.05,
        volatility20d: 0.05,
        avgTurnover20d: 0.08,
        return60d: -0.1,
        history: closes,
        volumeHistory: volumes,
        latestClose: closes[closes.length - 1],
      },
    }))

    if (result.profitRatio != null && result.profitRatio > 0.8 && result.levels.MATRIX != null && result.levels.MATRIX < 3.5) {
      expect(result.takeProfitWarning).toBe(false)
    }
  })
})
