/**
 * @test_id V9-TEST-ST-099
 * V6 评分引擎 — 单元测试
 *
 * 覆盖：11 层计算器，引擎聚合，审计追踪，边界条件
  * @covers_docs [V9-DOC-PROJ-114, V9-DOC-PROJ-054, V9-DOC-PROJ-113, V9-DOC-PROJ-066]
*/

import { describe, test, expect } from 'vitest'
import { V6ScoreEngine } from './engine'
import { LMinus1Calculator } from './calculators/lMinus1'
import { L0MacroCalculator, L1MoatCalculator, L2PeerCalculator } from './calculators/l0_l1_l2'
import { L3aFinancialCalculator, L3vValuationCalculator } from './calculators/l3'
import { L4ScenarioCalculator, L5TMCalculator, L6HypeCalculator } from './calculators/l4_l5_l6'
import { L7SecondCurveCalculator, L8ChipCalculator } from './calculators/l7_l8'
import { createV6Engine } from './index'
import type { V6ScoreInput } from './types'

// ============================================================
// Mock 数据
// ============================================================

const mockTechStock: V6ScoreInput = {
  symbol: '688256',
  stock: {
    symbol: '688256',
    name: '寒武纪',
    sector: '芯片设计',
    price: 120,
    marketCap: 5000e8,
    pe: 80,
    pb: 12,
    roe: 0.05,
    eps: 0.5,
    peg: 0.8,
  },
  financials: {
    revenue: 50,
    revenueYoY: 0.25,
    netProfit: 2.5,
    netProfitYoY: 0.5,
    grossMargin: 0.65,
    netMargin: 0.05,
    operatingCF: 3,
    rdRatio: 0.25,
    receivables: 8,
    inventoryTurnoverDays: 60,
    interestBearingDebt: 10,
    goodwill: 2,
    netAssets: 100,
    ordersInHand: 80,
    newOrders: 30,
    shareholderPledge: 0.10,
    customerConcentration: 0.25,
    auditOpinion: '标准无保留意见',
  },
  quotes: {
    latestClose: 120,
    return20d: 0.05,
    volatility20d: 0.03,
    avgTurnover20d: 0.02,
    return60d: 0.15,
    history: Array.from({ length: 120 }, (_, i) => 100 + i * 0.2),
    volumeHistory: Array.from({ length: 120 }, () => 1000000),
  },
}

const mockPharmaStock: V6ScoreInput = {
  symbol: '6160.HK',
  stock: {
    symbol: '6160.HK',
    name: '百济神州',
    sector: '创新药',
    price: 130,
    marketCap: 1800e8,
    pe: 0,
    pb: 5,
    roe: -0.10,
    eps: -2.0,
    peg: undefined,
  },
  financials: {
    revenue: 120,
    revenueYoY: 0.60,
    netProfit: -20,
    netProfitYoY: undefined,
    grossMargin: 0.85,
    netMargin: -0.17,
    operatingCF: -5,
    rdRatio: 0.40,
    receivables: 15,
    inventoryTurnoverDays: 45,
    interestBearingDebt: 30,
    goodwill: 5,
    netAssets: 200,
    ordersInHand: undefined,
    newOrders: 50,
    shareholderPledge: 0.05,
    customerConcentration: 0.15,
    auditOpinion: '标准无保留意见',
  },
  quotes: {
    latestClose: 130,
    return20d: 0.08,
    volatility20d: 0.04,
    avgTurnover20d: 0.015,
    return60d: 0.25,
    history: [],
    volumeHistory: [],
  },
}

const mockMinimalStock: V6ScoreInput = {
  symbol: '000001',
  stock: {
    symbol: '000001',
    name: '测试银行',
    sector: '金融',
    price: 10,
    marketCap: 500e8,
    pe: 6,
    pb: 0.9,
    roe: 0.12,
    eps: 1.5,
    peg: 0.5,
  },
  financials: {},
  quotes: {},
}

// ============================================================
// 引擎工厂
// ============================================================

