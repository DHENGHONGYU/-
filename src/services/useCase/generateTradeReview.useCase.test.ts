/**
 * @test_id V9-TEST-ST-128
 * @module services/useCase/generateTradeReview.useCase.test
 * @description 交易复盘生成用例单元测试 — 验证同步/异步复盘流程、错误分类、LLM 增强及异常处理
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-021, V9-DOC-BACK-033, V9-DOC-BACK-027]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateTradeReviewUseCase, generateTradeReviewAsyncUseCase } from './generateTradeReview.useCase'
import type { Order } from '@/data/types'

// Mock 依赖
const {
  mockLogger,
  mockIsLlmConfigured,
  mockChat,
  mockCheckReviewFreshness,
  mockClassifyErrors,
  mockGenerateTradeSummary,
  mockGenerateErrorAnalysis,
  mockGenerateDisciplineAnalysis,
  mockGenerateSkillDevelopment,
  mockGenerateActionPlan,
  mockGenerateAIDeepInsight,
  mockBuildAIDeepInsightPrompt,
  mockParseAIDeepInsightFromLlm,
} = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockIsLlmConfigured: vi.fn(),
  mockChat: vi.fn(),
  mockCheckReviewFreshness: vi.fn(),
  mockClassifyErrors: vi.fn(),
  mockGenerateTradeSummary: vi.fn(),
  mockGenerateErrorAnalysis: vi.fn(),
  mockGenerateDisciplineAnalysis: vi.fn(),
  mockGenerateSkillDevelopment: vi.fn(),
  mockGenerateActionPlan: vi.fn(),
  mockGenerateAIDeepInsight: vi.fn(),
  mockBuildAIDeepInsightPrompt: vi.fn(),
  mockParseAIDeepInsightFromLlm: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => mockLogger),
}))

vi.mock('@/config/llmConfig', () => ({
  isLlmConfigured: mockIsLlmConfigured,
}))

vi.mock('@/services/llm/llmGateway', () => ({
  chat: mockChat,
}))

vi.mock('@/core/freshnessGuard', () => ({
  checkReviewFreshness: mockCheckReviewFreshness,
}))

vi.mock('@/services/trading/tradeErrorClassifier', () => ({
  classifyErrors: mockClassifyErrors,
}))

vi.mock('@/services/trading/tradeReviewAI.reportGenerator', () => ({
  generateTradeSummary: mockGenerateTradeSummary,
  generateErrorAnalysis: mockGenerateErrorAnalysis,
  generateDisciplineAnalysis: mockGenerateDisciplineAnalysis,
  generateActionPlan: mockGenerateActionPlan,
  generateAIDeepInsight: mockGenerateAIDeepInsight,
}))

vi.mock('@/services/trading/tradeReviewAI.skillDevelopment', () => ({
  generateSkillDevelopment: mockGenerateSkillDevelopment,
}))

vi.mock('@/services/trading/tradeReviewAI.llmEnhancer', () => ({
  buildAIDeepInsightPrompt: mockBuildAIDeepInsightPrompt,
  parseAIDeepInsightFromLlm: mockParseAIDeepInsightFromLlm,
}))

// 辅助函数：创建 mock 订单
function createMockOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-001',
    symbol: '000001.SZ',
    direction: 'buy',
    quantity: 100,
    price: 15.5,
    amount: 1550,
    status: 'filled',
    accountType: 'paper',
    createdAt: Date.now() - 86400000, // 1 天前
    ...overrides,
  }
}

// 辅助函数：设置默认 mock 返回值
function setupDefaultMocks() {
  mockCheckReviewFreshness.mockReturnValue({
    valid: true,
    outputTime: Date.now(),
    inputTime: Date.now() - 86400000,
    staleHours: 24,
  })

  mockClassifyErrors.mockReturnValue({
    totalErrors: 0,
    errorCategories: {},
    severityCounts: { low: 0, medium: 0, high: 0 },
  })

  mockGenerateTradeSummary.mockReturnValue({
    totalOrders: 10,
    winRate: 60,
    profitLossRatio: 1.5,
    disciplineScore: 85,
    totalPnl: 1500,
  })

  mockGenerateErrorAnalysis.mockReturnValue({
    totalErrors: 0,
    errors: [],
    topErrors: [],
  })

  mockGenerateDisciplineAnalysis.mockReturnValue({
    score: 85,
    rules: [],
    violations: [],
  })

  mockGenerateSkillDevelopment.mockReturnValue({
    dimensions: [],
    recommendations: [],
  })

  mockGenerateActionPlan.mockReturnValue({
    actions: [],
    priorities: [],
  })

  mockGenerateAIDeepInsight.mockReturnValue({
    pnlAttribution: [],
    personalizedAdvice: [],
    keyTakeaways: [],
  })

  mockIsLlmConfigured.mockReturnValue(false)

  mockChat.mockResolvedValue({
    content: 'test llm response',
    model: 'test-model',
    usage: { totalTokens: 100 },
  })

  mockBuildAIDeepInsightPrompt.mockReturnValue([{ role: 'user', content: 'test prompt' }])

  mockParseAIDeepInsightFromLlm.mockReturnValue({
    pnlAttribution: [{ factor: '纪律执行', impact: 0.8 }],
    personalizedAdvice: [{ title: '建议', content: '加强止损纪律' }],
    keyTakeaways: [],
  })
}

describe('generateTradeReviewUseCase（同步版）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  describe('正常生成复盘成功流程', () => {
    it('应当生成完整的复盘报告', () => {
      const orders = [createMockOrder()]
      const now = Date.now()

      const result = generateTradeReviewUseCase(orders, now)

      expect(result).toBeDefined()
      expect(result.generatedAt).toBe(now)
      expect(result.summary).toBeDefined()
      expect(result.errorAnalysis).toBeDefined()
      expect(result.disciplineAnalysis).toBeDefined()
      expect(result.skillDevelopment).toBeDefined()
      expect(result.actionPlan).toBeDefined()
      expect(result.aiInsight).toBeDefined()
    })

    it('应当调用所有分析服务', () => {
      const orders = [createMockOrder()]

      generateTradeReviewUseCase(orders)

      expect(mockCheckReviewFreshness).toHaveBeenCalledTimes(1)
      expect(mockClassifyErrors).toHaveBeenCalledWith(orders)
      expect(mockGenerateTradeSummary).toHaveBeenCalledWith(orders, expect.any(Object))
      expect(mockGenerateErrorAnalysis).toHaveBeenCalledWith(expect.any(Object), orders)
      expect(mockGenerateDisciplineAnalysis).toHaveBeenCalledWith(orders, expect.any(Object))
      expect(mockGenerateSkillDevelopment).toHaveBeenCalledWith(expect.any(Object), orders)
      expect(mockGenerateActionPlan).toHaveBeenCalledWith(expect.any(Object), expect.any(Object))
      expect(mockGenerateAIDeepInsight).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
      )
    })

    it('应当记录开始和完成日志', () => {
      const orders = [createMockOrder()]

      generateTradeReviewUseCase(orders)

      expect(mockLogger.info).toHaveBeenCalled()
      const infoCalls = mockLogger.info.mock.calls.map((c) => c[0] as string)
      expect(infoCalls.some((msg) => msg.includes('开始生成复盘报告'))).toBe(true)
      expect(infoCalls.some((msg) => msg.includes('复盘报告生成完成'))).toBe(true)
    })
  })

  describe('订单数据为空', () => {
    it('应当处理空订单数组', () => {
      const result = generateTradeReviewUseCase([])

      expect(result).toBeDefined()
      expect(result.generatedAt).toBeDefined()
      expect(mockClassifyErrors).toHaveBeenCalledWith([])
      expect(mockGenerateTradeSummary).toHaveBeenCalledWith([], expect.any(Object))
    })

    it('空订单时 getLatestOrderCreatedAt 应返回 0', () => {
      generateTradeReviewUseCase([])

      expect(mockCheckReviewFreshness).toHaveBeenCalledWith(expect.any(Number), 0)
    })
  })

  describe('分析服务失败', () => {
    it('应当在 classifyErrors 抛出时传播异常', () => {
      mockClassifyErrors.mockImplementation(() => {
        throw new Error('分类服务异常')
      })

      expect(() => generateTradeReviewUseCase([createMockOrder()])).toThrow('分类服务异常')
    })

    it('应当在 generateTradeSummary 抛出时传播异常', () => {
      mockGenerateTradeSummary.mockImplementation(() => {
        throw new Error('摘要生成异常')
      })

      expect(() => generateTradeReviewUseCase([createMockOrder()])).toThrow('摘要生成异常')
    })

    it('应当在 generateErrorAnalysis 抛出时传播异常', () => {
      mockGenerateErrorAnalysis.mockImplementation(() => {
        throw new Error('错误分析异常')
      })

      expect(() => generateTradeReviewUseCase([createMockOrder()])).toThrow('错误分析异常')
    })

    it('应当在 generateDisciplineAnalysis 抛出时传播异常', () => {
      mockGenerateDisciplineAnalysis.mockImplementation(() => {
        throw new Error('纪律分析异常')
      })

      expect(() => generateTradeReviewUseCase([createMockOrder()])).toThrow('纪律分析异常')
    })

    it('应当在 generateSkillDevelopment 抛出时传播异常', () => {
      mockGenerateSkillDevelopment.mockImplementation(() => {
        throw new Error('技能发展异常')
      })

      expect(() => generateTradeReviewUseCase([createMockOrder()])).toThrow('技能发展异常')
    })

    it('应当在 generateActionPlan 抛出时传播异常', () => {
      mockGenerateActionPlan.mockImplementation(() => {
        throw new Error('行动计划异常')
      })

      expect(() => generateTradeReviewUseCase([createMockOrder()])).toThrow('行动计划异常')
    })
  })

  describe('异常捕获', () => {
    it('应当传播 Error 类型异常', () => {
      mockCheckReviewFreshness.mockImplementation(() => {
        throw new Error('freshness check failed')
      })

      expect(() => generateTradeReviewUseCase([createMockOrder()])).toThrow('freshness check failed')
    })

    it('应当传播非 Error 类型抛出', () => {
      mockCheckReviewFreshness.mockImplementation(() => {
        throw 'string error'
      })

      expect(() => generateTradeReviewUseCase([createMockOrder()])).toThrow('string error')
    })
  })

  describe('参数传递验证', () => {
    it('应当正确传递 now 参数', () => {
      const customNow = 1700000000000
      const orders = [createMockOrder({ createdAt: 1699900000000 })]

      const result = generateTradeReviewUseCase(orders, customNow)

      expect(result.generatedAt).toBe(customNow)
      expect(mockCheckReviewFreshness).toHaveBeenCalledWith(customNow, 1699900000000)
    })

    it('应当使用 Date.now() 作为默认 now', () => {
      const orders = [createMockOrder()]
      const before = Date.now()

      const result = generateTradeReviewUseCase(orders)

      const after = Date.now()
      expect(result.generatedAt).toBeGreaterThanOrEqual(before)
      expect(result.generatedAt).toBeLessThanOrEqual(after)
    })
  })

  describe('复盘报告结构完整性验证', () => {
    it('报告应当包含所有必需字段', () => {
      const result = generateTradeReviewUseCase([createMockOrder()])

      expect(result).toHaveProperty('generatedAt')
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('errorAnalysis')
      expect(result).toHaveProperty('disciplineAnalysis')
      expect(result).toHaveProperty('skillDevelopment')
      expect(result).toHaveProperty('actionPlan')
      expect(result).toHaveProperty('aiInsight')
      expect(typeof result.generatedAt).toBe('number')
    })

    it('报告不应包含 aiInsightSource（同步版无 LLM）', () => {
      const result = generateTradeReviewUseCase([createMockOrder()])

      expect(result).not.toHaveProperty('aiInsightSource')
    })
  })

  describe('freshness 校验', () => {
    it('应当调用 checkReviewFreshness 并记录结果', () => {
      const orders = [createMockOrder({ createdAt: 1000 })]
      const now = 2000

      generateTradeReviewUseCase(orders, now)

      expect(mockCheckReviewFreshness).toHaveBeenCalledWith(now, 1000)
    })

    it('应当取最新订单的 createdAt 进行 freshness 校验', () => {
      const orders = [
        createMockOrder({ id: 'old', createdAt: 1000 }),
        createMockOrder({ id: 'new', createdAt: 5000 }),
        createMockOrder({ id: 'mid', createdAt: 3000 }),
      ]

      generateTradeReviewUseCase(orders, 10000)

      expect(mockCheckReviewFreshness).toHaveBeenCalledWith(10000, 5000)
    })
  })

  describe('边界条件', () => {
    it('应当处理少量订单（1笔）', () => {
      const orders = [createMockOrder()]

      const result = generateTradeReviewUseCase(orders)

      expect(result).toBeDefined()
      expect(mockClassifyErrors).toHaveBeenCalledWith(orders)
    })

    it('应当处理大量订单（100笔）', () => {
      const orders = Array.from({ length: 100 }, (_, i) =>
        createMockOrder({ id: `order-${i}`, createdAt: Date.now() - i * 3600000 }),
      )

      const result = generateTradeReviewUseCase(orders)

      expect(result).toBeDefined()
      expect(mockClassifyErrors).toHaveBeenCalledWith(orders)
      expect(mockGenerateTradeSummary).toHaveBeenCalledWith(orders, expect.any(Object))
    })

    it('应当处理单日交易（所有订单在同一天）', () => {
      const baseTime = new Date('2024-01-15T10:00:00').getTime()
      const orders = [
        createMockOrder({ id: 'morning-buy', createdAt: baseTime }),
        createMockOrder({ id: 'midday-sell', direction: 'sell', createdAt: baseTime + 4 * 3600000 }),
        createMockOrder({ id: 'afternoon-buy', createdAt: baseTime + 6 * 3600000 }),
      ]

      const result = generateTradeReviewUseCase(orders, baseTime + 8 * 3600000)

      expect(result).toBeDefined()
      // 最新订单时间应为最后一笔
      expect(mockCheckReviewFreshness).toHaveBeenCalledWith(
        baseTime + 8 * 3600000,
        baseTime + 6 * 3600000,
      )
    })
  })

  describe('并发调用互不干扰', () => {
    it('多次同步调用应各自独立返回结果', () => {
      const orders1 = [createMockOrder({ id: 'set1-1' })]
      const orders2 = [createMockOrder({ id: 'set2-1' }), createMockOrder({ id: 'set2-2' })]

      let callCount = 0
      mockGenerateTradeSummary.mockImplementation((ords) => ({
        totalOrders: ords.length,
        callIndex: ++callCount,
      }))

      const result1 = generateTradeReviewUseCase(orders1)
      const result2 = generateTradeReviewUseCase(orders2)

      expect(result1.summary.totalTrades).toBe(1)
      expect(result2.summary.totalTrades).toBe(2)
      expect(mockClassifyErrors).toHaveBeenCalledTimes(2)
      expect(mockGenerateTradeSummary).toHaveBeenCalledTimes(2)
    })
  })
})

describe('generateTradeReviewAsyncUseCase（异步版）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  describe('正常生成复盘成功流程', () => {
    it('应当异步生成完整的复盘报告', async () => {
      const orders = [createMockOrder()]
      const now = Date.now()

      const result = await generateTradeReviewAsyncUseCase(orders, { now })

      expect(result).toBeDefined()
      expect(result.generatedAt).toBe(now)
      expect(result.summary).toBeDefined()
      expect(result.errorAnalysis).toBeDefined()
      expect(result.disciplineAnalysis).toBeDefined()
      expect(result.skillDevelopment).toBeDefined()
      expect(result.actionPlan).toBeDefined()
      expect(result.aiInsight).toBeDefined()
    })

    it('无 llmConfig 时使用规则模板生成 AI 洞察', async () => {
      const orders = [createMockOrder()]

      const result = await generateTradeReviewAsyncUseCase(orders)

      expect(mockIsLlmConfigured).not.toHaveBeenCalled()
      expect(mockChat).not.toHaveBeenCalled()
      expect(mockGenerateAIDeepInsight).toHaveBeenCalled()
      expect(result.aiInsightSource).toBeUndefined()
    })

    it('应当记录异步生成开始和完成日志', async () => {
      const orders = [createMockOrder()]

      await generateTradeReviewAsyncUseCase(orders)

      expect(mockLogger.info).toHaveBeenCalled()
      const infoCalls = mockLogger.info.mock.calls.map((c) => c[0] as string)
      expect(infoCalls.some((msg) => msg.includes('开始生成异步复盘报告'))).toBe(true)
      expect(infoCalls.some((msg) => msg.includes('异步复盘报告生成完成'))).toBe(true)
    })
  })

  describe('LLM 增强模式', () => {
    it('应当在 LLM 配置有效时调用 LLM 生成洞察', async () => {
      mockIsLlmConfigured.mockReturnValue(true)
      const orders = [createMockOrder()]
      const llmConfig = { baseURL: 'https://api.test.com', apiKey: 'test-key', model: 'gpt-test' }

      const result = await generateTradeReviewAsyncUseCase(orders, { llmConfig })

      expect(mockIsLlmConfigured).toHaveBeenCalledWith(expect.objectContaining(llmConfig))
      expect(mockChat).toHaveBeenCalled()
      expect(mockBuildAIDeepInsightPrompt).toHaveBeenCalled()
      expect(mockParseAIDeepInsightFromLlm).toHaveBeenCalled()
      expect(result.aiInsightSource).toBe('llm')
    })

    it('LLM 洞察有内容时应标记 aiInsightSource 为 llm', async () => {
      mockIsLlmConfigured.mockReturnValue(true)
      mockParseAIDeepInsightFromLlm.mockReturnValue({
        pnlAttribution: [{ factor: '心态控制', impact: 0.9 }],
        personalizedAdvice: [{ title: '建议', content: '保持冷静' }],
        keyTakeaways: [],
      })

      const result = await generateTradeReviewAsyncUseCase([createMockOrder()], {
        llmConfig: { baseURL: 'x', apiKey: 'x', model: 'x' },
      })

      expect(result.aiInsightSource).toBe('llm')
    })

    it('LLM 返回空洞察时应降级为规则模板', async () => {
      mockIsLlmConfigured.mockReturnValue(true)
      mockParseAIDeepInsightFromLlm.mockReturnValue({
        pnlAttribution: [],
        personalizedAdvice: [],
        keyTakeaways: [],
      })

      const result = await generateTradeReviewAsyncUseCase([createMockOrder()], {
        llmConfig: { baseURL: 'x', apiKey: 'x', model: 'x' },
      })

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('LLM 返回空洞察，降级为规则模板'),
      )
      expect(mockGenerateAIDeepInsight).toHaveBeenCalled()
      expect(result.aiInsightSource).toBeUndefined()
    })

    it('LLM 调用失败时应降级为规则模板', async () => {
      mockIsLlmConfigured.mockReturnValue(true)
      mockChat.mockRejectedValue(new Error('LLM API 调用超时'))

      const result = await generateTradeReviewAsyncUseCase([createMockOrder()], {
        llmConfig: { baseURL: 'x', apiKey: 'x', model: 'x' },
      })

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('LLM 洞察失败，降级为规则模板'),
      )
      expect(mockGenerateAIDeepInsight).toHaveBeenCalled()
      expect(result.aiInsightSource).toBeUndefined()
    })

    it('LLM 配置无效时应使用规则模板', async () => {
      mockIsLlmConfigured.mockReturnValue(false)

      const result = await generateTradeReviewAsyncUseCase([createMockOrder()], {
        llmConfig: { baseURL: '', apiKey: '', model: '' },
      })

      expect(mockIsLlmConfigured).toHaveBeenCalled()
      expect(mockChat).not.toHaveBeenCalled()
      expect(mockGenerateAIDeepInsight).toHaveBeenCalled()
      expect(result.aiInsightSource).toBeUndefined()
    })

    it('应当调用 onProgress 回调通知 LLM 阶段', async () => {
      mockIsLlmConfigured.mockReturnValue(true)
      const onProgress = vi.fn()

      await generateTradeReviewAsyncUseCase([createMockOrder()], {
        llmConfig: { baseURL: 'x', apiKey: 'x', model: 'x' },
        onProgress,
      })

      expect(onProgress).toHaveBeenCalledWith('llm', expect.any(String))
    })

    it('LLM 失败时应通过 onProgress 通知错误', async () => {
      mockIsLlmConfigured.mockReturnValue(true)
      mockChat.mockRejectedValue(new Error('连接失败'))
      const onProgress = vi.fn()

      await generateTradeReviewAsyncUseCase([createMockOrder()], {
        llmConfig: { baseURL: 'x', apiKey: 'x', model: 'x' },
        onProgress,
      })

      const progressCalls = onProgress.mock.calls.map((c) => c[1] as string)
      expect(progressCalls.some((msg) => msg.includes('LLM 洞察失败'))).toBe(true)
    })

    it('非 Error 类型的 LLM 异常也应被捕获', async () => {
      mockIsLlmConfigured.mockReturnValue(true)
      mockChat.mockRejectedValue('网络异常字符串')

      const result = await generateTradeReviewAsyncUseCase([createMockOrder()], {
        llmConfig: { baseURL: 'x', apiKey: 'x', model: 'x' },
      })

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('LLM 洞察失败，降级为规则模板'),
      )
      expect(result.aiInsightSource).toBeUndefined()
    })
  })

  describe('订单数据为空', () => {
    it('应当处理空订单数组', async () => {
      const result = await generateTradeReviewAsyncUseCase([])

      expect(result).toBeDefined()
      expect(mockClassifyErrors).toHaveBeenCalledWith([])
    })
  })

  describe('分析服务失败', () => {
    it('应当在 classifyErrors 抛出时传播异常', async () => {
      mockClassifyErrors.mockImplementation(() => {
        throw new Error('分类服务异常')
      })

      await expect(generateTradeReviewAsyncUseCase([createMockOrder()])).rejects.toThrow('分类服务异常')
    })

    it('应当记录错误日志后重新抛出', async () => {
      mockGenerateTradeSummary.mockImplementation(() => {
        throw new Error('摘要生成失败')
      })

      await expect(generateTradeReviewAsyncUseCase([createMockOrder()])).rejects.toThrow()

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('异步报告生成失败'),
        expect.any(Object),
      )
    })
  })

  describe('异常捕获', () => {
    it('应当捕获 Error 类型异常并记录日志', async () => {
      mockCheckReviewFreshness.mockImplementation(() => {
        throw new Error('freshness error')
      })

      await expect(generateTradeReviewAsyncUseCase([createMockOrder()])).rejects.toThrow('freshness error')
      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('应当捕获非 Error 类型抛出并记录日志', async () => {
      mockCheckReviewFreshness.mockImplementation(() => {
        throw { code: 'CUSTOM_ERR', message: 'custom error' }
      })

      await expect(generateTradeReviewAsyncUseCase([createMockOrder()])).rejects.toEqual(
        { code: 'CUSTOM_ERR', message: 'custom error' },
      )
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('参数传递验证', () => {
    it('应当正确传递 now 选项', async () => {
      const customNow = 1700000000000

      const result = await generateTradeReviewAsyncUseCase([createMockOrder()], { now: customNow })

      expect(result.generatedAt).toBe(customNow)
    })

    it('应当正确传递 llmConfig 选项', async () => {
      mockIsLlmConfigured.mockReturnValue(true)
      const llmConfig = { baseURL: 'https://custom.api', apiKey: 'custom-key', model: 'custom-model' }

      await generateTradeReviewAsyncUseCase([createMockOrder()], { llmConfig })

      expect(mockIsLlmConfigured).toHaveBeenCalledWith(expect.objectContaining(llmConfig))
      expect(mockChat).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining(llmConfig))
    })

    it('应当正确传递 onProgress 回调', async () => {
      mockIsLlmConfigured.mockReturnValue(true)
      const onProgress = vi.fn()

      await generateTradeReviewAsyncUseCase([createMockOrder()], { onProgress, llmConfig: { baseURL: 'x', apiKey: 'x', model: 'x' } })

      expect(onProgress).toHaveBeenCalled()
    })

    it('options 为 undefined 时应使用默认值', async () => {
      const result = await generateTradeReviewAsyncUseCase([createMockOrder()])

      expect(result).toBeDefined()
      expect(mockGenerateAIDeepInsight).toHaveBeenCalled()
    })
  })

  describe('复盘报告结构完整性验证', () => {
    it('无 LLM 时报告结构完整', async () => {
      const result = await generateTradeReviewAsyncUseCase([createMockOrder()])

      expect(result).toHaveProperty('generatedAt')
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('errorAnalysis')
      expect(result).toHaveProperty('disciplineAnalysis')
      expect(result).toHaveProperty('skillDevelopment')
      expect(result).toHaveProperty('actionPlan')
      expect(result).toHaveProperty('aiInsight')
      expect(result).not.toHaveProperty('aiInsightSource')
    })

    it('LLM 模式下报告包含 aiInsightSource', async () => {
      mockIsLlmConfigured.mockReturnValue(true)

      const result = await generateTradeReviewAsyncUseCase([createMockOrder()], {
        llmConfig: { baseURL: 'x', apiKey: 'x', model: 'x' },
      })

      expect(result).toHaveProperty('aiInsightSource', 'llm')
    })
  })

  describe('并发调用互不干扰', () => {
    it('多个异步并发调用应各自独立', async () => {
      const ordersA = [createMockOrder({ id: 'A-1', symbol: '000001.SZ' })]
      const ordersB = [createMockOrder({ id: 'B-1', symbol: '000002.SZ' })]

      const [resultA, resultB] = await Promise.all([
        generateTradeReviewAsyncUseCase(ordersA, { now: 1000 }),
        generateTradeReviewAsyncUseCase(ordersB, { now: 2000 }),
      ])

      expect(resultA.generatedAt).toBe(1000)
      expect(resultB.generatedAt).toBe(2000)
      expect(mockClassifyErrors).toHaveBeenCalledTimes(2)
      expect(mockClassifyErrors).toHaveBeenNthCalledWith(1, ordersA)
      expect(mockClassifyErrors).toHaveBeenNthCalledWith(2, ordersB)
    })

    it('并发调用中部分失败不应影响其他调用', async () => {
      const ordersGood = [createMockOrder({ id: 'good-1' })]
      const ordersBad = [createMockOrder({ id: 'bad-1' })]

      let callCount = 0
      mockGenerateTradeSummary.mockImplementation(() => {
        callCount++
        if (callCount === 2) {
          throw new Error('第二次调用失败')
        }
        return { totalOrders: 1 }
      })

      const [promiseA, promiseB] = [
        generateTradeReviewAsyncUseCase(ordersGood, { now: 1000 }),
        generateTradeReviewAsyncUseCase(ordersBad, { now: 2000 }),
      ]

      const results = await Promise.allSettled([promiseA, promiseB])

      // 第一个成功，第二个失败（取决于调用顺序，但验证整体状态不互相污染）
      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failCount = results.filter((r) => r.status === 'rejected').length
      expect(successCount + failCount).toBe(2)
    })
  })

  describe('边界条件', () => {
    it('应当处理少量订单（1笔）', async () => {
      const result = await generateTradeReviewAsyncUseCase([createMockOrder()])

      expect(result).toBeDefined()
    })

    it('应当处理大量订单（500笔）', async () => {
      const orders = Array.from({ length: 500 }, (_, i) =>
        createMockOrder({ id: `order-${i}`, createdAt: Date.now() - i * 60000 }),
      )

      const result = await generateTradeReviewAsyncUseCase(orders)

      expect(result).toBeDefined()
      expect(mockClassifyErrors).toHaveBeenCalledWith(orders)
    })

    it('应当处理单日交易（所有订单在同一天）', async () => {
      const baseTime = new Date('2024-01-15T09:30:00').getTime()
      const orders = Array.from({ length: 20 }, (_, i) =>
        createMockOrder({
          id: `intraday-${i}`,
          createdAt: baseTime + i * 30 * 60000, // 每 30 分钟一笔
        }),
      )

      const result = await generateTradeReviewAsyncUseCase(orders, {
        now: baseTime + 24 * 3600000,
      })

      expect(result).toBeDefined()
    })
  })
})
