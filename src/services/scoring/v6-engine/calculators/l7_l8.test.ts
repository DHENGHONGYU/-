/**
 * L7 第二曲线 + L8 技术筹码 —— 单元测试
 *
 * 覆盖：diagnoseLifeStage、scoreSecondCurve、evaluateChip、
 *       L7SecondCurveCalculator.calculate、L8ChipCalculator.calculate
 */

import { describe, test, expect, vi } from 'vitest'
import { diagnoseLifeStage, scoreSecondCurve, evaluateChip, L7SecondCurveCalculator, L8ChipCalculator } from './l7_l8'
import type { LayerInput } from '../types'

// ============================================================
// Mock logger
// ============================================================

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ============================================================
// 测试辅助函数
// ============================================================

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
// diagnoseLifeStage 生命阶段诊断
// ============================================================

describe('diagnoseLifeStage 生命阶段诊断', () => {
  test('孵化期: revenueYoY > 1.0 + 亏损', () => {
    const result = diagnoseLifeStage(createBaseInput({
      financials: { revenueYoY: 1.5, netProfit: -5 },
    }))
    expect(result.stage).toBe('孵化期')
    expect(result.baseScore).toBe(3.0)
  })

  test('爆发期: revenueYoY > 1.0 + 盈利', () => {
    const result = diagnoseLifeStage(createBaseInput({
      financials: { revenueYoY: 1.5, netProfit: 5 },
    }))
    expect(result.stage).toBe('爆发期')
    expect(result.baseScore).toBe(4.0)
  })

  test('爆发期: revenueYoY > 0.50 + 亏损', () => {
    const result = diagnoseLifeStage(createBaseInput({
      financials: { revenueYoY: 0.7, netProfit: -5 },
    }))
    expect(result.stage).toBe('爆发期')
    expect(result.baseScore).toBe(4.0)
  })

  test('成长前期: revenueYoY > 0.50 + 盈利', () => {
    const result = diagnoseLifeStage(createBaseInput({
      financials: { revenueYoY: 0.7, netProfit: 5 },
    }))
    expect(result.stage).toBe('成长前期')
    expect(result.baseScore).toBe(4.5)
  })

  test('成长前期: revenueYoY > 0.30', () => {
    const result = diagnoseLifeStage(createBaseInput({
      financials: { revenueYoY: 0.4 },
    }))
    expect(result.stage).toBe('成长前期')
    expect(result.baseScore).toBe(4.5)
  })

  test('成长后期: revenueYoY > 0.20', () => {
    const result = diagnoseLifeStage(createBaseInput({
      financials: { revenueYoY: 0.25 },
    }))
    expect(result.stage).toBe('成长后期')
    expect(result.baseScore).toBe(5.0)
  })

  test('成长后期: 0.05 < revenueYoY <= 0.15 (中增速)', () => {
    const result = diagnoseLifeStage(createBaseInput({
      financials: { revenueYoY: 0.10 },
    }))
    expect(result.stage).toBe('成长后期')
    expect(result.baseScore).toBe(4.5)
  })

  test('成熟期: revenueYoY <= 0.05', () => {
    const result = diagnoseLifeStage(createBaseInput({
      financials: { revenueYoY: 0.03 },
    }))
    expect(result.stage).toBe('成熟期')
    expect(result.baseScore).toBe(3.0)
  })

  test('数据不足: revenueYoY 缺失', () => {
    const result = diagnoseLifeStage(createBaseInput({
      financials: {},
    }))
    expect(result.stage).toBe('数据不足')
    expect(result.baseScore).toBe(2.5)
  })
})

// ============================================================
// scoreSecondCurve 第二曲线评分
// ============================================================

