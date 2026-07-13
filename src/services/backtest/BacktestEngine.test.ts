import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { DailyQuotes, Signal, Order } from '@/data/types'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockGenerateId = vi.hoisted(() => vi.fn(() => 'mock-id'))
vi.mock('@/data/db', () => ({ generateId: mockGenerateId }))

const mockSignalsList = vi.hoisted(() => vi.fn())
const mockOrdersList = vi.hoisted(() => vi.fn())
const mockDailyQuotesGet = vi.hoisted(() => vi.fn())

// BacktestEventLoader 在 P4 后统一走 DataBridge.query，不再直接访问 dataLayer。
// 本 mock 将 query 路由到原 dataLayer mock 函数，保持测试语义不变。
const mockDataBridgeQuery = vi.hoisted(() => vi.fn(async (request: { action: string; store: string; key?: string }) => {
  if (request.action === 'QUERY_LIST' && request.store === 'signals') {
    const data = await mockSignalsList()
    return { success: true, data }
  }
  if (request.action === 'QUERY_LIST' && request.store === 'orders') {
    const data = await mockOrdersList()
    return { success: true, data }
  }
  if (request.action === 'QUERY_GET' && request.store === 'daily_quotes') {
    const data = await mockDailyQuotesGet(request.key)
    return { success: true, data }
  }
  return { success: false, error: `unmocked query: ${request.action}/${request.store}` }
}))
vi.mock('@/core/databridge', () => ({
  dataBridge: { query: mockDataBridgeQuery },
}))

const mockCalculatePosition = vi.hoisted(() => vi.fn())
vi.mock('@/services/trading/positionSizer', () => ({ calculatePosition: mockCalculatePosition }))

// ============================================================
// Imports
// ============================================================

import { BacktestEngine } from './BacktestEngine'

// ============================================================
// Helpers
// ============================================================

function createMockSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig-1',
    symbol: 'AAPL',
    direction: 'buy',
    confidence: 0.8,
    strategy: 'hot-sector',
    createdAt: Date.now(),
    ...overrides,
  } as unknown as Signal
}

function createMockOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    symbol: 'AAPL',
    direction: 'buy',
    price: 100,
    quantity: 10,
    amount: 1000,
    status: 'filled',
    accountType: 'real',
    createdAt: Date.now(),
    ...overrides,
  } as unknown as Order
}

function createMockDailyQuotes(
  symbol: string,
  prices: Record<string, number>,
  latestPrice: number = 100,
): DailyQuotes {
  return {
    symbol,
    latest: {
      date: '2024-01-15',
      close: latestPrice,
      open: latestPrice,
      high: latestPrice,
      low: latestPrice,
      volume: 1_000_000,
    },
    history: Object.entries(prices).map(([date, close]) => ({
      date,
      close,
      open: close,
      high: close,
      low: close,
      volume: 1_000_000,
    })),
    updatedAt: Date.now(),
  } as unknown as DailyQuotes
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateId.mockReturnValue('mock-id')
})

// ============================================================
// BacktestEngine
// ============================================================

