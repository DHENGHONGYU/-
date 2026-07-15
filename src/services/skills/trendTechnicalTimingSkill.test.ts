/**
 * @module services/skills/trendTechnicalTimingSkill.test
 * @description S-12 趋势股技术分析择时 SKILL 单元测试
 */

import { describe, it, expect } from 'vitest'
import { SkillRegistry } from './skillRegistry'
import { trendTechnicalTimingSkill, type TrendTechnicalTimingOutput } from './trendTechnicalTimingSkill'

function generateSeries(length: number, start: number, step: number): number[] {
  return Array.from({ length }, (_, i) => start + i * step)
}

function generateVolumeWithSpike(length: number, spikeRatio = 10): number[] {
  const low = 1000
  const high = low * spikeRatio
  return Array.from({ length }, (_, i) => (i < length - 5 ? low : high))
}

describe('trendTechnicalTimingSkill', () => {
  const registry = new SkillRegistry()
  registry.register(trendTechnicalTimingSkill)

  it('强上涨趋势应生成偏多/强烈买入信号', async () => {
    const closeHistory = generateSeries(60, 10, 0.5)
    const volumeHistory = generateVolumeWithSpike(60)

    const result = await registry.execute<TrendTechnicalTimingOutput>('trend-technical-timing', {
      symbol: 'TREND-UP',
      params: { closeHistory, volumeHistory },
    })

    expect(result.status).toBe('success')
    expect(result.data).toBeDefined()
    expect(result.data!.trendDirection).toBe('up')
    expect(['buy', 'strong_buy']).toContain(result.data!.signal)
    expect(result.data!.confidence).toBeGreaterThanOrEqual(0.6)
    expect(result.data!.volumeConfirmation).toBe(true)
    expect(result.data!.movingAverages.ma5).toBeGreaterThan(result.data!.movingAverages.ma20)
    expect(result.data!.momentum.m5).toBeGreaterThan(0)
    expect(result.data!.momentum.m20).toBeGreaterThan(0)
  })

  it('强下跌趋势应生成偏空/强烈卖出信号', async () => {
    const closeHistory = generateSeries(60, 50, -0.6)
    const volumeHistory = generateVolumeWithSpike(60, 5)

    const result = await registry.execute<TrendTechnicalTimingOutput>('trend-technical-timing', {
      symbol: 'TREND-DOWN',
      params: { closeHistory, volumeHistory },
    })

    expect(result.status).toBe('success')
    expect(result.data).toBeDefined()
    expect(result.data!.trendDirection).toBe('down')
    expect(['sell', 'strong_sell']).toContain(result.data!.signal)
    expect(result.data!.confidence).toBeGreaterThanOrEqual(0.6)
    expect(result.data!.movingAverages.ma5).toBeLessThan(result.data!.movingAverages.ma20)
    expect(result.data!.momentum.m5).toBeLessThan(0)
    expect(result.data!.momentum.m20).toBeLessThan(0)
  })

  it('横盘震荡应生成观望信号', async () => {
    const closeHistory = Array.from({ length: 60 }, (_, i) => 20 + Math.sin(i * 0.5) * 2)

    const result = await registry.execute<TrendTechnicalTimingOutput>('trend-technical-timing', {
      symbol: 'SIDEWAYS',
      params: { closeHistory },
    })

    expect(result.status).toBe('success')
    expect(result.data).toBeDefined()
    expect(result.data!.signal).toBe('hold')
    expect(result.data!.volumeConfirmation).toBe(false)
  })

  it('收盘价历史数据不足时应失败降级', async () => {
    const result = await registry.execute<TrendTechnicalTimingOutput>('trend-technical-timing', {
      symbol: 'TOO-SHORT',
      params: { closeHistory: [1, 2, 3] },
    })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('收盘价历史数据不足')
  })

  it('自定义 ADX 周期与动量周期应生效', async () => {
    const closeHistory = generateSeries(80, 10, 0.3)

    const result = await registry.execute<TrendTechnicalTimingOutput>('trend-technical-timing', {
      symbol: 'CUSTOM',
      params: { closeHistory, adxPeriod: 10, momentumPeriods: [5, 10] },
    })

    expect(result.status).toBe('success')
    expect(result.data).toBeDefined()
    expect(result.data!.adx).toBeGreaterThan(0)
    expect(result.data!.momentum.m60).toBeUndefined()
  })
})
