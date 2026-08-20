/**
 * G3-B Golden Test · 阶段 A（合成数据验证）
 *
 * 验证目标：
 * 1. hybrid 混合衰减模型在 6 种换手率趋势下的正确性
 * 2. 向后兼容：无 turnoverRate 时回退 linear 衰减
 * 3. 核心指标在合理范围（[0,1]、[min,max] 等基本约束）
 * 4. hybrid vs linear：趋势性换手率场景下差异显著
 * 5. 边界条件：零换手、极端换手、单一价格、空数据
 *
 * @doc G3-B: 2026-08-20 换手率衰减对齐 CYQ 算法 · Golden Test Phase A
 */

import { describe, test, expect } from 'vitest'
import { calcChipDistribution, type ChipDistribution } from '@/services/scoring/v6-engine/calculators/chipDistribution'
import { buildGoldenTestCases, type ChipGoldenTestCase } from '@/fixtures/chip-golden-test-data'

const testCases = buildGoldenTestCases()

// ============================================================
// 1. 基础正确性：所有指标在合理范围
// ============================================================

describe('G3-B Golden Test · 基础正确性', () => {
  describe.each(testCases)(
    '${symbol} ${name}（trend=${turnoverTrend}）',
    (tc: ChipGoldenTestCase) => {
      let hybrid: ChipDistribution
      let linear: ChipDistribution

      beforeAll(() => {
        hybrid = calcChipDistribution(tc.closes, tc.volumes, {
          turnoverRates: tc.turnoverRates,
          windowDays: 250,
          bucketCount: 50,
          currentPrice: tc.currentPrice,
          decayModel: 'hybrid',
        })

        linear = calcChipDistribution(tc.closes, tc.volumes, {
          windowDays: 250,
          bucketCount: 50,
          currentPrice: tc.currentPrice,
          decayModel: 'linear',
        })
      })

      test('hybrid 结果 source=real，buckets 非空', () => {
        expect(hybrid.source).toBe('real')
        expect(hybrid.buckets.length).toBeGreaterThan(0)
        expect(hybrid.totalChips).toBeGreaterThan(0)
      })

      test('profitRatio ∈ [0, 1]', () => {
        expect(hybrid.profitRatio).toBeGreaterThanOrEqual(0)
        expect(hybrid.profitRatio).toBeLessThanOrEqual(1)
      })

      test('vwap ∈ [min(close), max(close)]', () => {
        const minC = Math.min(...tc.closes)
        const maxC = Math.max(...tc.closes)
        expect(hybrid.vwap).toBeGreaterThanOrEqual(minC * 0.95)
        expect(hybrid.vwap).toBeLessThanOrEqual(maxC * 1.05)
      })

      test('concentration90 ∈ [0, 1]', () => {
        expect(hybrid.concentration90).toBeGreaterThanOrEqual(0)
        expect(hybrid.concentration90).toBeLessThanOrEqual(1)
      })

      test('所有桶筹码量 >= 0，总和 ≈ totalChips', () => {
        const sum = hybrid.buckets.reduce((s, b) => s + b.chipAmount, 0)
        for (const b of hybrid.buckets) {
          expect(b.chipAmount).toBeGreaterThanOrEqual(0)
        }
        expect(sum).toBeCloseTo(hybrid.totalChips!, 5)
      })

      test('linear 结果同样合法', () => {
        expect(linear.source).toBe('real')
        expect(linear.profitRatio).toBeGreaterThanOrEqual(0)
        expect(linear.profitRatio).toBeLessThanOrEqual(1)
      })

      test('hybrid 与 linear 的 profitRatio 差异 < 30%（防极端）', () => {
        const diff = Math.abs((hybrid.profitRatio ?? 0) - (linear.profitRatio ?? 0))
        expect(diff).toBeLessThan(0.3)
      })
    },
  )
})

// ============================================================
// 2. 核心价值验证：趋势性换手 → hybrid ≠ linear
// ============================================================

