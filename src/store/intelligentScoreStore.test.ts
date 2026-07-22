/**
 * @test_id V9-TEST-ST-141
 * intelligentScoreStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态
 * 2. selectConfigReady 计算属性
 * 3. setSymbol / setFiles / setReportText / setLlmConfig / setShowConfig
 * 4. runScore 成功流程（mock 进度回调）
 * 5. runScore 失败（LLM 未配置 / symbol 为空 / service 返回 error）
 * 6. runScore 异常（抛出错误）
 * 7. loadHistory 成功与失败
 * 8. loadLogs 成功与失败
 * 9. loadStocks 成功与失败
 * 10. resetResult
  * @covers_docs [V9-DOC-BACK-020]
*/

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useIntelligentScoreStore, selectConfigReady } from './intelligentScoreStore'
import { runIntelligentScore } from '@/services/scoring/intelligentScoreService'
import {
  loadAllStocksForScoreSelect,
  loadIntelligentScoreHistory,
  loadResearchLogsForTarget,
} from '@/services/analysis/scorePageService'
import type { IntelligentScore, ResearchLog, Stock } from '@/data/types'

vi.mock('@/services/scoring/intelligentScoreService', () => ({
  runIntelligentScore: vi.fn(),
}))

vi.mock('@/services/analysis/scorePageService', () => ({
  loadAllStocksForScoreSelect: vi.fn(),
  loadIntelligentScoreHistory: vi.fn(),
  loadResearchLogsForTarget: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/config/llmConfig', () => ({
  getDefaultLlmConfig: () => ({
    baseURL: '',
    apiKey: '',
    model: '',
  }),
  getDefaultLlmTransparencyConfig: () => ({
    baseURL: '',
    apiKey: '',
    model: '',
    enableLlm: false,
    showTransparencyPanel: false,
    factorOverrides: [],
  }),
}))

vi.mock('@/config/scoreFactors', () => ({
  getEnabledStockFactorNames: () => ['成长性', '盈利能力', '估值水平', '财务健康', '行业地位'],
}))

function createMockStock(symbol: string, name: string): Stock {
  return {
    symbol,
    name,
    pool: 'research' as const,
    researchStatus: 'watching' as const,
    source: 'manual' as const,
    dataVersion: 1,
  }
}

