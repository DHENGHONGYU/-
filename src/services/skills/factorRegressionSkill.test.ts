/**
 * @module services/skills/factorRegressionSkill.test
 * @description S-01 因子回归权重校验 SKILL 单元测试
 */

import { describe, it, expect } from 'vitest'
import { SkillRegistry } from './skillRegistry'
import { factorRegressionSkill, type FactorRegressionOutput } from './factorRegressionSkill'

describe('factorRegressionSkill', () => {
  const registry = new SkillRegistry()
  registry.register(factorRegressionSkill)

  const samples: Record<string, Record<string, number>> = {
    '600000.SH': { l1: 4.0, l2: 2.5, l3f: 3.8, l8: 3.2 },
    '000001.SZ': { l1: 2.5, l2: 3.0, l3f: 3.5, l8: 2.8 },
    '000858.SZ': { l1: 4.2, l2: 4.0, l3f: 2.1, l8: 3.9 },
    '002415.SZ': { l1: 3.8, l2: 3.6, l3f: 3.2, l8: 2.0 },
    '300750.SZ': { l1: 4.5, l2: 2.2, l3f: 4.0, l8: 4.1 },
    '601318.SH': { l1: 2.6, l2: 3.4, l3f: 3.6, l8: 3.3 },
    '601012.SH': { l1: 3.9, l2: 4.7, l3f: 2.4, l8: 3.5 },
    '002594.SZ': { l1: 4.1, l2: 3.9, l3f: 4.9, l8: 3.7 },
  }

  const target: Record<string, number> = {
    '600000.SH': 3.6,
    '000001.SZ': 2.9,
    '000858.SZ': 3.7,
    '002415.SZ': 3.3,
    '300750.SZ': 3.8,
    '601318.SH': 3.2,
    '601012.SH': 3.9,
    '002594.SZ': 4.1,
  }

  const currentWeights: Record<string, number> = {
    l1: 0.25, l2: 0.20, l3f: 0.30, l8: 0.25,
  }

  it('应成功执行回归并返回显著因子与校准权重', async () => {
    const result = await registry.execute<FactorRegressionOutput>('factor-regression', {
      symbol: 'BATCH-B-TEST',
      params: { samples, target, currentWeights },
    })

    expect(result.status).toBe('success')
    expect(result.data).toBeDefined()
    expect(result.data!.sampleSize).toBe(8)
    expect(result.data!.factorCount).toBe(4)
    expect(result.data!.factors.length).toBe(4)
    expect(result.data!.calibratedWeights).toBeDefined()

    const weightSum = Object.values(result.data!.calibratedWeights)
      .reduce((a, b) => a + b, 0)
    expect(weightSum).toBeCloseTo(1, 3)
  })

  it('样本不足时应失败降级', async () => {
    const result = await registry.execute<FactorRegressionOutput>('factor-regression', {
      symbol: 'BATCH-B-TEST',
      params: {
        samples: { 'A': { l1: 1 } },
        target: { 'A': 1 },
      },
    })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('样本或目标变量不足')
  })

  it('缺失目标变量时应失败降级', async () => {
    const result = await registry.execute<FactorRegressionOutput>('factor-regression', {
      symbol: 'BATCH-B-TEST',
      params: { samples },
    })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('样本或目标变量不足')
  })

  it('应识别多重共线性（重复因子）', async () => {
    const collinearSamples: Record<string, Record<string, number>> = {
      'A': { l1: 1.0, l1_dup: 1.0, l2: 2.0 },
      'B': { l1: 2.0, l1_dup: 2.0, l2: 3.0 },
      'C': { l1: 3.0, l1_dup: 3.0, l2: 4.0 },
      'D': { l1: 4.0, l1_dup: 4.0, l2: 5.0 },
      'E': { l1: 5.0, l1_dup: 5.0, l2: 6.0 },
    }
    const collinearTarget: Record<string, number> = {
      'A': 1.5, 'B': 2.5, 'C': 3.5, 'D': 4.5, 'E': 5.5,
    }

    const result = await registry.execute<FactorRegressionOutput>('factor-regression', {
      symbol: 'BATCH-B-TEST',
      params: { samples: collinearSamples, target: collinearTarget, vifThreshold: 4 },
    })

    expect(result.status).toBe('success')
    expect(result.data!.diagnostics.multicollinearityRisk).toBe(true)
    expect(result.data!.redundantFactors.length).toBeGreaterThan(0)
  })
})
