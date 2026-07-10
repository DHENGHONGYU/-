import { describe, it, expect } from 'vitest'
import {
  buildScoreComparison,
  buildScoreTimeline,
} from '@/services/analysis/scoreDocService'
import type { ScoreDocVersion } from '@/data/types'

function mockDoc(overrides: Partial<ScoreDocVersion> = {}): ScoreDocVersion {
  const base: ScoreDocVersion = {
    docId: '600519__1__1698765432000',
    symbol: '600519',
    stockName: '贵州茅台',
    version: 1,
    scoreDate: '2024-10-31',
    composite: 85.6,
    l3v: 82.3,
    layers: {
      L0: { score: 90, reason: '基本面良好', weight: 0.2 },
      L1: { score: 85, reason: '行业领先', weight: 0.2 },
      L2: { score: 80, reason: '估值合理', weight: 0.15 },
      L3: { score: 82, reason: '技术面支撑', weight: 0.15 },
      L4: { score: 88, reason: '资金流入', weight: 0.1 },
      L5: { score: 78, reason: '情绪中性', weight: 0.1 },
      L6: { score: 92, reason: '政策利好', weight: 0.1 },
    },
    recommendation: { key: 'buy', label: '买入', color: '#ef4444' },
    targetPrice: { bull: 1900, base: 1800, bear: 1700 },
    keyRisks: ['行业竞争加剧'],
    keyCatalysts: ['新品发布'],
    reportMd: '# 贵州茅台评分报告',
    modelUsed: 'gpt-4',
    market: 'A股',
    industry: '白酒',
    createdAt: '2024-10-31T10:00:00Z',
  }
  return { ...base, ...overrides }
}

