/**
 * @fileoverview Portfolio 测试数据夹具
 * @description 提供组合持仓相关的 builder 函数与典型场景常量
 *
 * 设计原则：
 * - builder 函数支持 Partial override
 * - Portfolio 含嵌套 holdings 与 rebalancePlan，复用价值最高
 * - 默认值符合业务真实形态（含 2 个 holdings 的主题组合）
 *
 * 使用示例：
 * ```typescript
 * import { buildPortfolio, buildHolding, MOCK_PORTFOLIO_WITH_HOLDINGS } from '../fixtures'
 *
 * it('应计算组合总市值', () => {
 *   const portfolio = buildPortfolio({ holdings: [buildHolding({ symbol: '600519.SH' })] })
 *   const total = portfolio.holdings.reduce((sum, h) => sum + h.marketValue, 0)
 *   expect(total).toBeGreaterThan(0)
 * })
 * ```
 */

import type { Portfolio, PortfolioHolding, RebalanceAction } from '@/data/types'

/**
 * 构建 PortfolioHolding 实例
 *
 * @param overrides 部分字段覆盖
 * @returns 完整的 PortfolioHolding 对象
 *
 * 默认值：
 * - symbol: '600519.SH'
 * - name: '贵州茅台'
 * - currentShares: 100
 * - currentWeight: 0.4
 * - targetWeight: 0.5
 * - targetShares: 125
 * - price: 1800
 * - marketValue: 180000
 * - score: 85
 * - rationale: '核心资产，长期持有'
 */
export function buildHolding(overrides?: Partial<PortfolioHolding>): PortfolioHolding {
  const defaults: PortfolioHolding = {
    symbol: '600519.SH',
    name: '贵州茅台',
    currentShares: 100,
    currentWeight: 0.4,
    targetWeight: 0.5,
    targetShares: 125,
    price: 1800,
    marketValue: 180000,
    score: 85,
    rationale: '核心资产，长期持有',
  }

  return overrides ? { ...defaults, ...overrides } : defaults
}

/**
 * 构建 RebalanceAction 实例
 *
 * @param overrides 部分字段覆盖
 * @returns 完整的 RebalanceAction 对象
 */
export function buildRebalanceAction(overrides?: Partial<RebalanceAction>): RebalanceAction {
  const defaults: RebalanceAction = {
    symbol: '600519.SH',
    action: 'buy',
    shares: 25,
    reason: '增持至目标权重',
  }

  return overrides ? { ...defaults, ...overrides } : defaults
}

/**
 * 构建 Portfolio 实例（builder 模式 + override）
 *
 * @param overrides 部分字段覆盖
 * @returns 完整的 Portfolio 对象
 *
 * 默认值：
 * - id: 'test-portfolio-001'
 * - name: '核心资产组合'
 * - theme: 'core-scarce'
 * - totalValue: 540000
 * - cashReserve: 60000
 * - holdings: 2 个默认 holding（茅台 + 腾讯）
 * - rebalancePlan: 1 个 buy 动作
 * - createdAt / updatedAt: 固定时间戳
 */
export function buildPortfolio(overrides?: Partial<Portfolio>): Portfolio {
  const defaults: Portfolio = {
    id: 'test-portfolio-001',
    name: '核心资产组合',
    theme: 'core-scarce',
    totalValue: 540000,
    cashReserve: 60000,
    holdings: [
      buildHolding({
        symbol: '600519.SH',
        name: '贵州茅台',
        currentWeight: 0.4,
        targetWeight: 0.5,
      }),
      buildHolding({
        symbol: '00700.HK',
        name: '腾讯控股',
        currentShares: 200,
        currentWeight: 0.3,
        targetWeight: 0.3,
        targetShares: 200,
        price: 350,
        marketValue: 70000,
        score: 80,
        rationale: '互联网龙头，估值修复',
      }),
    ],
    rebalancePlan: [buildRebalanceAction({ symbol: '600519.SH', action: 'buy', shares: 25 })],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  }

  return overrides ? { ...defaults, ...overrides } : defaults
}

/** 含完整 holdings 的组合（2 个股票 + 1 个再平衡动作） */
export const MOCK_PORTFOLIO_WITH_HOLDINGS: Portfolio = buildPortfolio()

/** 空组合（无持仓，刚创建） */
export const MOCK_PORTFOLIO_EMPTY: Portfolio = buildPortfolio({
  id: 'mock-empty-001',
  name: '空组合',
  totalValue: 0,
  cashReserve: 100000,
  holdings: [],
  rebalancePlan: [],
})

/** 需要再平衡的组合（持仓权重偏离目标） */
export const MOCK_PORTFOLIO_NEEDS_REBALANCE: Portfolio = buildPortfolio({
  id: 'mock-rebalance-001',
  holdings: [
    buildHolding({
      symbol: '600519.SH',
      currentWeight: 0.6, // 目标 0.5，超配
      targetWeight: 0.5,
    }),
    buildHolding({
      symbol: '00700.HK',
      currentWeight: 0.1, // 目标 0.3，低配
      targetWeight: 0.3,
    }),
  ],
  rebalancePlan: [
    buildRebalanceAction({ symbol: '600519.SH', action: 'sell', shares: 20, reason: '减仓至目标权重' }),
    buildRebalanceAction({ symbol: '00700.HK', action: 'buy', shares: 60, reason: '加仓至目标权重' }),
  ],
})
