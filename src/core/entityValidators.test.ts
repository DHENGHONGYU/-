import { describe, it, expect } from 'vitest'
import {
  validateOrder,
  assertOrderValid,
  validateStock,
  validateV6Score,
  assertV6ScoreValid,
  roundAmount,
  computeOrderAmount,
} from './entityValidators'

describe('entityValidators', () => {
  describe('validateOrder()', () => {
    it('完整有效订单返回 valid=true 并自动计算 amount', () => {
      const result = validateOrder({
        symbol: '600519.SH',
        direction: 'buy',
        quantity: 100,
        price: 1500.5,
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.data).toBeDefined()
      expect(result.data?.amount).toBe(150050)
    })

    it('空对象返回所有字段错误', () => {
      const result = validateOrder({})
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(4)
      expect(result.errors.some(e => e.includes('symbol'))).toBe(true)
      expect(result.errors.some(e => e.includes('direction'))).toBe(true)
      expect(result.errors.some(e => e.includes('quantity'))).toBe(true)
      expect(result.errors.some(e => e.includes('price'))).toBe(true)
    })

    it('direction 仅支持 buy/sell', () => {
      const r1 = validateOrder({ symbol: '600519.SH', direction: 'buy', quantity: 10, price: 10 })
      expect(r1.valid).toBe(true)
      const r2 = validateOrder({ symbol: '600519.SH', direction: 'sell', quantity: 10, price: 10 })
      expect(r2.valid).toBe(true)
      const r3 = validateOrder({ symbol: '600519.SH', direction: 'hold' as any, quantity: 10, price: 10 })
      expect(r3.valid).toBe(false)
      expect(r3.errors.some(e => e.includes('direction'))).toBe(true)
    })

    it('quantity 必须为正数', () => {
      const r1 = validateOrder({ symbol: '600519.SH', direction: 'buy', quantity: 0, price: 10 })
      expect(r1.valid).toBe(false)
      expect(r1.errors.some(e => e.includes('quantity'))).toBe(true)

      const r2 = validateOrder({ symbol: '600519.SH', direction: 'buy', quantity: -5, price: 10 })
      expect(r2.valid).toBe(false)
    })

    it('quantity 超过 100 万报错', () => {
      const result = validateOrder({ symbol: '600519.SH', direction: 'buy', quantity: 2_000_000, price: 10 })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('quantity'))).toBe(true)
    })

    it('price 必须为正数', () => {
      const r1 = validateOrder({ symbol: '600519.SH', direction: 'buy', quantity: 10, price: 0 })
      expect(r1.valid).toBe(false)
      const r2 = validateOrder({ symbol: '600519.SH', direction: 'buy', quantity: 10, price: -1 })
      expect(r2.valid).toBe(false)
    })

    it('price 超过 1,000,000 报错', () => {
      const result = validateOrder({ symbol: '600519.SH', direction: 'buy', quantity: 1, price: 2_000_000 })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('price'))).toBe(true)
    })

    it('quantity 为 Infinity 报错', () => {
      const result = validateOrder({ symbol: '600519.SH', direction: 'buy', quantity: Infinity, price: 10 })
      expect(result.valid).toBe(false)
    })

    it('quantity 为 NaN 报错', () => {
      const result = validateOrder({ symbol: '600519.SH', direction: 'buy', quantity: NaN, price: 10 })
      expect(result.valid).toBe(false)
    })

    it('symbol 格式非法时报错', () => {
      const result = validateOrder({ symbol: '600519', direction: 'buy', quantity: 10, price: 10 })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('symbol'))).toBe(true)
    })

    it('amount 与预期差距过大时报错', () => {
      const result = validateOrder({
        symbol: '600519.SH',
        direction: 'buy',
        quantity: 100,
        price: 100,
        amount: 99999, // 预期 10000，差距大
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('amount'))).toBe(true)
    })

    it('amount 在容差范围内通过', () => {
      const result = validateOrder({
        symbol: '600519.SH',
        direction: 'buy',
        quantity: 100,
        price: 100.005,
        amount: 10000.5,
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('assertOrderValid()', () => {
    it('有效订单返回数据', () => {
      const order = assertOrderValid({
        symbol: '600519.SH',
        direction: 'buy',
        quantity: 100,
        price: 100,
      })
      expect(order.symbol).toBe('600519.SH')
      expect(order.amount).toBe(10000)
    })

    it('无效订单抛出 Error', () => {
      expect(() => assertOrderValid({})).toThrow('订单校验失败')
    })
  })

  describe('validateV6Score()', () => {
    it('有效评分返回 valid=true', () => {
      const result = validateV6Score({
        symbol: '600519.SH',
        score: 4.2,
        factors: { moat: 80, financial: 75 },
        algorithmVersion: 'v4.3',
        calculatedAt: Date.now(),
      })
      expect(result.valid).toBe(true)
      expect(result.data?.symbol).toBe('600519.SH')
    })

    it('无 symbol 返回错误', () => {
      const result = validateV6Score({ score: 3 })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('symbol'))).toBe(true)
    })

    it('score 不能为空', () => {
      const result = validateV6Score({ symbol: '600519.SH' })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('score'))).toBe(true)
    })

    it('score 范围 [0, 5]', () => {
      const r1 = validateV6Score({ symbol: '600519.SH', score: -1, factors: { a: 1 }, algorithmVersion: 'v1' })
      expect(r1.valid).toBe(false)

      const r2 = validateV6Score({ symbol: '600519.SH', score: 6, factors: { a: 1 }, algorithmVersion: 'v1' })
      expect(r2.valid).toBe(false)

      const r3 = validateV6Score({ symbol: '600519.SH', score: 0, factors: { a: 1 }, algorithmVersion: 'v1' })
      expect(r3.valid).toBe(true)

      const r4 = validateV6Score({ symbol: '600519.SH', score: 5, factors: { a: 1 }, algorithmVersion: 'v1' })
      expect(r4.valid).toBe(true)
    })

    it('factors 不能为空对象', () => {
      const result = validateV6Score({ symbol: '600519.SH', score: 3, factors: {}, algorithmVersion: 'v1' })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('factors'))).toBe(true)
    })

    it('algorithmVersion 不能为空', () => {
      const result = validateV6Score({ symbol: '600519.SH', score: 3, factors: { a: 1 } })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('algorithmVersion'))).toBe(true)
    })

    it('calculatedAt 为无效时间戳时报错', () => {
      const result = validateV6Score({
        symbol: '600519.SH',
        score: 3,
        factors: { a: 1 },
        algorithmVersion: 'v1',
        calculatedAt: 0,
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('calculatedAt'))).toBe(true)
    })
  })

  describe('assertV6ScoreValid()', () => {
    it('有效评分返回数据', () => {
      const score = assertV6ScoreValid({
        symbol: '600519.SH',
        score: 4.5,
        factors: { quality: 90 },
        algorithmVersion: 'v4.3',
      })
      expect(score.symbol).toBe('600519.SH')
    })

    it('无效评分抛出 Error', () => {
      expect(() => assertV6ScoreValid({})).toThrow('评分校验失败')
    })
  })

  describe('validateStock()', () => {
    it('有效股票返回 valid=true', () => {
      const result = validateStock({
        symbol: '600519.SH',
        name: '贵州茅台',
        researchStatus: 'candidate',
        price: 1500,
        pe: 25.5,
        pb: 8.2,
        roe: 0.3,
      })
      expect(result.valid).toBe(true)
    })

    it('无 symbol 返回错误', () => {
      const result = validateStock({ name: 'test', researchStatus: 'candidate' })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('symbol'))).toBe(true)
    })

    it('无 name 返回错误', () => {
      const result = validateStock({ symbol: '600519.SH', researchStatus: 'candidate' })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('name'))).toBe(true)
    })

    it('无 researchStatus 返回错误', () => {
      const result = validateStock({ symbol: '600519.SH', name: 'Test' })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('researchStatus'))).toBe(true)
    })

    it('price 为负数报错', () => {
      const result = validateStock({
        symbol: '600519.SH',
        name: 'Test',
        researchStatus: 'candidate',
        price: -10,
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('price'))).toBe(true)
    })

    it('price 为 Infinity 报错', () => {
      const result = validateStock({
        symbol: '600519.SH',
        name: 'Test',
        researchStatus: 'candidate',
        price: Infinity,
      })
      expect(result.valid).toBe(false)
    })

    it('pe/pb/roe 为有限数通过校验', () => {
      const result = validateStock({
        symbol: '600519.SH',
        name: 'Test',
        researchStatus: 'candidate',
        pe: NaN,
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('pe'))).toBe(true)
    })

    it('不提供 price/pe/pb/roe 不校验', () => {
      const result = validateStock({
        symbol: '600519.SH',
        name: 'Test',
        researchStatus: 'candidate',
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('roundAmount()', () => {
    it('四舍五入到 2 位小数', () => {
      expect(roundAmount(10.123)).toBe(10.12)
      expect(roundAmount(10.126)).toBe(10.13)
      expect(roundAmount(0)).toBe(0)
    })

    it('整数返回整数', () => {
      expect(roundAmount(100)).toBe(100)
    })
  })

  describe('computeOrderAmount()', () => {
    it('quantity * price 保留 2 位小数', () => {
      expect(computeOrderAmount(100, 10.5)).toBe(1050)
      expect(computeOrderAmount(100, 10.123)).toBe(1012.3)
      expect(computeOrderAmount(3, 9.99)).toBe(29.97)
    })

    it('0 数量返回 0', () => {
      expect(computeOrderAmount(0, 100)).toBe(0)
    })
  })
})