describe('buildScoreComparison', () => {
  it('同股票两版本比对：计算综合分变化', () => {
    const left = mockDoc({ version: 1, composite: 80, l3v: 75 })
    const right = mockDoc({ version: 2, composite: 85, l3v: 80 })

    const result = buildScoreComparison(left, right, 'same-stock-versions')

    expect(result.compositeDelta).toBe(5)
    expect(result.l3vDelta).toBe(5)
    expect(result.mode).toBe('same-stock-versions')
    expect(result.left.version).toBe(1)
    expect(result.right.version).toBe(2)
  })

  it('维度比对：所有共有维度都有 delta', () => {
    const left = mockDoc({
      layers: {
        L0: { score: 80, reason: '旧', weight: 0.2 },
        L1: { score: 70, reason: '旧', weight: 0.2 },
      },
    })
    const right = mockDoc({
      layers: {
        L0: { score: 90, reason: '新', weight: 0.2 },
        L1: { score: 65, reason: '新', weight: 0.2 },
      },
    })

    const result = buildScoreComparison(left, right, 'same-stock-versions')
    const l0 = result.dimensions.find((d) => d.code === 'L0')
    const l1 = result.dimensions.find((d) => d.code === 'L1')

    expect(l0?.delta).toBe(10)
    expect(l1?.delta).toBe(-5)
    expect(result.dimensions.length).toBe(2)
  })

  it('新增维度检测：右侧有左侧没有的维度', () => {
    const left = mockDoc({
      layers: { L0: { score: 80, reason: '', weight: 0.2 } },
    })
    const right = mockDoc({
      layers: {
        L0: { score: 80, reason: '', weight: 0.2 },
        L7: { score: 75, reason: '新增维度', weight: 0.1 },
      },
    })

    const result = buildScoreComparison(left, right, 'same-stock-versions')

    expect(result.addedDimensions).toContain('L7')
    expect(result.removedDimensions).toHaveLength(0)
  })

  it('移除维度检测：左侧有右侧没有的维度', () => {
    const left = mockDoc({
      layers: {
        L0: { score: 80, reason: '', weight: 0.2 },
        L7: { score: 75, reason: '旧维度', weight: 0.1 },
      },
    })
    const right = mockDoc({
      layers: { L0: { score: 80, reason: '', weight: 0.2 } },
    })

    const result = buildScoreComparison(left, right, 'same-stock-versions')

    expect(result.removedDimensions).toContain('L7')
    expect(result.addedDimensions).toHaveLength(0)
  })

  it('评级变化检测', () => {
    const left = mockDoc({
      recommendation: { key: 'hold', label: '持有', color: '#f59e0b' },
    })
    const right = mockDoc({
      recommendation: { key: 'buy', label: '买入', color: '#ef4444' },
    })

    const result = buildScoreComparison(left, right, 'same-stock-versions')

    expect(result.ratingChanged).toBe(true)
  })

  it('评级不变时 ratingChanged 为 false', () => {
    const left = mockDoc()
    const right = mockDoc({ composite: 90 })

    const result = buildScoreComparison(left, right, 'same-stock-versions')

    expect(result.ratingChanged).toBe(false)
  })

  it('上升幅度最大的维度 Top N', () => {
    const left = mockDoc({
      layers: {
        L0: { score: 80, reason: '', weight: 0.2 },
        L1: { score: 70, reason: '', weight: 0.2 },
        L2: { score: 60, reason: '', weight: 0.2 },
      },
    })
    const right = mockDoc({
      layers: {
        L0: { score: 85, reason: '', weight: 0.2 },
        L1: { score: 80, reason: '', weight: 0.2 },
        L2: { score: 55, reason: '', weight: 0.2 },
      },
    })

    const result = buildScoreComparison(left, right, 'same-stock-versions')

    expect(result.topRisingDimensions.length).toBeGreaterThan(0)
    expect(result.topRisingDimensions[0]?.delta).toBe(10)
    expect(result.topRisingDimensions[0]?.code).toBe('L1')
  })

  it('下降幅度最大的维度 Top N', () => {
    const left = mockDoc({
      layers: {
        L0: { score: 80, reason: '', weight: 0.2 },
        L1: { score: 70, reason: '', weight: 0.2 },
        L2: { score: 60, reason: '', weight: 0.2 },
      },
    })
    const right = mockDoc({
      layers: {
        L0: { score: 85, reason: '', weight: 0.2 },
        L1: { score: 65, reason: '', weight: 0.2 },
        L2: { score: 50, reason: '', weight: 0.2 },
      },
    })

    const result = buildScoreComparison(left, right, 'same-stock-versions')

    expect(result.topFallingDimensions.length).toBeGreaterThan(0)
    expect(result.topFallingDimensions[0]?.delta).toBe(-10)
    expect(result.topFallingDimensions[0]?.code).toBe('L2')
  })

  it('跨股票模式：mode 正确', () => {
    const left = mockDoc({ symbol: '600519', stockName: '贵州茅台' })
    const right = mockDoc({ symbol: '000858', stockName: '五粮液' })

    const result = buildScoreComparison(left, right, 'cross-stock-latest')

    expect(result.mode).toBe('cross-stock-latest')
    expect(result.left.symbol).toBe('600519')
    expect(result.right.symbol).toBe('000858')
  })
})

describe('buildScoreTimeline', () => {
  it('空数组返回空时间轴', () => {
    const result = buildScoreTimeline([])
    expect(result).toEqual([])
  })

  it('单个版本：changeFromPrev 为 null', () => {
    const versions = [mockDoc({ version: 1, composite: 80, scoreDate: '2024-10-01' })]
    const result = buildScoreTimeline(versions)

    expect(result).toHaveLength(1)
    expect(result[0]?.version).toBe(1)
    expect(result[0]?.changeFromPrev).toBeNull()
  })

  it('多个版本：按版本号排序并计算变化', () => {
    const versions = [
      mockDoc({ version: 3, composite: 90, scoreDate: '2024-12-01' }),
      mockDoc({ version: 1, composite: 80, scoreDate: '2024-10-01' }),
      mockDoc({ version: 2, composite: 85, scoreDate: '2024-11-01' }),
    ]

    const result = buildScoreTimeline(versions)

    expect(result).toHaveLength(3)
    expect(result[0]?.version).toBe(1)
    expect(result[0]?.changeFromPrev).toBeNull()
    expect(result[1]?.version).toBe(2)
    expect(result[1]?.changeFromPrev).toBe(5)
    expect(result[2]?.version).toBe(3)
    expect(result[2]?.changeFromPrev).toBe(5)
  })
})
