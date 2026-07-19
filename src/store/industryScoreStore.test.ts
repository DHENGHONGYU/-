/**
 * @test_id V9-TEST-ST-139
 * industryScoreStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态
 * 2. selectSelectedSector 计算属性
 * 3. selectConfigReady 计算属性
 * 4. setSelectedCode / setFiles / setReportText / setLlmConfig / setShowConfig
 * 5. setProgress / resetProgress
 * 6. loadHistory 成功与失败与空 symbol
 * 7. loadLogs 成功与失败与空 symbol
 * 8. runScore 成功流程（mock 进度回调）
 * 9. runScore 失败（code 为空 / LLM 未配置 / service 返回 error）
 * 10. runScore 异常（抛出错误）
 * 11. resetResult
  * @covers_docs [V9-DOC-BACK-020]
*/

import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  useIndustryScoreStore,
  selectConfigReady,
  selectSelectedSector,
} from './industryScoreStore'
import { runIndustryScore } from '@/services/scoring/industryScoreService'
import {
  loadIndustryScoreHistory,
  loadResearchLogsForTarget,
} from '@/services/analysis/scorePageService'
import type { IndustryScore, ResearchLog } from '@/data/types'

vi.mock('@/services/scoring/industryScoreService', () => ({
  runIndustryScore: vi.fn(),
}))

vi.mock('@/services/analysis/scorePageService', () => ({
  loadIndustryScoreHistory: vi.fn(),
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
}))

vi.mock('@/config/scoreFactors', () => ({
  getEnabledIndustryFactorNames: () => ['政策环境', '技术跃迁', '竞争格局', '下游市场', '估值安全'],
}))

vi.mock('@/data/sectorSkillData', () => ({
  SECTORS_SKILL_RANKED: [
    {
      code: 'AI',
      name: 'AI大模型与算力',
      swLevel1: '计算机',
      swLevel2: '软件开发',
      swLevel3: ['AI芯片', '大模型'],
      keywords: ['AI', '算力'],
      planAlignment: { score: 4.5, reason: '测试' },
      policySupport: { score: 4.5, reason: '测试' },
      usChinaParity: { score: 4.5, reason: '测试' },
      skillC: {
        techAdvancement: { score: 4.5, weight: 0.25, reason: '测试' },
        structuralScarcity: { score: 4.5, weight: 0.25, reason: '测试' },
        localizationBarrier: { score: 4.5, weight: 0.25, reason: '测试' },
        overtakingPotential: { score: 4.5, weight: 0.25, reason: '测试' },
        composite: 4.5,
        grade: 'A',
      },
      skillA: {
        coreValue: { score: 4.5, reason: '测试' },
        scarcityValue: { score: 4.5, reason: '测试' },
        matrixPosition: '核心稀缺',
      },
      skillN: {
        rotationSignal: { score: 4.5, reason: '测试' },
        policyEnv: { score: 4.5, reason: '测试' },
        competition: { score: 4.5, reason: '测试' },
        techMigration: { score: 4.5, reason: '测试' },
        downstream: { score: 4.5, reason: '测试' },
        fundValuation: { score: 4.5, reason: '测试' },
        composite: 4.5,
      },
      skillD: {
        rotationSignal: { score: 4.5, reason: '测试' },
        policyEnv: { score: 4.5, reason: '测试' },
        competition: { score: 4.5, reason: '测试' },
        techMigration: { score: 4.5, reason: '测试' },
        downstream: { score: 4.5, reason: '测试' },
        fundValuation: { score: 4.5, reason: '测试' },
        composite: 4.5,
        grade: 'A',
      },
      composite: 4.5,
      isCore: true,
      recommendation: '推荐',
      positionPct: '10%',
      subTracks: [],
    },
    {
      code: 'SEMI',
      name: '半导体',
      swLevel1: '电子',
      swLevel2: '半导体',
      swLevel3: ['芯片设计', '晶圆代工'],
      keywords: ['芯片', '半导体'],
      planAlignment: { score: 4.0, reason: '测试' },
      policySupport: { score: 4.0, reason: '测试' },
      usChinaParity: { score: 4.0, reason: '测试' },
      skillC: {
        techAdvancement: { score: 4.0, weight: 0.25, reason: '测试' },
        structuralScarcity: { score: 4.0, weight: 0.25, reason: '测试' },
        localizationBarrier: { score: 4.0, weight: 0.25, reason: '测试' },
        overtakingPotential: { score: 4.0, weight: 0.25, reason: '测试' },
        composite: 4.0,
        grade: 'A',
      },
      skillA: {
        coreValue: { score: 4.0, reason: '测试' },
        scarcityValue: { score: 4.0, reason: '测试' },
        matrixPosition: '核心稀缺',
      },
      skillN: {
        rotationSignal: { score: 4.0, reason: '测试' },
        policyEnv: { score: 4.0, reason: '测试' },
        competition: { score: 4.0, reason: '测试' },
        techMigration: { score: 4.0, reason: '测试' },
        downstream: { score: 4.0, reason: '测试' },
        fundValuation: { score: 4.0, reason: '测试' },
        composite: 4.0,
      },
      skillD: {
        rotationSignal: { score: 4.0, reason: '测试' },
        policyEnv: { score: 4.0, reason: '测试' },
        competition: { score: 4.0, reason: '测试' },
        techMigration: { score: 4.0, reason: '测试' },
        downstream: { score: 4.0, reason: '测试' },
        fundValuation: { score: 4.0, reason: '测试' },
        composite: 4.0,
        grade: 'A',
      },
      composite: 4.0,
      isCore: true,
      recommendation: '推荐',
      positionPct: '10%',
      subTracks: [],
    },
  ],
}))

