/**
 * @test_id V9-TEST-ST-128
 * @module services/useCase/runDualStrategy.useCase.test
 * @description 双策略执行用例单元测试 — 验证双策略编排、结果合并、异常处理等场景
 * @covers_docs [V9-DOC-BACK-003, V9-DOC-BACK-006, V9-DOC-ARCH-008, V9-DOC-BACK-010, V9-DOC-DATA-021]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runDualStrategyUseCase } from './runDualStrategy.useCase'
import type { Stock, HotSectorScore, ValuePitScore } from '@/data/types'

// Mock 依赖
const {
  mockAnalyzeHotSectors,
  mockAnalyzeValuePits,
  mockDetectBySector,
  mockGenerateId,
  mockGetLogger,
  mockGetDefaultDualStrategyRuleConfig,
} = vi.hoisted(() => ({
  mockAnalyzeHotSectors: vi.fn(),
  mockAnalyzeValuePits: vi.fn(),
  mockDetectBySector: vi.fn(),
  mockGenerateId: vi.fn(),
  mockGetLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  mockGetDefaultDualStrategyRuleConfig: vi.fn(),
}))

vi.mock('@/config/dualStrategyRules', () => ({
  getDefaultDualStrategyRuleConfig: mockGetDefaultDualStrategyRuleConfig,
  DEFAULT_DUAL_STRATEGY_RULE_CONFIG: {
    hotSectorV6Min: 3.5,
    hotSectorImmediateThreshold: 4.0,
    hotSectorProbeThreshold: 3.5,
    valuePitImmediateThreshold: 4.0,
    valuePitProbeThreshold: 3.5,
    valuePitWaitThreshold: 3.0,
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: mockGetLogger,
}))

vi.mock('@/lib/utils', () => ({
  generateId: mockGenerateId,
}))

vi.mock('@/services/scoring/hotSectorAnalyzer', () => ({
  analyzeHotSectors: mockAnalyzeHotSectors,
}))

vi.mock('@/services/scoring/valuePitAnalyzer', () => ({
  analyzeValuePits: mockAnalyzeValuePits,
}))

vi.mock('@/services/scoring/rotationSignalDetector', () => ({
  detectBySector: mockDetectBySector,
}))

describe('runDualStrategyUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置默认 mock 实现
    mockGetLogger.mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })
    mockGetDefaultDualStrategyRuleConfig.mockReturnValue({
      hotSectorV6Min: 3.5,
      hotSectorImmediateThreshold: 4.0,
      hotSectorProbeThreshold: 3.5,
      valuePitImmediateThreshold: 4.0,
      valuePitProbeThreshold: 3.5,
      valuePitWaitThreshold: 3.0,
    })
    mockGenerateId.mockReturnValue('gen-id-001')
    mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
    mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [] })
    mockDetectBySector.mockResolvedValue({ triggered: false })
  })

  // 测试数据
  const mockStocks: Stock[] = [
    { symbol: '000001.SZ', name: '平安银行', price: 12.5 },
    { symbol: '600519.SH', name: '贵州茅台', price: 1800.0 },
  ] as Stock[]

  const mockHotScores: HotSectorScore[] = [
    {
      symbol: '000001.SZ',
      name: '银行板块',
      score: 4.2,
      dimensions: { momentum: 0.8, sentiment: 0.7, technical: 0.9, valuation: 0.6, composite: 4.2 },
      action: 'immediate',
      calculatedAt: Date.now(),
      dataVersion: 1,
    },
  ]

  const mockPitScores: ValuePitScore[] = [
    {
      symbol: '600519.SH',
      name: '白酒板块',
      score: 3.8,
      dimensions: { catalyst: 0.7, valuation: 0.8, chip: 0.6, rotation: 0.5, liquidity: 0.7, composite: 3.8 },
      rotationSignal: false,
      action: 'probe',
      calculatedAt: Date.now(),
      dataVersion: 1,
    },
  ]

  describe('正常成功流程', () => {
    it('应当成功执行双策略并返回合并结果', async () => {
      // 准备
      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: mockHotScores })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: mockPitScores })
      mockDetectBySector.mockResolvedValue({ triggered: false })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.hotSectorScores).toHaveLength(1)
      expect(result.data!.valuePitScores).toHaveLength(1)
      expect(result.data!.summary.total).toBe(2)
      expect(result.data!.summary.hotSectorCount).toBe(1)
      expect(result.data!.summary.valuePitCount).toBe(1)
    })

    it('应当正确传递 ruleConfig 参数给两个分析器', async () => {
      // 准备
      const customConfig = {
        hotSectorV6Min: 4.0,
        hotSectorImmediateThreshold: 4.5,
        hotSectorProbeThreshold: 4.0,
        valuePitV6Min: 2.8,
        valuePitV6Max: 3.5,
        valuePitImmediateThreshold: 4.5,
        valuePitProbeThreshold: 4.0,
        valuePitWaitThreshold: 3.5,
        rotationVolumeSurgeRatio: 1.5,
        rotationFundFlowConsecutiveDays: 2,
        rotationPriceToMA20Threshold: 0.03,
        hotSectorStopLossPct: -0.08,
        hotSectorTakeProfitPct: 0.15,
        hotSectorTakeProfitSellRatio: 0.5,
        valuePitStopLossPct: -0.15,
        valuePitTakeProfitPct: 0.2,
        valuePitTakeProfitSellRatio: 0.3,
      }

      // 执行
      await runDualStrategyUseCase({ stocks: mockStocks, ruleConfig: customConfig })

      // 验证
      expect(mockAnalyzeHotSectors).toHaveBeenCalledWith(
        mockStocks,
        expect.objectContaining({ ruleConfig: customConfig }),
      )
      expect(mockAnalyzeValuePits).toHaveBeenCalledWith(
        mockStocks,
        expect.objectContaining({ ruleConfig: customConfig }),
      )
    })

    it('应当使用默认配置当 ruleConfig 未提供时', async () => {
      // 准备
      const defaultConfig = {
        hotSectorV6Min: 3.5,
        hotSectorImmediateThreshold: 4.0,
        hotSectorProbeThreshold: 3.5,
        valuePitImmediateThreshold: 4.0,
        valuePitProbeThreshold: 3.5,
        valuePitWaitThreshold: 3.0,
      }

      // 执行
      await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证
      expect(mockGetDefaultDualStrategyRuleConfig).toHaveBeenCalled()
      expect(mockAnalyzeHotSectors).toHaveBeenCalledWith(
        mockStocks,
        expect.objectContaining({ ruleConfig: defaultConfig }),
      )
    })
  })

  describe('策略A成功、策略B失败', () => {
    it('应当处理热门板块成功而价值洼地失败的情况', async () => {
      // 准备：热门板块成功，价值洼地返回 success: false
      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: mockHotScores })
      mockAnalyzeValuePits.mockResolvedValue({ success: false, data: undefined, error: '价值洼地分析失败' })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证
      expect(result.success).toBe(true)
      expect(result.data!.hotSectorScores).toHaveLength(1)
      expect(result.data!.valuePitScores).toHaveLength(0) // 失败时 data 为 undefined，回退到空数组
      expect(result.data!.summary.hotSectorCount).toBe(1)
      expect(result.data!.summary.valuePitCount).toBe(0)
      expect(result.data!.signals).toHaveLength(0)
    })
  })

  describe('策略A失败、策略B成功', () => {
    it('应当处理热门板块失败而价值洼地成功的情况', async () => {
      // 准备：热门板块失败，价值洼地成功
      mockAnalyzeHotSectors.mockResolvedValue({ success: false, data: undefined, error: '热门板块分析失败' })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: mockPitScores })
      mockDetectBySector.mockResolvedValue({ triggered: false })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证
      expect(result.success).toBe(true)
      expect(result.data!.hotSectorScores).toHaveLength(0) // 失败时回退到空数组
      expect(result.data!.valuePitScores).toHaveLength(1)
      expect(result.data!.summary.hotSectorCount).toBe(0)
      expect(result.data!.summary.valuePitCount).toBe(1)
    })
  })

  describe('两个策略都失败', () => {
    it('应当处理两个策略都失败的情况', async () => {
      // 准备
      mockAnalyzeHotSectors.mockResolvedValue({ success: false, data: undefined, error: '热门板块失败' })
      mockAnalyzeValuePits.mockResolvedValue({ success: false, data: undefined, error: '价值洼地失败' })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证
      expect(result.success).toBe(true)
      expect(result.data!.hotSectorScores).toHaveLength(0)
      expect(result.data!.valuePitScores).toHaveLength(0)
      expect(result.data!.signals).toHaveLength(0)
      expect(result.data!.watchlistCandidates).toHaveLength(0)
      expect(result.data!.summary.total).toBe(2)
      expect(result.data!.summary.signalCount).toBe(0)
      expect(result.data!.summary.watchlistCount).toBe(0)
    })
  })

  describe('输入参数验证', () => {
    it('应当返回空结果当 stocks 为空数组时', async () => {
      // 执行
      const result = await runDualStrategyUseCase({ stocks: [] })

      // 验证
      expect(result.success).toBe(true)
      expect(result.data!.hotSectorScores).toHaveLength(0)
      expect(result.data!.valuePitScores).toHaveLength(0)
      expect(result.data!.signals).toHaveLength(0)
      expect(result.data!.watchlistCandidates).toHaveLength(0)
      expect(result.data!.summary.total).toBe(0)
      expect(result.data!.summary.hotSectorCount).toBe(0)
      expect(result.data!.summary.valuePitCount).toBe(0)
      expect(result.data!.summary.signalCount).toBe(0)
      expect(result.data!.summary.watchlistCount).toBe(0)

      // 验证：空数组时不调用分析器
      expect(mockAnalyzeHotSectors).not.toHaveBeenCalled()
      expect(mockAnalyzeValuePits).not.toHaveBeenCalled()
    })
  })

  describe('异常捕获', () => {
    it('应当捕获热门板块分析器抛出的异常', async () => {
      // 准备
      mockAnalyzeHotSectors.mockRejectedValue(new Error('热门板块分析器内部错误'))
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: mockPitScores })

      // 执行 & 验证
      await expect(runDualStrategyUseCase({ stocks: mockStocks })).rejects.toThrow('热门板块分析器内部错误')
    })

    it('应当捕获价值洼地分析器抛出的异常', async () => {
      // 准备
      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: mockHotScores })
      mockAnalyzeValuePits.mockRejectedValue(new Error('价值洼地分析器内部错误'))

      // 执行 & 验证
      await expect(runDualStrategyUseCase({ stocks: mockStocks })).rejects.toThrow('价值洼地分析器内部错误')
    })

    it('应当捕获轮动信号检测器抛出的异常', async () => {
      // 准备
      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: mockPitScores })
      mockDetectBySector.mockRejectedValue(new Error('轮动信号检测器错误'))

      // 执行 & 验证
      await expect(runDualStrategyUseCase({ stocks: mockStocks })).rejects.toThrow('轮动信号检测器错误')
    })
  })

  describe('结果合并逻辑验证', () => {
    it('应当正确生成轮动信号触发的买入信号', async () => {
      // 准备：有 probe 状态的价值洼地评分，且轮动信号触发
      const probeScore: ValuePitScore = {
        symbol: '600519.SH',
        name: '白酒板块',
        score: 3.8,
        dimensions: { catalyst: 0.7, valuation: 0.8, chip: 0.6, rotation: 0.5, liquidity: 0.7, composite: 3.8 },
        rotationSignal: false,
        action: 'probe',
        calculatedAt: Date.now(),
        dataVersion: 1,
      }

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [probeScore] })
      mockDetectBySector.mockResolvedValue({ triggered: true })
      mockGenerateId.mockReturnValue('sig-rot-001')

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证：生成买入信号
      expect(result.data!.signals).toHaveLength(1)
      expect(result.data!.signals[0]!.type).toBe('buy_rotation')
      expect(result.data!.signals[0]!.direction).toBe('buy')
      expect(result.data!.signals[0]!.symbol).toBe('600519.SH')
      expect(result.data!.signals[0]!.strategy).toBe('dual')
      expect(result.data!.signals[0]!.id).toBe('sig-rot-001')

      // 验证：置信度计算
      const expectedConfidence = Math.min(0.9, 0.5 + 3.8 / 10)
      expect(result.data!.signals[0]!.confidence).toBeCloseTo(expectedConfidence, 5)
    })

    it('应当正确生成 wait 状态的观察列表候选', async () => {
      // 准备：有 wait 状态的价值洼地评分，且轮动信号未触发
      const waitScore: ValuePitScore = {
        symbol: '600519.SH',
        name: '白酒板块',
        score: 3.2,
        dimensions: { catalyst: 0.6, valuation: 0.7, chip: 0.5, rotation: 0.4, liquidity: 0.6, composite: 3.2 },
        rotationSignal: false,
        action: 'wait',
        calculatedAt: Date.now(),
        dataVersion: 1,
      }

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [waitScore] })
      mockDetectBySector.mockResolvedValue({ triggered: false })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证：生成观察列表候选
      expect(result.data!.watchlistCandidates).toHaveLength(1)
      expect(result.data!.watchlistCandidates[0]!.symbol).toBe('600519.SH')
      expect(result.data!.watchlistCandidates[0]!.reason).toContain('轮动信号尚未触发')

      // 验证：不生成买入信号
      expect(result.data!.signals).toHaveLength(0)
    })

    it('应当将 wait + 轮动触发的标的转为买入信号', async () => {
      // 准备：wait 状态 + 轮动触发
      const waitScore: ValuePitScore = {
        symbol: '600519.SH',
        name: '白酒板块',
        score: 3.2,
        dimensions: { catalyst: 0.6, valuation: 0.7, chip: 0.5, rotation: 0.4, liquidity: 0.6, composite: 3.2 },
        rotationSignal: false,
        action: 'wait',
        calculatedAt: Date.now(),
        dataVersion: 1,
      }

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [waitScore] })
      mockDetectBySector.mockResolvedValue({ triggered: true })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证：生成买入信号，不加入观察列表
      expect(result.data!.signals).toHaveLength(1)
      expect(result.data!.signals[0]!.type).toBe('buy_rotation')
      expect(result.data!.watchlistCandidates).toHaveLength(0)
    })

    it('应当忽略 ignore 状态的价值洼地评分', async () => {
      // 准备：ignore 状态的评分
      const ignoreScore: ValuePitScore = {
        symbol: '000001.SZ',
        name: '银行板块',
        score: 2.0,
        dimensions: { catalyst: 0.3, valuation: 0.4, chip: 0.2, rotation: 0.3, liquidity: 0.4, composite: 2.0 },
        rotationSignal: false,
        action: 'ignore',
        calculatedAt: Date.now(),
        dataVersion: 1,
      }

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [ignoreScore] })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证：不调用轮动检测器，不生成信号和观察列表
      expect(mockDetectBySector).not.toHaveBeenCalled()
      expect(result.data!.signals).toHaveLength(0)
      expect(result.data!.watchlistCandidates).toHaveLength(0)
      expect(result.data!.valuePitScores).toHaveLength(1) // 评分仍保留在结果中
    })

    it('应当更新 valuePitScores 中的 rotationSignal 字段', async () => {
      // 准备
      const probeScore: ValuePitScore = {
        symbol: '600519.SH',
        name: '白酒板块',
        score: 3.8,
        dimensions: { catalyst: 0.7, valuation: 0.8, chip: 0.6, rotation: 0.5, liquidity: 0.7, composite: 3.8 },
        rotationSignal: false,
        action: 'probe',
        calculatedAt: Date.now(),
        dataVersion: 1,
      }

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [probeScore] })
      mockDetectBySector.mockResolvedValue({ triggered: true })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证：rotationSignal 被更新为 true
      expect(result.data!.valuePitScores[0]!.rotationSignal).toBe(true)
    })

    it('应当正确处理多只股票的混合场景', async () => {
      // 准备：immediate + probe(触发) + wait(未触发) + ignore 四种状态
      const scores: ValuePitScore[] = [
        {
          symbol: '001', name: '板块A', score: 4.5,
          dimensions: { catalyst: 0.9, valuation: 0.9, chip: 0.8, rotation: 0.7, liquidity: 0.9, composite: 4.5 },
          rotationSignal: false, action: 'immediate', calculatedAt: 0, dataVersion: 1,
        },
        {
          symbol: '002', name: '板块B', score: 3.8,
          dimensions: { catalyst: 0.7, valuation: 0.8, chip: 0.6, rotation: 0.5, liquidity: 0.7, composite: 3.8 },
          rotationSignal: false, action: 'probe', calculatedAt: 0, dataVersion: 1,
        },
        {
          symbol: '003', name: '板块C', score: 3.2,
          dimensions: { catalyst: 0.6, valuation: 0.7, chip: 0.5, rotation: 0.4, liquidity: 0.6, composite: 3.2 },
          rotationSignal: false, action: 'wait', calculatedAt: 0, dataVersion: 1,
        },
        {
          symbol: '004', name: '板块D', score: 2.0,
          dimensions: { catalyst: 0.3, valuation: 0.4, chip: 0.2, rotation: 0.3, liquidity: 0.4, composite: 2.0 },
          rotationSignal: false, action: 'ignore', calculatedAt: 0, dataVersion: 1,
        },
      ]

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: scores })
      // 板块B 触发，板块C 不触发，板块A immediate 也检测
      mockDetectBySector
        .mockResolvedValueOnce({ triggered: true })   // immediate
        .mockResolvedValueOnce({ triggered: true })   // probe
        .mockResolvedValueOnce({ triggered: false })  // wait

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证：
      // - immediate + 触发：不生成信号（只有 probe/wait + 触发才生成）
      // - probe + 触发：生成 1 个信号
      // - wait + 不触发：加入观察列表
      // - ignore：无操作
      expect(result.data!.signals).toHaveLength(1) // probe + 触发
      expect(result.data!.signals[0]!.symbol).toBe('002')
      expect(result.data!.watchlistCandidates).toHaveLength(1) // wait + 不触发
      expect(result.data!.watchlistCandidates[0]!.symbol).toBe('003')
      expect(mockDetectBySector).toHaveBeenCalledTimes(3) // immediate, probe, wait（ignore 不检测）
    })

    it('应当正确计算 summary 统计', async () => {
      // 准备
      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: mockHotScores })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: mockPitScores })
      mockDetectBySector.mockResolvedValue({ triggered: true })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证 summary
      expect(result.data!.summary.total).toBe(2)
      expect(result.data!.summary.hotSectorCount).toBe(1)
      expect(result.data!.summary.valuePitCount).toBe(1)
      expect(result.data!.summary.signalCount).toBe(1) // probe + 触发
      expect(result.data!.summary.watchlistCount).toBe(0)
    })
  })

  describe('并发调用互不干扰', () => {
    it('应当正确处理并发执行多个双策略用例', async () => {
      // 准备
      const stocks1: Stock[] = [{ symbol: '000001.SZ', name: '平安银行', price: 12.5 }] as Stock[]
      const stocks2: Stock[] = [{ symbol: '600519.SH', name: '贵州茅台', price: 1800.0 }] as Stock[]

      const hotScores1: HotSectorScore[] = [
        {
          symbol: '000001.SZ', name: '银行板块', score: 4.2,
          dimensions: { momentum: 0.8, sentiment: 0.7, technical: 0.9, valuation: 0.6, composite: 4.2 },
          action: 'immediate', calculatedAt: 0, dataVersion: 1,
        },
      ]
      const pitScores2: ValuePitScore[] = [
        {
          symbol: '600519.SH', name: '白酒板块', score: 3.8,
          dimensions: { catalyst: 0.7, valuation: 0.8, chip: 0.6, rotation: 0.5, liquidity: 0.7, composite: 3.8 },
          rotationSignal: false, action: 'probe', calculatedAt: 0, dataVersion: 1,
        },
      ]

      mockAnalyzeHotSectors
        .mockResolvedValueOnce({ success: true, data: hotScores1 })
        .mockResolvedValueOnce({ success: true, data: [] })
      mockAnalyzeValuePits
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({ success: true, data: pitScores2 })
      mockDetectBySector.mockResolvedValue({ triggered: false })

      // 执行：并发调用
      const [result1, result2] = await Promise.all([
        runDualStrategyUseCase({ stocks: stocks1 }),
        runDualStrategyUseCase({ stocks: stocks2 }),
      ])

      // 验证：结果互不干扰
      expect(result1.success).toBe(true)
      expect(result1.data!.hotSectorScores).toHaveLength(1)
      expect(result1.data!.hotSectorScores[0]!.symbol).toBe('000001.SZ')
      expect(result1.data!.valuePitScores).toHaveLength(0)

      expect(result2.success).toBe(true)
      expect(result2.data!.hotSectorScores).toHaveLength(0)
      expect(result2.data!.valuePitScores).toHaveLength(1)
      expect(result2.data!.valuePitScores[0]!.symbol).toBe('600519.SH')
    })
  })

  describe('边界条件', () => {
    it('应当处理单只股票的情况', async () => {
      // 准备
      const singleStock: Stock[] = [{ symbol: '000001.SZ', name: '平安银行', price: 12.5 }] as Stock[]
      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: mockHotScores })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [] })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: singleStock })

      // 验证
      expect(result.success).toBe(true)
      expect(result.data!.summary.total).toBe(1)
      expect(mockAnalyzeHotSectors).toHaveBeenCalledWith(singleStock, expect.any(Object))
      expect(mockAnalyzeValuePits).toHaveBeenCalledWith(singleStock, expect.any(Object))
    })

    it('应当处理价值洼地评分全为 ignore 的情况', async () => {
      // 准备
      const allIgnoreScores: ValuePitScore[] = [
        {
          symbol: '001', name: '板块A', score: 2.0,
          dimensions: { catalyst: 0.3, valuation: 0.4, chip: 0.2, rotation: 0.3, liquidity: 0.4, composite: 2.0 },
          rotationSignal: false, action: 'ignore', calculatedAt: 0, dataVersion: 1,
        },
        {
          symbol: '002', name: '板块B', score: 1.5,
          dimensions: { catalyst: 0.2, valuation: 0.3, chip: 0.2, rotation: 0.2, liquidity: 0.3, composite: 1.5 },
          rotationSignal: false, action: 'ignore', calculatedAt: 0, dataVersion: 1,
        },
      ]

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: allIgnoreScores })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证：不调用轮动检测器
      expect(mockDetectBySector).not.toHaveBeenCalled()
      expect(result.data!.signals).toHaveLength(0)
      expect(result.data!.watchlistCandidates).toHaveLength(0)
      expect(result.data!.valuePitScores).toHaveLength(2)
    })

    it('应当处理轮动检测器返回 null 的情况', async () => {
      // 准备
      const probeScore: ValuePitScore = {
        symbol: '600519.SH', name: '白酒板块', score: 3.8,
        dimensions: { catalyst: 0.7, valuation: 0.8, chip: 0.6, rotation: 0.5, liquidity: 0.7, composite: 3.8 },
        rotationSignal: false, action: 'probe', calculatedAt: 0, dataVersion: 1,
      }

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [probeScore] })
      mockDetectBySector.mockResolvedValue(null) // 返回 null

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证：null 视为未触发
      expect(result.data!.valuePitScores[0]!.rotationSignal).toBe(false)
      expect(result.data!.signals).toHaveLength(0)
    })

    it('应当处理高分值时置信度上限为 0.9', async () => {
      // 准备：高分值 probe 评分
      const highScore: ValuePitScore = {
        symbol: '600519.SH', name: '白酒板块', score: 9.5,
        dimensions: { catalyst: 0.95, valuation: 0.95, chip: 0.9, rotation: 0.9, liquidity: 0.95, composite: 9.5 },
        rotationSignal: false, action: 'probe', calculatedAt: 0, dataVersion: 1,
      }

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [highScore] })
      mockDetectBySector.mockResolvedValue({ triggered: true })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证：置信度不超过 0.9
      expect(result.data!.signals[0]!.confidence).toBe(0.9)
      expect(Math.min(0.9, 0.5 + 9.5 / 10)).toBe(0.9) // 验证计算逻辑
    })

    it('应当处理低分值时的置信度计算', async () => {
      // 准备：低分值 probe 评分（刚好满足 probe 阈值）
      const lowScore: ValuePitScore = {
        symbol: '600519.SH', name: '白酒板块', score: 3.5,
        dimensions: { catalyst: 0.6, valuation: 0.7, chip: 0.5, rotation: 0.5, liquidity: 0.6, composite: 3.5 },
        rotationSignal: false, action: 'probe', calculatedAt: 0, dataVersion: 1,
      }

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [lowScore] })
      mockDetectBySector.mockResolvedValue({ triggered: true })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证：置信度 = 0.5 + 3.5/10 = 0.85
      expect(result.data!.signals[0]!.confidence).toBeCloseTo(0.85, 5)
    })

    it('应当处理信号的 snapshot 字段为预定义结构', async () => {
      // 准备
      const probeScore: ValuePitScore = {
        symbol: '600519.SH', name: '白酒板块', score: 3.8,
        dimensions: { catalyst: 0.7, valuation: 0.8, chip: 0.6, rotation: 0.5, liquidity: 0.7, composite: 3.8 },
        rotationSignal: false, action: 'probe', calculatedAt: 0, dataVersion: 1,
      }

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [probeScore] })
      mockDetectBySector.mockResolvedValue({ triggered: true })

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      // 验证：snapshot 结构
      expect(result.data!.signals[0]!.snapshot).toEqual({
        priceToMA20: undefined,
        priceToMA60: undefined,
      })
    })

    it('应当处理信号的 createdAt 为时间戳', async () => {
      // 准备
      const probeScore: ValuePitScore = {
        symbol: '600519.SH', name: '白酒板块', score: 3.8,
        dimensions: { catalyst: 0.7, valuation: 0.8, chip: 0.6, rotation: 0.5, liquidity: 0.7, composite: 3.8 },
        rotationSignal: false, action: 'probe', calculatedAt: 0, dataVersion: 1,
      }

      mockAnalyzeHotSectors.mockResolvedValue({ success: true, data: [] })
      mockAnalyzeValuePits.mockResolvedValue({ success: true, data: [probeScore] })
      mockDetectBySector.mockResolvedValue({ triggered: true })

      const beforeTime = Date.now()

      // 执行
      const result = await runDualStrategyUseCase({ stocks: mockStocks })

      const afterTime = Date.now()

      // 验证：createdAt 在合理时间范围内
      expect(result.data!.signals[0]!.createdAt).toBeGreaterThanOrEqual(beforeTime)
      expect(result.data!.signals[0]!.createdAt).toBeLessThanOrEqual(afterTime)
    })
  })

  // 注：日志输出由 logger mock 间接验证，此处不单独测试
})
