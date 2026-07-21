/**
 * @test_id V9-TEST-ST-129
 * @module services/useCase/rebalancePortfolio.useCase.test
 * @description 投资组合再平衡用例单元测试 — 验证再平衡流程、持仓更新、异常处理等场景
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-021, V9-DOC-BACK-033, V9-DOC-BACK-027]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rebalancePortfolioUseCase } from './rebalancePortfolio.useCase'
import type { Portfolio, PortfolioHolding, Order } from '@/data/types'

// Mock 依赖
const {
  mockGetWithTx,
  mockSaveWithTx,
  mockRunInTransaction,
  mockCheckPortfolioRebalanceFreshness,
  mockGetLogger,
} = vi.hoisted(() => ({
  mockGetWithTx: vi.fn(),
  mockSaveWithTx: vi.fn(),
  mockRunInTransaction: vi.fn(),
  mockCheckPortfolioRebalanceFreshness: vi.fn(),
  mockGetLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: mockGetLogger,
}))

vi.mock('@/data/dataLayerTradingStores', () => ({
  portfolioStore: {
    getWithTx: mockGetWithTx,
    saveWithTx: mockSaveWithTx,
  },
}))

vi.mock('@/core/transaction', () => ({
  runInTransaction: mockRunInTransaction,
}))

vi.mock('@/config/dbConfig', () => ({
  STORE_NAME: {
    portfolios: 'portfolios',
    orders: 'orders',
    stocks: 'stocks',
  },
}))

vi.mock('@/constants/execution.constants', () => ({
  DEFAULT_CASH_RESERVE_PCT: 0.1,
  DEFAULT_MAX_HOLDING_WEIGHT: 0.3,
  DEFAULT_REBALANCE_THRESHOLD: 0.05,
}))

vi.mock('@/core/freshnessGuard', () => ({
  checkPortfolioRebalanceFreshness: mockCheckPortfolioRebalanceFreshness,
}))

describe('rebalancePortfolioUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置默认 mock 实现
    mockGetLogger.mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })
    mockCheckPortfolioRebalanceFreshness.mockReturnValue({
      output: 'portfolio.updatedAt',
      input: 'latest_order.createdAt',
      outputTime: 0,
      inputTime: 0,
      valid: true,
    })
    // runInTransaction 默认实现：直接执行回调
    mockRunInTransaction.mockImplementation((_stores, _mode, callback) => {
      return callback({} as unknown as IDBTransaction)
    })
    mockGetWithTx.mockResolvedValue(undefined)
    mockSaveWithTx.mockResolvedValue(undefined)
  })

  // 测试数据
  const mockHoldings: PortfolioHolding[] = [
    {
      symbol: '000001.SZ',
      name: '平安银行',
      currentShares: 1000,
      currentWeight: 0.5,
      targetWeight: 0.4,
      targetShares: 800,
      price: 12.5,
      marketValue: 12500,
      score: 4.2,
      rationale: '测试持仓1',
    },
    {
      symbol: '600519.SH',
      name: '贵州茅台',
      currentShares: 10,
      currentWeight: 0.5,
      targetWeight: 0.6,
      targetShares: 12,
      price: 1800.0,
      marketValue: 18000,
      score: 4.5,
      rationale: '测试持仓2',
    },
  ]

  const mockPortfolio: Portfolio = {
    id: 'port-test-001',
    name: '测试组合',
    theme: '价值投资',
    totalValue: 30500,
    cashReserve: 3050,
    holdings: mockHoldings,
    rebalancePlan: [],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
  }

  const mockOrders: Order[] = [
    {
      id: 'order-001',
      symbol: '000001.SZ',
      direction: 'buy',
      quantity: 200,
      price: 12.0,
      amount: 2400,
      status: 'filled',
      accountType: 'real',
      createdAt: Date.now() - 1800000,
    },
  ]

  describe('正常再平衡流程', () => {
    it('应当成功执行再平衡并返回更新后的组合', async () => {
      // 准备
      mockGetWithTx.mockResolvedValue(mockPortfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', mockOrders)

      // 验证
      expect(result).toBeDefined()
      expect(result!.id).toBe('port-test-001')
      expect(result!.holdings).toHaveLength(2)

      // 验证：平安银行买入 200 股后变为 1200 股
      const pinganHolding = result!.holdings.find((h) => h.symbol === '000001.SZ')
      expect(pinganHolding).toBeDefined()
      expect(pinganHolding!.currentShares).toBe(1200)

      // 验证：保存被调用
      expect(mockSaveWithTx).toHaveBeenCalled()
    })

    it('应当正确计算总市值和现金储备', async () => {
      // 准备
      mockGetWithTx.mockResolvedValue(mockPortfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证：总市值 = 所有持仓 marketValue 之和
      const expectedTotalValue = mockHoldings.reduce((sum, h) => sum + h.marketValue, 0)
      expect(result!.totalValue).toBe(expectedTotalValue)

      // 验证：现金储备 = 总市值 * DEFAULT_CASH_RESERVE_PCT
      expect(result!.cashReserve).toBeCloseTo(expectedTotalValue * 0.1, 5)
    })

    it('应当生成再平衡计划当权重偏差超过阈值', async () => {
      // 准备：当前权重与目标权重偏差超过 5%
      const portfolioWithDeviation: Portfolio = {
        ...mockPortfolio,
        holdings: [
          {
            symbol: '000001.SZ',
            name: '平安银行',
            currentShares: 2000,
            currentWeight: 0.7,
            targetWeight: 0.4, // 偏差 30%，远超阈值
            targetShares: 800,
            price: 12.5,
            marketValue: 25000,
            score: 4.2,
            rationale: '超配',
          },
          {
            symbol: '600519.SH',
            name: '贵州茅台',
            currentShares: 5,
            currentWeight: 0.3,
            targetWeight: 0.6, // 偏差 30%，远超阈值
            targetShares: 12,
            price: 1800.0,
            marketValue: 9000,
            score: 4.5,
            rationale: '低配',
          },
        ],
        totalValue: 34000,
      }

      mockGetWithTx.mockResolvedValue(portfolioWithDeviation)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证：生成再平衡计划
      expect(result!.rebalancePlan).toBeDefined()
      expect(result!.rebalancePlan.length).toBeGreaterThan(0)

      // 验证：平安银行超配 -> 卖出
      const sellAction = result!.rebalancePlan.find((a) => a.symbol === '000001.SZ')
      expect(sellAction).toBeDefined()
      expect(sellAction!.action).toBe('sell')
      expect(sellAction!.shares).toBeGreaterThan(0)
      expect(sellAction!.reason).toContain('权重偏差')

      // 验证：贵州茅台低配 -> 买入
      const buyAction = result!.rebalancePlan.find((a) => a.symbol === '600519.SH')
      expect(buyAction).toBeDefined()
      expect(buyAction!.action).toBe('buy')
      expect(buyAction!.shares).toBeGreaterThan(0)
    })

    it('不应当生成再平衡计划当权偏差在阈值内', async () => {
      // 准备：权重偏差在阈值内（都为 0.03 < 0.05）
      const portfolioBalanced: Portfolio = {
        ...mockPortfolio,
        holdings: [
          {
            symbol: '000001.SZ',
            name: '平安银行',
            currentShares: 1000,
            currentWeight: 0.42,
            targetWeight: 0.4, // 偏差 2%
            targetShares: 952,
            price: 12.5,
            marketValue: 12500,
            score: 4.2,
            rationale: '基本平衡',
          },
          {
            symbol: '600519.SH',
            name: '贵州茅台',
            currentShares: 10,
            currentWeight: 0.58,
            targetWeight: 0.6, // 偏差 2%
            targetShares: 10,
            price: 1800.0,
            marketValue: 18000,
            score: 4.5,
            rationale: '基本平衡',
          },
        ],
        totalValue: 30500,
      }

      mockGetWithTx.mockResolvedValue(portfolioBalanced)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证：不生成再平衡计划
      expect(result!.rebalancePlan).toHaveLength(0)
    })

    it('应当更新 updatedAt 时间戳', async () => {
      // 准备
      const now = 1234567890000
      mockGetWithTx.mockResolvedValue(mockPortfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [], { now })

      // 验证
      expect(result!.updatedAt).toBe(now)
    })
  })

  describe('持仓为空', () => {
    it('应当处理持仓为空的情况', async () => {
      // 准备
      const emptyPortfolio: Portfolio = {
        ...mockPortfolio,
        holdings: [],
        totalValue: 0,
      }
      mockGetWithTx.mockResolvedValue(emptyPortfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证
      expect(result).toBeDefined()
      expect(result!.holdings).toHaveLength(0)
      expect(result!.totalValue).toBe(0)
      expect(result!.cashReserve).toBe(0)
      expect(result!.rebalancePlan).toHaveLength(0)
    })

    it('应当处理订单但持仓为空的情况', async () => {
      // 准备：空持仓 + 买入订单（应当不匹配任何持仓）
      const emptyPortfolio: Portfolio = {
        ...mockPortfolio,
        holdings: [],
        totalValue: 0,
      }
      mockGetWithTx.mockResolvedValue(emptyPortfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', mockOrders)

      // 验证：持仓仍为空（因为订单标的不在持仓中）
      expect(result!.holdings).toHaveLength(0)
      expect(mockSaveWithTx).toHaveBeenCalled()
    })
  })

  describe('目标配置为空', () => {
    it('应当处理目标权重全为 0 的情况', async () => {
      // 准备
      const portfolioZeroTarget: Portfolio = {
        ...mockPortfolio,
        holdings: [
          {
            ...mockHoldings[0]!,
            targetWeight: 0,
            currentWeight: 1.0,
            marketValue: 30500,
            price: 30.5,
            currentShares: 1000,
          },
        ],
        totalValue: 30500,
      }
      mockGetWithTx.mockResolvedValue(portfolioZeroTarget)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证：偏差 100%，应当触发卖出
      expect(result!.rebalancePlan.length).toBeGreaterThan(0)
      const action = result!.rebalancePlan[0]!
      expect(action.action).toBe('sell')
    })
  })

  describe('数据查询失败', () => {
    it('应当返回 undefined 当组合不存在时', async () => {
      // 准备
      mockGetWithTx.mockResolvedValue(undefined)

      // 执行
      const result = await rebalancePortfolioUseCase('port-not-exist', [])

      // 验证
      expect(result).toBeUndefined()
      expect(mockSaveWithTx).not.toHaveBeenCalled()
    })

    it('应当返回 undefined 当查询组合抛出异常时', async () => {
      // 准备
      mockGetWithTx.mockRejectedValue(new Error('数据库连接失败'))

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证
      expect(result).toBeUndefined()
      expect(mockSaveWithTx).not.toHaveBeenCalled()
    })

    it('应当返回 undefined 当查询组合返回非 Error 异常时', async () => {
      // 准备：非 Error 对象的异常
      mockGetWithTx.mockRejectedValue('字符串异常')

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证
      expect(result).toBeUndefined()
    })
  })

  describe('计算服务失败', () => {
    it('应当返回 undefined 当保存组合失败时', async () => {
      // 准备
      mockGetWithTx.mockResolvedValue(mockPortfolio)
      mockSaveWithTx.mockRejectedValue(new Error('保存失败'))

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证
      expect(result).toBeUndefined()
    })

    it('应当返回 undefined 当 freshness 校验抛出异常时', async () => {
      // 准备：freshness 校验抛出异常（blocking 模式）
      mockGetWithTx.mockResolvedValue(mockPortfolio)
      mockCheckPortfolioRebalanceFreshness.mockImplementation(() => {
        throw new Error('Freshness check failed')
      })

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', mockOrders)

      // 验证：异常被事务外层的 try-catch 捕获
      expect(result).toBeUndefined()
    })
  })

  describe('异常捕获', () => {
    it('应当捕获事务执行中的异常并返回 undefined', async () => {
      // 准备：runInTransaction 抛出异常
      mockRunInTransaction.mockRejectedValue(new Error('事务执行失败'))

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证
      expect(result).toBeUndefined()
    })

    it('应当捕获非 Error 类型的异常', async () => {
      // 准备
      mockRunInTransaction.mockRejectedValue({ code: 500, message: '系统错误' })

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证
      expect(result).toBeUndefined()
    })
  })

  describe('参数传递验证', () => {
    it('应当传递正确的参数给 runInTransaction', async () => {
      // 准备
      mockGetWithTx.mockResolvedValue(mockPortfolio)

      // 执行
      await rebalancePortfolioUseCase('port-test-001', [])

      // 验证
      expect(mockRunInTransaction).toHaveBeenCalledWith(
        ['portfolios'],
        'readwrite',
        expect.any(Function),
      )
    })

    it('应当使用自定义的现金储备比例', async () => {
      // 准备
      mockGetWithTx.mockResolvedValue(mockPortfolio)
      const customCashReservePct = 0.2

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [], {
        cashReservePct: customCashReservePct,
      })

      // 验证
      const expectedTotalValue = mockHoldings.reduce((sum, h) => sum + h.marketValue, 0)
      expect(result!.cashReserve).toBeCloseTo(expectedTotalValue * customCashReservePct, 5)
    })

    it('应当使用自定义的最大持仓权重', async () => {
      // 准备：目标权重超过上限
      const portfolioWithHighTarget: Portfolio = {
        ...mockPortfolio,
        holdings: [
          {
            ...mockHoldings[0]!,
            targetWeight: 0.5, // 超过默认 0.3 上限
            currentWeight: 0.5,
          },
          {
            ...mockHoldings[1]!,
            targetWeight: 0.5,
            currentWeight: 0.5,
          },
        ],
      }
      mockGetWithTx.mockResolvedValue(portfolioWithHighTarget)
      const customMaxWeight = 0.4

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [], {
        maxHoldingWeight: customMaxWeight,
      })

      // 验证：超过上限的目标权重被截断
      result!.holdings.forEach((h) => {
        expect(h.targetWeight).toBeLessThanOrEqual(customMaxWeight)
      })
    })

    it('应当使用自定义的再平衡阈值', async () => {
      // 准备：偏差 6%，默认阈值 5% 会触发，自定义 10% 不触发
      const portfolio: Portfolio = {
        ...mockPortfolio,
        holdings: [
          {
            ...mockHoldings[0]!,
            currentWeight: 0.46,
            targetWeight: 0.4, // 偏差 6%
          },
          {
            ...mockHoldings[1]!,
            currentWeight: 0.54,
            targetWeight: 0.6, // 偏差 6%
          },
        ],
      }
      mockGetWithTx.mockResolvedValue(portfolio)

      // 执行：使用 10% 阈值，偏差 6% 不应触发
      const result = await rebalancePortfolioUseCase('port-test-001', [], {
        rebalanceThreshold: 0.1,
      })

      // 验证：不触发再平衡
      expect(result!.rebalancePlan).toHaveLength(0)
    })

    it('应当传递 portfolioId 给查询和保存', async () => {
      // 准备
      mockGetWithTx.mockResolvedValue(mockPortfolio)
      const portfolioId = 'port-custom-id'

      // 执行
      await rebalancePortfolioUseCase(portfolioId, [])

      // 验证
      expect(mockGetWithTx).toHaveBeenCalledWith(portfolioId, expect.any(Object))
    })
  })

  describe('边界条件', () => {
    it('应当处理订单为 sell 方向时减少持仓', async () => {
      // 准备
      const sellOrders: Order[] = [
        {
          id: 'order-sell-001',
          symbol: '000001.SZ',
          direction: 'sell',
          quantity: 300,
          price: 13.0,
          amount: 3900,
          status: 'filled',
          accountType: 'real',
          createdAt: Date.now() - 1800000,
        },
      ]
      mockGetWithTx.mockResolvedValue(mockPortfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', sellOrders)

      // 验证：平安银行卖出 300 股后变为 700 股
      const pinganHolding = result!.holdings.find((h) => h.symbol === '000001.SZ')
      expect(pinganHolding!.currentShares).toBe(700)
    })

    it('应当防止持仓数量变为负数', async () => {
      // 准备：卖出数量超过持仓
      const sellOrders: Order[] = [
        {
          id: 'order-sell-001',
          symbol: '000001.SZ',
          direction: 'sell',
          quantity: 5000, // 远超持仓 1000 股
          price: 13.0,
          amount: 65000,
          status: 'filled',
          accountType: 'real',
          createdAt: Date.now() - 1800000,
        },
      ]
      mockGetWithTx.mockResolvedValue(mockPortfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', sellOrders)

      // 验证：持仓数量不为负
      const pinganHolding = result!.holdings.find((h) => h.symbol === '000001.SZ')
      expect(pinganHolding!.currentShares).toBe(0) // Math.max(0, 1000 - 5000) = 0
    })

    it('应当处理订单标的不在持仓中的情况', async () => {
      // 准备：订单标的不在持仓中
      const newStockOrders: Order[] = [
        {
          id: 'order-new-001',
          symbol: '000858.SZ',
          direction: 'buy',
          quantity: 100,
          price: 150.0,
          amount: 15000,
          status: 'filled',
          accountType: 'real',
          createdAt: Date.now() - 1800000,
        },
      ]
      mockGetWithTx.mockResolvedValue(mockPortfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', newStockOrders)

      // 验证：持仓数量不变（新标的不在持仓中，不更新）
      expect(result!.holdings).toHaveLength(2)
      const newHolding = result!.holdings.find((h) => h.symbol === '000858.SZ')
      expect(newHolding).toBeUndefined()
    })

    it('应当处理多个订单对同一持仓的影响', async () => {
      // 准备：同一标的多笔订单
      const multiOrders: Order[] = [
        {
          id: 'order-001',
          symbol: '000001.SZ',
          direction: 'buy',
          quantity: 200,
          price: 12.0,
          amount: 2400,
          status: 'filled',
          accountType: 'real',
          createdAt: Date.now() - 3600000,
        },
        {
          id: 'order-002',
          symbol: '000001.SZ',
          direction: 'buy',
          quantity: 300,
          price: 12.5,
          amount: 3750,
          status: 'filled',
          accountType: 'real',
          createdAt: Date.now() - 1800000,
        },
        {
          id: 'order-003',
          symbol: '000001.SZ',
          direction: 'sell',
          quantity: 100,
          price: 13.0,
          amount: 1300,
          status: 'filled',
          accountType: 'real',
          createdAt: Date.now() - 900000,
        },
      ]
      mockGetWithTx.mockResolvedValue(mockPortfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', multiOrders)

      // 验证：1000 + 200 + 300 - 100 = 1400
      const pinganHolding = result!.holdings.find((h) => h.symbol === '000001.SZ')
      expect(pinganHolding!.currentShares).toBe(1400)
    })

    it('应当处理订单为空数组的情况', async () => {
      // 准备
      mockGetWithTx.mockResolvedValue(mockPortfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证：持仓数量不变
      expect(result!.holdings[0]!.currentShares).toBe(1000)
      expect(result!.holdings[1]!.currentShares).toBe(10)
      expect(mockSaveWithTx).toHaveBeenCalled()
    })

    it('应当正确计算零市值时的权重', async () => {
      // 准备：总市值为 0
      const zeroValuePortfolio: Portfolio = {
        ...mockPortfolio,
        holdings: [
          {
            ...mockHoldings[0]!,
            marketValue: 0,
            price: 0,
            targetWeight: 0.5,
          },
        ],
        totalValue: 0,
      }
      mockGetWithTx.mockResolvedValue(zeroValuePortfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证：不报错，totalValue 为 0
      expect(result!.totalValue).toBe(0)
      expect(result!.cashReserve).toBe(0)
    })

    it('应当处理再平衡计划中目标股数为 0 的情况', async () => {
      // 准备：目标权重为 0，当前权重很大
      const portfolio: Portfolio = {
        ...mockPortfolio,
        holdings: [
          {
            symbol: '000001.SZ',
            name: '平安银行',
            currentShares: 1000,
            currentWeight: 1.0,
            targetWeight: 0,
            targetShares: 0,
            price: 12.5,
            marketValue: 12500,
            score: 4.2,
            rationale: '清仓',
          },
        ],
        totalValue: 12500,
      }
      mockGetWithTx.mockResolvedValue(portfolio)

      // 执行
      const result = await rebalancePortfolioUseCase('port-test-001', [])

      // 验证：生成卖出计划
      expect(result!.rebalancePlan).toHaveLength(1)
      expect(result!.rebalancePlan[0]!.action).toBe('sell')
      expect(result!.rebalancePlan[0]!.shares).toBe(1000) // 全部卖出
    })

    it('应当处理 freshness 校验时订单为空的情况', async () => {
      // 准备
      mockGetWithTx.mockResolvedValue(mockPortfolio)

      // 执行
      await rebalancePortfolioUseCase('port-test-001', [])

      // 验证：freshness 校验被调用，latestOrderCreatedAt 为 0
      expect(mockCheckPortfolioRebalanceFreshness).toHaveBeenCalledWith(
        expect.any(Number), // now
        0, // latestOrderCreatedAt = 0（无订单时）
        'port-test-001',
      )
    })

    it('应当正确计算最新订单时间', async () => {
      // 准备：多笔订单，时间不同
      const orders: Order[] = [
        { ...mockOrders[0]!, createdAt: 1000 },
        { ...mockOrders[0]!, id: 'order-002', createdAt: 5000 },
        { ...mockOrders[0]!, id: 'order-003', createdAt: 2000 },
      ]
      mockGetWithTx.mockResolvedValue(mockPortfolio)
      const now = 10000

      // 执行
      await rebalancePortfolioUseCase('port-test-001', orders, { now })

      // 验证：使用最新订单时间 5000
      expect(mockCheckPortfolioRebalanceFreshness).toHaveBeenCalledWith(
        now,
        5000,
        'port-test-001',
      )
    })
  })

  // 注：日志输出由 logger mock 间接验证，此处不单独测试
})