function createMockIndustryScore(code: string, overallScore: number | null): IndustryScore {
  return {
    code,
    name: '测试行业',
    overallScore,
    dimensionScores: [
      { name: '政策环境', score: 4.0, rationale: '测试', evidence: [], weight: 0.2 },
      { name: '技术跃迁', score: 4.0, rationale: '测试', evidence: [], weight: 0.2 },
      { name: '竞争格局', score: 4.0, rationale: '测试', evidence: [], weight: 0.2 },
      { name: '下游市场', score: 4.0, rationale: '测试', evidence: [], weight: 0.2 },
      { name: '估值安全', score: 4.0, rationale: '测试', evidence: [], weight: 0.2 },
    ],
    summary: '测试总结',
    basis: '测试依据',
    missingFields: [],
    sectorSnapshot: {
      composite: 4.5,
      recommendation: '推荐',
      positionPct: '10%',
      subTracks: [],
    },
    configSnapshot: {
      model: 'test-model',
      baseURL: 'https://test.com',
    },
    modelResponse: '{}',
    scoredAt: Date.now(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useIndustryScoreStore.setState({
    selectedCode: '',
    files: [],
    reportText: '',
    llmConfig: { baseURL: '', apiKey: '', model: '' },
    showConfig: false,
    progress: {
      fetchSectorData: 'pending',
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

describe('industryScoreStore', () => {
  // ============================================================
  // 初始状态
  // ============================================================

  test('初始状态正确', () => {
    const state = useIndustryScoreStore.getState()
    expect(state.selectedCode).toBe('')
    expect(state.sectors).toHaveLength(2)
    expect(state.files).toHaveLength(0)
    expect(state.reportText).toBe('')
    expect(state.llmConfig.baseURL).toBe('')
    expect(state.showConfig).toBe(false)
    expect(state.progress.fetchSectorData).toBe('pending')
    expect(state.progressMessage).toBe('')
    expect(state.result).toBeUndefined()
    expect(state.previousResult).toBeUndefined()
    expect(state.history).toHaveLength(0)
    expect(state.logs).toHaveLength(0)
    expect(state.error).toBe('')
    expect(state.loading).toBe(false)
  })

  // ============================================================
  // selectSelectedSector
  // ============================================================

  test('selectSelectedSector 当未选择时返回 undefined', () => {
    const state = useIndustryScoreStore.getState()
    expect(selectSelectedSector(state)).toBeUndefined()
  })

  test('selectSelectedSector 当选择有效 code 时返回对应行业', () => {
    useIndustryScoreStore.setState({ selectedCode: 'AI' })
    const state = useIndustryScoreStore.getState()
    const sector = selectSelectedSector(state)
    expect(sector).toBeDefined()
    expect(sector!.code).toBe('AI')
    expect(sector!.name).toBe('AI大模型与算力')
  })

  test('selectSelectedSector 当选择无效 code 时返回 undefined', () => {
    useIndustryScoreStore.setState({ selectedCode: 'INVALID' })
    const state = useIndustryScoreStore.getState()
    expect(selectSelectedSector(state)).toBeUndefined()
  })

  // ============================================================
  // selectConfigReady
  // ============================================================

  test('selectConfigReady 当 LLM 未配置时返回 false', () => {
    const state = useIndustryScoreStore.getState()
    expect(selectConfigReady(state)).toBe(false)
  })

  test('selectConfigReady 当 LLM 配置完整时返回 true', () => {
    useIndustryScoreStore.setState({
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' },
    })
    const state = useIndustryScoreStore.getState()
    expect(selectConfigReady(state)).toBe(true)
  })

  test('selectConfigReady 当任一字段为空时返回 false', () => {
    useIndustryScoreStore.setState({
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: '' },
    })
    const state = useIndustryScoreStore.getState()
    expect(selectConfigReady(state)).toBe(false)
  })

  // ============================================================
  // 基础 Actions
  // ============================================================

  test('setSelectedCode 更新 selectedCode', () => {
    const store = useIndustryScoreStore.getState()
    store.setSelectedCode('SEMI')
    expect(useIndustryScoreStore.getState().selectedCode).toBe('SEMI')
  })

  test('setFiles 更新 files', () => {
    const store = useIndustryScoreStore.getState()
    const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' })
    store.setFiles([mockFile])
    expect(useIndustryScoreStore.getState().files).toHaveLength(1)
    expect(useIndustryScoreStore.getState().files[0]!.name).toBe('test.txt')
  })

  test('setReportText 更新 reportText', () => {
    const store = useIndustryScoreStore.getState()
    store.setReportText('行业分析报告')
    expect(useIndustryScoreStore.getState().reportText).toBe('行业分析报告')
  })

  test('setLlmConfig 支持对象更新', () => {
    const store = useIndustryScoreStore.getState()
    store.setLlmConfig({ baseURL: 'https://api.test.com', apiKey: 'key', model: 'model' })
    const config = useIndustryScoreStore.getState().llmConfig
    expect(config.baseURL).toBe('https://api.test.com')
  })

  test('setLlmConfig 支持函数式更新', () => {
    const store = useIndustryScoreStore.getState()
    store.setLlmConfig((prev) => ({ ...prev, baseURL: 'https://api.test.com' }))
    expect(useIndustryScoreStore.getState().llmConfig.baseURL).toBe('https://api.test.com')
  })

  test('setShowConfig 支持布尔值更新', () => {
    const store = useIndustryScoreStore.getState()
    store.setShowConfig(true)
    expect(useIndustryScoreStore.getState().showConfig).toBe(true)
  })

  test('setShowConfig 支持函数式更新', () => {
    const store = useIndustryScoreStore.getState()
    store.setShowConfig((prev) => !prev)
    expect(useIndustryScoreStore.getState().showConfig).toBe(true)
  })

  test('setProgress 更新指定步骤状态', () => {
    const store = useIndustryScoreStore.getState()
    store.setProgress('fetchSectorData', 'running')
    expect(useIndustryScoreStore.getState().progress.fetchSectorData).toBe('running')
    expect(useIndustryScoreStore.getState().progress.llmAnalysis).toBe('pending')
  })

  test('resetProgress 重置所有进度', () => {
    const store = useIndustryScoreStore.getState()
    store.setProgress('fetchSectorData', 'done')
    store.setProgress('llmAnalysis', 'running')
    store.setProgressMessage('处理中...')
    store.resetProgress()
    const state = useIndustryScoreStore.getState()
    expect(state.progress.fetchSectorData).toBe('pending')
    expect(state.progress.llmAnalysis).toBe('pending')
    expect(state.progressMessage).toBe('')
  })

  // ============================================================
  // loadHistory
  // ============================================================

  test('loadHistory 成功时更新 history 和 previousResult', async () => {
    const mockHistory = [
      createMockIndustryScore('AI', 4.5),
      createMockIndustryScore('AI', 4.2),
    ]
    vi.mocked(loadIndustryScoreHistory).mockResolvedValueOnce(mockHistory)

    const store = useIndustryScoreStore.getState()
    await store.loadHistory('AI')

    const state = useIndustryScoreStore.getState()
    expect(state.history).toHaveLength(2)
    expect(state.previousResult).toBeDefined()
    expect(state.previousResult!.overallScore).toBe(4.5)
    expect(state.error).toBe('')
  })

  test('loadHistory code 为空时清空历史', async () => {
    useIndustryScoreStore.setState({
      previousResult: createMockIndustryScore('AI', 4.5),
      history: [createMockIndustryScore('AI', 4.5)],
    })

    const store = useIndustryScoreStore.getState()
    await store.loadHistory('')

    const state = useIndustryScoreStore.getState()
    expect(state.history).toHaveLength(0)
    expect(state.previousResult).toBeUndefined()
  })

  test('loadHistory 异常时设置 error', async () => {
    vi.mocked(loadIndustryScoreHistory).mockRejectedValueOnce(new Error('数据库错误'))

    const store = useIndustryScoreStore.getState()
    await store.loadHistory('AI')

    const state = useIndustryScoreStore.getState()
    expect(state.history).toHaveLength(0)
    expect(state.error).toBe('数据库错误')
  })

  // ============================================================
  // loadLogs
  // ============================================================

  test('loadLogs 成功时更新 logs', async () => {
    const mockLogs: ResearchLog[] = [
      { traceId: '1', timestamp: Date.now(), actor: 'system', action: 'score', targetType: 'industry', targetCode: 'AI' },
    ]
    vi.mocked(loadResearchLogsForTarget).mockResolvedValueOnce(mockLogs)

    const store = useIndustryScoreStore.getState()
    await store.loadLogs('AI')

    const state = useIndustryScoreStore.getState()
    expect(state.logs).toHaveLength(1)
    expect(state.logs[0]!.targetCode).toBe('AI')
    expect(state.error).toBe('')
  })

  test('loadLogs code 为空时清空 logs', async () => {
    useIndustryScoreStore.setState({
      logs: [{ traceId: '1', timestamp: Date.now(), actor: 'system', action: 'score', targetType: 'industry', targetCode: 'AI' }],
    })

    const store = useIndustryScoreStore.getState()
    await store.loadLogs('')

    const state = useIndustryScoreStore.getState()
    expect(state.logs).toHaveLength(0)
  })

  test('loadLogs 异常时设置 error', async () => {
    vi.mocked(loadResearchLogsForTarget).mockRejectedValueOnce(new Error('日志加载失败'))

    const store = useIndustryScoreStore.getState()
    await store.loadLogs('AI')

    const state = useIndustryScoreStore.getState()
    expect(state.logs).toHaveLength(0)
    expect(state.error).toBe('日志加载失败')
  })

  // ============================================================
  // runScore
  // ============================================================

  test('runScore code 为空时设置错误并返回', async () => {
    const store = useIndustryScoreStore.getState()
    await store.runScore()

    const state = useIndustryScoreStore.getState()
    expect(state.error).toBe('请选择行业/赛道')
    expect(state.loading).toBe(false)
    expect(runIndustryScore).not.toHaveBeenCalled()
  })

  test('runScore LLM 未配置时设置错误并展开配置', async () => {
    useIndustryScoreStore.setState({ selectedCode: 'AI' })
    const store = useIndustryScoreStore.getState()
    await store.runScore()

    const state = useIndustryScoreStore.getState()
    expect(state.error).toBe('请先配置 LLM 接口（baseURL、apiKey、model）')
    expect(state.showConfig).toBe(true)
    expect(state.loading).toBe(false)
    expect(runIndustryScore).not.toHaveBeenCalled()
  })

  test('runScore 成功流程并触发进度回调', async () => {
    const mockScore = createMockIndustryScore('AI', 4.5)
    const mockHistory = [mockScore]
    const mockLogs: ResearchLog[] = []

    vi.mocked(runIndustryScore).mockImplementationOnce(async (_input, onProgress) => {
      onProgress?.({ step: 'fetchSectorData', status: 'running', message: '读取中...' })
      onProgress?.({ step: 'fetchSectorData', status: 'done', message: '完成' })
      onProgress?.({ step: 'llmAnalysis', status: 'running' })
      onProgress?.({ step: 'llmAnalysis', status: 'done' })
      return { success: true, data: mockScore }
    })
    vi.mocked(loadIndustryScoreHistory).mockResolvedValueOnce(mockHistory)
    vi.mocked(loadResearchLogsForTarget).mockResolvedValueOnce(mockLogs)

    useIndustryScoreStore.setState({
      selectedCode: 'AI',
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' },
    })

    const store = useIndustryScoreStore.getState()
    await store.runScore()

    const state = useIndustryScoreStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('')
    expect(state.result).toBeDefined()
    expect(state.result!.overallScore).toBe(4.5)
    expect(state.progress.fetchSectorData).toBe('done')
    expect(state.progress.llmAnalysis).toBe('done')
    expect(state.history).toHaveLength(1)
    expect(state.previousResult).toBeDefined()
    expect(state.logs).toHaveLength(0)
  })

  test('runScore service 返回失败时设置 error', async () => {
    vi.mocked(runIndustryScore).mockResolvedValueOnce({ success: false, error: 'LLM 调用超时' })

    useIndustryScoreStore.setState({
      selectedCode: 'AI',
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' },
    })

    const store = useIndustryScoreStore.getState()
    await store.runScore()

    const state = useIndustryScoreStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('LLM 调用超时')
    expect(state.result).toBeUndefined()
  })

  test('runScore 抛出异常时设置 error', async () => {
    vi.mocked(runIndustryScore).mockRejectedValueOnce(new Error('网络中断'))

    useIndustryScoreStore.setState({
      selectedCode: 'AI',
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' },
    })

    const store = useIndustryScoreStore.getState()
    await store.runScore()

    const state = useIndustryScoreStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('网络中断')
    expect(state.result).toBeUndefined()
  })

  test('runScore 开始时重置进度和状态', async () => {
    const mockScore = createMockIndustryScore('AI', 4.5)
    vi.mocked(runIndustryScore).mockResolvedValueOnce({ success: true, data: mockScore })
    vi.mocked(loadIndustryScoreHistory).mockResolvedValueOnce([mockScore])
    vi.mocked(loadResearchLogsForTarget).mockResolvedValueOnce([])

    useIndustryScoreStore.setState({
      selectedCode: 'AI',
      llmConfig: { baseURL: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' },
      progress: { fetchSectorData: 'done', readSupplementaryFiles: 'done', prepareReportText: 'done', llmAnalysis: 'done', parseScore: 'done', saveResult: 'done' },
      progressMessage: '之前的消息',
      error: '之前的错误',
      result: createMockIndustryScore('SEMI', 3.0),
    })

    const store = useIndustryScoreStore.getState()
    await store.runScore()

    const state = useIndustryScoreStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('')
    expect(state.progress.fetchSectorData).toBe('pending')
    expect(state.progressMessage).toBe('')
    expect(state.result!.code).toBe('AI')
  })

  // ============================================================
  // resetResult
  // ============================================================

  test('resetResult 清空结果和关联状态', () => {
    useIndustryScoreStore.setState({
      result: createMockIndustryScore('AI', 4.5),
      previousResult: createMockIndustryScore('AI', 4.2),
      history: [createMockIndustryScore('AI', 4.5)],
      logs: [{ traceId: '1', timestamp: Date.now(), actor: 'system', action: 'score', targetType: 'industry', targetCode: 'AI' }],
      progress: { fetchSectorData: 'done', readSupplementaryFiles: 'done', prepareReportText: 'done', llmAnalysis: 'done', parseScore: 'done', saveResult: 'done' },
      progressMessage: '完成',
      error: '某错误',
    })

    const store = useIndustryScoreStore.getState()
    store.resetResult()

    const state = useIndustryScoreStore.getState()
    expect(state.result).toBeUndefined()
    expect(state.previousResult).toBeUndefined()
    expect(state.history).toHaveLength(0)
    expect(state.logs).toHaveLength(0)
    expect(state.progress.fetchSectorData).toBe('pending')
    expect(state.progressMessage).toBe('')
    expect(state.error).toBe('')
  })
})
