/**
 * @test_id V9-TEST-ST-105
 * L3 辅助函数单元测试
 * 
 * 覆盖：
 * - scoreMoat（护城河评分）
 * - scoreCompetition（竞争格局评分）
  * @covers_docs [V9-DOC-PROJ-114, V9-DOC-PROJ-054, V9-DOC-PROJ-113, V9-DOC-PROJ-066]
*/

import { describe, it, expect } from 'vitest'
import { scoreMoat, scoreCompetition } from './helpers'
import type { LayerInput } from '../../types'
import { DEFAULT_ENGINE_CONFIG } from '../../config'

// ============================================================
// 测试数据工厂
// ============================================================

function createInput(overrides: Partial<{
  grossMargin: number
  revenueYoY: number
  roe: number
}> = {}): LayerInput {
  return {
    stock: {
      symbol: 'TEST',
      name: '测试股票',
      sector: '科技',
      price: 100,
      marketCap: 1000e8,
      pe: 20,
      pb: 2,
      roe: overrides.roe ?? 0.15,
      eps: 1,
      peg: 0.8,
    },
    financials: {
      revenue: 50,
      revenueYoY: overrides.revenueYoY,
      netProfit: 5,
      netProfitYoY: 0.20,
      grossMargin: overrides.grossMargin,
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
    },
    quotes: {
      latestClose: 100,
      return20d: 0.05,
      volatility20d: 0.03,
      avgTurnover20d: 0.02,
      return60d: 0.10,
      history: [100, 102, 104, 106, 108, 110],
      volumeHistory: [1000000, 1000000, 1000000, 1000000, 1000000, 1000000],
    },
    config: DEFAULT_ENGINE_CONFIG,
  }
}

// ============================================================
// scoreMoat 测试
// ============================================================

describe('scoreMoat', () => {
  it('高毛利(65%)+高增速(120%)+高ROE(25%) → 5分', () => {
    const input = createInput({
      grossMargin: 0.65,
      revenueYoY: 1.20,
      roe: 0.25,
    })
    expect(scoreMoat(input)).toBe(5)
  })

  it('中毛利(45%)+中增速(60%)+中ROE(18%) → 5分（截断）', () => {
    const input = createInput({
      grossMargin: 0.45,
      revenueYoY: 0.60,
      roe: 0.18,
    })
    // 基础4.5 + 增速0.25 + ROE0.25 = 5，截断到5
    expect(scoreMoat(input)).toBe(5)
  })

  it('低毛利(15%)+低增速(5%)+低ROE(8%) → 2.5分', () => {
    const input = createInput({
      grossMargin: 0.15,
      revenueYoY: 0.05,
      roe: 0.08,
    })
    // 基础2.5 + 0 + 0 = 2.5
    expect(scoreMoat(input)).toBe(2.5)
  })

  it('毛利率边界值：正好60% → 5分基础', () => {
    const input = createInput({ grossMargin: 0.60 })
    expect(scoreMoat(input)).toBe(5)
  })

  it('毛利率边界值：正好40% → 4.5分基础', () => {
    const input = createInput({ grossMargin: 0.40 })
    expect(scoreMoat(input)).toBe(4.5)
  })

  it('毛利率边界值：正好30% → 4分基础', () => {
    const input = createInput({ grossMargin: 0.30 })
    expect(scoreMoat(input)).toBe(4)
  })

  it('毛利率边界值：正好20% → 3分基础', () => {
    const input = createInput({ grossMargin: 0.20 })
    expect(scoreMoat(input)).toBe(3)
  })

  it('毛利率边界值：正好10% → 2.5分基础', () => {
    const input = createInput({ grossMargin: 0.10 })
    expect(scoreMoat(input)).toBe(2.5)
  })

  it('毛利率边界值：正好10%以下 → 2分基础', () => {
    const input = createInput({ grossMargin: 0.09 })
    expect(scoreMoat(input)).toBe(2)
  })

  it('无数据：无毛利率无ROE → 默认3分', () => {
    const input = createInput({
      grossMargin: undefined,
      revenueYoY: undefined,
      roe: undefined,
    })
    expect(scoreMoat(input)).toBe(3)
  })

  it('增速加成：>100% → +0.5', () => {
    const input = createInput({ grossMargin: 0.30, revenueYoY: 1.05 })
    // 基础4 + 0.5 = 4.5
    expect(scoreMoat(input)).toBe(4.5)
  })

  it('增速加成：>50% → +0.25', () => {
    const input = createInput({ grossMargin: 0.30, revenueYoY: 0.55 })
    // 基础4 + 0.25 = 4.25
    expect(scoreMoat(input)).toBe(4.25)
  })

  it('ROE加成：>20% → +0.5', () => {
    const input = createInput({ grossMargin: 0.30, roe: 0.22 })
    // 基础4 + 0.5 = 4.5
    expect(scoreMoat(input)).toBe(4.5)
  })

  it('ROE加成：>15% → +0.25', () => {
    const input = createInput({ grossMargin: 0.30, roe: 0.16 })
    // 基础4 + 0.25 = 4.25
    expect(scoreMoat(input)).toBe(4.25)
  })
})

