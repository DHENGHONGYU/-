import { describe, it, expect } from 'vitest'
import { generateSkillDevelopment } from './tradeReviewAI.skillDevelopment'
import type { ErrorClassificationResult } from './tradeErrorClassifier'
import { TradeErrorType } from './tradeErrorClassifier'
import type { Order } from '@/data/types'

function makeClassification(
  errors: Array<{ type: TradeErrorType; severity: 'critical' | 'major' | 'minor'; count: number }>,
  disciplineScore = 70,
): ErrorClassificationResult {
  return {
    errors: errors.map((e) => ({
      type: e.type,
      name: e.type,
      severity: e.severity,
      count: e.count,
      psychologicalRoot: 'test root cause',
      relatedOrderIds: [],
      penalty: 0,
    })),
    disciplineScore,
    totalPenalty: 0,
    totalErrors: errors.reduce((sum, e) => sum + e.count, 0),
    criticalCount: errors.filter((e) => e.severity === 'critical').reduce((sum, e) => sum + e.count, 0),
    majorCount: errors.filter((e) => e.severity === 'major').reduce((sum, e) => sum + e.count, 0),
    minorCount: errors.filter((e) => e.severity === 'minor').reduce((sum, e) => sum + e.count, 0),
  }
}

function makeOrder(overrides: Partial<Order> & Record<string, unknown> = {}): Order {
  return {
    id: `order_${Math.random().toString(36).slice(2, 8)}`,
    symbol: '600519',
    direction: 'buy',
    quantity: 100,
    price: 100,
    amount: 10000,
    status: 'filled',
    accountType: 'paper',
    createdAt: Date.now() - 86400000,
    ...overrides,
  }
}

describe('tradeReviewAI.skillDevelopment', () => {
  describe('generateSkillDevelopment', () => {
    it('应生成完整的技能发展建议', () => {
      const classification = makeClassification([
        { type: TradeErrorType.NO_STOP_LOSS, severity: 'critical', count: 1 },
      ])
      const orders = [makeOrder()]
      const skill = generateSkillDevelopment(classification, orders)

      expect(skill.userId).toBeDefined()
      expect(skill.currentLevel).toBeDefined()
      expect(skill.overallLevel).toBeDefined()
      expect(skill.dimensions.length).toBeGreaterThan(0)
      expect(skill.milestones.length).toBeGreaterThan(0)
      expect(skill.learningPath.length).toBeGreaterThan(0)
      expect(skill.prioritySkills.length).toBeGreaterThan(0)
      expect(skill.recommendedResources.length).toBeGreaterThan(0)
    })

    it('无错误时所有维度应为默认分数', () => {
      const classification = makeClassification([])
      const orders = [makeOrder()]
      const skill = generateSkillDevelopment(classification, orders)

      for (const dim of skill.dimensions) {
        expect(dim.score).toBe(85)
      }
    })

    it('严重错误应降低对应维度评分', () => {
      const classification = makeClassification([
        { type: TradeErrorType.NO_STOP_LOSS, severity: 'critical', count: 1 },
      ])
      const orders = [makeOrder()]
      const skill = generateSkillDevelopment(classification, orders)

      const stopLossDim = skill.dimensions.find((d) => d.code === 'stop_loss')
      expect(stopLossDim).toBeDefined()
      expect(stopLossDim!.score).toBeLessThan(85)
    })

    it('学习路径应按 order 排序', () => {
      const classification = makeClassification([])
      const orders = [makeOrder()]
      const skill = generateSkillDevelopment(classification, orders)

      for (let i = 0; i < skill.learningPath.length - 1; i++) {
      expect(skill.learningPath[i]!.order).toBeLessThan(skill.learningPath[i + 1]!.order)
    }
    })

    it('里程碑应关联到技能维度', () => {
      const classification = makeClassification([])
      const orders = [makeOrder()]
      const skill = generateSkillDevelopment(classification, orders)

      const dimensionCodes = new Set(skill.dimensions.map((d) => d.code))
      for (const milestone of skill.milestones) {
        expect(dimensionCodes.has(milestone.skillDimension)).toBe(true)
      }
    })
  })
})
