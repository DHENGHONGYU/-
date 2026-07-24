/**
 * riskComputer.test.ts
 * 风险计算模块单元测试
 *
 * 覆盖：
 * - computeRiskMetrics: VaR、最大回撤、波动率、夏普、集中度、告警
 */
import { describe, it, expect } from 'vitest'
import { computeRiskMetrics } from './riskComputer'
import type { SymbolTradePair, PositionItem, MatchedTradePair } from './positionComputer'
import type { PnLSummary } from './pnlComputer'

// 辅助函数
function makePair(realizedAmount: number, sellDate: string): MatchedTradePair {
  return {
    buyId: 'b1', sellId: 's1', profitPct: 0, holdDays: 1,
    buyDate: sellDate, sellDate, quantity: 100, realizedAmount,
  }
}

function makeSymbolTradePair(symbol: string, totalBuy: number, pairs: MatchedTradePair[]): SymbolTradePair {
  return {
    symbol, buyOrders: [], sellOrders: [],
    totalBuy, totalSell: totalBuy + pairs.reduce((s, p) => s + p.realizedAmount, 0),
    realizedPnl: pairs.reduce((s, p) => s + p.realizedAmount, 0),
    openPositions: 0, avgCostPrice: 0, pairs,
  }
}

function makePosition(symbol: string, costValue: number): PositionItem {
  return {
    symbol, quantity: costValue / 10, avgCost: 10, costValue,
    direction: 'buy', firstBuyAt: 0, lastChangedAt: 0,
  }
}

function makePnLSummary(curve: Array<{ date: string; cumulativePnL: number }>): PnLSummary {
  return {
    totalRealizedPnl: curve.length > 0 ? curve[curve.length - 1]!.cumulativePnL : 0,
    totalUnrealizedPnl: 0,
    winRate: 0, profitFactor: 0, totalTrades: curve.length,
    profitTrades: 0, lossTrades: 0,
    monthlyPnL: [],
    dailyCurve: curve,
  }
}

