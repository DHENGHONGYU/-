import { describe, it, expect } from 'vitest'
import { generatePsychologicalProfile, generateRiskProfile } from './tradeReviewAI.profileGenerator'
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

describe('tradeReviewAI.profileGenerator', () => {
  describe('generatePsychologicalProfile', () => {
    it('追涨杀跌 + FOMO 应识别为追涨型', () => {
      const classification = makeClassification([
        { type: TradeErrorType.CHASE_HIGH_SELL_LOW, severity: 'critical', count: 1 },
        { type: TradeErrorType.FOMO_ENTRY, severity: 'major', count: 1 },
      ])
      const profile = generatePsychologicalProfile(classification)
      expect(profile.primaryType).toBe('chase_type')
      expect(profile.name).toBe('追涨型')
    })

    it('提前止盈 + 犹豫错过应识别为恐盈型', () => {
      const classification = makeClassification([
        { type: TradeErrorType.EARLY_PROFIT_TAKING, severity: 'major', count: 1 },
        { type: TradeErrorType.HESITATION_MISS, severity: 'major', count: 1 },
      ])
      const profile = generatePsychologicalProfile(classification)
      expect(profile.primaryType).toBe('fear_profit_type')
      expect(profile.name).toBe('恐盈型')
    })

    it('不止损 + 逆势加仓应识别为扛单型', () => {
      const classification = makeClassification([
        { type: TradeErrorType.NO_STOP_LOSS, severity: 'critical', count: 1 },
        { type: TradeErrorType.AGAINST_TREND_ADDING, severity: 'critical', count: 1 },
      ])
      const profile = generatePsychologicalProfile(classification)
      expect(profile.primaryType).toBe('hold_loss_type')
      expect(profile.name).toBe('扛单型')
    })

    it('重仓豪赌应识别为激进型', () => {
      const classification = makeClassification([
        { type: TradeErrorType.HEAVY_GAMBLING, severity: 'critical', count: 1 },
      ])
      const profile = generatePsychologicalProfile(classification)
      expect(profile.primaryType).toBe('aggressive_type')
      expect(profile.name).toBe('激进型')
    })

    it('报复性交易应识别为情绪化型', () => {
      const classification = makeClassification([
        { type: TradeErrorType.REVENGE_TRADING, severity: 'critical', count: 1 },
      ])
      const profile = generatePsychologicalProfile(classification)
      expect(profile.primaryType).toBe('emotional_type')
      expect(profile.name).toBe('情绪化型')
    })

    it('过度交易应识别为冲动型', () => {
      const classification = makeClassification([
        { type: TradeErrorType.OVERTRADING, severity: 'major', count: 1 },
      ])
      const profile = generatePsychologicalProfile(classification)
      expect(profile.primaryType).toBe('impulsive_type')
      expect(profile.name).toBe('冲动型')
    })

    it('无错误时应返回默认画像', () => {
      const classification = makeClassification([])
      const profile = generatePsychologicalProfile(classification)
      expect(profile.primaryType).toBeDefined()
      expect(profile.name).toBeDefined()
      expect(profile.characteristics.length).toBeGreaterThan(0)
    })
  })

  describe('generateRiskProfile', () => {
    it('重仓豪赌应识别为激进风险偏好', () => {
      const classification = makeClassification([
        { type: TradeErrorType.HEAVY_GAMBLING, severity: 'critical', count: 1 },
      ])
      const orders = [makeOrder()]
      const profile = generateRiskProfile(classification, orders)
      expect(profile.riskAppetite).toBe('aggressive')
    })

    it('高纪律评分应识别为保守风险偏好', () => {
      const classification = makeClassification([], 85)
      const orders = [makeOrder()]
      const profile = generateRiskProfile(classification, orders)
      expect(profile.riskAppetite).toBe('conservative')
    })

    it('应正确计算仓位集中度', () => {
      const classification = makeClassification([])
      const orders = [
        makeOrder({ symbol: 'A', amount: 8000 }),
        makeOrder({ symbol: 'B', amount: 2000 }),
      ]
      const profile = generateRiskProfile(classification, orders)
      expect(profile.concentrationLevel).toBe('high')
    })

    it('应包含风险控制建议', () => {
      const classification = makeClassification([
        { type: TradeErrorType.NO_STOP_LOSS, severity: 'critical', count: 1 },
      ])
      const orders = [makeOrder()]
      const profile = generateRiskProfile(classification, orders)
      expect(profile.suggestions.length).toBeGreaterThan(0)
    })
  })
})