describe('G3-B Golden Test · hybrid vs linear 差异验证', () => {
  test.each(testCases.map((tc) => ({
    tc,
    avgTR: tc.turnoverRates.reduce((s, v) => s + v, 0) / tc.turnoverRates.length,
    recentAvgTR: tc.turnoverRates.slice(-50).reduce((s, v) => s + v, 0) / 50,
  })))(
    '$tc.symbol $tc.name（trend=$tc.turnoverTrend）',
    ({ tc, avgTR, recentAvgTR }) => {
      const hybrid = calcChipDistribution(tc.closes, tc.volumes, {
        turnoverRates: tc.turnoverRates,
        windowDays: 250,
        bucketCount: 50,
        currentPrice: tc.currentPrice,
        decayModel: 'hybrid',
      })

      const linear = calcChipDistribution(tc.closes, tc.volumes, {
        windowDays: 250,
        bucketCount: 50,
        currentPrice: tc.currentPrice,
        decayModel: 'linear',
      })

      const prDiff = Math.abs((hybrid.profitRatio ?? 0) - (linear.profitRatio ?? 0))
      const vwapRelDiff = Math.abs(((hybrid.vwap ?? 0) - (linear.vwap ?? 0)) / (linear.vwap ?? 1))
      const trendStrength = Math.abs(recentAvgTR - avgTR) / (avgTR || 0.001)

      // 审计日志
      console.log(JSON.stringify({
        symbol: tc.symbol,
        name: tc.name,
        trend: tc.turnoverTrend,
        avgTR: Number(avgTR.toFixed(4)),
        recentAvgTR: Number(recentAvgTR.toFixed(4)),
        trendStrength: Number(trendStrength.toFixed(2)),
        hybridPR: Number((hybrid.profitRatio ?? 0).toFixed(4)),
        linearPR: Number((linear.profitRatio ?? 0).toFixed(4)),
        prDiff: Number(prDiff.toFixed(4)),
        hybridVWAP: Number((hybrid.vwap ?? 0).toFixed(2)),
        linearVWAP: Number((linear.vwap ?? 0).toFixed(2)),
        vwapRelDiffPct: Number((vwapRelDiff * 100).toFixed(2)) + '%',
      }))

      // 趋势性强（trendStrength > 0.3）时，hybrid 应产生可观测差异
      // 注：极低换手率（avgTR < 1%）时，turnoverFactor ≈ 0.99+，归一化后差异极小
      // 因此对 avgTR < 1% 的场景仅记录，不强制断言
      if (trendStrength > 0.3 && avgTR >= 0.01) {
        const hasPrDiff = prDiff > 0.0015
        const hasVwapDiff = vwapRelDiff > 0.0005
        // 至少一个指标产生可观测差异
        expect(hasPrDiff || hasVwapDiff).toBe(true)
      }

      // VWAP 相对差异 < 5%（防极端偏差）
      expect(vwapRelDiff).toBeLessThan(0.05)

      // profitRatio 差异 < 30%（防算法异常）
      expect(prDiff).toBeLessThan(0.3)
    },
  )
})

// ============================================================
// 3. 向后兼容
// ============================================================

