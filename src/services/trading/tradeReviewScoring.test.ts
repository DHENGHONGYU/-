import { describe, it, expect, beforeEach } from 'vitest'
import type { Order } from '@/data/types'
import {
  RealTradeReviewScoreCalculator,
  MockTradeReviewScoreCalculator,
  getTradeReviewScoreCalculator,
  setTradeReviewScoreCalculator,
  resetTradeReviewScoreCalculator,
  setOrderDataSource,
} from './tradeReviewScoring'

describe('tradeReviewScoring — 复盘评分真实化落地', () => {
  beforeEach(() => {
    // 每个用例复位到默认（真实）计算器 + 可控订单数据源
    resetTradeReviewScoreCalculator()
    setOrderDataSource(() => [])
  })

  it('RealTradeReviewScoreCalculator 无订单数据时返回 0（无纪律信号）', () => {
    setOrderDataSource(() => [])
    const calc = new RealTradeReviewScoreCalculator()
    expect(calc.calculateDisciplineScore()).toBe(0)
  })

  it('RealTradeReviewScoreCalculator 基于真实订单确定性计算纪律分', () => {
    // 单一标的 A：买入 100、卖出 120（盈利），两笔均 filled
    const orders: Order[] = [
      { id: 'o1', symbol: 'A', direction: 'buy', quantity: 10, price: 10, amount: 100, status: 'filled', accountType: 'paper', createdAt: 1 },
      { id: 'o2', symbol: 'A', direction: 'sell', quantity: 12, price: 10, amount: 120, status: 'filled', accountType: 'paper', createdAt: 2 },
    ]
    setOrderDataSource(() => orders)
    const calc = new RealTradeReviewScoreCalculator()
    // 胜率 1.0*50 + 完成度 1.0*25 + 仓位纪律(1-10/110)*25 ≈ 98
    expect(calc.calculateDisciplineScore()).toBe(98)
  })

  it('RealTradeReviewScoreCalculator 结果恒在 [0,100]', () => {
    const orders: Order[] = [
      { id: 'o1', symbol: 'A', direction: 'buy', quantity: 10, price: 10, amount: 100, status: 'filled', accountType: 'paper', createdAt: 1 },
      { id: 'o2', symbol: 'A', direction: 'sell', quantity: 5, price: 10, amount: 50, status: 'filled', accountType: 'paper', createdAt: 2 },
      { id: 'o3', symbol: 'B', direction: 'buy', quantity: 8, price: 10, amount: 80, status: 'pending', accountType: 'paper', createdAt: 3 },
    ]
    setOrderDataSource(() => orders)
    const score = new RealTradeReviewScoreCalculator().calculateDisciplineScore()
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('getTradeReviewScoreCalculator 默认返回真实计算器（Real），不再返回 Mock 占位', () => {
    resetTradeReviewScoreCalculator()
    expect(getTradeReviewScoreCalculator()).toBeInstanceOf(RealTradeReviewScoreCalculator)
  })

  it('Mock 仍可作为显式注入用于测试/特殊场景', () => {
    setTradeReviewScoreCalculator(new MockTradeReviewScoreCalculator())
    const calc = getTradeReviewScoreCalculator()
    expect(calc).toBeInstanceOf(MockTradeReviewScoreCalculator)
    const score = calc.calculateDisciplineScore()
    expect(score).toBeGreaterThanOrEqual(50)
    expect(score).toBeLessThanOrEqual(100)
  })
})
