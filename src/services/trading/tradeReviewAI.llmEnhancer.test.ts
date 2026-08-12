/**
 * @test_id V9-TEST-ST-120
 * @covers_docs [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-AI-017]
 */
import { describe, it, expect } from 'vitest'
import { buildAIDeepInsightPrompt, parseAIDeepInsightFromLlm } from './tradeReviewAI.llmEnhancer'
import type { TradeSummary, ErrorAnalysis, DisciplineAnalysis } from './tradeReviewAI.types'

function makeSummary(): TradeSummary {
  return {
    totalTrades: 10,
    profitableTrades: 6,
    losingTrades: 4,
    winRate: 60,
    profitLossRatio: 1.5,
    avgProfit: 5,
    avgLoss: 3.33,
    totalPnL: 10,
    totalPnLPercent: 10,
    disciplineScore: 75,
    totalErrors: 3,
  }
}

function makeErrorAnalysis(): ErrorAnalysis {
  return {
    topErrors: [
      { name: 'NO_STOP_LOSS', severity: 'critical', count: 2, psychologicalRoot: '损失厌恶' },
    ],
    errorTrend: '错误趋势稳定',
    psychologicalProfile: {
      primaryType: 'aggressive_type',
      name: '激进型',
      characteristics: ['仓位管理激进'],
      rootCause: '急功近利',
      improvementDirection: '严格执行仓位管理',
    },
    riskProfile: {
      riskAppetite: 'aggressive',
      maxDrawdown: 15,
      concentrationLevel: 'high',
      suggestions: ['控制仓位'],
    },
  }
}

function makeDiscipline(): DisciplineAnalysis {
  return {
    planAdherenceRate: 70,
    stopLossExecutionRate: 60,
    positionManagementScore: 50,
    emotionControlScore: 65,
    overallScore: 61,
    improvements: ['建立交易计划'],
  }
}

describe('tradeReviewAI.llmEnhancer', () => {
  describe('buildAIDeepInsightPrompt', () => {
    it('应生成包含系统消息和用户消息的 Prompt', () => {
      const summary = makeSummary()
      const errorAnalysis = makeErrorAnalysis()
      const discipline = makeDiscipline()
      const messages = buildAIDeepInsightPrompt(summary, errorAnalysis, discipline)

      expect(messages).toHaveLength(2)
      expect(messages[0]!.role).toBe('system')
      expect(messages[1]!.role).toBe('user')
    })

    it('用户消息应包含交易数据', () => {
      const summary = makeSummary()
      const errorAnalysis = makeErrorAnalysis()
      const discipline = makeDiscipline()
      const messages = buildAIDeepInsightPrompt(summary, errorAnalysis, discipline)

      expect(messages[1]!.content).toContain('胜率')
      expect(messages[1]!.content).toContain('盈亏比')
      expect(messages[1]!.content).toContain('心理画像')
    })
  })

  describe('parseAIDeepInsightFromLlm', () => {
    it('应正确解析 JSON 格式', () => {
      const content = JSON.stringify({
        pnlAttribution: ['盈亏归因1', '盈亏归因2'],
        dataPatterns: ['数据规律1'],
        personalizedAdvice: ['建议1'],
      })
      const result = parseAIDeepInsightFromLlm(content)

      expect(result.pnlAttribution).toHaveLength(2)
      expect(result.dataPatterns).toHaveLength(1)
      expect(result.personalizedAdvice).toHaveLength(1)
    })

    it('应处理 markdown 代码块格式', () => {
      const content = '```json\n{"pnlAttribution":["归因1"],"dataPatterns":[],"personalizedAdvice":[]}\n```'
      const result = parseAIDeepInsightFromLlm(content)

      expect(result.pnlAttribution).toHaveLength(1)
    })

    it('解析失败应返回空数组', () => {
      const content = 'invalid json'
      const result = parseAIDeepInsightFromLlm(content)

      expect(result.pnlAttribution).toEqual([])
      expect(result.dataPatterns).toEqual([])
      expect(result.personalizedAdvice).toEqual([])
    })

    it('应处理缺失字段', () => {
      const content = JSON.stringify({ pnlAttribution: ['归因1'] })
      const result = parseAIDeepInsightFromLlm(content)

      expect(result.pnlAttribution).toHaveLength(1)
      expect(result.dataPatterns).toEqual([])
      expect(result.personalizedAdvice).toEqual([])
    })
  })
})
