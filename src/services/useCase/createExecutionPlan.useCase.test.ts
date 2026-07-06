/**
 * @module services/useCase/createExecutionPlan.useCase.test
 * @description 创建执行计划用例单元测试 — 验证风控阻断场景
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createExecutionPlanUseCase } from './createExecutionPlan.useCase'
import type { Signal } from '@/data/types'

// Mock 依赖
vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    stocks: {
      get: vi.fn(),
    },
    orders: {
      list: vi.fn(),
    },
    executionPlans: {
      save: vi.fn(),
    },
  },
}))

vi.mock('@/config/tradingConfig', () => ({
  getDefaultTradingConfig: vi.fn(() => ({
    risk: {
      portfolioValue: 100000,
      singleMaxPct: 0.25,
      totalAllocationPct: 0.80,
      sameSymbolCooldownHours: 24,
      maxTradesPerDay: 5,
      dataFreshnessHours: 48,
    },
  })),
}))

vi.mock('@/services/trading/positionSizer', () => ({
  calculatePosition: vi.fn(() => ({
    targetShares: 1000,
    positionPct: 0.15,
    cappedBy: 'none' as const,
  })),
}))

vi.mock('@/services/trading/riskEngine', () => ({
  checkOrderRisk: vi.fn(),
}))

import { dataLayer } from '@/data/dataLayer'
import { checkOrderRisk } from '@/services/trading/riskEngine'

const mockDataLayer = vi.mocked(dataLayer)
const mockCheckOrderRisk = vi.mocked(checkOrderRisk)

describe('createExecutionPlanUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 测试数据
  const mockSignal: Signal = {
    id: 'sig-test-001',
    symbol: '000001.SZ',
    direction: 'buy',
    type: 'mcp_manual',
    strategy: 'manual',
    confidence: 0.8,
    rationale: '测试信号',
    snapshot: {},
    createdAt: Date.now(),
  }

  describe('风控阻断场景', () => {
    it('应当阻断：价格或数量非法', async () => {
      // 准备：股价为 0
      mockDataLayer.stocks.get.mockResolvedValue({ symbol: '000001.SZ', price: 0 })
      mockDataLayer.orders.list.mockResolvedValue([])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['价格或数量非法'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.success).toBe(true) // UseCase 本身成功执行
      expect(result.plan).toBeDefined()
      expect(result.plan?.risk?.passed).toBe(false) // 但风控未通过
      expect(result.plan?.result).toBe('failed')
      expect(result.plan?.errorMessage).toContain('价格或数量非法')
      expect(result.errorCode).toBe('RISK_BLOCKED')
    })

    it('应当阻断：行情数据过期', async () => {
      // 准备：行情超过 48 小时未更新
      mockDataLayer.stocks.get.mockResolvedValue({ symbol: '000001.SZ', price: 15.5 })
      mockDataLayer.orders.list.mockResolvedValue([])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['行情数据超过 48 小时未更新'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.plan?.risk?.passed).toBe(false)
      expect(result.plan?.result).toBe('failed')
      expect(result.plan?.errorMessage).toContain('行情数据超过 48 小时未更新')
    })

    it('应当阻断：同标的冷却期内', async () => {
      // 准备：24 小时内有同标的交易
      mockDataLayer.stocks.get.mockResolvedValue({ symbol: '000001.SZ', price: 15.5 })
      mockDataLayer.orders.list.mockResolvedValue([
        {
          id: 'order-001',
          symbol: '000001.SZ',
          direction: 'buy',
          quantity: 500,
          price: 15.0,
          createdAt: Date.now() - 12 * 60 * 60 * 1000, // 12 小时前
        },
      ])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['000001.SZ 在 24 小时冷却期内'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.plan?.risk?.passed).toBe(false)
      expect(result.plan?.result).toBe('failed')
      expect(result.plan?.errorMessage).toContain('冷却期内')
    })

    it('应当阻断：超出当日最大交易次数', async () => {
      // 准备：当日已交易 5 次
      mockDataLayer.stocks.get.mockResolvedValue({ symbol: '000001.SZ', price: 15.5 })
      mockDataLayer.orders.list.mockResolvedValue([])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['超出当日最大交易次数（5次）'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.plan?.risk?.passed).toBe(false)
      expect(result.plan?.result).toBe('failed')
      expect(result.plan?.errorMessage).toContain('超出当日最大交易次数')
    })

    it('应当阻断：超出单笔仓位上限', async () => {
      // 准备：单笔仓位超过 25%
      mockDataLayer.stocks.get.mockResolvedValue({ symbol: '000001.SZ', price: 15.5 })
      mockDataLayer.orders.list.mockResolvedValue([])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['超出单笔仓位上限（25%）'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.plan?.risk?.passed).toBe(false)
      expect(result.plan?.result).toBe('failed')
      expect(result.plan?.errorMessage).toContain('超出单笔仓位上限')
    })

    it('应当阻断：组合净值非法', async () => {
      // 准备：组合净值为 0
      mockDataLayer.stocks.get.mockResolvedValue({ symbol: '000001.SZ', price: 15.5 })
      mockDataLayer.orders.list.mockResolvedValue([])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['组合净值非法'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.plan?.risk?.passed).toBe(false)
      expect(result.plan?.result).toBe('failed')
      expect(result.plan?.errorMessage).toContain('组合净值非法')
    })
  })

  describe('风控通过场景', () => {
    it('应当成功创建执行计划：风控通过', async () => {
      // 准备：风控检查通过
      mockDataLayer.stocks.get.mockResolvedValue({ symbol: '000001.SZ', price: 15.5 })
      mockDataLayer.orders.list.mockResolvedValue([])
      mockDataLayer.executionPlans.save.mockResolvedValue({ success: true })
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: ['单笔仓位接近上限'],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.success).toBe(true)
      expect(result.plan).toBeDefined()
      expect(result.plan?.risk?.passed).toBe(true)
      expect(result.plan?.result).toBeUndefined()
      expect(result.plan?.errorMessage).toBeUndefined()
      expect(result.plan?.riskChecks).toHaveLength(1) // 只有警告
      expect(result.plan?.riskChecks[0]?.severity).toBe('warning')
      expect(result.plan?.risk?.warnings).toContain('单笔仓位接近上限')
    })

    it('应当正确计算仓位：Kelly 公式', async () => {
      // 准备
      mockDataLayer.stocks.get.mockResolvedValue({ symbol: '000001.SZ', price: 15.5 })
      mockDataLayer.orders.list.mockResolvedValue([])
      mockDataLayer.executionPlans.save.mockResolvedValue({ success: true })
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.plan?.sizing?.quantity).toBe(1000) // mock 返回值
      expect(result.plan?.quantity).toBe(1000)
      expect(result.plan?.targetPrice).toBe(15.5)
    })
  })

  describe('非交易信号场景', () => {
    it('应当跳过：hold 信号', async () => {
      const holdSignal: Signal = { ...mockSignal, direction: 'hold' }

      const result = await createExecutionPlanUseCase({ signal: holdSignal })

      expect(result.success).toBe(false)
      expect(result.error).toContain('非交易信号')
      expect(result.errorCode).toBe('NOT_TRADE_SIGNAL')
    })

    it('应当跳过：watch 信号', async () => {
      const watchSignal: Signal = { ...mockSignal, direction: 'watch' }

      const result = await createExecutionPlanUseCase({ signal: watchSignal })

      expect(result.success).toBe(false)
      expect(result.error).toContain('非交易信号')
      expect(result.errorCode).toBe('NOT_TRADE_SIGNAL')
    })
  })

  describe('MCP 调用来源标识', () => {
    it('应当传递 source 参数给风控引擎', async () => {
      // 准备
      mockDataLayer.stocks.get.mockResolvedValue({ symbol: '000001.SZ', price: 15.5 })
      mockDataLayer.orders.list.mockResolvedValue([])
      mockDataLayer.executionPlans.save.mockResolvedValue({ success: true })
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行：指定 source 为 mcp
      await createExecutionPlanUseCase({ signal: mockSignal, source: 'mcp' })

      // 验证：checkOrderRisk 被调用时包含 source 参数
      expect(mockCheckOrderRisk).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'mcp',
        }),
      )
    })
  })
})
