/**
 * @file tests/__tests__/services/trading-use-cases.test.ts
 * @description 交易用例层测试 —— placeBuyOrder / placeSellOrder 用例契约验证
 *
 * 测试重点：
 *   - 用例层对外 API 契约稳定性
 *   - 买入/卖出方向参数正确传递
 *   - 输入校验行为一致
 *   - 异常场景正确传递
 *
 * @created 2026-07-20
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { placeBuyOrder, placeSellOrder } from '@/services/trading/use-cases/placeOrder'

// Mock tradingService 中的 createOrderWithRiskCheck
vi.mock('@/services/trading/tradingService', () => ({
  createOrderWithRiskCheck: vi.fn(),
}))

import { createOrderWithRiskCheck } from '@/services/trading/tradingService'

describe('Trading Use Cases - placeOrder', () => {
  const mockOrder = {
    id: 'order-123',
    symbol: '600519.SH',
    direction: 'buy',
    quantity: 100,
    price: 1000,
    status: 'pending',
    createdAt: Date.now(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================
  // placeBuyOrder
  // ==========================================================

  describe('placeBuyOrder', () => {
    it('成功创建买入订单', async () => {
      vi.mocked(createOrderWithRiskCheck).mockResolvedValue({
        success: true,
        data: { ...mockOrder, direction: 'buy' },
      })

      const result = await placeBuyOrder({
        symbol: '600519.SH',
        price: 1000,
        quantity: 100,
        direction: 'buy',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      // 验证调用时 direction 被强制设为 buy
      expect(createOrderWithRiskCheck).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'buy' })
      )
    })

    it('无论输入 direction 是什么，都强制为 buy', async () => {
      vi.mocked(createOrderWithRiskCheck).mockResolvedValue({
        success: true,
        data: mockOrder,
      })

      // 用户传了 sell，但 placeBuyOrder 应该覆盖为 buy
      await placeBuyOrder({
        symbol: '600519.SH',
        price: 1000,
        quantity: 100,
        direction: 'sell', // 故意传错
      })

      const callArg = vi.mocked(createOrderWithRiskCheck).mock.calls[0][0]
      expect(callArg.direction).toBe('buy')
    })

    it('价格为 0 时返回错误', async () => {
      vi.mocked(createOrderWithRiskCheck).mockResolvedValue({
        success: false,
        error: '价格或数量非法',
      })

      const result = await placeBuyOrder({
        symbol: '600519.SH',
        price: 0,
        quantity: 100,
        direction: 'buy',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('价格或数量非法')
    })

    it('数量为 0 时返回错误', async () => {
      vi.mocked(createOrderWithRiskCheck).mockResolvedValue({
        success: false,
        error: '价格或数量非法',
      })

      const result = await placeBuyOrder({
        symbol: '600519.SH',
        price: 1000,
        quantity: 0,
        direction: 'buy',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('symbol 参数正确传递', async () => {
      vi.mocked(createOrderWithRiskCheck).mockResolvedValue({
        success: true,
        data: mockOrder,
      })

      await placeBuyOrder({
        symbol: '000001.SZ',
        price: 15,
        quantity: 1000,
        direction: 'buy',
      })

      const callArg = vi.mocked(createOrderWithRiskCheck).mock.calls[0][0]
      expect(callArg.symbol).toBe('000001.SZ')
    })
  })

  // ==========================================================
  // placeSellOrder
  // ==========================================================

  describe('placeSellOrder', () => {
    it('成功创建卖出订单', async () => {
      vi.mocked(createOrderWithRiskCheck).mockResolvedValue({
        success: true,
        data: { ...mockOrder, direction: 'sell' },
      })

      const result = await placeSellOrder({
        symbol: '600519.SH',
        price: 1000,
        quantity: 100,
        direction: 'sell',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      // 验证调用时 direction 被强制设为 sell
      expect(createOrderWithRiskCheck).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'sell' })
      )
    })

    it('无论输入 direction 是什么，都强制为 sell', async () => {
      vi.mocked(createOrderWithRiskCheck).mockResolvedValue({
        success: true,
        data: mockOrder,
      })

      // 用户传了 buy，但 placeSellOrder 应该覆盖为 sell
      await placeSellOrder({
        symbol: '600519.SH',
        price: 1000,
        quantity: 100,
        direction: 'buy', // 故意传错
      })

      const callArg = vi.mocked(createOrderWithRiskCheck).mock.calls[0][0]
      expect(callArg.direction).toBe('sell')
    })

    it('价格非法时返回错误', async () => {
      vi.mocked(createOrderWithRiskCheck).mockResolvedValue({
        success: false,
        error: '价格或数量非法',
      })

      const result = await placeSellOrder({
        symbol: '600519.SH',
        price: -1,
        quantity: 100,
        direction: 'sell',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('数量非法时返回错误', async () => {
      vi.mocked(createOrderWithRiskCheck).mockResolvedValue({
        success: false,
        error: '价格或数量非法',
      })

      const result = await placeSellOrder({
        symbol: '600519.SH',
        price: 1000,
        quantity: -10,
        direction: 'sell',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  // ==========================================================
  // 用例层契约验证
  // ==========================================================

  describe('用例层契约', () => {
    it('返回值结构符合 DataLayerResult 约定', async () => {
      vi.mocked(createOrderWithRiskCheck).mockResolvedValue({
        success: true,
        data: mockOrder,
      })

      const result = await placeBuyOrder({
        symbol: '600519.SH',
        price: 1000,
        quantity: 100,
        direction: 'buy',
      })

      // 验证返回值有 success 字段
      expect(result).toHaveProperty('success')
      expect(typeof result.success).toBe('boolean')

      // 成功时有 data 字段
      if (result.success) {
        expect(result).toHaveProperty('data')
      }
    })

    it('失败时返回 error 字段', async () => {
      vi.mocked(createOrderWithRiskCheck).mockResolvedValue({
        success: false,
        error: '测试错误',
      })

      const result = await placeSellOrder({
        symbol: '600519.SH',
        price: 1000,
        quantity: 100,
        direction: 'sell',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('测试错误')
    })

    it('placeBuyOrder 和 placeSellOrder 是独立函数', () => {
      expect(typeof placeBuyOrder).toBe('function')
      expect(typeof placeSellOrder).toBe('function')
      expect(placeBuyOrder).not.toBe(placeSellOrder)
    })
  })
})
