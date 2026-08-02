/**
 * portfolioMetrics 双向验证测试
 *
 * 双向测试（项目约定）：
 * - 正向：给定权益曲线 → 断言精确指标（输入→输出）。
 * - 逆向：由指标特征反推曲线必须满足的形态（输出特征→反推输入），
 *   证明指标非硬编码、且对曲线形态具备可区分性。
 */
import { describe, it, expect } from 'vitest'
import { computeMaxDrawdown, computePeriodReturns, computeSharpeRatio } from './portfolioMetrics'

describe('portfolioMetrics 双向验证', () => {
  // ───────────────────────── 正向：输入曲线 → 输出指标 ─────────────────────────
  describe('正向：输入曲线 → 输出指标', () => {
    it('单调不降曲线 → 最大回撤 = 0%', () => {
      expect(computeMaxDrawdown([100, 101, 102, 103])).toBe(0)
      expect(computeMaxDrawdown([50, 50, 50])).toBe(0)
    })

    it('含回撤曲线 → 精确最大回撤（峰值 107 → 谷值 99 = 7.48%）', () => {
      const curve = [100, 103, 101, 107, 99, 110, 105, 115, 108, 120]
      expect(computeMaxDrawdown(curve)).toBeCloseTo(7.4766, 3)
    })

    it('已知曲线 → 夏普比率可稳定复现（确定性）', () => {
      const curve = [100, 110, 105, 120]
      const first = computeSharpeRatio(curve)
      expect(computeSharpeRatio(curve)).toBeCloseTo(first, 12)
      expect(first).toBeGreaterThan(0)
    })

    it('每期收益率序列按 (v_i - v_{i-1}) / v_{i-1} 计算', () => {
      expect(computePeriodReturns([100, 110, 99])).toEqual([0.1, -0.1])
    })
  })

  // ───────────────────────── 逆向：指标特征 → 反推曲线形态 ─────────────────────────
  describe('逆向：指标特征 → 反推曲线形态', () => {
    it('最大回撤 = 0 ⇒ 曲线必单调不降（任意非降曲线回撤均为 0）', () => {
      const nonDecreasing = [
        [10, 20, 30, 40],
        [100, 100, 100, 100],
        [1, 2, 2, 3, 5],
      ]
      for (const c of nonDecreasing) {
        expect(computeMaxDrawdown(c)).toBe(0)
      }
    })

    it('最大回撤 > 0 ⇒ 曲线必含「低于历史峰值的下降段」（峰 100 → 谷 50 = 50%）', () => {
      expect(computeMaxDrawdown([100, 100, 50])).toBeCloseTo(50, 5)
      expect(computeMaxDrawdown([100, 100, 50])).toBeGreaterThan(0)
    })

    it('平坦曲线（零波动）⇒ 夏普比率 = 0（避免除零）', () => {
      expect(computeSharpeRatio([100, 100, 100, 100])).toBe(0)
    })

    it('数据不足（空 / 单点）⇒ 回撤与夏普均为 0，前端据此展示「数据不足」', () => {
      expect(computeMaxDrawdown([])).toBe(0)
      expect(computeMaxDrawdown([100])).toBe(0)
      expect(computeSharpeRatio([])).toBe(0)
      expect(computeSharpeRatio([100])).toBe(0)
    })

    it('组合：默认权益曲线的指标具备可区分性（回撤≈7.5%，夏普>0 且 <2）', () => {
      const curve = [100, 103, 101, 107, 99, 110, 105, 115, 108, 120]
      const dd = computeMaxDrawdown(curve)
      const sh = computeSharpeRatio(curve)
      expect(dd).toBeGreaterThan(0)
      expect(dd).toBeLessThan(15)
      expect(sh).toBeGreaterThan(0)
      expect(sh).toBeLessThan(2)
    })
  })
})
