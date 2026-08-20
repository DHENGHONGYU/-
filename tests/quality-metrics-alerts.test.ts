/**
 * @test_id V9-TEST-UT-QA-001
 * 质量门禁阈值告警单元测试
 *
 * 覆盖缺口：
 *   Q-01: 采集成功率 < 80% 时触发告警
 *   Q-02: 数据完整率 < 90% 时触发告警
 *   Q-03: 写入成功率 < 95% 时触发告警
 *   Q-04: 多指标同时低于阈值时同时告警
 *   Q-05: 达标时不告警
 *   Q-06: 空数据(0 total)时禁止告警（避免误报）
 *   Q-07: 真实成功率排除 mock 后仍能反映真实健康度
 *
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

describe('QualityMetricsCollector.checkAlerts — 阈值告警', () => {
  beforeEach(async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    getQualityMetrics().reset()
  })

  it('Q-01: 采集成功率 < 80% 时触发告警', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    for (let i = 0; i < 7; i++) collector.recordCollect(true, 'tencent', 100, ['tencent'])
    for (let i = 0; i < 3; i++) collector.recordCollect(false, 'tencent', 500, ['tencent'])
    expect(collector.snapshot().successRate).toBe(70)
    const alerts = collector.checkAlerts()
    expect(alerts.some((a) => a.includes('采集成功率'))).toBe(true)
  })

  it('Q-02: 数据完整率 < 90% 时触发告警', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    collector.recordCollect(true, 'tencent', 100, ['tencent'])
    collector.recordCompleteness({ nonNull: 5, total: 10 })
    expect(collector.snapshot().completeness).toBe(50)
    const alerts = collector.checkAlerts()
    expect(alerts.some((a) => a.includes('数据完整率'))).toBe(true)
  })

  it('Q-03: 写入成功率 < 95% 时触发告警', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    collector.recordCollect(true, 'tencent', 100, ['tencent'])
    for (let i = 0; i < 9; i++) collector.recordWrite(true)
    for (let i = 0; i < 1; i++) collector.recordWrite(false)
    expect(collector.snapshot().writeRate).toBe(90)
    const alerts = collector.checkAlerts()
    expect(alerts.some((a) => a.includes('写入成功率'))).toBe(true)
  })

  it('Q-04: 多指标同时低于阈值时同时告警', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    collector.recordCollect(true, 'tencent', 100, ['tencent'])
    collector.recordCollect(false, 'tencent', 500, ['tencent'])
    collector.recordCompleteness({ nonNull: 6, total: 10 })
    collector.recordWrite(true)
    collector.recordWrite(true)
    collector.recordWrite(true)
    collector.recordWrite(true)
    collector.recordWrite(false)

    const alerts = collector.checkAlerts()
    expect(alerts.some((a) => a.includes('采集成功率'))).toBe(true)
    expect(alerts.some((a) => a.includes('数据完整率'))).toBe(true)
    expect(alerts.some((a) => a.includes('写入成功率'))).toBe(true)
  })

  it('Q-05: 全部达标时返回空数组(不告警)', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    // 成功率 100%（10/10）
    for (let i = 0; i < 10; i++) collector.recordCollect(true, 'tencent', 100, ['tencent'])
    // 完整率滚动平均稳定收敛到 95%（足够多的样本，消除早期 0 启动偏差）
    for (let i = 0; i < 50; i++) collector.recordCompleteness({ nonNull: 95, total: 100 })
    // 写入率 100%
    for (let i = 0; i < 10; i++) collector.recordWrite(true)
    const snap = collector.snapshot()
    expect(snap.completeness).toBeGreaterThanOrEqual(90)
    expect(snap.successRate).toBe(100)
    expect(snap.writeRate).toBe(100)
    expect(collector.checkAlerts()).toEqual([])
  })

  it('Q-06: 空数据(0 total)时禁止告警 — 防误报', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    const snap = collector.snapshot()
    expect(snap.totalCollects).toBe(0)
    expect(snap.writeTotal).toBe(0)
    expect(collector.checkAlerts()).toEqual([])
  })

  it('Q-07: 真实成功率排除 mock 后反映真实健康度', async () => {
    const { getQualityMetrics } = await import('@/services/data-collector/qualityMetricsCollector')
    const collector = getQualityMetrics()
    collector.recordCollect(false, 'tencent', 500, ['tencent'])
    collector.recordCollect(false, 'sina', 500, ['sina'])
    collector.recordCollect(true, 'mock', 100, ['tencent', 'sina', 'mock'])
    const snap = collector.snapshot()
    expect(snap.successRate).toBeLessThan(80)
    expect(snap.realSuccessRate).toBe(0)
    const alerts = collector.checkAlerts()
    expect(alerts.length).toBeGreaterThanOrEqual(1)
  })
})