describe('scoreSecondCurve 第二曲线评分', () => {
  test('无催化剂', () => {
    const result = scoreSecondCurve(createBaseInput({
      financials: { revenueYoY: 0.25 },
    }))
    expect(result.score).toBe(5.0) // 成长后期 base=5.0
    expect(result.stage.stage).toBe('成长后期')
    expect(result.evidence.some(e => e.includes('生命阶段'))).toBe(true)
    expect(result.evidence.some(e => e.includes('在手订单') || e.includes('新签订单') || e.includes('研发'))).toBe(false)
  })

  test('强催化剂(多条件)', () => {
    const result = scoreSecondCurve(createBaseInput({
      financials: {
        revenueYoY: 0.25,
        revenue: 20,
        ordersInHand: 80,   // ocr=4>2 → +0.5
        newOrders: 10,      // >0 → +0.25
        rdRatio: 0.15,      // >10% → +0.25
      },
    }))
    expect(result.score).toBe(5.0) // min(5, 5.0+1.0)
    expect(result.summary).toContain('催化剂强')
    expect(result.evidence.some(e => e.includes('强催化剂'))).toBe(true)
    expect(result.evidence.some(e => e.includes('新签订单'))).toBe(true)
    expect(result.evidence.some(e => e.includes('技术储备催化'))).toBe(true)
  })

  test('上限5分', () => {
    const result = scoreSecondCurve(createBaseInput({
      financials: {
        revenueYoY: 0.25, // base=5.0
        revenue: 20,
        ordersInHand: 80, // +0.5
        newOrders: 10,    // +0.25
        rdRatio: 0.15,    // +0.25
      },
    }))
    expect(result.score).toBe(5.0) // 被上限截断
  })

  test('成熟期风险: 无催化剂', () => {
    const result = scoreSecondCurve(createBaseInput({
      financials: { revenueYoY: 0.03 }, // 成熟期 (revenueYoY <= 0.05)
    }))
    expect(result.score).toBe(3.0)
    expect(result.stage.stage).toBe('成熟期')
    expect(result.summary).toContain('曲线不清')
  })
})

// ============================================================
// evaluateChip 筹码评估(8级)
// ============================================================

describe('evaluateChip 筹码评估(8级)', () => {
  test('全部8级有效', () => {
    const result = evaluateChip(createBaseInput({
      quotes: {
        return20d: 0.05,
        volatility20d: 0.03,
        avgTurnover20d: 0.02,
        return60d: 0.15,
      },
    }))
    expect(result.levels.SCD).not.toBeNull()
    expect(result.levels.PCH).not.toBeNull()
    expect(result.levels.AII).not.toBeNull()
    expect(result.levels.MATRIX).not.toBeNull()
    expect(result.levels.RSI).not.toBeNull()
    expect(result.levels.CCS).not.toBeNull()
    expect(result.levels.DIV).not.toBeNull()
    expect(result.levels.CSR).not.toBeNull()
    expect(result.score).toBe(result.levels.CSR)
    expect(result.score).toBeGreaterThanOrEqual(1)
    expect(result.score).toBeLessThanOrEqual(5)
  })

  test('部分数据缺失', () => {
    const result = evaluateChip(createBaseInput({
      quotes: {
        return20d: 0.05,
        return60d: 0.15,
      },
    }))
    expect(result.levels.SCD).toBeNull()
    expect(result.levels.PCH).toBeNull()
    expect(result.levels.AII).toBeNull()
    expect(result.levels.MATRIX).toBeNull()
    expect(result.levels.RSI).not.toBeNull()
    expect(result.levels.CCS).toBeNull()
    expect(result.levels.DIV).toBeNull()
    expect(result.levels.CSR).not.toBeNull()
    expect(result.score).toBe(result.levels.RSI)
  })

  test('全部缺失 → CSR=3 (默认值)', () => {
    const result = evaluateChip(createBaseInput({
      quotes: {},
    }))
    expect(result.levels.SCD).toBeNull()
    expect(result.levels.PCH).toBeNull()
    expect(result.levels.AII).toBeNull()
    expect(result.levels.MATRIX).toBeNull()
    expect(result.levels.RSI).toBeNull()
    expect(result.levels.CCS).toBeNull()
    expect(result.levels.DIV).toBeNull()
    expect(result.levels.CSR).toBe(3)
    expect(result.score).toBe(3)
    expect(result.riskLevel).toBe('medium')
  })
})

