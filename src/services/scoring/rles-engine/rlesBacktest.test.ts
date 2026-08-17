/**
 * RLES 回测引擎单元测试
 * 用合成 K 线验证：① 排序归一化 ② Spearman ③ 样本采集/前向收益 ④ 聚合统计
 * 并确证"二波命中组"前向收益优于"未命中组"（验证新因子的预测方向正确）。
 */
import { describe, it, expect } from 'vitest'
import type { KlineBar } from '@/services/collect'
import {
  sortBarsAsc,
  spearman,
  collectSamplesFromBars,
  runBacktest,
} from './rlesBacktest'

function genBars(n: number, seed: number, trendPerBar: number): KlineBar[] {
  let s = seed
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const bars: KlineBar[] = []
  let close = 10
  for (let i = 0; i < n; i++) {
    const pull = Math.sin(i / 12) * 0.01
    const ret = trendPerBar + pull + (rnd() - 0.5) * 0.008
    const open = close
    close = close * (1 + ret)
    const high = Math.max(open, close) * (1 + Math.abs(rnd()) * 0.01)
    const low = Math.min(open, close) * (1 - Math.abs(rnd()) * 0.01)
    const spike = i % 30 === 0 ? 5 : 1
    const volume = 1_000_000 * spike * (0.8 + rnd() * 0.4)
    const year = 2023 + Math.floor(i / 240)
    const mm = String(Math.floor((i % 240) / 20) + 1).padStart(2, '0')
    const dd = String((i % 20) + 1).padStart(2, '0')
    bars.push({ date: `${year}-${mm}-${dd}`, open, high, low, close, volume, amount: volume * close })
  }
  return bars
}

describe('sortBarsAsc', () => {
  it('归一化倒序输入为升序', () => {
    const rev = [
      { date: '2024-03-01', open: 1, high: 1, low: 1, close: 1, volume: 1, amount: 1 },
      { date: '2024-01-01', open: 1, high: 1, low: 1, close: 1, volume: 1, amount: 1 },
      { date: '2024-02-01', open: 1, high: 1, low: 1, close: 1, volume: 1, amount: 1 },
    ]
    const asc = sortBarsAsc(rev)
    expect(asc[0]!.date).toBe('2024-01-01')
    expect(asc[2]!.date).toBe('2024-03-01')
  })
})

describe('spearman', () => {
  it('完全单调正相关 ≈ 1', () => {
    expect(spearman([1, 2, 3, 4], [2, 4, 6, 8])).toBeGreaterThan(0.99)
  })
  it('完全负相关 ≈ -1', () => {
    expect(spearman([1, 2, 3, 4], [8, 6, 4, 2])).toBeLessThan(-0.99)
  })
  it('样本不足返回 0', () => {
    expect(spearman([1], [1])).toBe(0)
  })
})

describe('collectSamplesFromBars', () => {
  it('样本数随步长正确；前向收益可计算', () => {
    const bars = genBars(200, 7, 0.01)
    const samples = collectSamplesFromBars('TEST', bars, { forwardDays: 20, stride: 20 })
    expect(samples.length).toBeGreaterThan(0)
    for (const s of samples) {
      expect(Number.isFinite(s.forwardReturn)).toBe(true)
      expect(s.timingScore).toBeGreaterThanOrEqual(0)
      expect(s.timingScore).toBeLessThanOrEqual(100)
    }
  })
})

describe('runBacktest 聚合', () => {
  it('二波命中组前向收益优于未命中组（赢家股 vs 平淡股）', () => {
    const winner = genBars(220, 7, 0.01) // 强趋势 → 处主升浪 + 突破放量 + 二波命中
    const flat = genBars(220, 99, 0.0005) // 横盘 → 不处主升浪 → 不命中
    const result = runBacktest(
      [
        { symbol: 'WIN', bars: winner },
        { symbol: 'FLAT', bars: flat },
      ],
      { forwardDays: 20, stride: 20 },
    )

    expect(result.symbolCount).toBe(2)
    expect(result.sampleCount).toBeGreaterThan(0)
    expect(result.byDetected.detected.count).toBeGreaterThan(0)
    expect(result.byDetected.notDetected.count).toBeGreaterThan(0)
    expect(result.byStrengthQuartile.length).toBe(4)
    expect(result.byTimingTier.length).toBe(3)
    expect(result.overall.ic).toBeGreaterThanOrEqual(-1)
    expect(result.overall.ic).toBeLessThanOrEqual(1)

    // 命中组（赢家）前向均值收益应优于未命中组（平淡）
    expect(result.byDetected.detected.avgReturn).toBeGreaterThan(
      result.byDetected.notDetected.avgReturn,
    )
  })
})