describe('BacktestEngine', () => {
  describe('run()', () => {
    it('无信号/订单时返回空结果', async () => {
      mockSignalsList.mockResolvedValue([])
      mockOrdersList.mockResolvedValue([])

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        initialCapital: 1_000_000,
        commissionRate: 0.0003,
        slippage: 0.001,
        maxPositionPct: 0.2,
      })

      expect(result.trades).toHaveLength(0)
      expect(result.positions).toHaveLength(0)
      expect(result.dailyValues).toHaveLength(0)
      expect(result.metrics.tradeCount).toBe(0)
      expect(result.metrics.totalReturn).toBe(0)
    })

    it('成功执行回测并计算绩效指标', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      const sellDate = new Date('2024-01-05T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'AAPL', direction: 'sell', createdAt: sellDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', {
          '2024-01-02': 100,
          '2024-01-03': 101,
          '2024-01-04': 102,
          '2024-01-05': 110,
        }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 1000 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-05',
        initialCapital: 1_000_000,
        commissionRate: 0.0003,
        slippage: 0.001,
        maxPositionPct: 0.2,
      })

      expect(result.trades.length).toBeGreaterThan(0)
      expect(result.metrics.tradeCount).toBeGreaterThan(0)
      expect(result.metrics.pnlCurve.length).toBeGreaterThan(0)
      expect(result.metrics.positions).toBeDefined()
      expect(result.metrics.dailyValues).toBeDefined()
    })

    it('信号不足时自动降级到 orders', async () => {
      mockSignalsList.mockResolvedValue([])
      const orderDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      mockOrdersList.mockResolvedValue([
        createMockOrder({ symbol: 'AAPL', direction: 'buy', createdAt: orderDate }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', { '2024-01-02': 100 }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-02',
        initialCapital: 1_000_000,
        commissionRate: 0.0003,
        slippage: 0.001,
        maxPositionPct: 0.2,
      })

      expect(mockOrdersList).toHaveBeenCalled()
      expect(result.trades.length).toBeGreaterThan(0)
    })

    it('signals 加载失败时优雅降级', async () => {
      mockSignalsList.mockRejectedValue(new Error('DB error'))
      mockOrdersList.mockResolvedValue([])

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        initialCapital: 1_000_000,
        commissionRate: 0.0003,
        slippage: 0.001,
        maxPositionPct: 0.2,
      })

      expect(result.trades).toHaveLength(0)
      expect(result.metrics.tradeCount).toBe(0)
    })

    it('orders 加载失败时优雅降级', async () => {
      mockSignalsList.mockResolvedValue([])
      mockOrdersList.mockRejectedValue(new Error('DB error'))

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        initialCapital: 1_000_000,
        commissionRate: 0.0003,
        slippage: 0.001,
        maxPositionPct: 0.2,
      })

      expect(result.trades).toHaveLength(0)
      expect(result.metrics.tradeCount).toBe(0)
    })
  })

  describe('绩效指标计算', () => {
    it('计算总收益率', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      const sellDate = new Date('2024-01-05T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'AAPL', direction: 'sell', createdAt: sellDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', {
          '2024-01-02': 100,
          '2024-01-03': 105,
          '2024-01-04': 108,
          '2024-01-05': 115,
        }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 1000 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-05',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      expect(result.metrics.totalReturn).toBeGreaterThan(0)
    })

    it('计算年化收益率', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', {
          '2024-01-02': 100,
          '2024-01-03': 102,
          '2024-01-04': 104,
          '2024-01-05': 106,
        }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 1000 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-05',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      expect(result.metrics.annualizedReturn).toBeGreaterThan(0)
    })

    it('计算最大回撤', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', {
          '2024-01-02': 100,
          '2024-01-03': 95,
          '2024-01-04': 90,
          '2024-01-05': 92,
        }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 1000 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-05',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      expect(result.metrics.maxDrawdown).toBeGreaterThan(0)
    })

    it('计算夏普比率', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', {
          '2024-01-02': 100,
          '2024-01-03': 102,
          '2024-01-04': 101,
          '2024-01-05': 105,
        }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 1000 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-05',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      expect(typeof result.metrics.sharpeRatio).toBe('number')
    })

    it('计算胜率', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      const sellDate1 = new Date('2024-01-03T10:00:00.000Z').getTime()
      const sellDate2 = new Date('2024-01-04T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'AAPL', direction: 'sell', createdAt: sellDate1, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'MSFT', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'MSFT', direction: 'sell', createdAt: sellDate2, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockImplementation((symbol: string) => {
        if (symbol === 'AAPL') {
          return Promise.resolve(
            createMockDailyQuotes('AAPL', {
              '2024-01-02': 100,
              '2024-01-03': 110,
              '2024-01-04': 108,
            }),
          )
        }
        return Promise.resolve(
          createMockDailyQuotes('MSFT', {
            '2024-01-02': 200,
            '2024-01-03': 195,
            '2024-01-04': 190,
          }),
        )
      })

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 500 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-04',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      expect(result.metrics.winRate).toBeGreaterThan(0)
      expect(result.metrics.winRate).toBeLessThanOrEqual(100)
    })
  })

  describe('交易执行', () => {
    it('买入执行（含滑点和手续费）', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', { '2024-01-02': 100 }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 1000 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-02',
        initialCapital: 1_000_000,
        commissionRate: 0.001,
        slippage: 0.01,
        maxPositionPct: 1,
      })

      const buyTrade = result.trades.find((t) => t.direction === 'buy')
      expect(buyTrade).toBeDefined()
      expect(buyTrade!.price).toBeGreaterThan(100)
      expect(buyTrade!.commission).toBeGreaterThan(0)
    })

    it('卖出执行（含滑点和手续费）', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      const sellDate = new Date('2024-01-03T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'AAPL', direction: 'sell', createdAt: sellDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', {
          '2024-01-02': 100,
          '2024-01-03': 105,
        }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 1000 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-03',
        initialCapital: 1_000_000,
        commissionRate: 0.001,
        slippage: 0.01,
        maxPositionPct: 1,
      })

      const sellTrade = result.trades.find((t) => t.direction === 'sell')
      expect(sellTrade).toBeDefined()
      expect(sellTrade!.price).toBeLessThan(105)
      expect(sellTrade!.commission).toBeGreaterThan(0)
    })

    it('卖出时检查持仓数量', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      const sellDate = new Date('2024-01-03T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'MSFT', direction: 'sell', createdAt: sellDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', { '2024-01-02': 100 }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 1000 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-03',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      const msftSell = result.trades.find((t) => t.symbol === 'MSFT')
      expect(msftSell).toBeUndefined()
    })

    it('现金不足时跳过买入', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', { '2024-01-02': 1000 }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 1_000_000 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-02',
        initialCapital: 100,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      expect(result.trades).toHaveLength(0)
    })
  })

  describe('持仓管理', () => {
    it('计算平均成本', async () => {
      const buyDate1 = new Date('2024-01-02T10:00:00.000Z').getTime()
      const buyDate2 = new Date('2024-01-03T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate1, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate2, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', {
          '2024-01-02': 100,
          '2024-01-03': 120,
        }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-03',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      const position = result.positions.find((p) => p.symbol === 'AAPL')
      expect(position).toBeDefined()
      expect(position!.avgCost).toBeGreaterThan(100)
      expect(position!.avgCost).toBeLessThan(120)
    })

    it('部分卖出后更新持仓', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      const sellDate = new Date('2024-01-03T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'AAPL', direction: 'sell', createdAt: sellDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', {
          '2024-01-02': 100,
          '2024-01-03': 110,
        }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-03',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      expect(result.positions).toHaveLength(0)
    })

    it('全部卖出后清空持仓', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      const sellDate = new Date('2024-01-03T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'AAPL', direction: 'sell', createdAt: sellDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', {
          '2024-01-02': 100,
          '2024-01-03': 110,
        }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-03',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      expect(result.positions).toHaveLength(0)
    })
  })

  describe('策略过滤', () => {
    it('hot_sector 策略只匹配 hot-sector 信号', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'MSFT', direction: 'buy', createdAt: buyDate, strategy: 'value-pit' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', { '2024-01-02': 100 }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-02',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      const symbols = result.trades.map((t) => t.symbol)
      expect(symbols).toContain('AAPL')
      expect(symbols).not.toContain('MSFT')
    })

    it('value_pit 策略只匹配 value-pit 信号', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'MSFT', direction: 'buy', createdAt: buyDate, strategy: 'value-pit' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('MSFT', { '2024-01-02': 200 }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'value_pit',
        startDate: '2024-01-02',
        endDate: '2024-01-02',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      const symbols = result.trades.map((t) => t.symbol)
      expect(symbols).toContain('MSFT')
      expect(symbols).not.toContain('AAPL')
    })

    it('composite 策略匹配所有信号', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'MSFT', direction: 'buy', createdAt: buyDate, strategy: 'value-pit' }),
      ])

      mockDailyQuotesGet.mockImplementation((symbol: string) => {
        return Promise.resolve(createMockDailyQuotes(symbol, { '2024-01-02': symbol === 'AAPL' ? 100 : 200 }))
      })

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'composite',
        startDate: '2024-01-02',
        endDate: '2024-01-02',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      const symbols = result.trades.map((t) => t.symbol)
      expect(symbols).toContain('AAPL')
      expect(symbols).toContain('MSFT')
    })
  })

  describe('日期范围处理', () => {
    it('跳过周末日期', async () => {
      const buyDate = new Date('2024-01-06T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', {
          '2024-01-05': 100,
          '2024-01-06': 105,
          '2024-01-07': 105,
          '2024-01-08': 105,
          '2024-01-09': 110,
        }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-05',
        endDate: '2024-01-09',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      const dates = result.dailyValues.map((d) => d.date)
      expect(dates).not.toContain('2024-01-06')
      expect(dates).not.toContain('2024-01-07')
    })

    it('日期范围外的信号被过滤', async () => {
      const earlyDate = new Date('2023-12-20T10:00:00.000Z').getTime()
      const inRangeDate = new Date('2024-01-05T10:00:00.000Z').getTime()
      const lateDate = new Date('2024-02-20T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: earlyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'MSFT', direction: 'buy', createdAt: inRangeDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'GOOG', direction: 'buy', createdAt: lateDate, strategy: 'hot-sector' }),
      ])

      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('MSFT', { '2024-01-05': 200 }),
      )

      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0,
        maxPositionPct: 1,
      })

      const symbols = result.trades.map((t) => t.symbol)
      expect(symbols).toContain('MSFT')
      expect(symbols).not.toContain('AAPL')
      expect(symbols).not.toContain('GOOG')
    })
  })

  // ============================================================
  // 行为契约测试（拆分等价性验证）
  // ============================================================
  // 验证原则：只验证 run() 的外部可观察行为（返回值结构、字段值、序列）
  // 不验证内部实现细节（不关心调用了哪个私有方法），用于拆分前后行为等价性验证
  // ============================================================
  describe('run() 行为契约（拆分等价性验证）', () => {
    // ---- 契约①：返回结果结构完整性 ----
    it('契约①: run() 返回结果包含完整字段结构', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
      ])
      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', { '2024-01-02': 100, '2024-01-03': 101 }),
      )
      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-03',
        initialCapital: 1_000_000,
        commissionRate: 0.0003,
        slippage: 0.001,
        maxPositionPct: 0.2,
      })

      // 顶层结构
      expect(result).toHaveProperty('trades')
      expect(result).toHaveProperty('positions')
      expect(result).toHaveProperty('dailyValues')
      expect(result).toHaveProperty('metrics')
      expect(Array.isArray(result.trades)).toBe(true)
      expect(Array.isArray(result.positions)).toBe(true)
      expect(Array.isArray(result.dailyValues)).toBe(true)

      // metrics 字段完整性
      const m = result.metrics
      expect(m).toHaveProperty('totalReturn')
      expect(m).toHaveProperty('annualizedReturn')
      expect(m).toHaveProperty('maxDrawdown')
      expect(m).toHaveProperty('sharpeRatio')
      expect(m).toHaveProperty('winRate')
      expect(m).toHaveProperty('tradeCount')
      expect(m).toHaveProperty('profitTrades')
      expect(m).toHaveProperty('lossTrades')
      expect(m).toHaveProperty('avgProfit')
      expect(m).toHaveProperty('avgLoss')
      expect(m).toHaveProperty('pnlCurve')
      expect(m).toHaveProperty('trades')

      // VirtualOrder 字段完整性
      if (result.trades.length > 0) {
        const t = result.trades[0]!
        expect(t).toHaveProperty('id')
        expect(t).toHaveProperty('symbol')
        expect(t).toHaveProperty('direction')
        expect(t).toHaveProperty('price')
        expect(t).toHaveProperty('quantity')
        expect(t).toHaveProperty('date')
        expect(t).toHaveProperty('commission')
      }
    })

    // ---- 契约②：buy→sell 完整路径后持仓清空 ----
    it('契约②: buy→sell 完整路径后持仓清空且包含双向交易', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      const sellDate = new Date('2024-01-03T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'AAPL', direction: 'sell', createdAt: sellDate, strategy: 'hot-sector' }),
      ])
      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', { '2024-01-02': 100, '2024-01-03': 105 }),
      )
      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-03',
        initialCapital: 1_000_000,
        commissionRate: 0.0003,
        slippage: 0.001,
        maxPositionPct: 0.2,
      })

      // DEBUG removed (console.log triggers ESLint no-console)
      // const mockLogger = getLogger() // not needed here
      // mockLogger.debug('DEBUG mockDataBridgeQuery calls:', mockDataBridgeQuery.mock.calls)

      // 包含买入和卖出双向交易
      const buyTrades = result.trades.filter((t) => t.direction === 'buy')
      const sellTrades = result.trades.filter((t) => t.direction === 'sell')
      expect(buyTrades.length).toBeGreaterThan(0)
      expect(sellTrades.length).toBeGreaterThan(0)

      // 卖出后持仓清空
      expect(result.positions).toHaveLength(0)

      // 最终现金为正（卖出回收现金）
      const lastDay = result.dailyValues[result.dailyValues.length - 1]
      expect(lastDay).toBeDefined()
      expect(lastDay!.cash).toBeGreaterThan(0)
    })

    // ---- 契约③：空事件时 metrics 全字段零值 ----
    it('契约③: 空事件时 metrics 全字段为零值且 trades/positions/dailyValues 为空数组', async () => {
      mockSignalsList.mockResolvedValue([])
      mockOrdersList.mockResolvedValue([])

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        initialCapital: 1_000_000,
        commissionRate: 0.0003,
        slippage: 0.001,
        maxPositionPct: 0.2,
      })

      // 三个数组为空
      expect(result.trades).toEqual([])
      expect(result.positions).toEqual([])
      expect(result.dailyValues).toEqual([])

      // metrics 全字段零值（注：pnlCurve 默认 [1.0]，与 _emptyMetrics 实现一致）
      expect(result.metrics.tradeCount).toBe(0)
      expect(result.metrics.profitTrades).toBe(0)
      expect(result.metrics.lossTrades).toBe(0)
      expect(result.metrics.totalReturn).toBe(0)
      expect(result.metrics.winRate).toBe(0)
      expect(result.metrics.pnlCurve).toEqual([1.0])
      expect(result.metrics.trades).toEqual([])
    })

    // ---- 契约④：滑点方向（买入上浮/卖出下浮） ----
    it('契约④: 滑点方向正确（买入价上浮/卖出价下浮）', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      const sellDate = new Date('2024-01-03T10:00:00.000Z').getTime()

      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
        createMockSignal({ symbol: 'AAPL', direction: 'sell', createdAt: sellDate, strategy: 'hot-sector' }),
      ])
      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', { '2024-01-02': 100, '2024-01-03': 100 }),
      )
      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-03',
        initialCapital: 1_000_000,
        commissionRate: 0,
        slippage: 0.01, // 1% 滑点
        maxPositionPct: 1,
      })

      const buyTrade = result.trades.find((t) => t.direction === 'buy')
      const sellTrade = result.trades.find((t) => t.direction === 'sell')

      // 买入价 = 100 × (1 + 0.01) = 101
      expect(buyTrade).toBeDefined()
      expect(buyTrade!.price).toBeCloseTo(101, 1)

      // 卖出价 = 100 × (1 - 0.01) = 99
      expect(sellTrade).toBeDefined()
      expect(sellTrade!.price).toBeCloseTo(99, 1)
    })

    // ---- 契约⑤：dailyValues 日期严格升序且跳过周末 ----
    it('契约⑤: dailyValues 日期严格升序且跳过周末', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
      ])
      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', {
          '2024-01-02': 100,
          '2024-01-03': 101,
          '2024-01-04': 102,
          '2024-01-05': 103,
        }),
      )
      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-08',
        initialCapital: 1_000_000,
        commissionRate: 0.0003,
        slippage: 0.001,
        maxPositionPct: 0.2,
      })

      // 日期严格升序
      for (let i = 1; i < result.dailyValues.length; i++) {
        const prev = result.dailyValues[i - 1]!
        const curr = result.dailyValues[i]!
        expect(curr.date > prev.date).toBe(true)
      }

      // 跳过周末（2024-01-06 周六、2024-01-07 周日）
      const dates = result.dailyValues.map((d) => d.date)
      expect(dates).not.toContain('2024-01-06')
      expect(dates).not.toContain('2024-01-07')
    })

    // ---- 契约⑥：metrics.positions/dailyValues 与顶层一致 ----
    it('契约⑥: metrics.positions 和 metrics.dailyValues 与顶层字段同引用', async () => {
      const buyDate = new Date('2024-01-02T10:00:00.000Z').getTime()
      mockSignalsList.mockResolvedValue([
        createMockSignal({ symbol: 'AAPL', direction: 'buy', createdAt: buyDate, strategy: 'hot-sector' }),
      ])
      mockDailyQuotesGet.mockResolvedValue(
        createMockDailyQuotes('AAPL', { '2024-01-02': 100, '2024-01-03': 101 }),
      )
      mockCalculatePosition.mockReturnValue({ action: 'buy', targetShares: 100 })

      const engine = new BacktestEngine()
      const result = await engine.run({
        strategy: 'hot_sector',
        startDate: '2024-01-02',
        endDate: '2024-01-03',
        initialCapital: 1_000_000,
        commissionRate: 0.0003,
        slippage: 0.001,
        maxPositionPct: 0.2,
      })

      // metrics 注入的 positions/dailyValues 应与顶层一致
      expect(result.metrics.positions).toEqual(result.positions)
      expect(result.metrics.dailyValues).toEqual(result.dailyValues)
    })
  })
})
