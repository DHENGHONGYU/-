/**
 * @module portfolioService.test
 * @description 投资组合服务单元测试（E-2-6）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/data/dataLayer', () => ({
  portfolioStore: {
    list: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
  },
}))

vi.mock('@/services/analysis/dataFreshnessGuard', () => ({
  checkPortfolioRebalanceFreshness: vi.fn(() => ({ valid: true })),
}))

import { portfolioStore } from '@/data/dataLayer'
import { rebalance, addHolding, removeHolding, listByTheme } from '@/services/portfolio/portfolioService'
import type { Portfolio, PortfolioHolding, Order } from '@/data/types'

const mockHolding = (overrides: Partial<PortfolioHolding> = {}): PortfolioHolding => ({
  symbol: '600000',
  name: '浦发银行',
  currentShares: 100,
  currentWeight: 0.2,
  targetWeight: 0.2,
  targetShares: 100,
  price: 10,
  marketValue: 1000,
  score: 80,
  rationale: '测试持仓',
  ...overrides,
})

const mockPortfolio = (overrides: Partial<Portfolio> = {}): Portfolio => ({
  id: 'portfolio_001',
  name: '测试组合',
  theme: '银行',
  totalValue: 10_000,
  cashReserve: 1_000,
  holdings: [mockHolding()],
  rebalancePlan: [],
  createdAt: 1_000,
  updatedAt: 1_000,
  ...overrides,
})

const mockOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order_001',
  symbol: '600000',
  direction: 'buy',
  quantity: 50,
  price: 10,
  status: 'filled',
  accountType: 'paper',
  createdAt: 1_500,
  ...overrides,
} as Order)

describe('portfolioService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rebalance', () => {
    it('rebalances portfolio based on latest orders', async () => {
      vi.mocked(portfolioStore.get).mockResolvedValue(mockPortfolio())
      vi.mocked(portfolioStore.save).mockResolvedValue({ success: true, data: {} as any } as any)
      const result = await rebalance('portfolio_001', [mockOrder()], { now: 3_000 })
      expect(result).toBeDefined()
      expect(result!.updatedAt).toBe(3_000)
      // 买单 50 股后持仓应为 150
      expect(result!.holdings[0]!.currentShares).toBe(150)
    })

    it('handles sell orders correctly', async () => {
      vi.mocked(portfolioStore.get).mockResolvedValue(mockPortfolio())
      vi.mocked(portfolioStore.save).mockResolvedValue({ success: true, data: {} as any } as any)
      const result = await rebalance('portfolio_001', [mockOrder({ direction: 'sell' })], { now: 3_000 })
      expect(result).toBeDefined()
      expect(result!.holdings[0]!.currentShares).toBe(50)
    })

    it('returns undefined when portfolio not found', async () => {
      vi.mocked(portfolioStore.get).mockResolvedValue(undefined)
      const result = await rebalance('portfolio_999', [])
      expect(result).toBeUndefined()
    })

    it('returns undefined when save fails', async () => {
      vi.mocked(portfolioStore.get).mockResolvedValue(mockPortfolio())
      vi.mocked(portfolioStore.save).mockResolvedValue({ success: false, error: 'db_error' } as any)
      const result = await rebalance('portfolio_001', [])
      expect(result).toBeUndefined()
    })
  })

  describe('addHolding', () => {
    it('adds a new holding to portfolio', async () => {
      vi.mocked(portfolioStore.get).mockResolvedValue(mockPortfolio())
      vi.mocked(portfolioStore.save).mockResolvedValue({ success: true, data: {} as any } as any)
      const newHolding = mockHolding({ symbol: '600001', name: '平安银行' })
      const result = await addHolding('portfolio_001', newHolding)
      expect(result).toBeDefined()
      expect(result!.holdings).toHaveLength(2)
    })

    it('rejects duplicate holding', async () => {
      vi.mocked(portfolioStore.get).mockResolvedValue(mockPortfolio())
      const result = await addHolding('portfolio_001', mockHolding())
      expect(result).toBeDefined()
      expect(result!.holdings).toHaveLength(1)
    })
  })

  describe('removeHolding', () => {
    it('removes a holding from portfolio', async () => {
      vi.mocked(portfolioStore.get).mockResolvedValue(mockPortfolio())
      vi.mocked(portfolioStore.save).mockResolvedValue({ success: true, data: {} as any } as any)
      const result = await removeHolding('portfolio_001', '600000')
      expect(result).toBeDefined()
      expect(result!.holdings).toHaveLength(0)
    })

    it('returns portfolio unchanged when holding not found', async () => {
      vi.mocked(portfolioStore.get).mockResolvedValue(mockPortfolio())
      const result = await removeHolding('portfolio_001', '999999')
      expect(result).toBeDefined()
      expect(result!.holdings).toHaveLength(1)
    })
  })

  describe('listByTheme', () => {
    it('filters portfolios by theme', async () => {
      vi.mocked(portfolioStore.list).mockResolvedValue([
        mockPortfolio({ theme: '银行' }),
        mockPortfolio({ id: 'portfolio_002', theme: '科技' }),
      ])
      const result = await listByTheme('银行')
      expect(result).toHaveLength(1)
      expect(result[0]!.theme).toBe('银行')
    })
  })
})
