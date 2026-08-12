/**
 * @test_id V9-TEST-ST-066
 * scoreDocService diff 功能单元测试
 *
 * 覆盖：版本差异计算、新增/删除维度、评分等级变化
  * @covers_docs [V9-DOC-BACK-044, V9-DOC-BACK-018, V9-DOC-BACK-037, V9-DOC-BACK-042]
*/

import { describe, test, expect } from 'vitest'
import { buildScoreDocDiff } from '../scoreDocService'
import type { ScoreDocVersion } from '@/data/types'

function createDoc(overrides: Partial<ScoreDocVersion> = {}): ScoreDocVersion {
  return {
    docId: 'TEST__V1__0',
    symbol: 'TEST',
    stockName: '测试股票',
    version: 1,
    scoreDate: '2026-07-01',
    composite: 4,
    l3v: 3.5,
    layers: {
      估值: { score: 4, reason: '', weight: 1 },
      成长: { score: 3, reason: '', weight: 1 },
    },
    recommendation: { key: 'buy', label: '买入', color: '#22c55e' },
    targetPrice: { bull: 0, base: 0, bear: 0 },
    keyRisks: [],
    keyCatalysts: [],
    reportMd: '',
    modelUsed: 'v6',
    market: 'A股',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('buildScoreDocDiff', () => {
  test('计算综合分、L3V 与维度变化', () => {
    const older = createDoc({ version: 1, composite: 4, l3v: 3.5 })
    const newer = createDoc({
      version: 2,
      composite: 4.5,
      l3v: 3.8,
      layers: {
        估值: { score: 4.5, reason: '', weight: 1 },
        成长: { score: 3, reason: '', weight: 1 },
      },
    })

    const diff = buildScoreDocDiff(newer, older)

    expect(diff.newerVersion).toBe(2)
    expect(diff.olderVersion).toBe(1)
    expect(diff.compositeDelta).toBeCloseTo(0.5, 2)
    expect(diff.l3vDelta).toBeCloseTo(0.3, 2)
    expect(diff.layerChanges.find((c) => c.code === '估值')?.delta).toBeCloseTo(0.5, 2)
  })

  test('识别新增维度', () => {
    const older = createDoc({ layers: { 估值: { score: 4, reason: '', weight: 1 } } })
    const newer = createDoc({
      layers: {
        估值: { score: 4, reason: '', weight: 1 },
        成长: { score: 3.5, reason: '', weight: 1 },
      },
    })

    const diff = buildScoreDocDiff(newer, older)

    expect(diff.addedLayers).toContain('成长')
    expect(diff.layerChanges.find((c) => c.code === '成长')?.oldScore).toBe(0)
  })

  test('识别删除维度', () => {
    const older = createDoc({
      layers: {
        估值: { score: 4, reason: '', weight: 1 },
        成长: { score: 3, reason: '', weight: 1 },
      },
    })
    const newer = createDoc({ layers: { 估值: { score: 4, reason: '', weight: 1 } } })

    const diff = buildScoreDocDiff(newer, older)

    expect(diff.removedLayers).toContain('成长')
    expect(diff.layerChanges.find((c) => c.code === '成长')?.newScore).toBe(0)
  })

  test('识别评分建议变化', () => {
    const older = createDoc({ recommendation: { key: 'hold', label: '观望', color: '#888' } })
    const newer = createDoc({ recommendation: { key: 'buy', label: '买入', color: '#22c55e' } })

    const diff = buildScoreDocDiff(newer, older)

    expect(diff.ratingChanged).toBe(true)
    expect(diff.oldRating).toBe('观望')
    expect(diff.newRating).toBe('买入')
  })
})