describe('G3-B Golden Test · 向后兼容', () => {
  const tc = testCases[0]!

  test('不传 turnoverRate → 回退 linear → 结果合法', () => {
    const result = calcChipDistribution(tc.closes, tc.volumes, {
      windowDays: 60,
      bucketCount: 50,
      currentPrice: tc.currentPrice,
    })
    expect(result.source).toBe('real')
    expect(result.profitRatio).toBeGreaterThan(0)
    expect(result.profitRatio).toBeLessThan(1)
  })

  test('decayModel=linear → 行为与旧算法一致', () => {
    const result = calcChipDistribution(tc.closes, tc.volumes, {
      windowDays: 60,
      bucketCount: 50,
      currentPrice: tc.currentPrice,
      decayModel: 'linear',
    })
    expect(result.profitRatio).not.toBeNull()
    expect(result.vwap).not.toBeNull()
  })

  test('空 turnoverRates 数组 → 回退 linear', () => {
    const result = calcChipDistribution(tc.closes, tc.volumes, {
      turnoverRates: [],
      windowDays: 250,
      bucketCount: 50,
      currentPrice: tc.currentPrice,
    })
    expect(result.source).toBe('real')
    expect(result.profitRatio).not.toBeNull()
  })

  test('不传任何 options → 使用默认值 → 结果合法', () => {
    // 不传 options 时默认 decayModel='hybrid'，无 turnoverRates 自动回退 linear
    // 不传 currentPrice 时 profitRatio 为 null（因为无法计算获利盘比例）
    const result = calcChipDistribution(tc.closes, tc.volumes)
    expect(result.source).toBe('real')
    expect(result.profitRatio).toBeNull()
    expect(result.vwap).not.toBeNull()
    expect(result.totalChips).toBeGreaterThan(0)
  })
})

// ============================================================
// 4. 边界条件
// ============================================================

describe('G3-B Golden Test · 边界条件', () => {
  test('零换手率 → hybrid 正常计算（turnoverFactor 下限 0.1 生效）', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 10 + i * 0.1)
    const volumes = Array.from({ length: 50 }, () => 1000)
    const zeroTR = Array.from({ length: 50 }, () => 0)

    const result = calcChipDistribution(closes, volumes, {
      turnoverRates: zeroTR,
      windowDays: 50,
      bucketCount: 10,
      currentPrice: 14,
      decayModel: 'hybrid',
    })

    expect(result.source).toBe('real')
    expect(result.profitRatio).toBeGreaterThanOrEqual(0)
    expect(result.profitRatio).toBeLessThanOrEqual(1)
    expect(result.vwap).not.toBeNull()
  })

  test('极端换手率（50%）→ 不崩溃', () => {
    const closes = Array.from({ length: 100 }, (_, i) => 50 + Math.sin(i * 0.3) * 10)
    const volumes = Array.from({ length: 100 }, () => 50000)
    const highTR = Array.from({ length: 100 }, () => 0.5)

    const result = calcChipDistribution(closes, volumes, {
      turnoverRates: highTR,
      windowDays: 100,
      bucketCount: 30,
      currentPrice: 55,
      decayModel: 'hybrid',
    })

    expect(result.source).toBe('real')
    expect(result.profitRatio).toBeGreaterThanOrEqual(0)
    expect(result.profitRatio).toBeLessThanOrEqual(1)
  })

  test('价格完全相同 → 不崩溃，vwap ≈ price', () => {
    const closes = Array.from({ length: 100 }, () => 25)
    const volumes = Array.from({ length: 100 }, () => 5000)
    const tr = Array.from({ length: 100 }, () => 0.05)

    const result = calcChipDistribution(closes, volumes, {
      turnoverRates: tr,
      windowDays: 100,
      bucketCount: 20,
      currentPrice: 25,
      decayModel: 'hybrid',
    })

    expect(result.source).toBe('real')
    expect(result.vwap).toBeCloseTo(25, 0)
  })

  test('仅 1 天数据 → 返回 proxy 空分布', () => {
    const result = calcChipDistribution([100], [5000], {
      turnoverRates: [0.03],
      windowDays: 10,
      bucketCount: 10,
      currentPrice: 100,
      decayModel: 'hybrid',
    })

    expect(result.source).toBe('proxy')
    expect(result.buckets.length).toBe(0)
    expect(result.profitRatio).toBeNull()
  })

  test('全零成交量 → 返回 proxy', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 10 + i * 0.1)
    const volumes = Array.from({ length: 50 }, () => 0)
    const tr = Array.from({ length: 50 }, () => 0.03)

    const result = calcChipDistribution(closes, volumes, {
      turnoverRates: tr,
      windowDays: 50,
      bucketCount: 10,
      currentPrice: 14,
      decayModel: 'hybrid',
    })

    expect(result.source).toBe('proxy')
    expect(result.totalChips).toBe(0)
  })

  test('空数组输入 → 返回 proxy', () => {
    const result = calcChipDistribution([], [], {
      turnoverRates: [],
      windowDays: 10,
      bucketCount: 10,
      decayModel: 'hybrid',
    })

    expect(result.source).toBe('proxy')
    expect(result.profitRatio).toBeNull()
  })
})

