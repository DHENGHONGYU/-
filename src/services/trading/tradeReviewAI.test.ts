import { describe, it, expect } from 'vitest'
import { generateReview, SKILL_DIMENSIONS } from './tradeReviewAI'
import type { Order } from '@/data/types'
import { TradeErrorType } from './tradeErrorClassifier'

/**
 * 构造一笔测试订单
 */
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

describe('tradeReviewAI', () => {
  describe('SkillDevelopment 结构对齐', () => {
    it('应生成完整且类型对齐的 SkillDevelopment', () => {
      const orders: Order[] = [
        makeOrder({ planFollowed: false, maxDrawdown: 15, planPositionPct: 0.5 }),
        makeOrder({ planFollowed: true, maxDrawdown: 2, planPositionPct: 0.1 }),
      ]

      const report = generateReview(orders)
      const skill = report.skillDevelopment

      expect(skill.userId).toBeDefined()
      expect(skill.overallLevel).toMatch(/^(beginner|intermediate|advanced|expert|master)$/)
      expect(skill.updatedAt).toBeGreaterThan(0)
      expect(skill.dimensions).toHaveLength(SKILL_DIMENSIONS.length)
      expect(skill.milestones.length).toBe(SKILL_DIMENSIONS.length)
      expect(skill.learningPath.length).toBeGreaterThan(0)
      expect(skill.prioritySkills.length).toBeGreaterThan(0)
      expect(skill.recommendedResources.length).toBeGreaterThan(0)
    })

    it('每个技能维度应包含有效字段', () => {
      const orders: Order[] = [makeOrder()]
      const { skillDevelopment } = generateReview(orders)

      for (const dim of skillDevelopment.dimensions) {
        expect(dim.code).toBeDefined()
        expect(dim.name).toBeDefined()
        expect(dim.description).toBeDefined()
        expect(dim.currentLevel).toMatch(/^(beginner|intermediate|advanced|expert|master)$/)
        expect(dim.targetLevel).toMatch(/^(beginner|intermediate|advanced|expert|master)$/)
        expect(dim.score).toBeGreaterThanOrEqual(0)
        expect(dim.score).toBeLessThanOrEqual(100)
        expect(dim.gap).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('错误到 Skill 的映射覆盖', () => {
    it('所有 12 种错误类型应至少映射到一个技能维度', () => {
      const allErrorTypes = Object.values(TradeErrorType)
      const covered = new Set<string>()

      for (const dim of SKILL_DIMENSIONS) {
        for (const err of dim.relatedErrors) {
          covered.add(err)
        }
      }

      for (const err of allErrorTypes) {
        expect(covered.has(err), `错误类型 ${err} 应至少映射到一个技能维度`).toBe(true)
      }
    })

    it('止损相关错误应降低 stop_loss 维度评分', () => {
      const now = Date.now()
      const orders: Order[] = [
        // 分散仓位，避免触发 planViolation / heavyGambling
        makeOrder({ id: 'b1', symbol: 'A', amount: 2000, price: 100, quantity: 20, createdAt: now - 86400000 * 5 }),
        makeOrder({ id: 'b2', symbol: 'B', amount: 2000, createdAt: now - 86400000 * 4 }),
        makeOrder({ id: 'b3', symbol: 'C', amount: 2000, createdAt: now - 86400000 * 3 }),
        makeOrder({ id: 'b4', symbol: 'D', amount: 2000, createdAt: now - 86400000 * 2 }),
        makeOrder({ id: 'b5', symbol: 'E', amount: 2000, createdAt: now - 86400000 }),
        // symbol A 亏损卖出，触发 no_stop_loss / ignore_stop_loss
        { id: 's1', symbol: 'A', direction: 'sell', quantity: 20, price: 80, amount: 1600, status: 'filled', accountType: 'paper', createdAt: now },
      ]

      const { skillDevelopment } = generateReview(orders)
      const stopLossDim = skillDevelopment.dimensions.find((d) => d.code === 'stop_loss')

      expect(stopLossDim).toBeDefined()
      expect(stopLossDim!.score).toBeLessThan(85)
    })

    it('重仓豪赌应降低 position_management 维度评分', () => {
      const orders: Order[] = [
        makeOrder({ planPositionPct: 0.6, planFollowed: true }),
      ]

      const { skillDevelopment } = generateReview(orders)
      const positionDim = skillDevelopment.dimensions.find((d) => d.code === 'position_management')

      expect(positionDim).toBeDefined()
      expect(positionDim!.score).toBeLessThan(85)
    })
  })

  describe('技能等级计算', () => {
    it('无错误时所有维度评分应为默认 85', () => {
      const now = Date.now()
      // 多笔不同 symbol 等金额订单，避免触发 planViolation / heavyGambling
      const orders: Order[] = [
        makeOrder({ symbol: 'A', amount: 2500, createdAt: now - 86400000 * 4 }),
        makeOrder({ symbol: 'B', amount: 2500, createdAt: now - 86400000 * 3 }),
        makeOrder({ symbol: 'C', amount: 2500, createdAt: now - 86400000 * 2 }),
        makeOrder({ symbol: 'D', amount: 2500, createdAt: now - 86400000 }),
      ]
      const { skillDevelopment } = generateReview(orders)

      for (const dim of skillDevelopment.dimensions) {
        expect(dim.score).toBe(85)
      }
      expect(skillDevelopment.overallLevel).toBe('expert')
    })

    it('严重错误应使对应维度等级下降', () => {
      // 一笔重仓 + 多笔小仓位，触发 heavyGambling 与 planViolation
      const orders: Order[] = [
        makeOrder({ id: 'h1', symbol: 'A', amount: 6000 }),
        makeOrder({ id: 'h2', symbol: 'B', amount: 1000 }),
        makeOrder({ id: 'h3', symbol: 'C', amount: 1000 }),
        makeOrder({ id: 'h4', symbol: 'D', amount: 1000 }),
        makeOrder({ id: 'h5', symbol: 'E', amount: 1000 }),
      ]
      const { skillDevelopment } = generateReview(orders)
      const positionDim = skillDevelopment.dimensions.find((d) => d.code === 'position_management')

      // 一次 critical heavyGambling 扣 20 分，85-20=65，对应 intermediate
      expect(positionDim!.currentLevel).toBe('intermediate')
      expect(positionDim!.targetLevel).toBe('advanced')
    })
  })

  describe('里程碑与学习路径', () => {
    it('每个里程碑应关联到存在的技能维度', () => {
      const orders: Order[] = [makeOrder()]
      const { skillDevelopment } = generateReview(orders)
      const codes = new Set(skillDevelopment.dimensions.map((d) => d.code))

      for (const m of skillDevelopment.milestones) {
        expect(codes.has(m.skillDimension)).toBe(true)
        expect(m.targetLevel).toMatch(/^(beginner|intermediate|advanced|expert|master)$/)
        expect(m.criteria.length).toBeGreaterThan(0)
      }
    })

    it('学习路径节点应按 order 顺序排列', () => {
      const orders: Order[] = [makeOrder()]
      const { skillDevelopment } = generateReview(orders)

      for (let i = 0; i < skillDevelopment.learningPath.length - 1; i++) {
        expect(skillDevelopment.learningPath[i]!.order).toBeLessThan(skillDevelopment.learningPath[i + 1]!.order)
      }
    })
  })
})
