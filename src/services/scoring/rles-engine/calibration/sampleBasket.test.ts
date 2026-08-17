import { describe, it, expect } from 'vitest'
import { buildSampleBasket } from './sampleBasket'

describe('buildSampleBasket', () => {
  it('生成 15 只多形态样本（6赢家/4横盘/3下跌/2ST）', () => {
    const b = buildSampleBasket()
    expect(b.length).toBe(15)
    expect(b.filter((e) => e.symbol.startsWith('WIN')).length).toBe(6)
    expect(b.filter((e) => e.symbol.startsWith('FLAT')).length).toBe(4)
    expect(b.filter((e) => e.symbol.startsWith('DOWN')).length).toBe(3)
    expect(b.filter((e) => e.symbol.startsWith('ST')).length).toBe(2)
  })

  it('每只样本为 260 根合法 K 线', () => {
    const b = buildSampleBasket()
    for (const e of b) {
      expect(e.bars.length).toBe(260)
      const first = e.bars[0]!
      expect(first.close).toBeGreaterThan(0)
      expect(first.volume).toBeGreaterThan(0)
      expect(first.high).toBeGreaterThanOrEqual(first.low)
    }
  })

  it('确定性可复现', () => {
    const a = buildSampleBasket()
    const c = buildSampleBasket()
    expect(a[0]!.bars[100]!.close).toBe(c[0]!.bars[100]!.close)
  })

  it('包含 ST 名称样本（名称弱判断可命中）', () => {
    const b = buildSampleBasket()
    expect(b.some((e) => e.name?.includes('ST'))).toBe(true)
  })
})
