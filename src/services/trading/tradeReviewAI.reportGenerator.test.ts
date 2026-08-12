/**
 * @test_id V9-TEST-ST-122
 * @covers_docs [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-QA-080]
 */
import { describe, it, expect } from 'vitest'
import {
  generateTradeSummary,
  generateErrorAnalysis,
  generateDisciplineAnalysis,
  generateActionPlan,
  generateAIDeepInsight,
} from './tradeReviewAI.reportGenerator'
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

describe('tradeReviewAI.reportGenerator', () => {
  describe('generateTradeSummary', () => {
    it('应正确计算交易摘要', () => {
      const now = Date.now()
      const orders = [
        makeOrder({ id: 'b1', symbol: 'A', direction: 'buy', price: 100, createdAt: now - 86400000 }),
        makeOrder({ id: 's1', symbol: 'A', direction: 'sell', price: 110, createdAt: now }),
      ]
      const classification = makeClassification([], 80)
      const summary = generateTradeSummary(orders, classification)

      expect(summary.totalTrades).toBe(1)
      expect(summary.profitableTrades).toBe(1)
      expect(summary.losingTrades).toBe(0)
      expect(summary.winRate).toBe(100)
      expect(summary.disciplineScore).toBe(80)
    })

    it('无交易对时应返回零值', () => {
      const orders = [makeOrder({ direction: 'buy' })]
      const classification = makeClassification([])
      const summary = generateTradeSummary(orders, classification)

      expect(summary.totalTrades).toBe(0)
      expect(summary.winRate).toBe(0)
      expect(summary.profitLossRatio).toBe(0)
    })
  })

  describe('generateErrorAnalysis', () => {
    it('应生成错误分析', () => {
      const classification = makeClassification([
        { type: TradeErrorType.NO_STOP_LOSS, severity: 'critical', count: 2 },
        { type: TradeErrorType.OVERTRADING, severity: 'major', count: 1 },
      ])
      const orders = [makeOrder()]
      const analysis = generateErrorAnalysis(classification, orders)

      expect(analysis.topErrors.length).toBeGreaterThan(0)
      expect(analysis.errorTrend).toBeDefined()
      expect(analysis.psychologicalProfile).toBeDefined()
      expect(analysis.riskProfile).toBeDefined()
    })

    it('严重错误频发应提示纪律亟需改善', () => {
      const classification = makeClassification([
        { type: TradeErrorType.NO_STOP_LOSS, severity: 'critical', count: 3 },
      ])
      const orders = [makeOrder()]
      const analysis = generateErrorAnalysis(classification, orders)

      expect(analysis.errorTrend).toContain('亟需')
    })
  })

  describe('generateDisciplineAnalysis', () => {
    it('应生成纪律分析', () => {
      const classification = makeClassification([
        { type: TradeErrorType.PLAN_VIOLATION, severity: 'critical', count: 1 },
      ])
      const orders = [makeOrder()]
      const analysis = generateDisciplineAnalysis(orders, classification)

      expect(analysis.planAdherenceRate).toBeLessThan(85)
      expect(analysis.overallScore).toBeGreaterThan(0)
      expect(analysis.improvements.length).toBeGreaterThan(0)
    })

    it('无错误时应返回高纪律评分', () => {
      const classification = makeClassification([])
      const orders = [makeOrder()]
      const analysis = generateDisciplineAnalysis(orders, classification)

      expect(analysis.planAdherenceRate).toBe(85)
      expect(analysis.stopLossExecutionRate).toBe(80)
    })
  })

  describe('generateActionPlan', () => {
    it('应生成行动计划', () => {
      const classification = makeClassification([
        { type: TradeErrorType.NO_STOP_LOSS, severity: 'critical', count: 1 },
      ])
      const discipline = generateDisciplineAnalysis([makeOrder()], classification)
      const plan = generateActionPlan(classification, discipline)

      expect(plan.immediate.length).toBeGreaterThan(0)
      expect(plan.shortTerm.length).toBeGreaterThan(0)
      expect(plan.longTerm.length).toBeGreaterThan(0)
    })
  })

  describe('generateAIDeepInsight', () => {
    it('应生成 AI 深度洞察', () => {
      const now = Date.now()
      const orders = [
        makeOrder({ id: 'b1', symbol: 'A', direction: 'buy', price: 100, createdAt: now - 86400000 }),
        makeOrder({ id: 's1', symbol: 'A', direction: 'sell', price: 110, createdAt: now }),
      ]
      const classification = makeClassification([], 80)
      const summary = generateTradeSummary(orders, classification)
      const errorAnalysis = generateErrorAnalysis(classification, orders)
      const discipline = generateDisciplineAnalysis(orders, classification)
      const insight = generateAIDeepInsight(summary, errorAnalysis, discipline)

      expect(insight.pnlAttribution.length).toBeGreaterThan(0)
      expect(insight.dataPatterns.length).toBeGreaterThan(0)
      expect(insight.personalizedAdvice.length).toBeGreaterThan(0)
    })
  })
})
