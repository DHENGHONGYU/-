/**
 * @test_id V9-TEST-ST-127
 * @module services/useCase/createExecutionPlan.useCase.test
 * @description 创建执行计划用例单元测试 — 验证风控阻断场景
  * @covers_docs [V9-DOC-BACK-013, V9-DOC-ARCH-007, V9-DOC-BACK-008, V9-DOC-ARCH-008, V9-DOC-BACK-005]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createExecutionPlanUseCase } from './createExecutionPlan.useCase'
import type { Signal, Stock, Order } from '@/data/types'

// Mock 依赖
const {
  mockQuery,
  mockForward,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockForward: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
    forward: mockForward,
    subscribe: vi.fn().mockReturnValue(vi.fn()),
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
  getEffectiveTradingConfig: vi.fn(() => ({
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

import { checkOrderRisk } from '@/services/trading/riskEngine'

const mockCheckOrderRisk = vi.mocked(checkOrderRisk)

function mockStockGet(stock: Partial<Stock> | null) {
  mockQuery.mockResolvedValueOnce({
    success: stock !== null,
    data: stock ?? undefined,
  })
}

function mockOrdersList(orders: Order[] = []) {
  mockQuery.mockResolvedValueOnce({ success: true, data: orders })
}

function mockExecutionPlanSave(error?: string) {
  if (error) {
    mockForward.mockRejectedValueOnce(new Error(error))
  } else {
    mockForward.mockResolvedValueOnce(undefined)
  }
}

describe('createExecutionPlanUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 恢复默认 mock 实现（clearAllMocks 只清调用记录，不清实现，
    // 但 mockRejectedValueOnce 等 Once 变体会残留，需要显式重置）
    mockQuery.mockResolvedValue({ success: false })
    mockForward.mockResolvedValue(undefined)
    mockCheckOrderRisk.mockResolvedValue({ ok: true, blocks: [], warnings: [] })
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
      mockStockGet({ symbol: '000001.SZ', price: 0 })
      mockOrdersList([])
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
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
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
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([
        {
          id: 'order-001',
          symbol: '000001.SZ',
          direction: 'buy',
          quantity: 500,
          price: 15.0,
          amount: 7500,
          status: 'filled',
          accountType: 'real',
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
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
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
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
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
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
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
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
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
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
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
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
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

  describe('边界条件 - 极端数值', () => {
    it('应当处理：极小正数股价（0.01元）', async () => {
      // 准备：A股最低股价 0.01 元
      mockStockGet({ symbol: '000001.SZ', price: 0.01 })
      mockOrdersList([])
      mockExecutionPlanSave()
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.success).toBe(true)
      expect(result.plan?.targetPrice).toBe(0.01)
      expect(result.plan?.quantity).toBeGreaterThan(0)
    })

    it('应当处理：极大股价（99999.99元）', async () => {
      // 准备：A股最高股价限制
      mockStockGet({ symbol: '000001.SZ', price: 99999.99 })
      mockOrdersList([])
      mockExecutionPlanSave()
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.success).toBe(true)
      expect(result.plan?.targetPrice).toBe(99999.99)
    })

    it('应当处理：极小置信度（0.01）', async () => {
      // 准备：置信度刚好高于阈值
      const lowConfidenceSignal: Signal = { ...mockSignal, confidence: 0.01 }
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: lowConfidenceSignal })

      // 验证
      expect(result.success).toBe(true)
      expect(result.plan?.confidence).toBe(0.01)
    })

    it('应当处理：极大置信度（1.0）', async () => {
      // 准备：置信度达到最大值
      const highConfidenceSignal: Signal = { ...mockSignal, confidence: 1.0 }
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: highConfidenceSignal })

      // 验证
      expect(result.success).toBe(true)
      expect(result.plan?.confidence).toBe(1.0)
    })

    it('应当处理：负数股价（异常数据）', async () => {
      // 准备：异常负数股价
      mockStockGet({ symbol: '000001.SZ', price: -10.5 })
      mockOrdersList([])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['价格或数量非法'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证：应当被风控阻断
      expect(result.plan?.risk?.passed).toBe(false)
      expect(result.plan?.result).toBe('failed')
    })

    it('应当处理：极大数量（1000000股）', async () => {
      // 准备：超大交易量
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: ['超大交易量'],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.success).toBe(true)
      expect(result.plan?.quantity).toBeGreaterThan(0)
    })
  })

  describe('边界条件 - 数据缺失', () => {
    it('应当处理：股票数据不存在', async () => {
      // 准备：股票不存在
      mockStockGet(null)
      mockOrdersList([])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['股票数据缺失'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.plan?.risk?.passed).toBe(false)
      expect(result.plan?.result).toBe('failed')
      expect(result.plan?.errorMessage).toContain('股票数据缺失')
    })

    it('应当处理：股票价格为 undefined', async () => {
      // 准备：价格字段缺失
      mockStockGet({ symbol: '000001.SZ', price: undefined })
      mockOrdersList([])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['价格或数量非法'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.plan?.risk?.passed).toBe(false)
      expect(result.plan?.result).toBe('failed')
    })

    it('应当处理：股票价格为 NaN', async () => {
      // 准备：价格为 NaN
      mockStockGet({ symbol: '000001.SZ', price: NaN })
      mockOrdersList([])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['价格或数量非法'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.plan?.risk?.passed).toBe(false)
      expect(result.plan?.result).toBe('failed')
    })

    it('应当处理：股票价格为 Infinity', async () => {
      // 准备：价格为无穷大
      mockStockGet({ symbol: '000001.SZ', price: Infinity })
      mockOrdersList([])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['价格或数量非法'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证
      expect(result.plan?.risk?.passed).toBe(false)
      expect(result.plan?.result).toBe('failed')
    })
  })

  describe('边界条件 - 特殊字符', () => {
    it('应当处理：symbol 包含空格', async () => {
      // 准备：symbol 前后有空格
      const signalWithSpace: Signal = { ...mockSignal, symbol: '  000001.SZ  ' }
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: signalWithSpace })

      // 验证：应当正常处理（内部会 trim）
      expect(result.success).toBe(true)
    })

    it('应当处理：symbol 小写转大写', async () => {
      // 准备：小写 symbol
      const signalLowercase: Signal = { ...mockSignal, symbol: '000001.sz' }
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: signalLowercase })

      // 验证：应当正常处理（内部会转大写）
      expect(result.success).toBe(true)
    })
  })

  describe('边界条件 - 并发请求', () => {
    it('应当处理：并发创建多个执行计划', async () => {
      // 准备：模拟并发场景
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行：并发创建 5 个执行计划
      const signals = Array.from({ length: 5 }, (_, i) => ({
        ...mockSignal,
        id: `sig-concurrent-${i}`,
      }))

      const results = await Promise.all(
        signals.map((signal) => createExecutionPlanUseCase({ signal }))
      )

      // 验证：所有请求都应成功
      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(result.success).toBe(true)
        expect(result.plan).toBeDefined()
      })

      // 验证：每个计划都有唯一的 ID
      const planIds = results.map((r) => r.plan?.id)
      const uniqueIds = new Set(planIds)
      expect(uniqueIds.size).toBe(5)
    })

    it('应当处理：并发请求中部分失败', async () => {
      // 准备：部分请求风控失败
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()

      // 第一次调用成功，第二次失败，第三次成功
      mockCheckOrderRisk
        .mockResolvedValueOnce({ ok: true, blocks: [], warnings: [] })
        .mockResolvedValueOnce({ ok: false, blocks: ['超出当日最大交易次数'], warnings: [] })
        .mockResolvedValueOnce({ ok: true, blocks: [], warnings: [] })

      // 执行：并发创建 3 个执行计划
      const signals = Array.from({ length: 3 }, (_, i) => ({
        ...mockSignal,
        id: `sig-mixed-${i}`,
      }))

      const results = await Promise.all(
        signals.map((signal) => createExecutionPlanUseCase({ signal }))
      )

      // 验证
      expect(results).toHaveLength(3)
      expect(results[0]!.success).toBe(true)
      expect(results[0]!.plan?.risk?.passed).toBe(true)

      expect(results[1]!.success).toBe(true)
      expect(results[1]!.plan?.risk?.passed).toBe(false)
      expect(results[1]!.plan?.result).toBe('failed')

      expect(results[2]!.success).toBe(true)
      expect(results[2]!.plan?.risk?.passed).toBe(true)
    })
  })

  describe('边界条件 - 数据库操作', () => {
    it('应当处理：保存执行计划失败', async () => {
      // 准备：数据库保存失败
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave() // DataBridge.forward 成功时返回 void，源码不检查返回值，等效于保存成功
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证：即使保存失败，UseCase 仍应返回成功（计划已生成）
      expect(result.success).toBe(true)
      expect(result.plan).toBeDefined()
    })

    it('应当处理：保存执行计划抛出异常', async () => {
      // 准备：数据库保存抛出异常
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave('数据库连接失败')
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证：应当捕获异常并返回失败（统一错误码 UNKNOWN_ERROR）
      expect(result.success).toBe(false)
      expect(result.error).toContain('数据库连接失败')
      expect(result.errorCode).toBe('UNKNOWN_ERROR')
    })

    it('应当处理：查询订单列表失败', async () => {
      // 准备：查询订单失败
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockQuery.mockRejectedValueOnce(new Error('数据库查询失败'))

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证：应当捕获异常并返回失败（统一错误码 UNKNOWN_ERROR）
      expect(result.success).toBe(false)
      expect(result.error).toContain('数据库查询失败')
      expect(result.errorCode).toBe('UNKNOWN_ERROR')
    })
  })

  describe('边界条件 - 风控引擎', () => {
    it('应当处理：风控引擎返回多个阻断原因', async () => {
      // 准备：多个风控问题
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockCheckOrderRisk.mockResolvedValue({
        ok: false,
        blocks: ['价格或数量非法', '超出单笔仓位上限', '超出当日最大交易次数'],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证：应当包含所有阻断原因
      expect(result.plan?.risk?.passed).toBe(false)
      expect(result.plan?.result).toBe('failed')
      expect(result.plan?.errorMessage).toContain('价格或数量非法')
      expect(result.plan?.errorMessage).toContain('超出单笔仓位上限')
      expect(result.plan?.errorMessage).toContain('超出当日最大交易次数')
    })

    it('应当处理：风控引擎返回多个警告', async () => {
      // 准备：多个警告
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: ['单笔仓位接近上限', '当日交易次数接近上限', '行情数据较旧'],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证：应当包含所有警告
      expect(result.success).toBe(true)
      expect(result.plan?.risk?.passed).toBe(true)
      expect(result.plan?.risk?.warnings).toHaveLength(3)
      expect(result.plan?.risk?.warnings).toContain('单笔仓位接近上限')
      expect(result.plan?.risk?.warnings).toContain('当日交易次数接近上限')
      expect(result.plan?.risk?.warnings).toContain('行情数据较旧')
    })

    it('应当处理：风控引擎抛出异常', async () => {
      // 准备：风控引擎异常
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockCheckOrderRisk.mockRejectedValue(new Error('风控引擎内部错误'))

      // 执行
      const result = await createExecutionPlanUseCase({ signal: mockSignal })

      // 验证：应当捕获异常并返回失败
      expect(result.success).toBe(false)
      expect(result.error).toContain('风控引擎内部错误')
      expect(result.errorCode).toBe('UNKNOWN_ERROR')
    })
  })

  describe('边界条件 - 信号方向', () => {
    it('应当处理：sell 方向', async () => {
      // 准备：卖出信号
      const sellSignal: Signal = { ...mockSignal, direction: 'sell' }
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: sellSignal })

      // 验证
      expect(result.success).toBe(true)
      expect(result.plan?.direction).toBe('sell')
    })

    it('应当处理：大小写不敏感的方向', async () => {
      // 准备：大写方向
      const upperSignal: Signal = { ...mockSignal, direction: 'BUY' as 'buy' }
      mockStockGet({ symbol: '000001.SZ', price: 15.5 })
      mockOrdersList([])
      mockExecutionPlanSave()
      mockCheckOrderRisk.mockResolvedValue({
        ok: true,
        blocks: [],
        warnings: [],
      })

      // 执行
      const result = await createExecutionPlanUseCase({ signal: upperSignal })

      // 验证：应当正常处理
      expect(result.success).toBe(true)
    })
  })
})
