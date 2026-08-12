/**
 * @test_id V9-TEST-UT-043
 * @covers_docs [V9-DOC-PROJ-053, V9-DOC-PROJ-114, V9-DOC-PROJ-054, V9-DOC-ARCH-008, V9-DOC-PROJ-066]
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { CORE_RESOURCE_THEME } from '@/config/themeRegistry'
import { db } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import {
  buildThemePortfolio,
  computeHoldingsFromOrders,
} from '@/services/trading/portfolioBuilder'
import type { Stock, V6Score } from '@/data/types'

function buildStock(
  symbol: string,
  price: number,
  overrides: Partial<Stock> = {},
): Stock {
  return {
    symbol,
    name: `${symbol} 测试`,
    price,
    pool: 'research',
    researchStatus: 'watching',
    source: 'manual',
    dataVersion: 1,
    ...overrides,
  }
}

async function seedV6Score(symbol: string, score: number): Promise<void> {
  const v6Score: V6Score = {
    symbol,
    score,
    factors: {},
    algorithmVersion: 'v6',
    calculatedAt: Date.now(),
    dataVersion: 1,
  }
  await dataLayer.v6Scores.save(v6Score)
}

describe('portfolioBuilder', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    dataBridge.invalidateCache(STORE_NAME.orders)
  })

  it('应该build a theme portfolio from matching stocks', async () => {
    // 使用 8 只默认核心池股票，确保等权不触发 singleMaxPct 上限
    const stocks: Stock[] = [
      buildStock('002371.SZ', 300), // 北方华创
      buildStock('000063.SZ', 30), // 中兴通讯
      buildStock('601138.SH', 25), // 工业富联
      buildStock('002230.SZ', 50), // 科大讯飞
      buildStock('002415.SZ', 30), // 海康威视
      buildStock('600941.SH', 100), // 中国移动
      buildStock('688981.SH', 50), // 中芯国际
      buildStock('600519.SH', 1500, { sector: '白酒' }), // 不匹配
    ]

    for (const stock of stocks) {
      await seedV6Score(stock.symbol, 4.2)
    }
    // 茅台虽高评分但不在主题内，用于验证过滤
    await seedV6Score('600519.SH', 4.8)

    const portfolio = await buildThemePortfolio({
      theme: CORE_RESOURCE_THEME,
      stocks,
      totalPortfolioValue: 1_000_000,
    })

    expect(portfolio.theme).toBe(CORE_RESOURCE_THEME.id)
    expect(portfolio.holdings).toHaveLength(7)
    expect(portfolio.holdings.map((h) => h.symbol)).toContain('002371.SZ')
    expect(portfolio.holdings.map((h) => h.symbol)).toContain('601138.SH')
    expect(portfolio.holdings.map((h) => h.symbol)).not.toContain('600519.SH')

    const totalTargetWeight = portfolio.holdings.reduce((sum, h) => sum + h.targetWeight, 0)
    expect(totalTargetWeight).toBeCloseTo(1, 1)
  })

  it('应该过滤 out stocks below min composite score', async () => {
    const stocks: Stock[] = [
      buildStock('002371.SZ', 300),
      buildStock('601138.SH', 25),
    ]

    await seedV6Score('002371.SZ', 4.5)
    await seedV6Score('601138.SH', 3.5) // 低于 4.0

    const portfolio = await buildThemePortfolio({
      theme: CORE_RESOURCE_THEME,
      stocks,
      totalPortfolioValue: 1_000_000,
    })

    expect(portfolio.holdings).toHaveLength(1)
    expect(portfolio.holdings[0]?.symbol).toBe('002371.SZ')
  })

  it('应该respect single max pct constraint', async () => {
    // 用 4 只高评分股票，等权下主题内权重 25%，但受 singleMaxPct=8% 总资产约束
    const stocks: Stock[] = [
      buildStock('A', 100),
      buildStock('B', 100),
      buildStock('C', 100),
      buildStock('D', 100),
    ]

    for (const stock of stocks) {
      await seedV6Score(stock.symbol, 4.5)
    }

    const portfolio = await buildThemePortfolio({
      theme: CORE_RESOURCE_THEME,
      stocks,
      totalPortfolioValue: 1_000_000,
    })

    // 受 8% 总资产上限约束，最多 floor(1 / effectiveMax) 只标的能配置
    const effectiveMax =
      (CORE_RESOURCE_THEME.singleMaxPct / 100) /
      ((CORE_RESOURCE_THEME.totalAllocationPct / 100) * (1 - CORE_RESOURCE_THEME.cashReservePct / 100))

    const nonZeroHoldings = portfolio.holdings.filter((h) => h.targetWeight > 0)
    expect(nonZeroHoldings.length).toBeLessThanOrEqual(Math.floor(1 / effectiveMax))

    for (const h of nonZeroHoldings) {
      expect(h.targetWeight).toBeLessThanOrEqual(effectiveMax + 1e-6)
    }
  })

  it('应该生成 rebalance plan based on current holdings', async () => {
    const stocks: Stock[] = [buildStock('002371.SZ', 100)]
    await seedV6Score('002371.SZ', 4.5)

    const portfolio = await buildThemePortfolio({
      theme: CORE_RESOURCE_THEME,
      stocks,
      totalPortfolioValue: 1_000_000,
      currentHoldings: { '002371.SZ': 0 },
    })

    expect(portfolio.rebalancePlan).toHaveLength(1)
    expect(portfolio.rebalancePlan[0]?.action).toBe('buy')
    expect(portfolio.rebalancePlan[0]?.shares).toBeGreaterThan(0)
  })

  it('应该返回 empty portfolio when no matching stocks', async () => {
    const stocks: Stock[] = [buildStock('600519.SH', 1500, { sector: '白酒' })]
    await seedV6Score('600519.SH', 4.8)

    const portfolio = await buildThemePortfolio({
      theme: CORE_RESOURCE_THEME,
      stocks,
      totalPortfolioValue: 1_000_000,
    })

    expect(portfolio.holdings).toHaveLength(0)
    expect(portfolio.rebalancePlan).toHaveLength(0)
  })

  it('应该计算 holdings from orders', () => {
    const orders = [
      { symbol: 'A', direction: 'buy' as const, quantity: 100 },
      { symbol: 'A', direction: 'buy' as const, quantity: 200 },
      { symbol: 'B', direction: 'buy' as const, quantity: 500 },
      { symbol: 'A', direction: 'sell' as const, quantity: 50 },
    ]

    const holdings = computeHoldingsFromOrders(orders)
    expect(holdings['A']).toBe(250)
    expect(holdings['B']).toBe(500)
  })
})
