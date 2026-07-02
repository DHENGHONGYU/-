/**
 * 因子贡献计算 — 单元测试
 *
 * 覆盖：权重归一化、正负向贡献、边界条件、与引擎 audit 集成
 */

import { describe, test, expect } from 'vitest'
import { buildFactorContributions } from './factorContributions'
import type { ScoreAuditTrail } from './types'
import { DEFAULT_ENGINE_CONFIG } from './config'

function createAuditTrail(
  layerScores: Partial<ScoreAuditTrail['composite']['layers']>,
): ScoreAuditTrail {
  const weights = DEFAULT_ENGINE_CONFIG.weights
  const layers = { ...Object.fromEntries(Object.keys(weights).map((k) => [k, 0])) } as Record<
    keyof typeof weights,
    number
  >
  for (const [id, score] of Object.entries(layerScores)) {
    layers[id as keyof typeof weights] = score ?? 0
  }

  const weightedSum = Object.entries(layers).reduce((sum, [id, score]) => {
    return sum + (score * weights[id as keyof typeof weights])
  }, 0)

  return {
    symbol: 'TEST',
    timestamp: Date.now(),
    config: { ...DEFAULT_ENGINE_CONFIG },
    layers: {} as ScoreAuditTrail['layers'],
    composite: {
      weightedSum,
      layers,
      rating: 'hold',
    },
    factorContributions: [],
  }
}

describe('buildFactorContributions', () => {
  test('空层得分返回空数组', () => {
    const trail = createAuditTrail({})
    expect(buildFactorContributions(trail)).toEqual([])
  })

  test('仅有一个因子时贡献率等于 1', () => {
    const trail = createAuditTrail({ l1: 4 })
    const contributions = buildFactorContributions(trail)
    expect(contributions).toHaveLength(1)
    const first = contributions[0]
    expect(first?.contributionRate).toBeCloseTo(1, 5)
    expect(first?.contribution).toBeGreaterThan(0)
  })

  test('高于基准得分为正向贡献，低于基准为负向贡献', () => {
    const trail = createAuditTrail({ l1: 5, l2: 1 })
    const contributions = buildFactorContributions(trail)
    const l1 = contributions.find((c) => c.factorId === 'l1')
    const l2 = contributions.find((c) => c.factorId === 'l2')
    expect(l1).toBeDefined()
    expect(l2).toBeDefined()
    expect(l1!.signedContribution).toBeGreaterThan(0)
    expect(l2!.signedContribution).toBeLessThan(0)
  })

  test('所有绝对贡献之和等于加权最终分（忽略调整项）', () => {
    const trail = createAuditTrail({ l1: 4, l2: 3, l3f: 5 })
    const contributions = buildFactorContributions(trail)
    const total = contributions.reduce((sum, c) => sum + c.contribution, 0)
    const weightedAverage =
      contributions.reduce((sum, c) => sum + c.score * c.normalizedWeight, 0)
    expect(total).toBeCloseTo(weightedAverage * 20, 5)
  })

  test('贡献率之和约等于 1', () => {
    const trail = createAuditTrail({ l1: 4, l2: 3, l3f: 5 })
    const contributions = buildFactorContributions(trail)
    const totalRate = contributions.reduce((sum, c) => sum + c.contributionRate, 0)
    expect(totalRate).toBeCloseTo(1, 5)
  })

  test('未激活层（score=0 或 weight=0）不出现在结果中', () => {
    const trail = createAuditTrail({ l1: 4, l2: 0, l3f: 3 })
    const contributions = buildFactorContributions(trail)
    expect(contributions.some((c) => c.factorId === 'l2')).toBe(false)
  })

  test('权重为 0 的层被过滤', () => {
    const trail = createAuditTrail({ l1: 4 })
    trail.config.weights = { ...DEFAULT_ENGINE_CONFIG.weights, l2: 0 }
    trail.composite.layers.l2 = 4
    const contributions = buildFactorContributions(trail)
    expect(contributions.some((c) => c.factorId === 'l2')).toBe(false)
  })
})
