/**
 * L3a/L3v 计算器 — 单元测试
 *
 * 覆盖：
 * - scoreMoat / scoreCompetition
 * - L3aFinancialCalculator / L3vValuationCalculator
 */

import {
  scoreMoat,
  scoreCompetition,
  L3aFinancialCalculator,
  L3vValuationCalculator,
} from './l3'
import type { LayerInput, StockBasicData } from '../types'
import { DEFAULT_ENGINE_CONFIG } from '../config'

type TestLayerInput = Partial<Omit<LayerInput, 'stock'>> & { stock?: Partial<StockBasicData> }

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
// 测试数据工厂
// ============================================================

function createInput(partial: TestLayerInput = {}): LayerInput {
  return {
    stock: {
      symbol: 'TEST',
      name: '测试股票',
      sector: '科技',
      price: 100,
      marketCap: 1000e8,
      pe: 20,
      pb: 2,
      roe: 0.15,
      eps: 1,
      peg: 0.8,
      ...partial.stock,
    },
    financials: {
      revenue: 50,
      revenueYoY: 0.30,
      netProfit: 5,
      netProfitYoY: 0.20,
      grossMargin: 0.40,
      netMargin: 0.10,
      operatingCF: 8,
      rdRatio: 0.10,
      receivables: 5,
      inventoryTurnoverDays: 20,
      interestBearingDebt: 10,
      goodwill: 1,
      netAssets: 100,
      ordersInHand: 60,
      newOrders: 20,
      shareholderPledge: 0.05,
      customerConcentration: 0.20,
      auditOpinion: '标准无保留意见',
      ...partial.financials,
    },
    quotes: {
      latestClose: 100,
      return20d: 0.05,
      volatility20d: 0.03,
      avgTurnover20d: 0.02,
      return60d: 0.10,
      history: [100, 102, 104, 106, 108, 110],
      volumeHistory: [1000000, 1000000, 1000000, 1000000, 1000000, 1000000],
      ...partial.quotes,
    },
    config: partial.config ?? DEFAULT_ENGINE_CONFIG,
  }
}

// ============================================================
// scoreMoat
// ============================================================

describe('scoreMoat', () => {
  it('高毛利(65%)+高增速(120%)+高ROE(25%) → 5分', () => {
    const input = createInput({
      stock: { roe: 0.25 },
      financials: { grossMargin: 0.65, revenueYoY: 1.20 },
    })
    expect(scoreMoat(input)).toBe(5)
  })

  it('中毛利(45%)+中增速(60%)+中ROE(18%) → 4.75分', () => {
    const input = createInput({
      stock: { roe: 0.18 },
      financials: { grossMargin: 0.45, revenueYoY: 0.60 },
    })
    // 基础4.5 + 增速0.25 + ROE0.25 = 5，截断到5
    expect(scoreMoat(input)).toBe(5)
  })

  it('低毛利(15%)+低增速(5%)+低ROE(8%) → 2.5分', () => {
    const input = createInput({
      stock: { roe: 0.08 },
      financials: { grossMargin: 0.15, revenueYoY: 0.05 },
    })
    // 基础2.5 + 0 + 0 = 2.5
    expect(scoreMoat(input)).toBe(2.5)
  })

  it('毛利率边界值：正好60% → 5分基础', () => {
    const input = createInput({
      financials: { grossMargin: 0.60 },
    })
    expect(scoreMoat(input)).toBe(5)
  })

  it('毛利率边界值：正好40% → 4.5分基础', () => {
    const input = createInput({
      financials: { grossMargin: 0.40 },
    })
    expect(scoreMoat(input)).toBe(4.5)
  })

  it('毛利率边界值：正好30% → 4分基础', () => {
    const input = createInput({
      financials: { grossMargin: 0.30 },
    })
    expect(scoreMoat(input)).toBe(4)
  })

  it('毛利率边界值：正好20% → 3分基础', () => {
    const input = createInput({
      financials: { grossMargin: 0.20 },
    })
    expect(scoreMoat(input)).toBe(3)
  })

  it('毛利率边界值：正好10% → 2.5分基础', () => {
    const input = createInput({
      financials: { grossMargin: 0.10 },
    })
    expect(scoreMoat(input)).toBe(2.5)
  })

  it('毛利率边界值：正好10%以下 → 2分基础', () => {
    const input = createInput({
      financials: { grossMargin: 0.09 },
    })
    expect(scoreMoat(input)).toBe(2)
  })

  it('无数据：无毛利率无ROE → 默认3分', () => {
    const input = createInput({
      stock: { roe: undefined },
      financials: { grossMargin: undefined, revenueYoY: undefined },
    })
    expect(scoreMoat(input)).toBe(3)
  })
})

// ============================================================
// scoreCompetition
// ============================================================