function createTestEngine() {
  const engine = new V6ScoreEngine()
  engine.registerCalculators([
    LMinus1Calculator,
    L0MacroCalculator,
    L1MoatCalculator,
    L2PeerCalculator,
    L3aFinancialCalculator,
    L3vValuationCalculator,
    L4ScenarioCalculator,
    L5TMCalculator,
    L6HypeCalculator,
    L7SecondCurveCalculator,
    L8ChipCalculator,
  ])
  return engine
}

// ============================================================
// L-1 行业评分
// ============================================================

describe('L-1 行业评分估值', () => {
  test('核心标的精确匹配', async () => {
    const result = await LMinus1Calculator.calculate({
      ...mockTechStock,
      config: { weights: { lMinus1: 0.10 } } as never,
    })
    expect(result.layerId).toBe('lMinus1')
    expect(result.score).toBeGreaterThan(3.5) // 芯片设计 4.19 × 1.0
    expect(result.summary).toContain('芯片设计')
  })

  test('不在覆盖范围内的股票', async () => {
    const result = await LMinus1Calculator.calculate({
      ...mockMinimalStock,
      stock: { ...mockMinimalStock.stock, symbol: 'UNKNOWN', name: '某未知公司', sector: '某未知行业' },
      config: { weights: { lMinus1: 0.10 } } as never,
    })
    expect(Number.isNaN(result.score)).toBe(true)
    expect(result.participated).toBe(false)
    expect(result.summary).toContain('未匹配到行业评分覆盖范围')
  })
})

// ============================================================
// L0 STEEP 宏观
// ============================================================

describe('L0 STEEP 宏观扫描', () => {
  test('科技行业评分高于金融', async () => {
    const techResult = await L0MacroCalculator.calculate({
      ...mockTechStock,
      config: { weights: { l0: 0.08 } } as never,
    })
    const financeResult = await L0MacroCalculator.calculate({
      ...mockMinimalStock,
      config: { weights: { l0: 0.08 } } as never,
    })
    expect(techResult.score).toBeGreaterThan(financeResult.score)
    expect(techResult.score).toBeGreaterThan(3)
    expect(techResult.evidence.length).toBeGreaterThan(0)
  })
})

// ============================================================
// L1 护城河
// ============================================================

