import { describe, expect, it } from 'vitest'
import { calculatePosition } from '@/services/trading/positionSizer'

describe('positionSizer', () => {
  it('calculates buy position with Kelly sizing', () => {
    const result = calculatePosition({
      direction: 'buy',
      price: 100,
      portfolioValue: 1_000_000,
    })

    expect(result.action).toBe('buy')
    expect(result.targetShares).toBeGreaterThan(0)
    expect(result.targetShares % 100).toBe(0)
    expect(result.positionPct).toBeGreaterThan(0)
    expect(result.kellyPct).toBeGreaterThan(0)
  })

  it('caps position at max single position limit', () => {
    const result = calculatePosition({
      direction: 'buy',
      price: 100,
      portfolioValue: 1_000_000,
      currentHoldingValue: 200_000,
    })

    // 单笔上限 25% = 250k，已持有 200k，剩余 50k
    expect(result.action).toBe('buy')
    expect(result.targetValue).toBeLessThanOrEqual(50_000)
    expect(result.cappedBy).toBe('single')
  })

  it('caps position at max total position limit', () => {
    const result = calculatePosition({
      direction: 'buy',
      price: 100,
      portfolioValue: 1_000_000,
      currentTotalPositionValue: 750_000,
    })

    // 总仓位上限 80% = 800k，剩余 50k
    expect(result.action).toBe('buy')
    expect(result.targetValue).toBeLessThanOrEqual(50_000)
    expect(result.cappedBy).toBe('total')
  })

  it('returns hold when target position is below minimum', () => {
    const result = calculatePosition({
      direction: 'buy',
      price: 100_000,
      portfolioValue: 1_000_000,
    })

    expect(result.action).toBe('hold')
    expect(result.targetShares).toBe(0)
  })

  it('returns sell action with current holding shares', () => {
    const result = calculatePosition({
      direction: 'sell',
      price: 100,
      portfolioValue: 1_000_000,
      currentHoldingShares: 500,
      currentHoldingValue: 50_000,
    })

    expect(result.action).toBe('sell')
    expect(result.targetShares).toBe(500)
    expect(result.targetValue).toBe(50_000)
  })

  it('returns hold for non-buy/sell directions', () => {
    const result = calculatePosition({
      direction: 'hold',
      price: 100,
      portfolioValue: 1_000_000,
    })

    expect(result.action).toBe('hold')
    expect(result.targetShares).toBe(0)
  })
})