// ============================================================
// L7SecondCurveCalculator.calculate
// ============================================================

describe('L7SecondCurveCalculator.calculate', () => {
  test('正常: 成长后期 + 催化剂', async () => {
    const result = await L7SecondCurveCalculator.calculate(createBaseInput({
      financials: {
        revenueYoY: 0.25,
        revenue: 20,
        ordersInHand: 80,
        newOrders: 10,
        rdRatio: 0.15,
      },
    }))
    expect(result.layerId).toBe('l7')
    expect(result.score).toBe(5.0)
    expect(result.weight).toBe(0.15)
    expect(result.weightedScore).toBe(0.75)
    expect(result.risks).toHaveLength(0)
    expect(result.dataSources).toContain('财报数据')
  })

  test('低分风险: score <= 3', async () => {
    const result = await L7SecondCurveCalculator.calculate(createBaseInput({
      financials: { revenueYoY: 0.03 }, // 成熟期 baseScore=3.0, 无催化剂
    }))
    expect(result.score).toBe(3.0)
    expect(result.risks).toContain('第二曲线不清晰，增长动力单一')
  })

  test('成熟期风险: stage=成熟期 且 score < 4', async () => {
    const result = await L7SecondCurveCalculator.calculate(createBaseInput({
      financials: { revenueYoY: 0.03 }, // 成熟期
    }))
    expect(result.risks).toContain('处于成熟期且无新催化剂，关注增长天花板')
  })

  test('异常: 输入异常', async () => {
    const result = await L7SecondCurveCalculator.calculate({
      stock: { symbol: 'TEST' },
      config: { weights: { l7: 0.15 } },
    } as unknown as LayerInput)
    expect(Number.isNaN(result.score)).toBe(true)
    expect(result.summary).toContain('第二曲线计算失败')
    expect(result.layerId).toBe('l7')
  })
})

// ============================================================
// L8ChipCalculator.calculate
// ============================================================

describe('L8ChipCalculator.calculate', () => {
  test('正常: 完整数据', async () => {
    const result = await L8ChipCalculator.calculate(createBaseInput({
      quotes: {
        return20d: 0.05,
        volatility20d: 0.03,
        avgTurnover20d: 0.02,
        return60d: 0.15,
      },
    }))
    expect(result.layerId).toBe('l8')
    expect(result.score).toBeGreaterThanOrEqual(1)
    expect(result.score).toBeLessThanOrEqual(5)
    expect(result.weight).toBe(0.04)
    expect(result.evidence.length).toBe(8)
  })

  test('高风险: score < 2.5', async () => {
    const result = await L8ChipCalculator.calculate(createBaseInput({
      quotes: {
        return60d: -0.20,
        volatility20d: 0.15,
      },
    }))
    expect(result.score).toBe(1.25)
    expect(result.summary).toContain('风险高')
    expect(result.risks).toContain('筹码结构风险高，技术面偏空')
  })

  test('中风险: 2.5 <= score < 4', async () => {
    const result = await L8ChipCalculator.calculate(createBaseInput({
      quotes: {},
    }))
    expect(result.score).toBe(3)
    expect(result.summary).toContain('风险中')
    expect(result.risks).toContain('筹码结构中性，需关注资金流向')
  })

  test('全部缺失: CSR=3 (默认值)', async () => {
    const result = await L8ChipCalculator.calculate(createBaseInput({
      quotes: {},
    }))
    expect(result.score).toBe(3)
    expect(result.evidence.length).toBe(1)
    expect(result.evidence[0]).toContain('CSR')
  })

  test('异常: 输入异常', async () => {
    const result = await L8ChipCalculator.calculate({
      stock: { symbol: 'TEST' },
      config: { weights: { l8: 0.04 } },
    } as unknown as LayerInput)
    expect(Number.isNaN(result.score)).toBe(true)
    expect(result.summary).toContain('筹码计算失败')
    expect(result.layerId).toBe('l8')
  })
})
