/**
 * @test_id V9-TEST-ST-210
 * analysisOrchestratorStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. analyze: 成功完成（结果写入 results）
 * 3. analyze: 服务返回错误（success=false）
 * 4. analyze: 抛出异常（catch 分支）
 * 5. analyze: loading 状态变更
 * 6. analyze: 多 symbol 结果累积
 * 7. analyze: 同 symbol 覆盖更新
 * 8. withBroadcast: 分析成功时触发广播
 * 9. makeAnalysisTraceId: 格式正确性
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { AnalysisResult } from '@/types/modules/analysisOrchestrator.types'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockRunAnalysis = vi.hoisted(() => vi.fn())
const mockWithBroadcast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/lib/withBroadcast', () => ({
  withBroadcast: mockWithBroadcast,
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: {
    ANALYSIS_RESULT_CHANGED: 'analysis_result:changed',
  },
}))

vi.mock('@/services/analysis/analysisOrchestrator', () => ({
  runAnalysis: mockRunAnalysis,
}))

// ============================================================
// Imports
// ============================================================

import { useAnalysisOrchestratorStore, makeAnalysisTraceId } from './analysisOrchestratorStore'

// ============================================================
// Helpers
// ============================================================

function createMockResult(symbol: string, overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    docId: `doc-${symbol}-001`,
    symbol,
    version: 1,
    createdAt: Date.now(),
    external: {
      symbol,
      articleCount: 10,
      topArticles: [{ title: '测试新闻', summary: '摘要', sentiment: 'positive' }],
      fetchedAt: Date.now(),
    },
    internal: {
      symbol,
      stockName: '测试公司',
      v6Score: 75,
      v6Rating: 'buy',
      fetchedAt: Date.now(),
    },
    conclusion: {
      rating: 'buy',
      summary: '看好后市表现',
      keyRisks: ['行业竞争加剧'],
      opportunities: ['新产品放量'],
      consistentWithV6: true,
      confidence: 0.85,
    },
    rawLlmText: '原始 LLM 输出文本',
    factorExecution: [
      { factorId: 'f1', factorName: '护城河', executed: true, value: 80 },
    ],
    reasonableness: {
      passed: true,
      threshold: 0.6,
      completeness: 0.9,
      missingLayers: [],
      notes: '数据完整',
    },
    feedbackLoop: {
      triggered: false,
      issueCount: 0,
      message: '无问题',
    },
    model: 'gpt-4',
    ...overrides,
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  // 手动重置 store 状态（该 store 没有 reset action）
  useAnalysisOrchestratorStore.setState({
    results: {},
    loading: false,
    error: undefined,
  })
})

// ============================================================
// useAnalysisOrchestratorStore
// ============================================================

describe('useAnalysisOrchestratorStore', () => {
  // ---------- 初始状态 ----------

  describe('初始状态', () => {
    it('results 为空对象，loading 为 false，error 为 undefined', () => {
      const state = useAnalysisOrchestratorStore.getState()
      expect(state.results).toEqual({})
      expect(state.loading).toBe(false)
      expect(state.error).toBeUndefined()
      expect(typeof state.analyze).toBe('function')
    })
  })

  // ---------- analyze: 成功 ----------

  describe('analyze 成功', () => {
    it('应将结果写入 results 并返回数据', async () => {
      const mockResult = createMockResult('AAPL')
      mockRunAnalysis.mockResolvedValue({ success: true, data: mockResult })

      const result = await useAnalysisOrchestratorStore.getState().analyze('AAPL')

      expect(result).toEqual(mockResult)
      const state = useAnalysisOrchestratorStore.getState()
      expect(state.results['AAPL']).toEqual(mockResult)
      expect(state.loading).toBe(false)
      expect(state.error).toBeUndefined()
    })

    it('应调用 runAnalysis 并传入正确参数', async () => {
      const mockResult = createMockResult('TSLA')
      mockRunAnalysis.mockResolvedValue({ success: true, data: mockResult })

      await useAnalysisOrchestratorStore.getState().analyze('TSLA', {
        enableFeedback: true,
        maxReAnalysis: 3,
      })

      expect(mockRunAnalysis).toHaveBeenCalledTimes(1)
      expect(mockRunAnalysis).toHaveBeenCalledWith({
        symbol: 'TSLA',
        enableFeedback: true,
        maxReAnalysis: 3,
      })
    })

    it('成功时应触发 withBroadcast', async () => {
      const mockResult = createMockResult('NVDA')
      mockRunAnalysis.mockResolvedValue({ success: true, data: mockResult })

      await useAnalysisOrchestratorStore.getState().analyze('NVDA')

      expect(mockWithBroadcast).toHaveBeenCalledTimes(1)
      expect(mockWithBroadcast).toHaveBeenCalledWith('analysis_result:changed', {
        action: 'analyze',
        symbol: 'NVDA',
        docId: mockResult.docId,
      })
    })
  })

  // ---------- analyze: loading 状态 ----------

  describe('analyze loading 状态', () => {
    it('调用后立即设置 loading=true，完成后 loading=false', async () => {
      let resolveAnalysis: ((value: { success: true; data: AnalysisResult }) => void) | undefined
      const analysisPromise = new Promise<{ success: true; data: AnalysisResult }>((r) => {
        resolveAnalysis = r
      })
      mockRunAnalysis.mockReturnValue(analysisPromise)

      const analyzePromise = useAnalysisOrchestratorStore.getState().analyze('AAPL')

      // 调用后立即检查 loading 状态
      expect(useAnalysisOrchestratorStore.getState().loading).toBe(true)
      expect(useAnalysisOrchestratorStore.getState().error).toBeUndefined()

      // 完成后检查
      resolveAnalysis!({ success: true, data: createMockResult('AAPL') })
      await analyzePromise

      expect(useAnalysisOrchestratorStore.getState().loading).toBe(false)
    })

    it('调用前清除上一次的 error', async () => {
      // 先设置一个错误状态
      useAnalysisOrchestratorStore.setState({ error: 'previous error' })

      mockRunAnalysis.mockResolvedValue({
        success: true,
        data: createMockResult('AAPL'),
      })

      await useAnalysisOrchestratorStore.getState().analyze('AAPL')

      expect(useAnalysisOrchestratorStore.getState().error).toBeUndefined()
    })
  })

  // ---------- analyze: 服务返回错误 ----------

  describe('analyze 服务返回错误', () => {
    it('success=false 时应设置 error 且返回 undefined', async () => {
      mockRunAnalysis.mockResolvedValue({
        success: false,
        error: '分析服务不可用',
      })

      const result = await useAnalysisOrchestratorStore.getState().analyze('AAPL')

      expect(result).toBeUndefined()
      const state = useAnalysisOrchestratorStore.getState()
      expect(state.loading).toBe(false)
      expect(state.error).toBe('分析服务不可用')
      expect(state.results['AAPL']).toBeUndefined()
    })

    it('success=false 时不应触发 withBroadcast', async () => {
      mockRunAnalysis.mockResolvedValue({
        success: false,
        error: '服务错误',
      })

      await useAnalysisOrchestratorStore.getState().analyze('AAPL')

      expect(mockWithBroadcast).not.toHaveBeenCalled()
    })

    it('success=true 但 data 为空时应返回 undefined', async () => {
      mockRunAnalysis.mockResolvedValue({
        success: true,
        data: undefined,
      })

      const result = await useAnalysisOrchestratorStore.getState().analyze('AAPL')

      expect(result).toBeUndefined()
      const state = useAnalysisOrchestratorStore.getState()
      expect(state.results['AAPL']).toBeUndefined()
      expect(state.loading).toBe(false)
    })
  })

  // ---------- analyze: 抛出异常 ----------

  describe('analyze 异常处理', () => {
    it('抛出 Error 时应捕获并设置 error 消息', async () => {
      mockRunAnalysis.mockRejectedValue(new Error('网络超时'))

      const result = await useAnalysisOrchestratorStore.getState().analyze('AAPL')

      expect(result).toBeUndefined()
      const state = useAnalysisOrchestratorStore.getState()
      expect(state.loading).toBe(false)
      expect(state.error).toBe('网络超时')
    })

    it('抛出非 Error 对象时应转为字符串', async () => {
      mockRunAnalysis.mockRejectedValue('字符串异常')

      await useAnalysisOrchestratorStore.getState().analyze('AAPL')

      const state = useAnalysisOrchestratorStore.getState()
      expect(state.error).toBe('字符串异常')
    })

    it('异常时不应触发 withBroadcast', async () => {
      mockRunAnalysis.mockRejectedValue(new Error('崩溃'))

      await useAnalysisOrchestratorStore.getState().analyze('AAPL')

      expect(mockWithBroadcast).not.toHaveBeenCalled()
    })
  })

  // ---------- 多 symbol 结果管理 ----------

  describe('多 symbol 结果管理', () => {
    it('多次调用不同 symbol 应累积到 results', async () => {
      mockRunAnalysis
        .mockResolvedValueOnce({ success: true, data: createMockResult('AAPL') })
        .mockResolvedValueOnce({ success: true, data: createMockResult('TSLA') })
        .mockResolvedValueOnce({ success: true, data: createMockResult('NVDA') })

      await useAnalysisOrchestratorStore.getState().analyze('AAPL')
      await useAnalysisOrchestratorStore.getState().analyze('TSLA')
      await useAnalysisOrchestratorStore.getState().analyze('NVDA')

      const state = useAnalysisOrchestratorStore.getState()
      expect(Object.keys(state.results)).toHaveLength(3)
      expect(state.results['AAPL']!.symbol).toBe('AAPL')
      expect(state.results['TSLA']!.symbol).toBe('TSLA')
      expect(state.results['NVDA']!.symbol).toBe('NVDA')
    })

    it('同 symbol 重复分析应覆盖旧结果', async () => {
      const firstResult = createMockResult('AAPL', { docId: 'doc-AAPL-v1', version: 1 })
      const secondResult = createMockResult('AAPL', { docId: 'doc-AAPL-v2', version: 2 })

      mockRunAnalysis
        .mockResolvedValueOnce({ success: true, data: firstResult })
        .mockResolvedValueOnce({ success: true, data: secondResult })

      await useAnalysisOrchestratorStore.getState().analyze('AAPL')
      expect(useAnalysisOrchestratorStore.getState().results['AAPL']!.version).toBe(1)

      await useAnalysisOrchestratorStore.getState().analyze('AAPL')
      const state = useAnalysisOrchestratorStore.getState()
      expect(state.results['AAPL']!.version).toBe(2)
      expect(state.results['AAPL']!.docId).toBe('doc-AAPL-v2')
      // 确认只有一个 AAPL 结果
      expect(Object.keys(state.results)).toHaveLength(1)
    })
  })
})

// ============================================================
// makeAnalysisTraceId
// ============================================================

describe('makeAnalysisTraceId', () => {
  it('应返回 analysis-{symbol}-{timestamp} 格式', () => {
    const id = makeAnalysisTraceId('AAPL')
    expect(id).toMatch(/^analysis-AAPL-\d+$/)
  })

  it('不同 symbol 生成不同 ID', () => {
    const id1 = makeAnalysisTraceId('AAPL')
    const id2 = makeAnalysisTraceId('TSLA')
    expect(id1).not.toBe(id2)
    expect(id1).toContain('AAPL')
    expect(id2).toContain('TSLA')
  })

  it('包含时间戳且为数字', () => {
    const id = makeAnalysisTraceId('NVDA')
    const parts = id.split('-')
    const timestamp = parseInt(parts[parts.length - 1]!, 10)
    expect(timestamp).toBeGreaterThan(0)
    expect(Number.isFinite(timestamp)).toBe(true)
  })
})
