import { describe, it, expect } from 'vitest'
import { computeBreadthScore } from './breadthFactor'

describe('computeBreadthScore (MAS 市场宽度)', () => {
  it('强多头市场（涨多跌少 + 涨停潮）→ 高分', () => {
    const score = computeBreadthScore({
      up: 4000,
      down: 1000,
      totalStocks: 5300,
      limitUp: 120,
      limitDown: 10,
    })
    expect(score).toBeGreaterThan(80)
  })

  it('强空头市场（跌多涨少 + 跌停潮）→ 低分', () => {
    const score = computeBreadthScore({
      up: 800,
      down: 4200,
      totalStocks: 5300,
      limitUp: 10,
      limitDown: 200,
    })
    expect(score).toBeLessThan(30)
  })

  it('涨跌各半、涨跌停均衡 → 接近 50（中性）', () => {
    const score = computeBreadthScore({
      up: 2500,
      down: 2500,
      totalStocks: 5300,
      limitUp: 50,
      limitDown: 50,
    })
    expect(score).toBeGreaterThan(45)
    expect(score).toBeLessThan(55)
  })
})