describe('L1 护城河分析', () => {
  test('高研发+高市值 → 强护城河', async () => {
    const result = await L1MoatCalculator.calculate({
      ...mockTechStock,
      config: { weights: { l1: 0.15 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(3)
    expect(result.evidence.some((e) => e.includes('研发'))).toBe(true)
  })

  test('数据缺失时降级', async () => {
    const result = await L1MoatCalculator.calculate({
      ...mockMinimalStock,
      config: { weights: { l1: 0.15 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(1)
    expect(result.score).toBeLessThanOrEqual(3)
  })
})

// ============================================================
// L2 竞品
// ============================================================

describe('L2 竞品格局', () => {
  test('大市值 → 行业龙头', async () => {
    const result = await L2PeerCalculator.calculate({
      ...mockTechStock,
      config: { weights: { l2: 0.10 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(3.5)
    expect(result.summary).toContain('第一梯队')
  })
})

// ============================================================
// L3a 财务健康
// ============================================================

describe('L3a 财务健康', () => {
  test('健康财务数据 → 较高评分', async () => {
    const result = await L3aFinancialCalculator.calculate({
      ...mockTechStock,
      config: { weights: { l3f: 0.10 } } as never,
    })
    // 得分受存货周转天数(60天)红色预警影响，预期≥1.5
    expect(result.score).toBeGreaterThanOrEqual(1.5)
    expect(result.evidence.length).toBeGreaterThan(2)
  })

  test('亏损企业触发风险预警', async () => {
    const result = await L3aFinancialCalculator.calculate({
      ...mockPharmaStock,
      config: { weights: { l3f: 0.10 } } as never,
    })
    // 经营现金流为负 → 红色预警
    expect(result.risks.some((r: string) => r.includes('红色预警'))).toBe(true)
  })

  test('空财务数据 → 兜底', async () => {
    const result = await L3aFinancialCalculator.calculate({
      ...mockMinimalStock,
      config: { weights: { l3f: 0.10 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(5)
  })

  test('无风险数据 → 高分', async () => {
    // 使用干净数据，预期无红色预警
    const cleanData = {
      ...mockTechStock,
      financials: {
        revenue: 50,
        revenueYoY: 0.25,
        netProfit: 5,
        netMargin: 0.10,
        operatingCF: 10,
        rdRatio: 0.25,
        receivables: 5,
        inventoryTurnoverDays: 20,
        grossMargin: 0.65,
        interestBearingDebt: 5,
        goodwill: 0,
        netAssets: 100,
        shareholderPledge: 0.05,
        customerConcentration: 0.2,
        auditOpinion: '标准无保留意见',
        ordersInHand: 80,
        newOrders: 30,
      },
    }
    const result = await L3aFinancialCalculator.calculate({
      ...cleanData,
      config: { weights: { l3f: 0.10 } } as never,
    })
    // 无风险预警时得分应≥2.5
    expect(result.score).toBeGreaterThanOrEqual(2.5)
    expect(result.risks.filter((r: string) => r.includes('红色预警')).length).toBe(0)
  })
})

// ============================================================
// L3v 估值
// ============================================================

describe('L3v 估值水平', () => {
  test('PEG < 0.5 → 低估', async () => {
    const result = await L3vValuationCalculator.calculate({
      ...mockMinimalStock,
      config: { weights: { l3v: 0.08 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(4)
    expect(result.summary).toContain('低估')
  })

  test('无 PEG/PE → 默认值', async () => {
    const noPeg = { ...mockPharmaStock, stock: { ...mockPharmaStock.stock, pe: undefined, peg: undefined } }
    const result = await L3vValuationCalculator.calculate({
      ...noPeg,
      config: { weights: { l3v: 0.08 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(2.5)
    expect(result.score).toBeLessThanOrEqual(3.5)
  })
})

// ============================================================
// L4 情景推演
// ============================================================

describe('L4 情景推演', () => {
  test('正向收益 → 合理评分', async () => {
    const result = await L4ScenarioCalculator.calculate({
      ...mockTechStock,
      config: { weights: { l4: 0.08 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(2)
    expect(result.evidence.some((e) => e.includes('乐观'))).toBe(true)
    expect(result.evidence.some((e) => e.includes('悲观'))).toBe(true)
  })
})

// ============================================================
// L5 T-M 矩阵
// ============================================================

describe('L5 T-M 矩阵', () => {
  test('科技行业 → 技术领先', async () => {
    const result = await L5TMCalculator.calculate({
      ...mockTechStock,
      config: { weights: { l5: 0.05 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(2.5)
    expect(result.summary).toContain('最佳')
  })
})

// ============================================================
// L6 Hype 周期
// ============================================================

describe('L6 Hype 周期', () => {
  test('半导体有交付 → 复苏期', async () => {
    const result = await L6HypeCalculator.calculate({
      ...mockTechStock,
      config: { weights: { l6: 0.07 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(3)
  })
})

// ============================================================
// L7 第二曲线
// ============================================================

describe('L7 第二曲线', () => {
  test('高增长 → 成长前期', async () => {
    const result = await L7SecondCurveCalculator.calculate({
      ...mockPharmaStock,
      config: { weights: { l7: 0.15 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(3.5)
    expect(result.summary).toContain('爆发期')
  })
})

// ============================================================
// L8 技术筹码
// ============================================================

describe('L8 技术筹码', () => {
  test('有 K 线数据 → 八级指标', async () => {
    const result = await L8ChipCalculator.calculate({
      ...mockTechStock,
      config: { weights: { l8: 0.04 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(1)
    expect(result.score).toBeLessThanOrEqual(5)
    expect(result.evidence.length).toBeGreaterThan(0)
    expect(result.evidence.some((e) => e.startsWith('SCD'))).toBe(true)
  })

  test('无 K 线数据 → 兜底', async () => {
    const result = await L8ChipCalculator.calculate({
      ...mockMinimalStock,
      config: { weights: { l8: 0.04 } } as never,
    })
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// 引擎聚合
// ============================================================

describe('V6ScoreEngine 聚合', () => {
  test('calculateAll 返回完整 CompositeScore', async () => {
    const engine = createTestEngine()
    const result = await engine.calculateAll(mockTechStock)

    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThanOrEqual(5)
    expect(result.rating).toBeDefined()
    expect(['strong_buy', 'buy', 'hold', 'sell', 'strong_sell']).toContain(result.rating)
    expect(result.layers).toBeDefined()
    expect(Object.keys(result.layers).length).toBe(11)
    expect(result.recommendation).toBeTruthy()
    expect(result.timestamp).toBeGreaterThan(0)
  })

  test('审计追踪启用并包含因子贡献明细', async () => {
    const engine = createTestEngine()
    await engine.calculateAll(mockTechStock)
    const audit = engine.audit()
    expect(audit).not.toBeNull()
    expect(audit!.symbol).toBe('688256')
    expect(audit!.composite).toBeDefined()
    expect(audit!.composite.rating).toBeTruthy()
    expect(audit!.factorContributions).toBeDefined()
    expect(audit!.factorContributions.length).toBeGreaterThan(0)

    const totalContribution = audit!.factorContributions.reduce((sum, c) => sum + c.contribution, 0)
    const totalRate = audit!.factorContributions.reduce((sum, c) => sum + c.contributionRate, 0)
    expect(totalContribution).toBeGreaterThan(0)
    expect(totalRate).toBeCloseTo(1, 5)

    for (const fc of audit!.factorContributions) {
      expect(fc.label).toBeTruthy()
      expect(fc.weight).toBeGreaterThan(0)
      expect(fc.normalizedWeight).toBeGreaterThan(0)
      expect(fc.score).toBeGreaterThan(0)
      expect(fc.baseline).toBe(2.5)
    }
  })

  test('不同股票得到不同评分', async () => {
    const engine = createTestEngine()
    const techResult = await engine.calculateAll(mockTechStock)
    const financeResult = await engine.calculateAll(mockMinimalStock)

    // 科技股评分应高于金融股（基于行业和政策利好）
    expect(techResult.score).toBeGreaterThan(financeResult.score)
  })
})

// ============================================================
// 便捷工厂函数
// ============================================================

describe('createV6Engine', () => {
  test('预配置引擎包含所有计算器', async () => {
    const engine = createV6Engine()
    const result = await engine.calculateAll(mockTechStock)
    expect(result.score).toBeGreaterThan(0)
    expect(Object.keys(result.layers).length).toBe(11)
  })

  test('配置覆盖', async () => {
    const engine = createV6Engine({ offlineMode: true, llmEnabled: false })
    const config = engine.getConfig()
    expect(config.offlineMode).toBe(true)
    expect(config.llmEnabled).toBe(false)
  })
})

// ============================================================
// 边界条件
// ============================================================

describe('边界条件', () => {
  test('空数据输入不崩溃', async () => {
    const engine = createTestEngine()
    const emptyInput: V6ScoreInput = {
      symbol: 'EMPTY',
      stock: { symbol: 'EMPTY', name: '空测试' },
      financials: {},
      quotes: {},
    }
    const result = await engine.calculateAll(emptyInput)
    expect(result).toBeDefined()
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(5)
  })

  test('极端值不崩溃', async () => {
    const engine = createTestEngine()
    const extremeInput: V6ScoreInput = {
      symbol: 'EXTREME',
      stock: {
        symbol: 'EXTREME',
        name: '极端测试',
        price: 999999,
        marketCap: 1e16,
        pe: 1000,
        pb: 100,
        roe: 10,
        eps: 1000,
        peg: 100,
      },
      financials: {
        revenue: 1e10,
        revenueYoY: 100,
        netProfit: 1e9,
        netMargin: 100,
        operatingCF: 1e9,
        rdRatio: 100,
        ordersInHand: 1e10,
      },
      quotes: {
        return20d: 100,
        volatility20d: 100,
        avgTurnover20d: 100,
        return60d: 100,
      },
    }
    const result = await engine.calculateAll(extremeInput)
    expect(result).toBeDefined()
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(5)
  })
})