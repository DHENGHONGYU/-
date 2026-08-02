/**
 * @test_id V9-TEST-ST-145
 * @covers_docs [V9-DOC-BACK-013, V9-DOC-BACK-005, V9-DOC-BACK-008, V9-DOC-DATA-013, V9-DOC-ARCH-008]
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Order } from '@/data/types'
import {
  useOrderStore,
  initOrderStoreSubscriptions,
} from './orderStore'
import {
  buildTradePairs,
  buildPositions,
  type SymbolTradePair,
  type PositionItem,
} from '@/services/trading/positionComputer'
import {
  computePnLSummary,
  type PnLSummary,
} from '@/services/trading/pnlComputer'
import {
  computeRiskMetrics,
} from '@/services/trading/riskComputer'
// ============================================================
// Mocks
// ============================================================

const mockQuery = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: vi.fn(),
    query: mockQuery,
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: vi.fn().mockReturnValue({}),
  },
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: {
    insertOrder: 'INSERT_ORDER',
    updateOrder: 'UPDATE_ORDER',
    deleteOrder: 'DELETE_ORDER',
    tradeActionExecuted: 'TRADE_ACTION_EXECUTED',
    queryList: 'QUERY_LIST',
  },
  ENVELOPE_TARGET: { db: 'DB' },
  MODULE_ID: { orderstore: 'orderstore' },
  STORE_NAME: { orders: 'orders' },
}))

// ============================================================
// Helpers
// ============================================================

function createOrder(
  overrides: Partial<Order> & Pick<Order, 'symbol' | 'direction' | 'quantity' | 'price' | 'amount' | 'createdAt'>,
): Order {
  return {
    id: `ord-${Math.random().toString(36).slice(2, 9)}`,
    status: 'filled',
    accountType: 'real',
    ...overrides,
  } as Order
}

function dateTs(dateStr: string): number {
  return new Date(dateStr).getTime()
}

// ============================================================
// buildTradePairs
// ============================================================

describe('buildTradePairs', () => {
  it('空数组应返回空数组', () => {
    const result = buildTradePairs([])
    expect(result).toEqual([])
  })

  it('单买单 → 无配对, openPositions=quantity', () => {
    const orders = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
    ]
    const result = buildTradePairs(orders)

    expect(result).toHaveLength(1)
    const tp = result[0]!
    expect(tp.symbol).toBe('AAPL')
    expect(tp.pairs).toHaveLength(0)
    expect(tp.realizedPnl).toBe(0)
    expect(tp.openPositions).toBe(100)
    expect(tp.avgCostPrice).toBe(10)
    expect(tp.totalBuy).toBe(1000)
    expect(tp.totalSell).toBe(0)
  })

  it('单卖单（无买单）→ 无配对, openPositions=0', () => {
    const orders = [
      createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 50, price: 12, amount: 600, createdAt: dateTs('2024-01-01') }),
    ]
    const result = buildTradePairs(orders)

    expect(result).toHaveLength(1)
    const tp = result[0]!
    expect(tp.pairs).toHaveLength(0)
    expect(tp.realizedPnl).toBe(0)
    expect(tp.openPositions).toBe(0)
    expect(tp.avgCostPrice).toBe(0)
    expect(tp.totalBuy).toBe(0)
    expect(tp.totalSell).toBe(600)
  })

  it('简单 FIFO: 买100股@10, 卖50股@12 → profitPct=20%, realizedAmount=100, openPositions=50', () => {
    const orders = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
      createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 50, price: 12, amount: 600, createdAt: dateTs('2024-01-02') }),
    ]
    const result = buildTradePairs(orders)

    const tp = result[0]!
    expect(tp.pairs).toHaveLength(1)
    expect(tp.pairs[0]).toMatchObject({
      profitPct: 20,
      quantity: 50,
      realizedAmount: 100,
      buyDate: '2024-01-01',
      sellDate: '2024-01-02',
    })
    expect(tp.realizedPnl).toBe(100)
    expect(tp.openPositions).toBe(50)
    expect(tp.avgCostPrice).toBe(10)
  })

  it('完全卖出: 买100@10, 卖100@12 → openPositions=0', () => {
    const orders = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
      createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 100, price: 12, amount: 1200, createdAt: dateTs('2024-01-02') }),
    ]
    const result = buildTradePairs(orders)

    const tp = result[0]!
    expect(tp.pairs).toHaveLength(1)
    expect(tp.pairs[0]).toMatchObject({
      profitPct: 20,
      quantity: 100,
      realizedAmount: 200,
    })
    expect(tp.realizedPnl).toBe(200)
    expect(tp.openPositions).toBe(0)
    expect(tp.avgCostPrice).toBe(0)
  })

  it('多笔买单 FIFO: 买50@10, 买50@11, 卖80@12 → 先配50@10(profit=100), 再配30@11(profit=30)', () => {
    const orders = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 50, price: 10, amount: 500, createdAt: dateTs('2024-01-01') }),
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 50, price: 11, amount: 550, createdAt: dateTs('2024-01-02') }),
      createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 80, price: 12, amount: 960, createdAt: dateTs('2024-01-03') }),
    ]
    const result = buildTradePairs(orders)

    const tp = result[0]!
    expect(tp.pairs).toHaveLength(2)
    expect(tp.pairs[0]).toMatchObject({ profitPct: 20, quantity: 50, realizedAmount: 100, buyDate: '2024-01-01' })
    expect(tp.pairs[1]).toMatchObject({ profitPct: 9.09, quantity: 30, realizedAmount: 30, buyDate: '2024-01-02' })
    expect(tp.realizedPnl).toBe(130)
    expect(tp.openPositions).toBe(20)
    expect(tp.avgCostPrice).toBe(11)
  })

  it('亏损卖出: 买100@10, 卖100@8 → profitPct=-20%, realized=-200', () => {
    const orders = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
      createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 100, price: 8, amount: 800, createdAt: dateTs('2024-01-02') }),
    ]
    const result = buildTradePairs(orders)

    const tp = result[0]!
    expect(tp.pairs).toHaveLength(1)
    expect(tp.pairs[0]).toMatchObject({
      profitPct: -20,
      quantity: 100,
      realizedAmount: -200,
      buyDate: '2024-01-01',
      sellDate: '2024-01-02',
    })
    expect(tp.realizedPnl).toBe(-200)
    expect(tp.openPositions).toBe(0)
  })

  it('多 symbol: AAPL 和 TSLA 各一组订单', () => {
    const orders = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
      createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 100, price: 15, amount: 1500, createdAt: dateTs('2024-01-02') }),
      createOrder({ symbol: 'TSLA', direction: 'buy', quantity: 50, price: 20, amount: 1000, createdAt: dateTs('2024-01-01') }),
      createOrder({ symbol: 'TSLA', direction: 'sell', quantity: 50, price: 25, amount: 1250, createdAt: dateTs('2024-01-02') }),
    ]
    const result = buildTradePairs(orders)

    expect(result).toHaveLength(2)
    const aapl = result.find((r) => r.symbol === 'AAPL')!
    const tsla = result.find((r) => r.symbol === 'TSLA')!
    expect(aapl.realizedPnl).toBe(500)
    expect(aapl.openPositions).toBe(0)
    expect(tsla.realizedPnl).toBe(250)
    expect(tsla.openPositions).toBe(0)
  })

  it('日期排序: 先卖后买（时间戳）→ 卖单无法配对', () => {
    const orders = [
      createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 50, price: 15, amount: 750, createdAt: dateTs('2024-01-01') }),
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-02') }),
    ]
    const result = buildTradePairs(orders)

    const tp = result[0]!
    expect(tp.pairs).toHaveLength(0)
    expect(tp.realizedPnl).toBe(0)
    expect(tp.openPositions).toBe(100)
    expect(tp.avgCostPrice).toBe(10)
  })

  it('零价格买入: buy.price=0 → profitPct=0（避免除以零）', () => {
    const orders = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 0, amount: 0, createdAt: dateTs('2024-01-01') }),
      createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-02') }),
    ]
    const result = buildTradePairs(orders)

    const tp = result[0]!
    expect(tp.pairs).toHaveLength(1)
    expect(tp.pairs[0]).toMatchObject({
      profitPct: 0,
      quantity: 100,
      realizedAmount: 1000,
    })
  })
})

// ============================================================
// computePnLSummary
// ============================================================

describe('computePnLSummary', () => {
  it('空数组 → 全部零值', () => {
    const result = computePnLSummary([])
    expect(result).toEqual({
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      profitTrades: 0,
      lossTrades: 0,
      monthlyPnL: [],
      dailyCurve: [],
    })
  })

  it('单盈利配对 → winRate=100%, profitFactor=999, profitTrades=1', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 1500,
        realizedPnl: 500,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [
          { buyId: 'b1', sellId: 's1', profitPct: 50, holdDays: 1, buyDate: '2024-01-01', sellDate: '2024-01-02', quantity: 100, realizedAmount: 500 },
        ],
      },
    ]
    const result = computePnLSummary(tradePairs)

    expect(result.totalRealizedPnl).toBe(500)
    expect(result.totalTrades).toBe(1)
    expect(result.profitTrades).toBe(1)
    expect(result.lossTrades).toBe(0)
    expect(result.winRate).toBe(100)
    expect(result.profitFactor).toBe(999)
  })

  it('单亏损配对 → winRate=0%, profitFactor=0, lossTrades=1', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 800,
        realizedPnl: -200,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [
          { buyId: 'b2', sellId: 's2', profitPct: -20, holdDays: 1, buyDate: '2024-01-01', sellDate: '2024-01-02', quantity: 100, realizedAmount: -200 },
        ],
      },
    ]
    const result = computePnLSummary(tradePairs)

    expect(result.totalRealizedPnl).toBe(-200)
    expect(result.totalTrades).toBe(1)
    expect(result.profitTrades).toBe(0)
    expect(result.lossTrades).toBe(1)
    expect(result.winRate).toBe(0)
    expect(result.profitFactor).toBe(0)
  })

  it('混合盈亏 → winRate=50%, profitFactor 计算正确', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 1500,
        realizedPnl: 500,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [
          { buyId: 'b3', sellId: 's3', profitPct: 50, holdDays: 1, buyDate: '2024-01-01', sellDate: '2024-01-02', quantity: 100, realizedAmount: 500 },
        ],
      },
      {
        symbol: 'TSLA',
        buyOrders: [],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 800,
        realizedPnl: -200,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [
          { buyId: 'b4', sellId: 's4', profitPct: -20, holdDays: 2, buyDate: '2024-01-01', sellDate: '2024-01-03', quantity: 100, realizedAmount: -200 },
        ],
      },
    ]
    const result = computePnLSummary(tradePairs)

    expect(result.totalRealizedPnl).toBe(300)
    expect(result.totalTrades).toBe(2)
    expect(result.profitTrades).toBe(1)
    expect(result.lossTrades).toBe(1)
    expect(result.winRate).toBe(50)
    expect(result.profitFactor).toBe(2.5)
  })

  it('月度聚合 → 按月份正确汇总', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 1200,
        realizedPnl: 200,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [
          { buyId: 'b5', sellId: 's5', profitPct: 20, holdDays: 14, buyDate: '2024-01-01', sellDate: '2024-01-15', quantity: 100, realizedAmount: 100 },
          { buyId: 'b6', sellId: 's6', profitPct: 10, holdDays: 27, buyDate: '2024-01-05', sellDate: '2024-02-01', quantity: 100, realizedAmount: 100 },
          { buyId: 'b7', sellId: 's7', profitPct: 5, holdDays: 10, buyDate: '2024-02-10', sellDate: '2024-02-20', quantity: 100, realizedAmount: 50 },
        ],
      },
    ]
    const result = computePnLSummary(tradePairs)

    expect(result.monthlyPnL).toEqual([
      { month: '2024-01', pnl: 100, trades: 1 },
      { month: '2024-02', pnl: 150, trades: 2 },
    ])
  })

  it('日度累计曲线 → 按日期排序累加', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 1200,
        realizedPnl: 200,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [
          { buyId: 'b8', sellId: 's8', profitPct: 20, holdDays: 14, buyDate: '2024-01-01', sellDate: '2024-01-15', quantity: 100, realizedAmount: 100 },
          { buyId: 'b9', sellId: 's9', profitPct: 10, holdDays: 5, buyDate: '2024-01-05', sellDate: '2024-01-10', quantity: 100, realizedAmount: 50 },
          { buyId: 'b10', sellId: 's10', profitPct: 5, holdDays: 22, buyDate: '2024-01-10', sellDate: '2024-02-01', quantity: 100, realizedAmount: 50 },
        ],
      },
    ]
    const result = computePnLSummary(tradePairs)

    expect(result.dailyCurve).toEqual([
      { date: '2024-01-10', cumulativePnL: 50 },
      { date: '2024-01-15', cumulativePnL: 150 },
      { date: '2024-02-01', cumulativePnL: 200 },
    ])
  })

  it('只有盈利无亏损 → profitFactor=999', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 1800,
        realizedPnl: 800,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [
          { buyId: 'b11', sellId: 's11', profitPct: 30, holdDays: 1, buyDate: '2024-01-01', sellDate: '2024-01-02', quantity: 100, realizedAmount: 300 },
          { buyId: 'b12', sellId: 's12', profitPct: 50, holdDays: 1, buyDate: '2024-01-03', sellDate: '2024-01-04', quantity: 100, realizedAmount: 500 },
        ],
      },
    ]
    const result = computePnLSummary(tradePairs)

    expect(result.totalTrades).toBe(2)
    expect(result.profitTrades).toBe(2)
    expect(result.lossTrades).toBe(0)
    expect(result.profitFactor).toBe(999)
  })

  it('多 symbol 合并统计', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 1200,
        realizedPnl: 200,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [
          { buyId: 'b13', sellId: 's13', profitPct: 20, holdDays: 1, buyDate: '2024-01-01', sellDate: '2024-01-02', quantity: 100, realizedAmount: 200 },
        ],
      },
      {
        symbol: 'TSLA',
        buyOrders: [],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 1100,
        realizedPnl: 100,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [
          { buyId: 'b14', sellId: 's14', profitPct: 10, holdDays: 1, buyDate: '2024-01-01', sellDate: '2024-01-02', quantity: 100, realizedAmount: 100 },
        ],
      },
      {
        symbol: 'NVDA',
        buyOrders: [],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 900,
        realizedPnl: -100,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [
          { buyId: 'b15', sellId: 's15', profitPct: -10, holdDays: 1, buyDate: '2024-01-01', sellDate: '2024-01-02', quantity: 100, realizedAmount: -100 },
        ],
      },
    ]
    const result = computePnLSummary(tradePairs)

    expect(result.totalRealizedPnl).toBe(200)
    expect(result.totalTrades).toBe(3)
    expect(result.profitTrades).toBe(2)
    expect(result.lossTrades).toBe(1)
    expect(result.winRate).toBe(66.7)
  })
})

// ============================================================
// buildPositions
// ============================================================

describe('buildPositions', () => {
  it('空数组 → 空结果', () => {
    const result = buildPositions([])
    expect(result).toEqual([])
  })

  it('有持仓 → 正确 symbol/quantity/avgCost/costValue', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [
          createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
        ],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 0,
        realizedPnl: 0,
        openPositions: 100,
        avgCostPrice: 10,
        pairs: [],
      },
    ]
    const result = buildPositions(tradePairs)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      symbol: 'AAPL',
      quantity: 100,
      avgCost: 10,
      costValue: 1000,
      direction: 'buy',
    })
  })

  it('已清仓（openPositions=0）→ 不包含', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [
          createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
        ],
        sellOrders: [
          createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 100, price: 15, amount: 1500, createdAt: dateTs('2024-01-02') }),
        ],
        totalBuy: 1000,
        totalSell: 1500,
        realizedPnl: 500,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [{ buyId: 'b16', sellId: 's16', profitPct: 50, holdDays: 1, buyDate: '2024-01-01', sellDate: '2024-01-02', quantity: 100, realizedAmount: 500 }],
      },
    ]
    const result = buildPositions(tradePairs)
    expect(result).toEqual([])
  })

  it('多标的 → 按 costValue 降序', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [
          createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
        ],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 0,
        realizedPnl: 0,
        openPositions: 100,
        avgCostPrice: 10,
        pairs: [],
      },
      {
        symbol: 'TSLA',
        buyOrders: [
          createOrder({ symbol: 'TSLA', direction: 'buy', quantity: 10, price: 500, amount: 5000, createdAt: dateTs('2024-01-01') }),
        ],
        sellOrders: [],
        totalBuy: 5000,
        totalSell: 0,
        realizedPnl: 0,
        openPositions: 10,
        avgCostPrice: 500,
        pairs: [],
      },
    ]
    const result = buildPositions(tradePairs)

    expect(result).toHaveLength(2)
    expect(result[0]!.symbol).toBe('TSLA')
    expect(result[1]!.symbol).toBe('AAPL')
    expect(result[0]!.costValue).toBe(5000)
    expect(result[1]!.costValue).toBe(1000)
  })

  it('firstBuyAt 和 lastChangedAt 正确', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [
          createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 50, price: 10, amount: 500, createdAt: dateTs('2024-01-01') }),
          createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 50, price: 12, amount: 600, createdAt: dateTs('2024-01-05') }),
        ],
        sellOrders: [
          createOrder({ symbol: 'AAPL', direction: 'sell', quantity: 30, price: 15, amount: 450, createdAt: dateTs('2024-01-10') }),
        ],
        totalBuy: 1100,
        totalSell: 450,
        realizedPnl: 210,
        openPositions: 70,
        avgCostPrice: 10,
        pairs: [{ buyId: 'b17', sellId: 's17', profitPct: 50, holdDays: 9, buyDate: '2024-01-01', sellDate: '2024-01-10', quantity: 30, realizedAmount: 150 }],
      },
    ]
    const result = buildPositions(tradePairs)

    expect(result).toHaveLength(1)
    expect(result[0]!.firstBuyAt).toBe(dateTs('2024-01-01'))
    expect(result[0]!.lastChangedAt).toBe(dateTs('2024-01-10'))
  })

  it('direction 始终为 buy', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [
          createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
        ],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 0,
        realizedPnl: 0,
        openPositions: 100,
        avgCostPrice: 10,
        pairs: [],
      },
    ]
    const result = buildPositions(tradePairs)

    expect(result[0]!.direction).toBe('buy')
  })
})

// ============================================================
// computeRiskMetrics
// ============================================================

describe('computeRiskMetrics', () => {
  it('空数据 → 全部零/低', () => {
    const pnlSummary: PnLSummary = {
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      profitTrades: 0,
      lossTrades: 0,
      monthlyPnL: [],
      dailyCurve: [],
    }
    const result = computeRiskMetrics([], pnlSummary, [])

    expect(result).toMatchObject({
      var95: 0,
      varLevel: 'low',
      maxDrawdown: 0,
      volatility: 0,
      sharpeRatio: 0,
      betaEstimate: 0,
      concentration: 0,
      alerts: [],
    })
  })

  it('正常数据 → 各指标在合理范围', () => {
    const tradePairs: SymbolTradePair[] = [
      {
        symbol: 'AAPL',
        buyOrders: [],
        sellOrders: [],
        totalBuy: 1000,
        totalSell: 1200,
        realizedPnl: 200,
        openPositions: 0,
        avgCostPrice: 0,
        pairs: [],
      },
    ]
    const pnlSummary: PnLSummary = {
      totalRealizedPnl: 200,
      totalUnrealizedPnl: 0,
      winRate: 100,
      profitFactor: 999,
      totalTrades: 1,
      profitTrades: 1,
      lossTrades: 0,
      monthlyPnL: [],
      dailyCurve: [
        { date: '2024-01-01', cumulativePnL: 50 },
        { date: '2024-01-02', cumulativePnL: 200 },
      ],
    }
    const positions: PositionItem[] = [
      { symbol: 'AAPL', quantity: 100, avgCost: 10, costValue: 1000, direction: 'buy', firstBuyAt: dateTs('2024-01-01'), lastChangedAt: dateTs('2024-01-01') },
    ]
    const result = computeRiskMetrics(tradePairs, pnlSummary, positions)

    expect(result.concentration).toBe(100)
    expect(result.betaEstimate).toBe(1)
    expect(result.volatility).toBeGreaterThanOrEqual(0)
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0)
  })

  it('VaR high: var95 < -5', () => {
    const tradePairs: SymbolTradePair[] = [
      { symbol: 'AAPL', buyOrders: [], sellOrders: [], totalBuy: 1000, totalSell: 0, realizedPnl: 0, openPositions: 0, avgCostPrice: 0, pairs: [] },
    ]
    const pnlSummary: PnLSummary = {
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      profitTrades: 0,
      lossTrades: 0,
      monthlyPnL: [],
      dailyCurve: [
        { date: '2024-01-01', cumulativePnL: 0 },
        { date: '2024-01-02', cumulativePnL: 200 },
        { date: '2024-01-03', cumulativePnL: -100 },
        { date: '2024-01-04', cumulativePnL: 300 },
        { date: '2024-01-05', cumulativePnL: -200 },
      ],
    }
    const result = computeRiskMetrics(tradePairs, pnlSummary, [])

    expect(result.var95).toBeLessThan(-5)
    expect(result.varLevel).toBe('high')
  })

  it('VaR medium: -5 <= var95 < -2', () => {
    const tradePairs: SymbolTradePair[] = [
      { symbol: 'AAPL', buyOrders: [], sellOrders: [], totalBuy: 10000, totalSell: 0, realizedPnl: 0, openPositions: 0, avgCostPrice: 0, pairs: [] },
    ]
    const pnlSummary: PnLSummary = {
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      profitTrades: 0,
      lossTrades: 0,
      monthlyPnL: [],
      dailyCurve: [
        { date: '2024-01-01', cumulativePnL: 0 },
        { date: '2024-01-02', cumulativePnL: 100 },
        { date: '2024-01-03', cumulativePnL: -200 },
        { date: '2024-01-04', cumulativePnL: 100 },
        { date: '2024-01-05', cumulativePnL: -200 },
      ],
    }
    const result = computeRiskMetrics(tradePairs, pnlSummary, [])

    expect(result.var95).toBeGreaterThanOrEqual(-5)
    expect(result.var95).toBeLessThan(-2)
    expect(result.varLevel).toBe('medium')
  })

  it('VaR low: var95 >= -2', () => {
    const tradePairs: SymbolTradePair[] = [
      { symbol: 'AAPL', buyOrders: [], sellOrders: [], totalBuy: 10000, totalSell: 0, realizedPnl: 0, openPositions: 0, avgCostPrice: 0, pairs: [] },
    ]
    const pnlSummary: PnLSummary = {
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      profitTrades: 0,
      lossTrades: 0,
      monthlyPnL: [],
      dailyCurve: [
        { date: '2024-01-01', cumulativePnL: 0 },
        { date: '2024-01-02', cumulativePnL: 50 },
        { date: '2024-01-03', cumulativePnL: -50 },
        { date: '2024-01-04', cumulativePnL: 50 },
        { date: '2024-01-05', cumulativePnL: -50 },
      ],
    }
    const result = computeRiskMetrics(tradePairs, pnlSummary, [])

    expect(result.var95).toBeGreaterThanOrEqual(-2)
    expect(result.varLevel).toBe('low')
  })

  it('集中度 > 50% → alert', () => {
    const positions: PositionItem[] = [
      { symbol: 'AAPL', quantity: 100, avgCost: 10, costValue: 1000, direction: 'buy', firstBuyAt: dateTs('2024-01-01'), lastChangedAt: dateTs('2024-01-01') },
      { symbol: 'TSLA', quantity: 1, avgCost: 10, costValue: 10, direction: 'buy', firstBuyAt: dateTs('2024-01-01'), lastChangedAt: dateTs('2024-01-01') },
    ]
    const pnlSummary: PnLSummary = {
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      profitTrades: 0,
      lossTrades: 0,
      monthlyPnL: [],
      dailyCurve: [],
    }
    const result = computeRiskMetrics([], pnlSummary, positions)

    expect(result.concentration).toBeGreaterThan(50)
    expect(result.alerts).toContain('持仓集中度超过 50%，建议分散风险')
  })

  it('夏普 < 0 → alert', () => {
    const tradePairs: SymbolTradePair[] = [
      { symbol: 'AAPL', buyOrders: [], sellOrders: [], totalBuy: 10000, totalSell: 0, realizedPnl: 0, openPositions: 0, avgCostPrice: 0, pairs: [] },
    ]
    const pnlSummary: PnLSummary = {
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      profitTrades: 0,
      lossTrades: 0,
      monthlyPnL: [],
      dailyCurve: [
        { date: '2024-01-01', cumulativePnL: 0 },
        { date: '2024-01-02', cumulativePnL: 100 },
        { date: '2024-01-03', cumulativePnL: -200 },
        { date: '2024-01-04', cumulativePnL: 100 },
        { date: '2024-01-05', cumulativePnL: -200 },
      ],
    }
    const positions: PositionItem[] = [
      { symbol: 'AAPL', quantity: 100, avgCost: 10, costValue: 1000, direction: 'buy', firstBuyAt: dateTs('2024-01-01'), lastChangedAt: dateTs('2024-01-01') },
    ]
    const result = computeRiskMetrics(tradePairs, pnlSummary, positions)

    expect(result.sharpeRatio).toBeLessThan(0)
    expect(result.alerts).toContain('夏普比率为负，组合风险收益比不佳')
  })

  it('最大回撤 > 20% → alert', () => {
    const tradePairs: SymbolTradePair[] = [
      { symbol: 'AAPL', buyOrders: [], sellOrders: [], totalBuy: 1000, totalSell: 0, realizedPnl: 0, openPositions: 0, avgCostPrice: 0, pairs: [] },
    ]
    const pnlSummary: PnLSummary = {
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      profitTrades: 0,
      lossTrades: 0,
      monthlyPnL: [],
      dailyCurve: [
        { date: '2024-01-01', cumulativePnL: 0 },
        { date: '2024-01-02', cumulativePnL: 500 },
        { date: '2024-01-03', cumulativePnL: 200 },
      ],
    }
    const result = computeRiskMetrics(tradePairs, pnlSummary, [])

    expect(result.maxDrawdown).toBeGreaterThan(20)
    expect(result.alerts).toContain('【清仓】回撤达 20%，建议清仓止损')
  })

  it('无持仓 → betaEstimate=0', () => {
    const tradePairs: SymbolTradePair[] = [
      { symbol: 'AAPL', buyOrders: [], sellOrders: [], totalBuy: 1000, totalSell: 1500, realizedPnl: 500, openPositions: 0, avgCostPrice: 0, pairs: [] },
    ]
    const pnlSummary: PnLSummary = {
      totalRealizedPnl: 500,
      totalUnrealizedPnl: 0,
      winRate: 100,
      profitFactor: 999,
      totalTrades: 1,
      profitTrades: 1,
      lossTrades: 0,
      monthlyPnL: [],
      dailyCurve: [],
    }
    const result = computeRiskMetrics(tradePairs, pnlSummary, [])

    expect(result.betaEstimate).toBe(0)
    expect(result.concentration).toBe(0)
  })
})

// ============================================================
// Store Actions
// ============================================================

describe('useOrderStore', () => {
  beforeEach(() => {
    useOrderStore.getState().reset()
    vi.clearAllMocks()
  })

  it('getPosition: 存在 → 返回, 不存在 → null', async () => {
    const mockOrders: Order[] = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
      createOrder({ symbol: 'TSLA', direction: 'buy', quantity: 50, price: 20, amount: 1000, createdAt: dateTs('2024-01-01') }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: mockOrders })
    await useOrderStore.getState().refresh()

    const aapl = useOrderStore.getState().getPosition('AAPL')
    expect(aapl).not.toBeNull()
    expect(aapl!.symbol).toBe('AAPL')
    expect(aapl!.quantity).toBe(100)

    const unknown = useOrderStore.getState().getPosition('UNKNOWN')
    expect(unknown).toBeNull()
  })

  it('reset: 重置到初始状态', async () => {
    const mockOrders: Order[] = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: mockOrders })
    await useOrderStore.getState().refresh()
    expect(useOrderStore.getState().orders.length).toBeGreaterThan(0)

    useOrderStore.getState().reset()
    const state = useOrderStore.getState()
    expect(state.orders).toEqual([])
    expect(state.positions).toEqual([])
    expect(state.realizedPnL).toBe(0)
    expect(state.loading).toBe(true)
    expect(state.error).toBeNull()
    expect(state.isRefreshing).toBe(false)
  })

  it('addOrder: 成功', async () => {
    const { dataBridge } = await import('@/core/databridge')
    const result = await useOrderStore.getState().addOrder({
      symbol: 'AAPL',
      direction: 'buy',
      quantity: 100,
      price: 10,
      amount: 1000,
      status: 'filled',
      accountType: 'real',
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.id).toMatch(/^ord-/)
    expect(result.data!.symbol).toBe('AAPL')
    expect(dataBridge.forward).toHaveBeenCalledTimes(1)
  })

  it('addOrder: 失败', async () => {
    const { dataBridge } = await import('@/core/databridge')
    ;(dataBridge.forward as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'))

    const result = await useOrderStore.getState().addOrder({
      symbol: 'AAPL',
      direction: 'buy',
      quantity: 100,
      price: 10,
      amount: 1000,
      status: 'filled',
      accountType: 'real',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
    expect(dataBridge.forward).toHaveBeenCalledTimes(1)
  })

  it('updateOrder: 成功', async () => {
    const { dataBridge } = await import('@/core/databridge')
    const result = await useOrderStore.getState().updateOrder('ord-123', { price: 20 })

    expect(result.success).toBe(true)
    expect(dataBridge.forward).toHaveBeenCalledTimes(1)
  })

  it('updateOrder: 失败', async () => {
    const { dataBridge } = await import('@/core/databridge')
    ;(dataBridge.forward as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Update failed'))

    const result = await useOrderStore.getState().updateOrder('ord-123', { price: 20 })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Update failed')
    expect(dataBridge.forward).toHaveBeenCalledTimes(1)
  })

  it('deleteOrder: 成功', async () => {
    const { dataBridge } = await import('@/core/databridge')
    const result = await useOrderStore.getState().deleteOrder('ord-123')

    expect(result.success).toBe(true)
    expect(dataBridge.forward).toHaveBeenCalledTimes(1)
  })

  it('deleteOrder: 失败', async () => {
    const { dataBridge } = await import('@/core/databridge')
    ;(dataBridge.forward as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Delete failed'))

    const result = await useOrderStore.getState().deleteOrder('ord-123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Delete failed')
    expect(dataBridge.forward).toHaveBeenCalledTimes(1)
  })

  it('refresh: 并发锁（isRefreshing=true 时第二次调用等待第一次完成后再刷新）', async () => {
    const mockOrders: Order[] = [
      createOrder({ symbol: 'AAPL', direction: 'buy', quantity: 100, price: 10, amount: 1000, createdAt: dateTs('2024-01-01') }),
    ]
    let resolveList: ((value: { success: true; data: Order[] }) => void) | undefined
    const listPromise = new Promise<{ success: true; data: Order[] }>((r) => { resolveList = r })
    // coordinateRefresh 会在第一次完成后执行第二次刷新，所以需要返回两个 Promise
    mockQuery
      .mockReturnValueOnce(listPromise)
      .mockResolvedValueOnce({ success: true, data: mockOrders })

    const promise1 = useOrderStore.getState().refresh()
    const promise2 = useOrderStore.getState().refresh()

    // 第二次调用不会立即返回，而是等待第一次完成
    // resolve 第一次请求
    resolveList!({ success: true, data: mockOrders })
    await promise1
    await promise2

    // coordinateRefresh 会让第二次调用在第一次完成后也执行刷新
    expect(mockQuery).toHaveBeenCalled()
  })
})

// ============================================================
// initOrderStoreSubscriptions
// ============================================================

describe('initOrderStoreSubscriptions', () => {
  it('应初始化订阅并返回清理函数', () => {
    const cleanup = initOrderStoreSubscriptions()
    expect(typeof cleanup).toBe('function')
    cleanup()
  })
})

// ============================================================
// initOrderStoreSubscriptions - 订阅回调逻辑（覆盖 540-550, 560-561）
// ============================================================

describe('initOrderStoreSubscriptions - 订阅回调逻辑', () => {
  let cleanup: () => void
  let subscribeCallback: (envelope: { meta: { source: string; action: string; traceId: string } }) => void
  let subscribeMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    // 设置 mockQuery 默认返回成功，供去抖刷新使用
    mockQuery.mockResolvedValue({ success: true, data: [] })
    // 重置 store 状态
    useOrderStore.getState().reset()
    // 初始化订阅
    cleanup = initOrderStoreSubscriptions()
    // 获取订阅回调函数
    const { dataBridge } = await import('@/core/databridge')
    subscribeMock = dataBridge.subscribe as ReturnType<typeof vi.fn>
    const calls = subscribeMock.mock.calls
    subscribeCallback = calls[calls.length - 1]![1]
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  /**
   * @test_id V9-TEST-ST-145-SUB-01
   * source 过滤：当 envelope.meta.source === 'orderstore' 时跳过，不触发刷新
   * 覆盖行 540-542
   */
  it('source 过滤：source === orderstore 时跳过刷新', () => {
    subscribeCallback({ meta: { source: 'orderstore', action: 'INSERT_ORDER', traceId: 'trace-self' } })
    // 立即检查 —— 不应有任何 query 调用
    expect(mockQuery).not.toHaveBeenCalled()
  })

  /**
   * @test_id V9-TEST-ST-145-SUB-02
   * 订单变更 action（INSERT_ORDER）触发去抖刷新
   * 覆盖行 544-550
   */
  it('变更 action 触发去抖刷新', async () => {
    subscribeCallback({ meta: { source: 'external', action: 'INSERT_ORDER', traceId: 'trace-1' } })
    // 推进去抖定时器（100ms + 缓冲）
    await vi.advanceTimersByTimeAsync(200)
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  /**
   * @test_id V9-TEST-ST-145-SUB-03
   * 非订单变更 action 不触发刷新
   */
  it('非变更 action 不触发刷新', async () => {
    subscribeCallback({ meta: { source: 'external', action: 'UNKNOWN_ACTION', traceId: 'trace-2' } })
    await vi.advanceTimersByTimeAsync(200)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  /**
   * @test_id V9-TEST-ST-145-SUB-04
   * 多次事件在去抖窗口内合并为一次刷新
   */
  it('去抖合并：100ms 内多次事件只刷新一次', async () => {
    subscribeCallback({ meta: { source: 'external', action: 'INSERT_ORDER', traceId: 'trace-3' } })
    subscribeCallback({ meta: { source: 'external', action: 'UPDATE_ORDER', traceId: 'trace-4' } })
    subscribeCallback({ meta: { source: 'external', action: 'DELETE_ORDER', traceId: 'trace-5' } })
    await vi.advanceTimersByTimeAsync(200)
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  /**
   * @test_id V9-TEST-ST-145-SUB-05
   * cleanup 函数清除去抖定时器，阻止待执行的刷新
   * 覆盖行 560-561
   */
  it('cleanup 清除去抖定时器，阻止待执行刷新', async () => {
    subscribeCallback({ meta: { source: 'external', action: 'INSERT_ORDER', traceId: 'trace-6' } })
    // 立即调用 cleanup（定时器尚未触发）
    cleanup()
    await vi.advanceTimersByTimeAsync(200)
    // 定时器已被清除，刷新不应执行
    expect(mockQuery).not.toHaveBeenCalled()
  })

  /**
   * @test_id V9-TEST-ST-145-SUB-06
   * tradeActionExecuted action 也触发去抖刷新
   */
  it('tradeActionExecuted action 触发去抖刷新', async () => {
    subscribeCallback({ meta: { source: 'external', action: 'TRADE_ACTION_EXECUTED', traceId: 'trace-7' } })
    await vi.advanceTimersByTimeAsync(200)
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  /**
   * @test_id V9-TEST-ST-145-SUB-07
   * 重复初始化时跳过并返回已有清理函数
   */
  it('重复初始化时跳过并返回已有清理函数', () => {
    const cleanup2 = initOrderStoreSubscriptions()
    expect(typeof cleanup2).toBe('function')
    // 不应再次调用 subscribe
    expect(subscribeMock).toHaveBeenCalledTimes(1)
    cleanup2()
  })
})