function createMockIntelligentScore(symbol: string, overallScore: number | null): IntelligentScore {
  return {
    symbol,
    overallScore,
    dimensionScores: [
      { name: '成长性', score: 4.0, rationale: '测试', evidence: [], weight: 0.2 },
      { name: '盈利能力', score: 4.0, rationale: '测试', evidence: [], weight: 0.2 },
      { name: '估值水平', score: 4.0, rationale: '测试', evidence: [], weight: 0.2 },
      { name: '财务健康', score: 4.0, rationale: '测试', evidence: [], weight: 0.2 },
      { name: '行业地位', score: 4.0, rationale: '测试', evidence: [], weight: 0.2 },
    ],
    summary: '测试总结',
    basis: '测试依据',
    missingFields: [],
    sourceSnapshot: {
      stock: undefined,
      fileNames: [],
      reportLength: 0,
    },
    configSnapshot: {
      model: 'test-model',
      baseURL: 'https://test.com',
    },
    modelResponse: '{}',
    dataVersion: 1,
    scoredAt: Date.now(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useIntelligentScoreStore.setState({
    symbol: '',
    stocks: [],
    files: [],
    reportText: '',
    llmConfig: { baseURL: '', apiKey: '', model: '' },
    showConfig: false,
    progress: {
      fetchBasicData: 'pending',
      v6EngineCalculation: 'pending',
      readSupplementaryFiles: 'pending',
      prepareReportText: 'pending',
      llmAnalysis: 'pending',
      parseScore: 'pending',
      saveResult: 'pending',
    },
    progressMessage: '',
    result: undefined,
    previousResult: undefined,
    history: [],
    logs: [],
    error: '',
    loading: false,
  })
})

describe('intelligentScoreStore', () => {
  // ============================================================
  // 初始状态
  // ============================================================

  test('初始状态正确', () => {
    const state = useIntelligentScoreStore.getState()
    expect(state.symbol).toBe('')
    expect(state.stocks).toHaveLength(0)
    expect(state.files).toHaveLength(0)
    expect(state.reportText).toBe('')
    expect(state.llmConfig.baseURL).toBe('')
    expect(state.showConfig).toBe(false)
    expect(state.progress.fetchBasicData).toBe('pending')
    expect(state.progressMessage).toBe('')
    expect(state.result).toBeUndefined()
    expect(state.previousResult).toBeUndefined()
    expect(state.history).toHaveLength(0)
    expect(state.logs).toHaveLength(0)
    expect(state.error).toBe('')
    expect(state.loading).toBe(false)
  })

  // ============================================================
  // selectConfigReady
  // ============================================================

  test('selectConfigReady 当 enableLlm 为 false 时返回 true（无需 LLM）', () => {
    useIntelligentScoreStore.setState({
      transparencyConfig: {
        baseURL: '',
        apiKey: '',
        model: '',
        enableLlm: false,
        showTransparencyPanel: false,
        factorOverrides: [],
      },
      llmConfig: { baseURL: '', apiKey: '', model: '' },
    })
    const state = useIntelligentScoreStore.getState()
    expect(selectConfigReady(state)).toBe(true)
  })

  test('selectConfigReady 当 enableLlm 为 true 且配置完整时返回 true', () => {
    useIntelligentScoreStore.setState({
      transparencyConfig: {
        baseURL: 'https://api.test.com',
        apiKey: 'sk-test',
        model: 'test-model',
        enableLlm: true,
        showTransparencyPanel: true,
        factorOverrides: [],
      },
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' },
    })
    const state = useIntelligentScoreStore.getState()
    expect(selectConfigReady(state)).toBe(true)
  })

  test('selectConfigReady 当 enableLlm 为 true 但任一字段为空时返回 false', () => {
    useIntelligentScoreStore.setState({
      transparencyConfig: {
        baseURL: 'https://api.test.com',
        apiKey: 'sk-test',
        model: 'test-model',
        enableLlm: true,
        showTransparencyPanel: true,
        factorOverrides: [],
      },
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: '' },
    })
    const state = useIntelligentScoreStore.getState()
    expect(selectConfigReady(state)).toBe(false)
  })

  // ============================================================
  // 基础 Actions
  // ============================================================

  test('setSymbol 更新 symbol', () => {
    const store = useIntelligentScoreStore.getState()
    store.setSymbol('600519')
    expect(useIntelligentScoreStore.getState().symbol).toBe('600519')
  })

  test('setFiles 更新 files', () => {
    const store = useIntelligentScoreStore.getState()
    const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' })
    store.setFiles([mockFile])
    expect(useIntelligentScoreStore.getState().files).toHaveLength(1)
    expect(useIntelligentScoreStore.getState().files[0]!.name).toBe('test.txt')
  })

  test('setReportText 更新 reportText', () => {
    const store = useIntelligentScoreStore.getState()
    store.setReportText('行业分析报告')
    expect(useIntelligentScoreStore.getState().reportText).toBe('行业分析报告')
  })

  test('setLlmConfig 支持对象更新', () => {
    const store = useIntelligentScoreStore.getState()
    store.setLlmConfig({ baseURL: 'https://api.test.com', apiKey: 'key', model: 'model' })
    const config = useIntelligentScoreStore.getState().llmConfig
    expect(config.baseURL).toBe('https://api.test.com')
  })

  test('setLlmConfig 支持函数式更新', () => {
    const store = useIntelligentScoreStore.getState()
    store.setLlmConfig((prev) => ({ ...prev, baseURL: 'https://api.test.com' }))
    expect(useIntelligentScoreStore.getState().llmConfig.baseURL).toBe('https://api.test.com')
  })

  test('setShowConfig 支持布尔值更新', () => {
    const store = useIntelligentScoreStore.getState()
    store.setShowConfig(true)
    expect(useIntelligentScoreStore.getState().showConfig).toBe(true)
  })

  test('setShowConfig 支持函数式更新', () => {
    const store = useIntelligentScoreStore.getState()
    store.setShowConfig((prev) => !prev)
    expect(useIntelligentScoreStore.getState().showConfig).toBe(true)
  })

  test('setProgress 更新指定步骤状态', () => {
    const store = useIntelligentScoreStore.getState()
    store.setProgress('fetchBasicData', 'running')
    expect(useIntelligentScoreStore.getState().progress.fetchBasicData).toBe('running')
    expect(useIntelligentScoreStore.getState().progress.llmAnalysis).toBe('pending')
  })

  test('resetProgress 重置所有进度', () => {
    const store = useIntelligentScoreStore.getState()
    store.setProgress('fetchBasicData', 'done')
    store.setProgress('llmAnalysis', 'running')
    store.setProgressMessage('处理中...')
    store.resetProgress()
    const state = useIntelligentScoreStore.getState()
    expect(state.progress.fetchBasicData).toBe('pending')
    expect(state.progress.llmAnalysis).toBe('pending')
    expect(state.progressMessage).toBe('')
  })

  // ============================================================
  // loadStocks
  // ============================================================

  test('loadStocks 成功时更新 stocks', async () => {
    const mockStocks = [createMockStock('600519', '贵州茅台')]
    vi.mocked(loadAllStocksForScoreSelect).mockResolvedValueOnce(mockStocks)

    const store = useIntelligentScoreStore.getState()
    await store.loadStocks()

    const state = useIntelligentScoreStore.getState()
    expect(state.stocks).toHaveLength(1)
    expect(state.stocks[0]!.symbol).toBe('600519')
    expect(state.error).toBe('')
  })

  test('loadStocks 异常时设置 error', async () => {
    vi.mocked(loadAllStocksForScoreSelect).mockRejectedValueOnce(new Error('网络错误'))

    const store = useIntelligentScoreStore.getState()
    await store.loadStocks()

    const state = useIntelligentScoreStore.getState()
    expect(state.stocks).toHaveLength(0)
    expect(state.error).toBe('网络错误')
  })

  // ============================================================
  // loadHistory
  // ============================================================

  test('loadHistory 成功时更新 history 和 previousResult', async () => {
    const mockHistory = [
      createMockIntelligentScore('600519', 4.5),
      createMockIntelligentScore('600519', 4.2),
    ]
    vi.mocked(loadIntelligentScoreHistory).mockResolvedValueOnce(mockHistory)

    const store = useIntelligentScoreStore.getState()
    await store.loadHistory('600519')

    const state = useIntelligentScoreStore.getState()
    expect(state.history).toHaveLength(2)
    expect(state.previousResult).toBeDefined()
    expect(state.previousResult!.overallScore).toBe(4.5)
    expect(state.error).toBe('')
  })

  test('loadHistory symbol 为空时清空历史', async () => {
    useIntelligentScoreStore.setState({
      previousResult: createMockIntelligentScore('600519', 4.5),
      history: [createMockIntelligentScore('600519', 4.5)],
    })

    const store = useIntelligentScoreStore.getState()
    await store.loadHistory('')

    const state = useIntelligentScoreStore.getState()
    expect(state.history).toHaveLength(0)
    expect(state.previousResult).toBeUndefined()
  })

  test('loadHistory 异常时设置 error', async () => {
    vi.mocked(loadIntelligentScoreHistory).mockRejectedValueOnce(new Error('数据库错误'))

    const store = useIntelligentScoreStore.getState()
    await store.loadHistory('600519')

    const state = useIntelligentScoreStore.getState()
    expect(state.history).toHaveLength(0)
    expect(state.error).toBe('数据库错误')
  })

  // ============================================================
  // loadLogs
  // ============================================================

  test('loadLogs 成功时更新 logs', async () => {
    const mockLogs: ResearchLog[] = [
      { traceId: '1', timestamp: Date.now(), actor: 'system', action: 'score', targetType: 'stock', targetCode: '600519' },
    ]
    vi.mocked(loadResearchLogsForTarget).mockResolvedValueOnce(mockLogs)

    const store = useIntelligentScoreStore.getState()
    await store.loadLogs('600519')

    const state = useIntelligentScoreStore.getState()
    expect(state.logs).toHaveLength(1)
    expect(state.logs[0]!.targetCode).toBe('600519')
    expect(state.error).toBe('')
  })

  test('loadLogs symbol 为空时清空 logs', async () => {
    useIntelligentScoreStore.setState({
      logs: [{ traceId: '1', timestamp: Date.now(), actor: 'system', action: 'score', targetType: 'stock', targetCode: '600519' }],
    })

    const store = useIntelligentScoreStore.getState()
    await store.loadLogs('')

    const state = useIntelligentScoreStore.getState()
    expect(state.logs).toHaveLength(0)
  })

  test('loadLogs 异常时设置 error', async () => {
    vi.mocked(loadResearchLogsForTarget).mockRejectedValueOnce(new Error('日志加载失败'))

    const store = useIntelligentScoreStore.getState()
    await store.loadLogs('600519')

    const state = useIntelligentScoreStore.getState()
    expect(state.logs).toHaveLength(0)
    expect(state.error).toBe('日志加载失败')
  })

  // ============================================================
  // runScore
  // ============================================================

  test('runScore symbol 为空时设置错误并返回', async () => {
    const store = useIntelligentScoreStore.getState()
    await store.runScore()

    const state = useIntelligentScoreStore.getState()
    expect(state.error).toBe('请选择或输入股票代码')
    expect(state.loading).toBe(false)
    expect(runIntelligentScore).not.toHaveBeenCalled()
  })

  test('runScore LLM 未配置时设置错误并展开配置', async () => {
    useIntelligentScoreStore.setState({
      symbol: '600519',
      transparencyConfig: {
        baseURL: 'https://api.test.com',
        apiKey: 'sk-test',
        model: 'test-model',
        enableLlm: true,
        showTransparencyPanel: true,
        factorOverrides: [],
      },
      llmConfig: { baseURL: '', apiKey: '', model: '' },
    })
    const store = useIntelligentScoreStore.getState()
    await store.runScore()

    const state = useIntelligentScoreStore.getState()
    expect(state.error).toBe('请先配置 LLM 接口（baseURL、apiKey、model）')
    expect(state.showConfig).toBe(true)
    expect(state.loading).toBe(false)
    expect(runIntelligentScore).not.toHaveBeenCalled()
  })

  test('runScore 成功流程并触发进度回调', async () => {
    const mockScore = createMockIntelligentScore('600519', 4.5)
    const mockHistory = [mockScore]
    const mockLogs: ResearchLog[] = []

    vi.mocked(runIntelligentScore).mockImplementationOnce(async (_input, onProgress) => {
      onProgress?.({ step: 'fetchBasicData', status: 'running', message: '读取中...' })
      onProgress?.({ step: 'fetchBasicData', status: 'done', message: '完成' })
      onProgress?.({ step: 'llmAnalysis', status: 'running' })
      onProgress?.({ step: 'llmAnalysis', status: 'done' })
      return { success: true, data: mockScore }
    })
    vi.mocked(loadIntelligentScoreHistory).mockResolvedValueOnce(mockHistory)
    vi.mocked(loadResearchLogsForTarget).mockResolvedValueOnce(mockLogs)

    useIntelligentScoreStore.setState({
      symbol: '600519',
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' },
    })

    const store = useIntelligentScoreStore.getState()
    await store.runScore()

    const state = useIntelligentScoreStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('')
    expect(state.result).toBeDefined()
    expect(state.result!.overallScore).toBe(4.5)
    expect(state.progress.fetchBasicData).toBe('done')
    expect(state.progress.llmAnalysis).toBe('done')
    expect(state.history).toHaveLength(1)
    expect(state.previousResult).toBeDefined()
    expect(state.logs).toHaveLength(0)
  })

  test('runScore service 返回失败时设置 error', async () => {
    vi.mocked(runIntelligentScore).mockResolvedValueOnce({ success: false, error: 'LLM 调用超时' })

    useIntelligentScoreStore.setState({
      symbol: '600519',
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' },
    })

    const store = useIntelligentScoreStore.getState()
    await store.runScore()

    const state = useIntelligentScoreStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('LLM 调用超时')
    expect(state.result).toBeUndefined()
  })

  test('runScore 抛出异常时设置 error', async () => {
    vi.mocked(runIntelligentScore).mockRejectedValueOnce(new Error('网络中断'))

    useIntelligentScoreStore.setState({
      symbol: '600519',
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' },
    })

    const store = useIntelligentScoreStore.getState()
    await store.runScore()

    const state = useIntelligentScoreStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('网络中断')
    expect(state.result).toBeUndefined()
  })

  test('runScore 开始时重置进度和状态', async () => {
    const mockScore = createMockIntelligentScore('600519', 4.5)
    vi.mocked(runIntelligentScore).mockResolvedValueOnce({ success: true, data: mockScore })
    vi.mocked(loadIntelligentScoreHistory).mockResolvedValueOnce([mockScore])
    vi.mocked(loadResearchLogsForTarget).mockResolvedValueOnce([])

    useIntelligentScoreStore.setState({
      symbol: '600519',
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' },
      progress: { fetchBasicData: 'done', v6EngineCalculation: 'done', readSupplementaryFiles: 'done', prepareReportText: 'done', llmAnalysis: 'done', parseScore: 'done', saveResult: 'done' },
      progressMessage: '之前的消息',
      error: '之前的错误',
      result: createMockIntelligentScore('000001', 3.0),
    })

    const store = useIntelligentScoreStore.getState()
    await store.runScore()

    const state = useIntelligentScoreStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('')
    expect(state.progress.fetchBasicData).toBe('pending')
    expect(state.progressMessage).toBe('')
    expect(state.result!.symbol).toBe('600519')
  })

  // ============================================================
  // resetResult
  // ============================================================

  test('resetResult 清空结果和关联状态', () => {
    useIntelligentScoreStore.setState({
      result: createMockIntelligentScore('600519', 4.5),
      previousResult: createMockIntelligentScore('600519', 4.2),
      history: [createMockIntelligentScore('600519', 4.5)],
      logs: [{ traceId: '1', timestamp: Date.now(), actor: 'system', action: 'score', targetType: 'stock', targetCode: '600519' }],
      progress: { fetchBasicData: 'done', v6EngineCalculation: 'done', readSupplementaryFiles: 'done', prepareReportText: 'done', llmAnalysis: 'done', parseScore: 'done', saveResult: 'done' },
      progressMessage: '完成',
      error: '某错误',
    })

    const store = useIntelligentScoreStore.getState()
    store.resetResult()

    const state = useIntelligentScoreStore.getState()
    expect(state.result).toBeUndefined()
    expect(state.previousResult).toBeUndefined()
    expect(state.history).toHaveLength(0)
    expect(state.logs).toHaveLength(0)
    expect(state.progress.fetchBasicData).toBe('pending')
    expect(state.progressMessage).toBe('')
    expect(state.error).toBe('')
  })

  test('reset 将所有关键状态字段重置为初始值', () => {
    useIntelligentScoreStore.setState({
      symbol: '600519',
      files: [new File(['test'], 'test.txt', { type: 'text/plain' })],
      reportText: '报告',
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' },
      showConfig: true,
      progress: { fetchBasicData: 'done', v6EngineCalculation: 'done', readSupplementaryFiles: 'done', prepareReportText: 'done', llmAnalysis: 'done', parseScore: 'done', saveResult: 'done' },
      progressMessage: '完成',
      result: createMockIntelligentScore('600519', 4.5),
      previousResult: createMockIntelligentScore('600519', 4.2),
      history: [createMockIntelligentScore('600519', 4.5)],
      logs: [{ traceId: '1', timestamp: Date.now(), actor: 'system', action: 'score', targetType: 'stock', targetCode: '600519' }],
      error: '某错误',
      loading: true,
      trendData: { symbol: '600519', period: '1M', data: [] },
      trendLoading: true,
      trendError: '趋势错误',
    })

    const store = useIntelligentScoreStore.getState()
    store.reset()

    const state = useIntelligentScoreStore.getState()
    expect(state.symbol).toBe('')
    expect(state.stocks).toHaveLength(0)
    expect(state.files).toHaveLength(0)
    expect(state.reportText).toBe('')
    expect(state.llmConfig.baseURL).toBe('')
    expect(state.showConfig).toBe(false)
    expect(state.progress.fetchBasicData).toBe('pending')
    expect(state.progressMessage).toBe('')
    expect(state.result).toBeUndefined()
    expect(state.previousResult).toBeUndefined()
    expect(state.history).toHaveLength(0)
    expect(state.logs).toHaveLength(0)
    expect(state.error).toBe('')
    expect(state.loading).toBe(false)
    expect(state.trendData).toBeUndefined()
    expect(state.trendLoading).toBe(false)
    expect(state.trendError).toBeNull()
  })
})
