/**
 * lib/utils/portfolioMetrics — 单元测试
 * 只增不删策略（TD-022 覆盖率增量 Round 3+）。
 *
 * 覆盖目标：
 *  - computeMaxDrawdown：长度/数组守卫、peak 更新、peak=0 不除零分支、drawdown 更新最大值
 *  - computePeriodReturns：prev=0 跳过除零分支，正常序列，空/短序列
 *  - computeSharpeRatio：returns 长度<2 → 0；std=0 → 0；periodsPerYear=1 / ≠1 两条分支
 */
import { describe, it, expect } from 'vitest'
import { computeMaxDrawdown, computePeriodReturns, computeSharpeRatio } from './portfolioMetrics'

describe('lib/utils/portfolioMetrics', () => {
  describe('computeMaxDrawdown(equityCurve)', () => {
    it('非数组 → 0', () => {
      expect(computeMaxDrawdown(null as unknown as number[])).toBe(0)
      expect(computeMaxDrawdown('not-array' as unknown as number[])).toBe(0)
    })
    it('长度 < 2 → 0', () => {
      expect(computeMaxDrawdown([])).toBe(0)
      expect(computeMaxDrawdown([100])).toBe(0)
    })
    it('单调上升（无回撤）→ 0%', () => {
      expect(computeMaxDrawdown([100, 110, 120, 150])).toBeCloseTo(0, 8)
    })
    it('峰值后 V 型回撤 50%（100→50 半值）→ 最大回撤 = 50(%)', () => {
      expect(computeMaxDrawdown([100, 50])).toBeCloseTo(50, 6)
    })
    it('多段回撤：100→80(20%)→150→75(50%)→最大回撤 50%', () => {
      expect(computeMaxDrawdown([100, 80, 150, 75])).toBeCloseTo(50, 6)
    })
    it('peak = 0（曲线从 0 开始）→ 跳过除零分支（L27 if (peak>0) 假）→ 不会 NaN，恒 0', () => {
      expect(computeMaxDrawdown([0, 0, 0])).toBe(0)
      expect(Number.isNaN(computeMaxDrawdown([0, 0]))).toBe(false)
    })
    it('跨零曲线：[0, 100, 50] → peak 更新至 100 后，(100-50)/100 = 50%', () => {
      // 先 0 → peak=0 跳过，→ 100 更新 peak=100 → 50 时 (100-50)/100 = 0.5
      expect(computeMaxDrawdown([0, 100, 50])).toBeCloseTo(50, 6)
    })
    it('完全水平直线（无波动）→ 0%', () => {
      expect(computeMaxDrawdown([1, 1, 1, 1])).toBeCloseTo(0, 8)
    })
  })

  describe('computePeriodReturns(equityCurve)', () => {
    it('空数组 → []', () => {
      expect(computePeriodReturns([])).toEqual([])
    })
    it('长度 1 → []', () => {
      expect(computePeriodReturns([100])).toEqual([])
    })
    it('正常 3 点序列：[100, 110, 121] → [0.1, 0.1]', () => {
      const rs = computePeriodReturns([100, 110, 121])
      expect(rs).toHaveLength(2)
      expect(rs[0]).toBeCloseTo(0.1, 8)
      expect(rs[1]).toBeCloseTo(0.1, 8)
    })
    it('prev=0 跳过（避免除零）→ [0, 10, 20] → 仅一次：10→20 收益率 1.0', () => {
      // i=1: prev=0 跳过；i=2: prev=10, (20-10)/10 = 1
      const rs = computePeriodReturns([0, 10, 20])
      expect(rs).toHaveLength(1)
      expect(rs[0]).toBeCloseTo(1.0, 8)
    })
    it('全为 0 → 所有 prev=0 → []', () => {
      expect(computePeriodReturns([0, 0, 0, 0])).toEqual([])
    })
    it('负收益：[200, 100] → (100-200)/200 = -0.5', () => {
      const rs = computePeriodReturns([200, 100])
      expect(rs).toHaveLength(1)
      expect(rs[0]).toBeCloseTo(-0.5, 8)
    })
  })

  describe('computeSharpeRatio(curve, rfr=0, periodsPerYear=1)', () => {
    it('returns 长度 < 2（空数组/长度 1）→ 0', () => {
      expect(computeSharpeRatio([])).toBe(0)
      expect(computeSharpeRatio([100])).toBe(0)
      // 长度 2 但 prev=0 跳过 → returns=[] → length 0 < 2 → 0
      expect(computeSharpeRatio([0, 100])).toBe(0)
    })
    it('长度 2 正常 [100, 100] → returns=[0]，长度 1 < 2 → 0', () => {
      // 长度 2 仅产生 1 个 return
      expect(computeSharpeRatio([100, 100])).toBe(0)
    })
    it('std=0（零波动，所有 r_i 相同且为二进制精确值）→ 0（L65 分支）', () => {
      // 水平直线 [100, 100, 100, 100] → returns = [0, 0, 0]（精确 0，浮点不漂移）
      // 这样 mean=0, variance=0, std=0 → 命中 if (std === 0) return 0
      const r = computeSharpeRatio([100, 100, 100, 100])
      expect(r).toBe(0)
    })
    it('periodsPerYear = 1 → 返回每期（未年化）夏普', () => {
      // 3 点 → returns 2 个； [1, 1.1, 0.99]
      // r0 = 0.1, r1 = -0.1
      // mean = 0, variance = (0.01 + 0.01)/2 = 0.01 → std = 0.1
      // perPeriod = (0 - 0) / 0.1 = 0
      const r = computeSharpeRatio([1, 1.1, 0.99], 0, 1)
      expect(r).toBeCloseTo(0, 6)
    })
    it('periodsPerYear = 252（年化）→ * sqrt(252)', () => {
      // 同样 3 点 [1, 1.1, 0.99]，mean=0 → 不管 periodsPerYear 都是 0。
      // 换一组：returns = [0.02, -0.01]
      // → 序列 1, 1.02, 1.02*0.99=1.0098
      // mean = 0.005
      // variance = ((0.02-0.005)^2 + (-0.01-0.005)^2)/2 = (0.000225 + 0.000225)/2 = 0.000225
      // std = 0.015
      // perPeriod = (0.005 - 0)/0.015 = 0.333...
      // 年化 × sqrt(252) = 0.3333... * 15.8745 ≈ 5.2915
      const r = computeSharpeRatio([1, 1.02, 1.0098], 0, 252)
      expect(r).toBeCloseTo(5.2915, 3)
    })
    it('riskFreeRatePerPeriod ≠ 0 时，mean 减掉它', () => {
      // returns = [0.1, 0.3] → 序列 [1, 1.1, 1.43]
      // mean = 0.2
      // variance = ((0.1-0.2)^2 + (0.3-0.2)^2)/2 = 0.01
      // std = 0.1
      // rfr=0.05 → perPeriod = (0.2 - 0.05)/0.1 = 1.5
      const r = computeSharpeRatio([1, 1.1, 1.43], 0.05, 1)
      expect(r).toBeCloseTo(1.5, 6)
    })
  })
})
