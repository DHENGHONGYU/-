/**
 * @fileoverview Order 测试数据夹具
 * @description 提供订单相关的 builder 函数与典型场景常量
 *
 * 设计原则：
 * - builder 函数支持 Partial override，适应不同测试场景
 * - 默认值符合业务真实形态（filled 状态、paper 账户）
 * - 常量场景覆盖 pending/filled/cancelled 三种主流状态
 *
 * 使用示例：
 * ```typescript
 * import { buildOrder, MOCK_ORDER_FILLED } from '../fixtures'
 *
 * it('应创建订单', () => {
 *   const order = buildOrder({ symbol: '600519.SH', quantity: 100 })
 *   expect(order.amount).toBe(order.price * order.quantity)
 * })
 *
 * it('已成交订单应跳过撤单', () => {
 *   const result = cancelService.canCancel(MOCK_ORDER_FILLED)
 *   expect(result).toBe(false)
 * })
 * ```
 */

import type { Order } from '@/data/types'
import { ACCOUNT_TYPE, ORDER_DIRECTION, ORDER_STATUS } from '@/config/dbConfig'

/**
 * 构建 Order 实例（builder 模式 + override）
 *
 * @param overrides 部分字段覆盖（与默认值浅合并）
 * @returns 完整的 Order 对象
 *
 * 默认值：
 * - id: 'test-order-001'（确定性，便于断言）
 * - symbol: '600519.SH'
 * - direction: 'buy'
 * - quantity: 100
 * - price: 1800
 * - amount: 自动计算（quantity * price，除非显式 override）
 * - status: 'filled'
 * - accountType: 'paper'
 * - createdAt: 固定时间戳（确定性）
 */
export function buildOrder(overrides?: Partial<Order>): Order {
  const defaults: Order = {
    id: 'test-order-001',
    symbol: '600519.SH',
    direction: ORDER_DIRECTION.buy,
    quantity: 100,
    price: 1800,
    amount: 180000,
    status: ORDER_STATUS.filled,
    accountType: ACCOUNT_TYPE.paper,
    createdAt: 1700000000000,
  }

  // 如果 override 了 quantity 或 price 但未 override amount，自动重算
  if (overrides) {
    const merged = { ...defaults, ...overrides }
    if (overrides.quantity !== undefined || overrides.price !== undefined) {
      if (overrides.amount === undefined) {
        merged.amount = merged.quantity * merged.price
      }
    }
    return merged
  }

  return defaults
}

/** 已成交订单（买入 100 股贵州茅台 @ 1800，模拟账户） */
export const MOCK_ORDER_FILLED: Order = buildOrder({
  id: 'mock-filled-001',
  status: ORDER_STATUS.filled,
})

/** 待成交订单（卖出 50 股，pending 状态） */
export const MOCK_ORDER_PENDING: Order = buildOrder({
  id: 'mock-pending-001',
  direction: ORDER_DIRECTION.sell,
  quantity: 50,
  price: 1850,
  status: ORDER_STATUS.pending,
})

/** 已撤销订单（cancelled 状态） */
export const MOCK_ORDER_CANCELLED: Order = buildOrder({
  id: 'mock-cancelled-001',
  status: ORDER_STATUS.cancelled,
})

/** 真实账户订单（accountType: 'real'） */
export const MOCK_ORDER_REAL_ACCOUNT: Order = buildOrder({
  id: 'mock-real-001',
  accountType: ACCOUNT_TYPE.real,
})

/** 批量订单场景（5 个不同状态的订单） */
export const MOCK_ORDERS_BATCH: Order[] = [
  MOCK_ORDER_FILLED,
  MOCK_ORDER_PENDING,
  MOCK_ORDER_CANCELLED,
  MOCK_ORDER_REAL_ACCOUNT,
  buildOrder({ id: 'mock-batch-005', symbol: '000001.SZ', quantity: 200, price: 15.5 }),
]
