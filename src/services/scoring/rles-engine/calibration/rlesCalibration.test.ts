import { describe, it, expect } from 'vitest'
import { runCalibration, buildCalibrationReport, formatCalibrationReport } from './rlesCalibration'
import { buildSampleBasket } from './sampleBasket'

describe('runCalibration', () => {
  const r = runCalibration()

  it('dump calibration report', () => {
    console.log('\n' + formatCalibrationReport(r))
  })

  it('跑通并产出完整报告', () => {
    expect(r.raw.sampleCount).toBeGreaterThan(50)
    expect(r.raw.symbolCount).toBe(15)
    expect(['strong', 'moderate', 'weak', 'invalid']).toContain(r.verdict)
  })

  it('二波因子显示正向增量（因子有效性成立）', () => {
    // 赢家组（二波命中）的前向收益应显著优于横盘/下跌组
    expect(r.detectedEdge).toBeGreaterThan(0)
    expect(r.detectedWinRateEdge).toBeGreaterThanOrEqual(0)
    // 时序复合分与前向收益正相关
    expect(r.ic).toBeGreaterThan(0)
  })

  it('tier 分流具备区分度', () => {
    expect(r.tierEdge).toBeGreaterThan(0)
    expect(r.quartileMonotonicity).toBeGreaterThanOrEqual(0)
  })

  it('verdict 不为 invalid（样本区分度足够支撑权重假设）', () => {
    expect(r.verdict === 'strong' || r.verdict === 'moderate').toBe(true)
  })

  it('文本报告可读', () => {
    const s = formatCalibrationReport(r)
    expect(s).toContain('verdict')
    expect(s).toContain('权重建议')
  })

  it('buildCalibrationReport 可单独调用', () => {
    const sample = buildSampleBasket()
    const rep = buildCalibrationReport('manual', runCalibration(sample).raw)
    expect(rep.basketName).toBe('manual')
  })
})