// ============================================================
// scoreCompetition 测试
// ============================================================

describe('scoreCompetition', () => {
  it('毛利递减(15%)+增速>30%(50%) → 4.5分', () => {
    const input = createInput({
      grossMargin: 0.15,
      revenueYoY: 0.50,
    })
    expect(scoreCompetition(input)).toBe(4.5)
  })

  it('毛利递增(45%)+增速<10%(5%) → 3分', () => {
    const input = createInput({
      grossMargin: 0.45,
      revenueYoY: 0.05,
    })
    expect(scoreCompetition(input)).toBe(3)
  })

  it('毛利率稳定(30%)+增速>30%(50%) → 4分', () => {
    const input = createInput({
      grossMargin: 0.30,
      revenueYoY: 0.50,
    })
    expect(scoreCompetition(input)).toBe(4)
  })

  it('无数据：毛利率undefined → 2.5分', () => {
    const input = createInput({
      grossMargin: undefined,
      revenueYoY: 0.30,
    })
    expect(scoreCompetition(input)).toBe(2.5)
  })

  it('无数据：增速undefined → 2.5分', () => {
    const input = createInput({
      grossMargin: 0.30,
      revenueYoY: undefined,
    })
    expect(scoreCompetition(input)).toBe(2.5)
  })

  it('毛利递减+增速>10%(20%) → 4分', () => {
    const input = createInput({
      grossMargin: 0.15,
      revenueYoY: 0.20,
    })
    expect(scoreCompetition(input)).toBe(4)
  })

  it('毛利递减+增速<10%(5%) → 3.5分', () => {
    const input = createInput({
      grossMargin: 0.15,
      revenueYoY: 0.05,
    })
    expect(scoreCompetition(input)).toBe(3.5)
  })

  it('毛利递增+增速>30%(50%) → 4分', () => {
    const input = createInput({
      grossMargin: 0.45,
      revenueYoY: 0.50,
    })
    expect(scoreCompetition(input)).toBe(4)
  })

  it('毛利递增+增速>10%(20%) → 3.5分', () => {
    const input = createInput({
      grossMargin: 0.45,
      revenueYoY: 0.20,
    })
    expect(scoreCompetition(input)).toBe(3.5)
  })

  it('毛利率稳定+增速>10%(20%) → 3.5分', () => {
    const input = createInput({
      grossMargin: 0.30,
      revenueYoY: 0.20,
    })
    expect(scoreCompetition(input)).toBe(3.5)
  })

  it('毛利率稳定+增速<10%(5%) → 3分', () => {
    const input = createInput({
      grossMargin: 0.30,
      revenueYoY: 0.05,
    })
    expect(scoreCompetition(input)).toBe(3)
  })

  it('边界值：毛利率正好20% → 递减趋势', () => {
    const input = createInput({
      grossMargin: 0.20,
      revenueYoY: 0.50,
    })
    // gm < 0.20 为 false，所以 trend = '稳定'
    expect(scoreCompetition(input)).toBe(4)
  })

  it('边界值：毛利率正好40% → 递增趋势', () => {
    const input = createInput({
      grossMargin: 0.40,
      revenueYoY: 0.50,
    })
    // gm > 0.40 为 false，所以 trend = '稳定'
    expect(scoreCompetition(input)).toBe(4)
  })
})
