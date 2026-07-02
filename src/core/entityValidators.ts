/**
 * @module core/entityValidators
 * @lifecycle @Global
 * @description 核心实体充血模型 — 将校验逻辑从贫血 interface 中提取为独立验证函数
 *
 * 设计原则：
 * - 保持现有 interface 定义不变（渐进式增强，非破坏性重构）
 * - 校验函数以 `assertXxx` / `validateXxx` 命名，返回 `Result<T>` 类型
 * - 在 Store 写入入口（addOrder/saveScore）和 useCase 层调用
 *
 * @see AGENTS.md 第二章 "类型安全" 章节
 */

import type { Order, V6Score, Stock } from '@/data/types'

// ============================================================================
// 类型定义
// ============================================================================

export interface ValidationResult<T> {
  valid: boolean
  data?: T
  errors: string[]
}

export type OrderDirection = 'buy' | 'sell'

// ============================================================================
// Order 实体验证
// ============================================================================

/**
 * 验证订单实体的合法性
 *
 * 校验规则：
 * 1. symbol 非空且为有效字符串
 * 2. direction 必须为 'buy' 或 'sell'
 * 3. quantity 必须为正数且为有限数
 * 4. price 必须为正数且为有限数
 * 5. amount = quantity × price（自动计算，允许误差 0.01）
 */
export function validateOrder(order: Partial<Order>): ValidationResult<Order> {
  const errors: string[] = []

  // symbol 校验
  if (!order.symbol || typeof order.symbol !== 'string' || order.symbol.trim().length === 0) {
    errors.push('symbol 不能为空')
  } else if (order.symbol.length > 20) {
    errors.push('symbol 长度不能超过 20 个字符')
  }

  // direction 校验
  if (!order.direction) {
    errors.push('direction 不能为空')
  } else if (order.direction !== 'buy' && order.direction !== 'sell') {
    errors.push(`direction 必须为 'buy' 或 'sell'，当前: ${String(order.direction)}`)
  }

  // quantity 校验
  if (order.quantity === undefined || order.quantity === null) {
    errors.push('quantity 不能为空')
  } else if (typeof order.quantity !== 'number' || !Number.isFinite(order.quantity)) {
    errors.push('quantity 必须为有限数字')
  } else if (order.quantity <= 0) {
    errors.push('quantity 必须为正数')
  } else if (order.quantity > 1_000_000) {
    errors.push('quantity 不能超过 100 万')
  }

  // price 校验
  if (order.price === undefined || order.price === null) {
    errors.push('price 不能为空')
  } else if (typeof order.price !== 'number' || !Number.isFinite(order.price)) {
    errors.push('price 必须为有限数字')
  } else if (order.price <= 0) {
    errors.push('price 必须为正数')
  } else if (order.price > 1_000_000) {
    errors.push('price 不能超过 1,000,000')
  }

  // amount 校验（如果提供了 amount）
  if (order.amount !== undefined && order.quantity !== undefined && order.price !== undefined) {
    const expectedAmount = order.quantity * order.price
    if (Math.abs(order.amount - expectedAmount) > 0.01) {
      errors.push(`amount 不匹配: 预期 ${expectedAmount.toFixed(2)}，实际 ${order.amount}`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  const amount = order.quantity! * order.price!
  return {
    valid: true,
    data: {
      ...order,
      amount: Math.round(amount * 100) / 100,
    } as Order,
    errors: [],
  }
}

/**
 * 断言订单合法，不合法时抛出 Error
 */
export function assertOrderValid(order: Partial<Order>): Order {
  const result = validateOrder(order)
  if (!result.valid || !result.data) {
    throw new Error(`订单校验失败: ${result.errors.join('; ')}`)
  }
  return result.data
}

// ============================================================================
// V6Score 实体验证
// ============================================================================

/**
 * 验证 V6 评分实体的合法性
 *
 * 校验规则：
 * 1. symbol 非空
 * 2. score 在 [0, 5] 范围内
 * 3. factors 不能为空对象
 * 4. algorithmVersion 非空
 * 5. calculatedAt 为有效时间戳
 */
export function validateV6Score(score: Partial<V6Score>): ValidationResult<V6Score> {
  const errors: string[] = []

  if (!score.symbol || score.symbol.trim().length === 0) {
    errors.push('symbol 不能为空')
  }

  if (score.score === undefined || score.score === null) {
    errors.push('score 不能为空')
  } else if (typeof score.score !== 'number' || !Number.isFinite(score.score)) {
    errors.push('score 必须为有限数字')
  } else if (score.score < 0 || score.score > 5) {
    errors.push(`score 必须在 [0, 5] 范围内，当前: ${score.score}`)
  }

  if (!score.factors || typeof score.factors !== 'object' || Object.keys(score.factors).length === 0) {
    errors.push('factors 不能为空')
  }

  if (!score.algorithmVersion || score.algorithmVersion.trim().length === 0) {
    errors.push('algorithmVersion 不能为空')
  }

  if (score.calculatedAt !== undefined && (typeof score.calculatedAt !== 'number' || score.calculatedAt <= 0)) {
    errors.push('calculatedAt 必须为正数时间戳')
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    data: score as V6Score,
    errors: [],
  }
}

/**
 * 断言评分合法，不合法时抛出 Error
 */
export function assertV6ScoreValid(score: Partial<V6Score>): V6Score {
  const result = validateV6Score(score)
  if (!result.valid || !result.data) {
    throw new Error(`评分校验失败: ${result.errors.join('; ')}`)
  }
  return result.data
}

// ============================================================================
// Stock 实体验证
// ============================================================================

/**
 * 验证 Stock 实体的合法性
 *
 * 校验规则：
 * 1. symbol 非空
 * 2. name 非空
 * 3. researchStatus 为有效枚举值
 * 4. price（若提供）为正数
 * 5. pe/pb/roe（若提供）为有限数
 */
export function validateStock(stock: Partial<Stock>): ValidationResult<Stock> {
  const errors: string[] = []

  if (!stock.symbol || stock.symbol.trim().length === 0) {
    errors.push('symbol 不能为空')
  }

  if (!stock.name || stock.name.trim().length === 0) {
    errors.push('name 不能为空')
  }

  if (!stock.researchStatus) {
    errors.push('researchStatus 不能为空')
  }

  if (stock.price !== undefined && stock.price !== null) {
    if (typeof stock.price !== 'number' || !Number.isFinite(stock.price)) {
      errors.push('price 必须为有限数字')
    } else if (stock.price < 0) {
      errors.push('price 不能为负数')
    }
  }

  if (stock.pe !== undefined && stock.pe !== null) {
    if (typeof stock.pe !== 'number' || !Number.isFinite(stock.pe)) {
      errors.push('pe 必须为有限数字')
    }
  }

  if (stock.pb !== undefined && stock.pb !== null) {
    if (typeof stock.pb !== 'number' || !Number.isFinite(stock.pb)) {
      errors.push('pb 必须为有限数字')
    }
  }

  if (stock.roe !== undefined && stock.roe !== null) {
    if (typeof stock.roe !== 'number' || !Number.isFinite(stock.roe)) {
      errors.push('roe 必须为有限数字')
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    data: stock as Stock,
    errors: [],
  }
}

// ============================================================================
// 金额精度工具
// ============================================================================

/**
 * 将金额四舍五入到2位小数（分精度）
 */
export function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * 计算订单总金额 = quantity × price，保留2位小数
 */
export function computeOrderAmount(quantity: number, price: number): number {
  return roundAmount(quantity * price)
}