describe('scoreCompetition', () => {
  it('毛利递减(15%)+增速>30%(50%) → 4.5分', () => {
    const input = createInput({
      financials: { grossMargin: 0.15, revenueYoY: 0.50 },
    })
    expect(scoreCompetition(input)).toBe(4.5)
  })

  it('毛利递增(45%)+增速<10%(5%) → 3分', () => {
    const input = createInput({
      financials: { grossMargin: 0.45, revenueYoY: 0.05 },
    })
    expect(scoreCompetition(input)).toBe(3)
  })

  it('毛利率稳定(30%)+增速>30%(50%) → 4分', () => {
    const input = createInput({
      financials: { grossMargin: 0.30, revenueYoY: 0.50 },
    })
    expect(scoreCompetition(input)).toBe(4)
  })

  it('无数据：毛利率undefined → 2.5分', () => {
    const input = createInput({
      financials: { grossMargin: undefined, revenueYoY: 0.30 },
    })
    expect(scoreCompetition(input)).toBe(2.5)
  })

  it('无数据：增速undefined → 2.5分', () => {
    const input = createInput({
      financials: { grossMargin: 0.30, revenueYoY: undefined },
    })
    expect(scoreCompetition(input)).toBe(2.5)
  })

  it('毛利递减+增速>10%(20%) → 4分', () => {
    const input = createInput({
      financials: { grossMargin: 0.15, revenueYoY: 0.20 },
    })
    expect(scoreCompetition(input)).toBe(4)
  })

  it('毛利递减+增速<10%(5%) → 3.5分', () => {
    const input = createInput({
      financials: { grossMargin: 0.15, revenueYoY: 0.05 },
    })
    expect(scoreCompetition(input)).toBe(3.5)
  })

  it('毛利递增+增速>30%(50%) → 4分', () => {
    const input = createInput({
      financials: { grossMargin: 0.45, revenueYoY: 0.50 },
    })
    expect(scoreCompetition(input)).toBe(4)
  })

  it('毛利递增+增速>10%(20%) → 3.5分', () => {
    const input = createInput({
      financials: { grossMargin: 0.45, revenueYoY: 0.20 },
    })
    expect(scoreCompetition(input)).toBe(3.5)
  })

  it('毛利率稳定+增速>10%(20%) → 3.5分', () => {
    const input = createInput({
      financials: { grossMargin: 0.30, revenueYoY: 0.20 },
    })
    expect(scoreCompetition(input)).toBe(3.5)
  })

  it('毛利率稳定+增速<10%(5%) → 3分', () => {
    const input = createInput({
      financials: { grossMargin: 0.30, revenueYoY: 0.05 },
    })
    expect(scoreCompetition(input)).toBe(3)
  })
})

// ============================================================
// L3aFinancialCalculator (L3aMoatCalculator)
// ============================================================

describe('L3aFinancialCalculator', () => {
  it('正常输入：健康财务 → 较高分', async () => {
    const input = createInput({
      financials: {
        revenue: 50,
        revenueYoY: 0.30,
        netProfit: 5,
        netMargin: 0.10,
        operatingCF: 10,
        ordersInHand: 80,
        inventoryTurnoverDays: 20,
        shareholderPledge: 0.05,
        auditOpinion: '标准无保留意见',
      },
    })
    const result = await L3aFinancialCalculator.calculate(input)
    expect(result.layerId).toBe('l3f')
    expect(result.score).toBeGreaterThanOrEqual(2)
    expect(result.evidence.length).toBeGreaterThan(0)
  })

  it('异常：空财务数据 → 兜底不崩溃', async () => {
    const input = createInput({
      stock: { symbol: 'EMPTY' },
      financials: {},
    })
    const result = await L3aFinancialCalculator.calculate(input)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(5)
    expect(result.layerId).toBe('l3f')
  })

  it('触发红色预警 → 分数降低', async () => {
    const input = createInput({
      financials: {
        operatingCF: -5,
        receivables: 50,
        revenue: 50,
        revenueYoY: 0.30,
        inventoryTurnoverDays: 40,
        shareholderPledge: 0.60,
      },
    })
    const result = await L3aFinancialCalculator.calculate(input)
    expect(result.risks.some((r) => r.includes('红色预警'))).toBe(true)
  })

  it('触发黄色预警 → 标注风险', async () => {
    const input = createInput({
      financials: {
        grossMargin: 0.10,
        interestBearingDebt: 60,
        netAssets: 100,
        goodwill: 40,
        customerConcentration: 0.60,
      },
    })
    const result = await L3aFinancialCalculator.calculate(input)
    expect(result.risks.some((r) => r.includes('黄色预警'))).toBe(true)
  })
})

// ============================================================
// L3vValuationCalculator (L3vCompetitionCalculator)
// ============================================================

describe('L3vValuationCalculator', () => {
  it('正常输入：PEG低 → 低估高分', async () => {
    const input = createInput({
      stock: { peg: 0.4, pe: 15 },
    })
    const result = await L3vValuationCalculator.calculate(input)
    expect(result.layerId).toBe('l3v')
    expect(result.score).toBeGreaterThanOrEqual(4)
    expect(result.summary).toContain('低估')
  })

  it('正常输入：PE中等 → 合理', async () => {
    const input = createInput({
      stock: { peg: undefined, pe: 25 },
    })
    const result = await L3vValuationCalculator.calculate(input)
    expect(result.score).toBeGreaterThanOrEqual(3)
    expect(result.score).toBeLessThanOrEqual(4)
  })

  it('异常：无PE无PEG → 默认兜底', async () => {
    const input = createInput({
      stock: { peg: undefined, pe: undefined },
    })
    const result = await L3vValuationCalculator.calculate(input)
    expect(result.score).toBeGreaterThanOrEqual(2)
    expect(result.score).toBeLessThanOrEqual(4)
  })

  it('异常：极高PE → 高分险', async () => {
    // sector='半导体'匹配行业基准(peHigh=50)，pe=100>50 → industryAdjust=-0.5
    // peg=2.0 → pegScore=2，最终score=clamp(2-0.5)=1.5 < L3_VALUATION_RISK_THRESHOLD(2) → 触发风险
    const input = createInput({
      stock: { peg: 2.0, pe: 100, sector: '半导体' },
    })
    const result = await L3vValuationCalculator.calculate(input)
    expect(result.score).toBeLessThan(2)
    expect(result.risks.length).toBeGreaterThan(0)
  })
})
