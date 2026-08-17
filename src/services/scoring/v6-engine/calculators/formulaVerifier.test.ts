/**
 * formulaVerifier 测试
 *
 * P1: 财务公式重推导验证 — 独立验算工具测试
 * 确保所有公式从数学定义出发都能正确推导，与引擎输出一致。
 *
 * @test_id V9-TEST-UT-061
 * @covers src/services/scoring/v6-engine/calculators/formulaVerifier.ts
 * @created 2026-08-17 P1
 */

import { describe, expect, it } from 'vitest'
import {
  derivePegScore,
  derivePeRelativeScore,
  deriveDdmIntrinsicValue,
  deriveDdmScore,
  deriveEvEbitda,
  derivePsScore,
  deriveDdmDividendAdjust,
  deriveConsensusGapAdjust,
  deriveMarginOfSafety,
  deriveClamp,
  verifyAllFormulas,
} from '@/services/scoring/v6-engine/calculators/formulaVerifier'

describe('formulaVerifier — 财务公式独立重推导', () => {

  describe('F1: PEG 评分', () => {
    it('PEG < 0.5 → 5 分（极度低估）', () => {
      expect(derivePegScore(0.3)).toBe(5)
    })
    it('PEG < 1.0 → 4 分（低估）', () => {
      expect(derivePegScore(0.7)).toBe(4)
    })
    it('PEG < 1.5 → 3 分（合理偏低）', () => {
      expect(derivePegScore(1.2)).toBe(3)
    })
    it('PEG < 2.5 → 2.5 分（合理偏高）', () => {
      expect(derivePegScore(2.0)).toBe(2.5)
    })
    it('PEG ≥ 2.5 → 2 分（高估）', () => {
      expect(derivePegScore(3.0)).toBe(2)
    })
    it('PEG ≤ 0（亏损）→ 2 分', () => {
      expect(derivePegScore(-1)).toBe(2)
      expect(derivePegScore(0)).toBe(2)
    })
  })

  describe('F2: PE 行业基准评分', () => {
    const benchmark = { peLow: 15, peHigh: 30 }
    it('PE < 行业下限 → 低估 4.5', () => {
      expect(derivePeRelativeScore(10, benchmark)).toBe(4.5)
    })
    it('PE < 行业上限 → 合理 3.5', () => {
      expect(derivePeRelativeScore(20, benchmark)).toBe(3.5)
    })
    it('PE ≥ 行业上限 → 高估 2.5', () => {
      expect(derivePeRelativeScore(35, benchmark)).toBe(2.5)
    })
    it('无行业基准时使用默认阈值', () => {
      expect(derivePeRelativeScore(10, null)).toBe(4.5)
      expect(derivePeRelativeScore(20, null)).toBe(3.5)
      expect(derivePeRelativeScore(35, null)).toBe(2.5)
    })
  })

  describe('F3: DDM 内在价值', () => {
    it('标准两阶段 DDM 计算', () => {
      const result = deriveDdmIntrinsicValue({
        dps0: 1.0, g1: 0.10, g2: 0.03, r: 0.08, n: 3,
      })
      expect(result.valid).toBe(true)
      // 手动验算：约 24.88
      expect(result.intrinsicValue).toBeGreaterThan(24)
      expect(result.intrinsicValue).toBeLessThan(26)
    })
    it('r <= g2 时返回 invalid', () => {
      const result = deriveDdmIntrinsicValue({
        dps0: 1.0, g1: 0.10, g2: 0.10, r: 0.08, n: 3,
      })
      expect(result.valid).toBe(false)
    })
  })

  describe('F3b: DDM 评分映射', () => {
    it('安全边际 ≥ 30% → 5.0', () => {
      expect(deriveDdmScore(100, 70)).toBe(5.0)
    })
    it('安全边际 ≥ 20% → 4.5', () => {
      expect(deriveDdmScore(100, 80)).toBe(4.5)
    })
    it('安全边际 ≥ 10% → 4.0', () => {
      expect(deriveDdmScore(100, 90)).toBe(4.0)
    })
    it('安全边际 ≥ 0% → 3.0', () => {
      expect(deriveDdmScore(100, 100)).toBe(3.0)
    })
    it('安全边际 ≥ -10% → 2.0', () => {
      expect(deriveDdmScore(100, 110)).toBe(2.0)
    })
    it('安全边际 < -10% → 1.0', () => {
      expect(deriveDdmScore(100, 120)).toBe(1.0)
    })
  })

  describe('F4: EV/EBITDA', () => {
    it('低 EV/EBITDA → 低估 +0.5', () => {
      const result = deriveEvEbitda(1000, 100)
      expect(result.valid).toBe(true)
      expect(result.adjust).toBe(0.5)
    })
    it('中 EV/EBITDA → 合理 +0.3', () => {
      const result = deriveEvEbitda(2000, 100)
      expect(result.adjust).toBe(0.3)
    })
    it('高 EV/EBITDA → 高估 -0.5', () => {
      const result = deriveEvEbitda(5000, 100)
      expect(result.adjust).toBe(-0.5)
    })
    it('亏损时 invalid', () => {
      const result = deriveEvEbitda(1000, 0)
      expect(result.valid).toBe(false)
    })
  })

  describe('F5: PS 市销率', () => {
    it('低 PS → 低估 +0.5', () => {
      const result = derivePsScore(100, 100)
      expect(result.valid).toBe(true)
      expect(result.adjust).toBe(0.5)
    })
    it('中 PS → 合理 +0.3', () => {
      const result = derivePsScore(300, 100)
      expect(result.adjust).toBe(0.3)
    })
    it('高 PS → 偏高 -0.3', () => {
      const result = derivePsScore(1200, 100)
      expect(result.adjust).toBe(-0.3)
    })
  })

  describe('F6: DDM 分红折价因子', () => {
    it('高股息 + 健康分红率 → 正向调整', () => {
      const result = deriveDdmDividendAdjust({
        dividendYield: 4.0,
        payoutRatio3Y: 40,
        totalDividend3Y: 15,
        nextUnlockRatio: 0,
      })
      expect(result.adjust).toBeGreaterThanOrEqual(1.5)
      expect(result.adjust).toBeLessThanOrEqual(2.5)
    })
    it('不可持续分红 → 负向调整', () => {
      const result = deriveDdmDividendAdjust({
        dividendYield: 1.5,
        payoutRatio3Y: 90,
        totalDividend3Y: 5,
        nextUnlockRatio: 0,
      })
      expect(result.adjust).toBeLessThanOrEqual(0)
    })
    it('截断在 [-1.5, 1.5]', () => {
      const result = deriveDdmDividendAdjust({
        dividendYield: 0.5,
        payoutRatio3Y: 30,
        totalDividend3Y: 3,
        nextUnlockRatio: 0.08,
      })
      expect(result.adjust).toBeGreaterThanOrEqual(-1.5)
      expect(result.adjust).toBeLessThanOrEqual(1.5)
      expect(result.adjust).toBeCloseTo(-0.3, 1)
    })
  })

  describe('F7: 一致预期差因子', () => {
    it('全面乐观 → 高正向调整', () => {
      const result = deriveConsensusGapAdjust({
        epsGrowth: 20,
        impliedPE: 10,
        currentPE: 20,
        bullishRatio: 70,
        upside: 20,
        ratingTrend: 'upgrade',
      })
      expect(result.adjust).toBeGreaterThanOrEqual(1.5)
      expect(result.adjust).toBeLessThanOrEqual(2.3)
    })
    it('全面悲观 → 高负向调整', () => {
      const result = deriveConsensusGapAdjust({
        epsGrowth: -5,
        impliedPE: 30,
        currentPE: 20,
        bullishRatio: 20,
        upside: -15,
        ratingTrend: 'downgrade',
      })
      expect(result.adjust).toBeLessThanOrEqual(-1.5)
    })
  })

  describe('F8: 安全边际', () => {
    it('内在价值 > 股价 → 正安全边际', () => {
      const result = deriveMarginOfSafety(100, 80)
      expect(result.valid).toBe(true)
      expect(result.margin).toBe(20)
    })
    it('内在价值 < 股价 → 负安全边际', () => {
      const result = deriveMarginOfSafety(100, 120)
      expect(result.valid).toBe(true)
      expect(result.margin).toBe(-20)
    })
  })

  describe('F9: Clamp', () => {
    it('正常值不变', () => expect(deriveClamp(3)).toBe(3))
    it('负值截断为 0', () => expect(deriveClamp(-1)).toBe(0))
    it('超上限截断为 5', () => expect(deriveClamp(6)).toBe(5))
    it('边界值 0', () => expect(deriveClamp(0)).toBe(0))
    it('边界值 5', () => expect(deriveClamp(5)).toBe(5))
  })

  describe('综合验证', () => {
    it('verifyAllFormulas 应全部通过', () => {
      const report = verifyAllFormulas()
      expect(report.overallPassed).toBe(true)
      expect(report.passedFormulas).toBe(report.totalFormulas)
      for (const v of report.verifications) {
        expect(v.passed).toBe(true)
      }
    })
  })
})