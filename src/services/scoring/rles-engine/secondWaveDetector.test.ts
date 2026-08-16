/**
 * SecondWaveDetector 单元测试（纯函数，无网络依赖）
 * 覆盖：理想二波命中 / 非主升浪剔除 / K线不足降级
 */

import { describe, test, expect } from 'vitest'
import { detectSecondWave } from './secondWaveDetector'
import type { KlineBar } from '@/services/collect'

/** 用收盘价序列 + 成交量序列构造日线（带极小影线，可后续覆盖） */
function makeBars(closes: number[], vols: number[], wick = 0.008): KlineBar[] {
  return closes.map((c, i) => {
    const o = i === 0 ? c * (1 - wick) : closes[i - 1]!
    const hi = Math.max(o, c) * (1 + wick)
    const lo = Math.min(o, c) * (1 - wick)
    const date = `2024-${String(Math.floor(i / 20) + 1).padStart(2, '0')}-${String((i % 20) + 1).padStart(2, '0')}`
    const v = vols[i]!
    return { date, open: o, high: hi, low: lo, close: c, volume: v, amount: v * c }
  })
}

describe('detectSecondWave', () => {
  test('理想二波：主升浪 + 放量突破 + 长上影试盘 → 命中 strong_wave', () => {
    const n = 120
    const closes: number[] = []
    const vols: number[] = []
    for (let i = 0; i < n; i++) {
      closes.push(10 + i * 0.18) // 稳定斜率，60日涨幅>50%
      vols.push(1_000_000)
    }
    vols[61] = 5_000_000 // 突破放量 5 倍
    const bars = makeBars(closes, vols)
    // 注入长上影试盘（index 117）
    const bar117 = bars[117]!
    const c = bar117.close
    bar117.high = c * 1.12
    bar117.volume = 2_000_000

    const sig = detectSecondWave(bars)
    expect(sig.detected).toBe(true)
    expect(sig.signalType).toBe('strong_wave')
    expect(sig.maxVolumeRatio).toBeGreaterThanOrEqual(3)
    expect(sig.hasTrialShadow).toBe(true)
    expect(sig.uptrendPct60).toBeGreaterThanOrEqual(0.5)
  })

  test('非主升浪：横盘无量 → 不命中，信号类型 none', () => {
    const n = 120
    const closes: number[] = []
    const vols: number[] = []
    for (let i = 0; i < n; i++) {
      closes.push(10 + Math.sin(i / 5)) // 横盘震荡
      vols.push(1_000_000)
    }
    const sig = detectSecondWave(makeBars(closes, vols))
    expect(sig.detected).toBe(false)
    expect(sig.signalType).toBe('none')
    expect(sig.strength).toBeLessThan(40)
  })

  test('K线不足 25 根 → 安全降级，不抛异常', () => {
    const closes = [10, 10.2, 10.1, 9.9, 10.3]
    const vols = closes.map(() => 1_000_000)
    const sig = detectSecondWave(makeBars(closes, vols))
    expect(sig.detected).toBe(false)
    expect(sig.strength).toBe(0)
    expect(sig.details.length).toBeGreaterThan(0)
  })

  test('乱序日期输入 → 内部排序后仍正确判定', () => {
    const closes: number[] = []
    const vols: number[] = []
    for (let i = 0; i < 120; i++) {
      closes.push(10 + i * 0.18)
      vols.push(1_000_000)
    }
    vols[61] = 5_000_000
    const bars = makeBars(closes, vols)
    const bar117 = bars[117]!
    bar117.high = bar117.close * 1.12
    bar117.volume = 2_000_000
    const shuffled = [...bars].reverse() // 倒序
    const sig = detectSecondWave(shuffled)
    expect(sig.detected).toBe(true)
  })
})