describe('riskComputer — computeRiskMetrics', () => {
  describe('空数据场景', () => {
    it('无交易、无持仓 → 风险指标均为 0/默认值', () => {
      const result = computeRiskMetrics([], makePnLSummary([]), [])

      expect(result.var95).toBe(0)
      expect(result.varLevel).toBe('low')
      expect(result.maxDrawdown).toBe(0)
      expect(result.volatility).toBe(0)
      expect(result.sharpeRatio).toBe(0)
      expect(result.betaEstimate).toBe(0)
      expect(result.concentration).toBe(0)
      expect(result.alerts).toEqual([])
    })

    it('只有交易无持仓 → beta 为 0，concentration 为 0', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(1000, '2024-01-02'),
        ]),
      ]
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: 1000 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])

      expect(result.betaEstimate).toBe(0)
      expect(result.concentration).toBe(0)
    })
  })

  describe('VaR 计算', () => {
    it('稳定收益（无波动）→ VaR 接近 0', () => {
      // 每天盈利相同 → 日收益率恒定 → 标准差为 0 → VaR = mean - 1.645*0 = mean
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(100, '2024-01-02'),
          makePair(100, '2024-01-03'),
          makePair(100, '2024-01-04'),
          makePair(100, '2024-01-05'),
        ]),
      ]
      // 累计曲线：100, 200, 300, 400
      // 一阶差分：100, 100, 100 → 收益率：1%, 1%, 1%
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: 100 },
        { date: '2024-01-03', cumulativePnL: 200 },
        { date: '2024-01-04', cumulativePnL: 300 },
        { date: '2024-01-05', cumulativePnL: 400 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])

      // 标准差为 0，VaR = mean = 1（百分比）
      // 因为 mean 是正的，VaR 为正 → 风险等级 low
      expect(result.varLevel).toBe('low')
    })

    it('大幅亏损 → VaR 为负，风险等级高', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(-1000, '2024-01-02'),
          makePair(-1000, '2024-01-03'),
          makePair(-1000, '2024-01-04'),
        ]),
      ]
      // 累计：-1000, -2000, -3000
      // 收益率变化：-10%, -10%, -10%
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: -1000 },
        { date: '2024-01-03', cumulativePnL: -2000 },
        { date: '2024-01-04', cumulativePnL: -3000 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])

      // VaR 应该为负（亏损）
      expect(result.var95).toBeLessThan(0)
      // -10% 均值 + 0 波动 → VaR = -10 - 0 = -10 → 远小于 -5 → high
      expect(result.varLevel).toBe('high')
    })

    it('中等波动 → medium 风险等级', () => {
      // 构造一组日收益率，均值约 -3%
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(-300, '2024-01-02'),
          makePair(-300, '2024-01-03'),
          makePair(-300, '2024-01-04'),
          makePair(-300, '2024-01-05'),
        ]),
      ]
      // 累计：-300, -600, -900, -1200
      // 变化：-300, -300, -300 → 收益率：-3%, -3%, -3%
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: -300 },
        { date: '2024-01-03', cumulativePnL: -600 },
        { date: '2024-01-04', cumulativePnL: -900 },
        { date: '2024-01-05', cumulativePnL: -1200 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])

      // VaR = -3 - 1.645*0 = -3 → 在 -5 和 -2 之间 → medium
      expect(result.varLevel).toBe('medium')
    })

    it('VaR 边界值 -5 → 等于 high 阈值，应为 medium（严格小于才算 high）', () => {
      // 构造日收益率均值 -5%，零波动
      // var95 = -5 - 1.645*0 = -5
      // 代码逻辑: var95 < -5 → high，所以 -5 不算 high，应该是 medium
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(-500, '2024-01-02'),
          makePair(-500, '2024-01-03'),
        ]),
      ]
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: -500 },
        { date: '2024-01-03', cumulativePnL: -1000 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])

      // VaR = -5 - 0 = -5，不严格小于 -5 → medium
      expect(result.varLevel).toBe('medium')
    })
  })

  describe('最大回撤计算', () => {
    it('持续上涨 → 最大回撤为 0', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(500, '2024-01-02'),
          makePair(500, '2024-01-03'),
          makePair(500, '2024-01-04'),
        ]),
      ]
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: 500 },
        { date: '2024-01-03', cumulativePnL: 1000 },
        { date: '2024-01-04', cumulativePnL: 1500 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      expect(result.maxDrawdown).toBe(0)
    })

    it('先涨后跌 → 回撤等于跌幅', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(2000, '2024-01-02'),  // 峰值
          makePair(-1000, '2024-01-03'), // 回撤
          makePair(-500, '2024-01-04'),  // 继续回撤
        ]),
      ]
      // 累计：2000 (20%), 1000 (10%), 500 (5%)
      // 峰值 20%，最低 5%，回撤 15%
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: 2000 },
        { date: '2024-01-03', cumulativePnL: 1000 },
        { date: '2024-01-04', cumulativePnL: 500 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      // 峰值 20%，最低 5% → 回撤 15%
      expect(result.maxDrawdown).toBeCloseTo(15, 0)
    })

    it('V 型走势 → 最大回撤出现在谷底', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(1000, '2024-01-02'),  // 10%
          makePair(-2000, '2024-01-03'), // -10%
          makePair(2000, '2024-01-04'),  // 10%
        ]),
      ]
      // 累计：1000 (10%), -1000 (-10%), 1000 (10%)
      // 峰值 10% → 谷底 -10% → 最大回撤 20%
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: 1000 },
        { date: '2024-01-03', cumulativePnL: -1000 },
        { date: '2024-01-04', cumulativePnL: 1000 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      // 峰值 10%，最低 -10% → 回撤 20%
      expect(result.maxDrawdown).toBeCloseTo(20, 0)
    })

    it('持续下跌 → 最大回撤 = 峰值到最低点的差值', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(-500, '2024-01-02'),
          makePair(-500, '2024-01-03'),
          makePair(-500, '2024-01-04'),
        ]),
      ]
      // 累计：-500 (-5%), -1000 (-10%), -1500 (-15%)
      // 峰值初始为第一个点 -5%
      // 最低点 -15%，回撤 = (-5) - (-15) = 10%
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: -500 },
        { date: '2024-01-03', cumulativePnL: -1000 },
        { date: '2024-01-04', cumulativePnL: -1500 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      // 峰值 = -5%（第一个点），最低点 = -15% → 回撤 10%
      expect(result.maxDrawdown).toBeCloseTo(10, 0)
    })
  })

  describe('波动率与夏普比率', () => {
    it('无波动（恒定收益）→ 波动率为 0，夏普为 0', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(100, '2024-01-02'),
          makePair(100, '2024-01-03'),
          makePair(100, '2024-01-04'),
        ]),
      ]
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: 100 },
        { date: '2024-01-03', cumulativePnL: 200 },
        { date: '2024-01-04', cumulativePnL: 300 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      expect(result.volatility).toBe(0)
      expect(result.sharpeRatio).toBe(0)
    })

    it('有波动时 → 波动率 > 0，夏普正确', () => {
      // 累计曲线：200, 100, 300, 200
      // 日变化：-100, +200, -100
      // 总投入 10000 → 日收益率：-1%, +2%, -1%
      // 均值 = 0%
      // 方差 = (1 + 4 + 1) / 3 = 2，标准差 = sqrt(2) ≈ 1.414%
      // 年化波动率 = 1.414 * sqrt(252) ≈ 22.45%
      // 夏普 = (0 * 252 - 0) / (1.414 * sqrt(252)) = 0
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(200, '2024-01-02'),
          makePair(-100, '2024-01-03'),
          makePair(200, '2024-01-04'),
          makePair(-100, '2024-01-05'),
        ]),
      ]
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: 200 },
        { date: '2024-01-03', cumulativePnL: 100 },
        { date: '2024-01-04', cumulativePnL: 300 },
        { date: '2024-01-05', cumulativePnL: 200 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      // 年化波动率 ≈ 22.45%
      expect(result.volatility).toBeGreaterThan(20)
      expect(result.volatility).toBeLessThan(25)
      // 均值为 0 → 夏普为 0
      expect(result.sharpeRatio).toBeCloseTo(0, 0)
    })

    it('负收益 → 夏普比率为负', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(-200, '2024-01-02'),
          makePair(-100, '2024-01-03'),
          makePair(-200, '2024-01-04'),
        ]),
      ]
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: -200 },
        { date: '2024-01-03', cumulativePnL: -300 },
        { date: '2024-01-04', cumulativePnL: -500 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      expect(result.sharpeRatio).toBeLessThan(0)
    })
  })

  describe('持仓集中度', () => {
    it('单只持仓 → 集中度 100%', () => {
      const positions = [makePosition('A', 10000)]

      const result = computeRiskMetrics([], makePnLSummary([]), positions)
      expect(result.concentration).toBe(100)
    })

    it('两只等权重 → 集中度 50%', () => {
      const positions = [
        makePosition('A', 5000),
        makePosition('B', 5000),
      ]

      const result = computeRiskMetrics([], makePnLSummary([]), positions)
      expect(result.concentration).toBe(50)
    })

    it('三只不等权重 → 集中度 = 最大/总', () => {
      const positions = [
        makePosition('A', 6000),
        makePosition('B', 3000),
        makePosition('C', 1000),
      ]

      const result = computeRiskMetrics([], makePnLSummary([]), positions)
      // 最大 6000 / 总 10000 = 60%
      expect(result.concentration).toBe(60)
    })

    it('无持仓 → 集中度 0%', () => {
      const result = computeRiskMetrics([], makePnLSummary([]), [])
      expect(result.concentration).toBe(0)
    })
  })

  describe('Beta 估算', () => {
    it('有持仓 → beta = 1（保守估算）', () => {
      const positions = [makePosition('A', 10000)]
      const result = computeRiskMetrics([], makePnLSummary([]), positions)
      expect(result.betaEstimate).toBe(1)
    })

    it('无持仓 → beta = 0', () => {
      const result = computeRiskMetrics([], makePnLSummary([]), [])
      expect(result.betaEstimate).toBe(0)
    })
  })

  describe('风险告警', () => {
    it('集中度过高 → 触发集中度告警', () => {
      const positions = [makePosition('A', 10000)] // 100% 集中

      const result = computeRiskMetrics([], makePnLSummary([]), positions)
      expect(result.alerts).toContain('持仓集中度超过 50%，建议分散风险')
    })

    it('夏普为负 → 触发夏普告警', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(-200, '2024-01-02'),
          makePair(-100, '2024-01-03'),
          makePair(-200, '2024-01-04'),
        ]),
      ]
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: -200 },
        { date: '2024-01-03', cumulativePnL: -300 },
        { date: '2024-01-04', cumulativePnL: -500 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      expect(result.alerts).toContain('夏普比率为负，组合风险收益比不佳')
    })

    it('VaR 高风险 → 触发 VaR 告警', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(-1000, '2024-01-02'),
          makePair(-1000, '2024-01-03'),
        ]),
      ]
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: -1000 },
        { date: '2024-01-03', cumulativePnL: -2000 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      expect(result.alerts).toContain('VaR(95%) 处于高风险区间')
    })

    it('最大回撤过高 → 触发回撤告警', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(3000, '2024-01-02'),  // 30% 峰值
          makePair(-3000, '2024-01-03'), // 回撤到 0
          makePair(-1000, '2024-01-04'), // 继续跌 -10%
        ]),
      ]
      // 累计：3000 (30%), 0 (0%), -1000 (-10%)
      // 最大回撤：30% - (-10%) = 40% > 20% 阈值
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: 3000 },
        { date: '2024-01-03', cumulativePnL: 0 },
        { date: '2024-01-04', cumulativePnL: -1000 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      expect(result.alerts).toContain('【清仓】回撤达 20%，建议清仓止损')
    })

    it('健康组合 → 无告警', () => {
      const positions = [
        makePosition('A', 3000),
        makePosition('B', 3000),
        makePosition('C', 4000),
      ]

      const result = computeRiskMetrics([], makePnLSummary([]), positions)
      // 集中度 40% < 50%，无其他风险 → 无告警
      expect(result.alerts).toEqual([])
    })

    it('多重风险 → 多条告警', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(3000, '2024-01-02'),
          makePair(-4000, '2024-01-03'),
          makePair(-1000, '2024-01-04'),
        ]),
      ]
      // 累计：3000, -1000, -2000
      // 最大回撤 50% > 20%
      // VaR: 日收益 -40%, -10% → 均值 -25%，标准差 15% → VaR 很低 → high
      // 夏普为负
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: 3000 },
        { date: '2024-01-03', cumulativePnL: -1000 },
        { date: '2024-01-04', cumulativePnL: -2000 },
      ])
      const positions = [makePosition('A', 10000)] // 100% 集中

      const result = computeRiskMetrics(tradePairs, pnl, positions)
      expect(result.alerts.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('数值精度', () => {
    it('VaR 保留两位小数', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(123, '2024-01-02'),
          makePair(456, '2024-01-03'),
          makePair(789, '2024-01-04'),
        ]),
      ]
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: 123 },
        { date: '2024-01-03', cumulativePnL: 579 },
        { date: '2024-01-04', cumulativePnL: 1368 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      const decimalStr = result.var95.toString()
      const decimals = decimalStr.split('.')[1]?.length ?? 0
      expect(decimals).toBeLessThanOrEqual(2)
    })

    it('最大回撤保留两位小数', () => {
      const tradePairs = [
        makeSymbolTradePair('A', 10000, [
          makePair(1234, '2024-01-02'),
          makePair(-567, '2024-01-03'),
        ]),
      ]
      const pnl = makePnLSummary([
        { date: '2024-01-02', cumulativePnL: 1234 },
        { date: '2024-01-03', cumulativePnL: 667 },
      ])

      const result = computeRiskMetrics(tradePairs, pnl, [])
      const decimalStr = result.maxDrawdown.toString()
      const decimals = decimalStr.split('.')[1]?.length ?? 0
      expect(decimals).toBeLessThanOrEqual(2)
    })
  })
})