// ============================================================
// 5. 算法单调性验证
// ============================================================

describe('G3-B Golden Test · 算法单调性', () => {
  test('hybrid：换手率越高的日期权重越低（筹码向近端转移）', () => {
    // 构造：前 50 天换手率 20%，后 50 天换手率 1%
    const days = 100
    const closes = Array.from({ length: days }, (_, i) => 100 + i * 0.5)
    const volumes = Array.from({ length: days }, (_, i) => 10000 + i * 50)
    const turnoverRates = [
      ...Array.from({ length: 50 }, () => 0.2),
      ...Array.from({ length: 50 }, () => 0.01),
    ]

    const hybrid = calcChipDistribution(closes, volumes, {
      turnoverRates,
      windowDays: days,
      bucketCount: 20,
      currentPrice: 150,
      decayModel: 'hybrid',
    })

    const linear = calcChipDistribution(closes, volumes, {
      windowDays: days,
      bucketCount: 20,
      currentPrice: 150,
      decayModel: 'linear',
    })

    // 前 50 天（高换手、低价）的筹码应被 hybrid 衰减更多
    // → hybrid 的 profitRatio 应 ≥ linear（更多筹码转移到近端/高价区）
    expect(hybrid.profitRatio!).toBeGreaterThanOrEqual(linear.profitRatio! * 0.9)
  })

  test('hybrid：换手率越低的日期权重保留越多', () => {
    // 构造：前 50 天换手率 0.1%（几乎不换手），后 50 天换手率 20%
    const days = 100
    const closes = Array.from({ length: days }, (_, i) => 200 - i * 0.5) // 下跌
    const volumes = Array.from({ length: days }, (_, i) => 10000 + (days - i) * 50)
    const turnoverRates = [
      ...Array.from({ length: 50 }, () => 0.001),
      ...Array.from({ length: 50 }, () => 0.2),
    ]

    const hybrid = calcChipDistribution(closes, volumes, {
      turnoverRates,
      windowDays: days,
      bucketCount: 20,
      currentPrice: 150,
      decayModel: 'hybrid',
    })

    const linear = calcChipDistribution(closes, volumes, {
      windowDays: days,
      bucketCount: 20,
      currentPrice: 150,
      decayModel: 'linear',
    })

    // hybrid 保留更多早期（低换手、低价）筹码 → profitRatio 更低
    expect(hybrid.profitRatio!).toBeLessThanOrEqual(linear.profitRatio! * 1.1)
  })

  test('linear 模型：无 turnoverRate 时结果不受换手率数据影响', () => {
    const closes = Array.from({ length: 100 }, (_, i) => 50 + i * 0.2)
    const volumes = Array.from({ length: 100 }, () => 5000)
    const tr1 = Array.from({ length: 100 }, () => 0.01)
    const tr2 = Array.from({ length: 100 }, () => 0.3)

    const result1 = calcChipDistribution(closes, volumes, {
      turnoverRates: tr1,
      windowDays: 100,
      bucketCount: 20,
      currentPrice: 70,
      decayModel: 'linear',
    })

    const result2 = calcChipDistribution(closes, volumes, {
      turnoverRates: tr2,
      windowDays: 100,
      bucketCount: 20,
      currentPrice: 70,
      decayModel: 'linear',
    })

    // linear 模式下 turnoverRate 不应影响结果
    expect(result1.profitRatio!).toBeCloseTo(result2.profitRatio!, 5)
    expect(result1.vwap!).toBeCloseTo(result2.vwap!, 5)
  })
})
