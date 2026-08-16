import { describe, it, expect } from 'vitest'
import { evaluateChipForStock } from './chipBridge'
import type { KlineBar } from '@/services/collect'

function makeBars(n: number): KlineBar[] {
  const bars: KlineBar[] = []
  let close = 10
  for (let i = 0; i < n; i++) {
    close = close * (1 + (i % 5 === 0 ? -0.01 : 0.01))
    bars.push({
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      open: close * 0.99,
      high: close * 1.02,
      low: close * 0.98,
      close,
      volume: 1_000_000,
      amount: 1_000_000 * close,
    })
  }
  return bars
}

describe('evaluateChipForStock（八级筹码桥接）', () => {
  it('充足 K 线返回有效 ChipResult（score 在 0-100）', () => {
    const chip = evaluateChipForStock('600519', makeBars(30))
    expect(chip).not.toBeNull()
    expect(typeof chip!.score).toBe('number')
    expect(chip!.score).toBeGreaterThanOrEqual(0)
    expect(chip!.score).toBeLessThanOrEqual(100)
    expect(['low', 'medium', 'high']).toContain(chip!.riskLevel)
  })

  it('空 K 线返回 null（不崩溃）', () => {
    expect(evaluateChipForStock('600519', [])).toBeNull()
  })
})
