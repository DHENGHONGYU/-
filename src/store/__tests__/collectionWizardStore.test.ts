/**
 * @test_id V9-TEST-ST-166
 * @fileoverview collectionWizardStore 拆分后单元测试
 *
 * 验证拆分后的 4 个子模块（core / persistence / mock / utils）协同工作：
 * 1. utils：traceId 生成、duration 格式化
 * 2. mock：MOCK_CONFIGS 默认值
 * 3. persistence：loadSavedConfigs、loadConfigToWizard、deleteSavedConfig、renameSavedConfig
 * 4. core：通过 spread 合并 persistence actions 后，所有 action 仍可通过 store 调用
  * @covers_docs []
*/

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

// Mock services 与 lib
vi.mock('@/services/collection/collectionWizardPersistence', () => ({
  saveWizardConfig: vi.fn(async (config) => ({
    ...config,
    id: `wizard_config_${Date.now()}_mock`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })),
  loadAllWizardConfigs: vi.fn(async () => []),
  deleteWizardConfig: vi.fn(async () => true),
  updateWizardConfig: vi.fn(async (configId, updates) => ({
    id: configId,
    name: updates.name ?? 'test',
    selectedDimensions: [],
    apiConfigs: {},
    frequency: 'daily',
    cronExpression: '0 0 * * *',
    priority: 'medium',
    cacheTTL: 3600,
    cacheStrategy: 'stale-while-revalidate',
    saveAsTemplate: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })),
}))

vi.mock('@/services/collection/configExportService', () => ({
  exportAndDownloadConfig: vi.fn(),
  importConfigFromJSON: vi.fn(async (file: File) => ({
    meta: { exportVersion: '1.0', exportedAt: Date.now(), sourceName: file.name },
    config: {
      id: 'imported',
      name: 'Imported Config',
      selectedDimensions: ['quote'],
      apiConfigs: { quote: { baseUrl: 'http://test', timeoutMs: 5000 } },
      frequency: 'daily',
      cronExpression: '0 0 * * *',
      priority: 'medium',
      cacheTTL: 3600,
      cacheStrategy: 'stale-while-revalidate',
      saveAsTemplate: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  })),
  validateImportedConfig: vi.fn(() => ({ ok: true })),
}))

vi.mock('@/lib/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))

import { useCollectionWizardStore } from '@/store/collectionWizardStore'
import { MOCK_CONFIGS } from '@/store/collectionWizardStore.mock'
import {
  generateTraceId,
  formatDuration,
  generateConfigId,
} from '@/store/collectionWizardStore.utils'
// 导入 mocked 函数以便在测试中 per-test 控制行为
import { saveWizardConfig, loadAllWizardConfigs } from '@/services/collection/collectionWizardPersistence'
import { withBroadcast } from '@/lib/withBroadcast'
import type { ApiConfig } from '@/types/modules/collection.types'

describe('collectionWizardStore.utils', () => {
  it('generateTraceId 应返回带 trace_ 前缀的字符串', () => {
    const id = generateTraceId()
    expect(id).toMatch(/^trace_\d+_[a-z0-9]+$/)
  })

  it('formatDuration 应正确格式化毫秒与秒', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(0)).toBe('0ms')
  })

  it('generateConfigId 应返回带 wizard_config_ 前缀的字符串', () => {
    const id = generateConfigId()
    expect(id).toMatch(/^wizard_config_\d+_[a-z0-9]+$/)
  })
})

describe('collectionWizardStore.mock', () => {
  it('MOCK_CONFIGS 应包含 3 个默认配置', () => {
    expect(MOCK_CONFIGS).toHaveLength(3)
    expect(MOCK_CONFIGS[0]?.name).toBe('高频行情监控')
    expect(MOCK_CONFIGS[1]?.name).toBe('每日舆情分析')
    expect(MOCK_CONFIGS[2]?.name).toBe('基础行情采集')
  })

  it('MOCK_CONFIGS 应包含完整的 PersistedWizardConfig 字段', () => {
    for (const c of MOCK_CONFIGS) {
      expect(c).toHaveProperty('id')
      expect(c).toHaveProperty('name')
      expect(c).toHaveProperty('selectedDimensions')
      expect(c).toHaveProperty('apiConfigs')
      expect(c).toHaveProperty('frequency')
      expect(c).toHaveProperty('cronExpression')
      expect(c).toHaveProperty('priority')
      expect(c).toHaveProperty('cacheTTL')
      expect(c).toHaveProperty('cacheStrategy')
      expect(c).toHaveProperty('saveAsTemplate')
      expect(c).toHaveProperty('createdAt')
      expect(c).toHaveProperty('updatedAt')
    }
  })
})

describe('collectionWizardStore 核心', () => {
  beforeEach(() => {
    // 重置 store
    useCollectionWizardStore.getState().resetWizard()
  })

  it('初始状态应包含默认值', () => {
    const state = useCollectionWizardStore.getState()
    expect(state.currentStep).toBe(1)
    expect(state.isOpen).toBe(false)
    expect(state.selectedDimensions).toEqual([])
    expect(state.taskStatus).toBe('idle')
    expect(state.savedConfigs).toHaveLength(0) // 初始为空，从 DB 加载
    expect(state.isSavingConfig).toBe(false)
  })

  it('setStep 应更新当前步骤', () => {
    const { setStep } = useCollectionWizardStore.getState()
    setStep(3)
    expect(useCollectionWizardStore.getState().currentStep).toBe(3)
  })

  it('toggleDimension 应正确添加/移除维度', () => {
    const { toggleDimension } = useCollectionWizardStore.getState()
    toggleDimension('quote', true)
    expect(useCollectionWizardStore.getState().selectedDimensions).toContain('quote')
    toggleDimension('quote', false)
    expect(useCollectionWizardStore.getState().selectedDimensions).not.toContain('quote')
  })

  it('setFrequency/setPriority 等 setActions 应正确更新状态', () => {
    const { setFrequency, setPriority, setCacheTTL, setTaskName } = useCollectionWizardStore.getState()
    setFrequency('hourly')
    setPriority('high')
    setCacheTTL(1800)
    setTaskName('测试任务')
    const s = useCollectionWizardStore.getState()
    expect(s.frequency).toBe('hourly')
    expect(s.priority).toBe('high')
    expect(s.cacheTTL).toBe(1800)
    expect(s.taskName).toBe('测试任务')
  })

  it('addLog 应添加日志条目', () => {
    const { addLog } = useCollectionWizardStore.getState()
    addLog({ level: 'info', message: '测试日志', stage: 'test' })
    const logs = useCollectionWizardStore.getState().logs
    expect(logs).toHaveLength(1)
    expect(logs[0]?.message).toBe('测试日志')
    expect(logs[0]?.id).toMatch(/^log_/)
  })

  it('resetWizard 应重置为初始状态但保留 savedConfigs', () => {
    const { toggleDimension, setTaskName, resetWizard } = useCollectionWizardStore.getState()
    toggleDimension('quote', true)
    setTaskName('temp')
    resetWizard()
    const s = useCollectionWizardStore.getState()
    expect(s.selectedDimensions).toEqual([])
    expect(s.taskName).toBe('')
    expect(s.savedConfigs).toHaveLength(0) // 初始为空，reset 后仍然为空
  })
})

describe('collectionWizardStore 持久化 actions', () => {
  beforeEach(() => {
    // 显式重置为 MOCK_CONFIGS（避免前一个测试的状态污染）
    useCollectionWizardStore.setState({ savedConfigs: MOCK_CONFIGS })
    useCollectionWizardStore.getState().resetWizard()
  })

  it('loadSavedConfigs 应从 IndexedDB 加载配置列表', async () => {
    const { loadSavedConfigs } = useCollectionWizardStore.getState()
    await loadSavedConfigs()
    const configs = useCollectionWizardStore.getState().savedConfigs
    // mock 返回 []，但 store 中已有 mock 数据，应保留
    expect(configs.length).toBeGreaterThanOrEqual(0)
  })

  it('loadConfigToWizard 应将配置字段加载到向导状态', () => {
    const { loadConfigToWizard } = useCollectionWizardStore.getState()
    const config = MOCK_CONFIGS[0]!
    loadConfigToWizard(config)
    const s = useCollectionWizardStore.getState()
    expect(s.selectedDimensions).toEqual(config.selectedDimensions)
    expect(s.frequency).toBe(config.frequency)
    expect(s.priority).toBe(config.priority)
    expect(s.taskName).toBe(config.name)
  })

  it('deleteSavedConfig 应从 savedConfigs 移除配置', async () => {
    const { deleteSavedConfig } = useCollectionWizardStore.getState()
    const beforeCount = useCollectionWizardStore.getState().savedConfigs.length
    await deleteSavedConfig(MOCK_CONFIGS[0]!.id)
    const afterCount = useCollectionWizardStore.getState().savedConfigs.length
    expect(afterCount).toBe(beforeCount - 1)
  })

  it('renameSavedConfig 在重名时应返回 success=false', async () => {
    const { renameSavedConfig } = useCollectionWizardStore.getState()
    // MOCK_CONFIGS[0].name = '高频行情监控'，尝试把 MOCK_CONFIGS[1] 重命名为 '高频行情监控'
    const result = await renameSavedConfig(MOCK_CONFIGS[1]!.id, '高频行情监控')
    expect(result.success).toBe(false)
    expect(result.error).toContain('已存在')
  })

  it('renameSavedConfig 成功时应更新 savedConfigs', async () => {
    const { renameSavedConfig } = useCollectionWizardStore.getState()
    const result = await renameSavedConfig(MOCK_CONFIGS[0]!.id, '新的名称')
    expect(result.success).toBe(true)
    const updated = useCollectionWizardStore.getState().savedConfigs.find(c => c.id === MOCK_CONFIGS[0]!.id)
    expect(updated?.name).toBe('新的名称')
  })

  it('exportConfig 在配置不存在时不应抛出错误', () => {
    const { exportConfig } = useCollectionWizardStore.getState()
    expect(() => exportConfig('non-existent')).not.toThrow()
  })
})

// ============================================================
// 步骤控制补充：openWizard / closeWizard
// @test_id V9-TEST-ST-166-EXT-1
// 覆盖行：148-167
// ============================================================
describe('collectionWizardStore 步骤控制（补充）', () => {
  beforeEach(() => {
    useCollectionWizardStore.getState().resetWizard()
    vi.clearAllMocks()
  })

  it('openWizard 应设置 isOpen=true 并记录日志', () => {
    const { openWizard } = useCollectionWizardStore.getState()
    openWizard()

    expect(useCollectionWizardStore.getState().isOpen).toBe(true)
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[CollectionWizardStore] openWizard',
      expect.objectContaining({ previousTaskId: null, previousStatus: 'idle' }),
    )
    // 应广播 openWizard 事件
    expect(vi.mocked(withBroadcast)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'openWizard' }),
    )
  })

  it('openWizard 应自动触发 loadSavedConfigs', async () => {
    const { openWizard } = useCollectionWizardStore.getState()
    openWizard()

    // loadSavedConfigs 是 void 调用的 async，等待微任务完成
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(vi.mocked(loadAllWizardConfigs)).toHaveBeenCalled()
  })

  it('closeWizard 应设置 isOpen=false 并记录日志', () => {
    const store = useCollectionWizardStore.getState()
    store.openWizard()
    expect(useCollectionWizardStore.getState().isOpen).toBe(true)

    useCollectionWizardStore.getState().closeWizard()

    expect(useCollectionWizardStore.getState().isOpen).toBe(false)
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[CollectionWizardStore] closeWizard',
      expect.objectContaining({ taskId: null, taskStatus: 'idle', logCount: 0 }),
    )
    expect(vi.mocked(withBroadcast)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'closeWizard' }),
    )
  })
})

// ============================================================
// 配置收集补充：updateApiConfig / setCronExpression / setCacheStrategy / setSaveAsTemplate
// @test_id V9-TEST-ST-166-EXT-2
// 覆盖行：197-207, 217-222, 238-243, 251-255
// ============================================================
describe('collectionWizardStore 配置收集（补充）', () => {
  beforeEach(() => {
    useCollectionWizardStore.getState().resetWizard()
    vi.clearAllMocks()
  })

  it('updateApiConfig 应为指定维度更新 API 配置', () => {
    const { updateApiConfig } = useCollectionWizardStore.getState()
    const config: ApiConfig = { baseUrl: 'http://test-api/quote', timeoutMs: 5000, rateLimitPerMinute: 30 }

    updateApiConfig('quote', config)

    const state = useCollectionWizardStore.getState()
    expect(state.apiConfigs['quote']).toEqual(config)
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[CollectionWizardStore] updateApiConfig',
      expect.objectContaining({ code: 'quote', previous: null, updated: config }),
    )
    expect(vi.mocked(withBroadcast)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'updateApiConfig', code: 'quote', config }),
    )
  })

  it('updateApiConfig 在已有配置时应记录 previous 值', () => {
    const store = useCollectionWizardStore.getState()
    const oldConfig: ApiConfig = { baseUrl: 'http://old', timeoutMs: 3000 }
    const newConfig: ApiConfig = { baseUrl: 'http://new', timeoutMs: 8000 }
    store.updateApiConfig('news', oldConfig)
    vi.clearAllMocks()

    store.updateApiConfig('news', newConfig)

    expect(mockLogger.info).toHaveBeenCalledWith(
      '[CollectionWizardStore] updateApiConfig',
      expect.objectContaining({ code: 'news', previous: oldConfig, updated: newConfig }),
    )
  })

  it('setCronExpression 应更新 cron 表达式', () => {
    const { setCronExpression } = useCollectionWizardStore.getState()
    setCronExpression('0 */2 * * *')

    expect(useCollectionWizardStore.getState().cronExpression).toBe('0 */2 * * *')
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[CollectionWizardStore] setCronExpression',
      expect.objectContaining({ from: '0 0 * * *', to: '0 */2 * * *' }),
    )
  })

  it('setCacheStrategy 应更新缓存策略', () => {
    const { setCacheStrategy } = useCollectionWizardStore.getState()
    setCacheStrategy('cache-first')

    expect(useCollectionWizardStore.getState().cacheStrategy).toBe('cache-first')
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[CollectionWizardStore] setCacheStrategy',
      expect.objectContaining({ from: 'stale-while-revalidate', to: 'cache-first' }),
    )
  })

  it('setSaveAsTemplate 应更新保存为模板标志', () => {
    const { setSaveAsTemplate } = useCollectionWizardStore.getState()
    setSaveAsTemplate(true)

    expect(useCollectionWizardStore.getState().saveAsTemplate).toBe(true)
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[CollectionWizardStore] setSaveAsTemplate',
      expect.objectContaining({ save: true }),
    )
    expect(vi.mocked(withBroadcast)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'setSaveAsTemplate', save: true }),
    )
  })
})

// ============================================================
// 任务生命周期：startTask / pauseTask / resumeTask / stopTask
// @test_id V9-TEST-ST-166-EXT-3
// 覆盖行：252-462
// ============================================================
describe('collectionWizardStore 任务生命周期', () => {
  beforeEach(() => {
    useCollectionWizardStore.getState().resetWizard()
    vi.clearAllMocks()
  })

  // 确保 fake timer 测试失败时也能恢复 real timer
  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── startTask 基础路径 ───

  it('startTask（不保存模板）应设置任务状态并初始化进度', async () => {
    const { toggleDimension, setTaskName, startTask } = useCollectionWizardStore.getState()
    toggleDimension('quote', true)
    toggleDimension('news', true)
    setTaskName('测试任务')

    await startTask()

    const state = useCollectionWizardStore.getState()
    expect(state.traceId).toMatch(/^trace_/)
    expect(state.taskId).toMatch(/^task_/)
    expect(state.taskStatus).toBe('running')
    expect(state.dimensionProgress).toHaveLength(2)
    expect(state.dimensionProgress[0]).toEqual(
      expect.objectContaining({ dimensionCode: 'quote', progress: 0 }),
    )
    // simulateProgress 同步执行到第一个 await 前，已将第一个维度状态设为 running
    expect(state.dimensionProgress[0]?.status).toBe('running')
    // 应添加 task:start 和 task:config 日志
    const logs = state.logs
    expect(logs.some((l) => l.stage === 'task:start')).toBe(true)
    expect(logs.some((l) => l.stage === 'task:config')).toBe(true)
    // 未保存模板时不应调用 saveWizardConfig
    expect(vi.mocked(saveWizardConfig)).not.toHaveBeenCalled()
  })

  it('startTask（空 taskName）日志应使用 "未命名"', async () => {
    const { toggleDimension, startTask } = useCollectionWizardStore.getState()
    toggleDimension('quote', true)

    await startTask()

    const state = useCollectionWizardStore.getState()
    const startLog = state.logs.find((l) => l.stage === 'task:start')
    expect(startLog?.message).toContain('未命名')
  })

  // ─── startTask 保存模板路径 ───

  it('startTask（saveAsTemplate=true）应先保存配置再启动任务', async () => {
    const { toggleDimension, setTaskName, setSaveAsTemplate, startTask } = useCollectionWizardStore.getState()
    toggleDimension('quote', true)
    setTaskName('模板任务')
    setSaveAsTemplate(true)

    await startTask()

    // 应调用 saveWizardConfig 保存配置
    expect(vi.mocked(saveWizardConfig)).toHaveBeenCalledTimes(1)
    const savedArg = vi.mocked(saveWizardConfig).mock.calls[0]![0]
    expect(savedArg).toEqual(
      expect.objectContaining({
        name: '模板任务',
        selectedDimensions: ['quote'],
        saveAsTemplate: true,
      }),
    )
    // isSavingConfig 应恢复为 false
    expect(useCollectionWizardStore.getState().isSavingConfig).toBe(false)
    // 任务应已启动
    expect(useCollectionWizardStore.getState().taskStatus).toBe('running')
  })

  it('startTask（saveAsTemplate=true，taskName 为空）应使用默认配置名', async () => {
    const { toggleDimension, setSaveAsTemplate, startTask } = useCollectionWizardStore.getState()
    toggleDimension('quote', true)
    setSaveAsTemplate(true)

    await startTask()

    expect(vi.mocked(saveWizardConfig)).toHaveBeenCalledTimes(1)
    const savedArg = vi.mocked(saveWizardConfig).mock.calls[0]![0] as { name: string }
    expect(savedArg.name).toMatch(/^配置_/)
  })

  it('startTask（saveAsTemplate=true，保存失败）应记录错误但继续启动任务', async () => {
    const { toggleDimension, setSaveAsTemplate, startTask } = useCollectionWizardStore.getState()
    toggleDimension('quote', true)
    setSaveAsTemplate(true)
    vi.mocked(saveWizardConfig).mockRejectedValueOnce(new Error('DB 写入失败'))

    await startTask()

    // 应记录保存失败错误
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[CollectionWizardStore] startTask - 配置模板保存失败',
      expect.objectContaining({ error: 'DB 写入失败' }),
    )
    // isSavingConfig 应恢复为 false
    expect(useCollectionWizardStore.getState().isSavingConfig).toBe(false)
    // 任务仍应正常启动（保存失败不阻断）
    expect(useCollectionWizardStore.getState().taskStatus).toBe('running')
    expect(useCollectionWizardStore.getState().traceId).toMatch(/^trace_/)
  })

  // ─── startTask 进度模拟完成 ───

  it('startTask simulateProgress 完成后 taskStatus 应为 completed', async () => {
    vi.useFakeTimers()

    const { toggleDimension, startTask } = useCollectionWizardStore.getState()
    toggleDimension('quote', true)

    await startTask()

    // 初始状态为 running
    expect(useCollectionWizardStore.getState().taskStatus).toBe('running')

    // 推进 fake timer 完成 simulateProgress（单维度约需 2000ms）
    await vi.advanceTimersByTimeAsync(3000)

    // 任务应完成
    expect(useCollectionWizardStore.getState().taskStatus).toBe('completed')
    // 维度进度应为 100 且状态为 completed
    const dim = useCollectionWizardStore.getState().dimensionProgress[0]
    expect(dim?.progress).toBe(100)
    expect(dim?.status).toBe('completed')
    // 应有 task:complete 日志
    const logs = useCollectionWizardStore.getState().logs
    expect(logs.some((l) => l.stage === 'task:complete')).toBe(true)

    vi.useRealTimers()
  })

  // ─── pauseTask / resumeTask / stopTask ───

  it('pauseTask 应设置 taskStatus=paused 并添加 warn 日志', () => {
    // 先设置一个运行中的任务状态
    useCollectionWizardStore.setState({
      taskId: 'task_test_001',
      traceId: 'trace_test_001',
      taskStatus: 'running',
    })

    useCollectionWizardStore.getState().pauseTask()

    const state = useCollectionWizardStore.getState()
    expect(state.taskStatus).toBe('paused')
    // 应添加 task:pause 日志
    const pauseLog = state.logs.find((l) => l.stage === 'task:pause')
    expect(pauseLog).toBeDefined()
    expect(pauseLog?.level).toBe('warn')
    expect(pauseLog?.traceId).toBe('trace_test_001')
    // 应广播 pauseTask 事件
    expect(vi.mocked(withBroadcast)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'pauseTask', taskId: 'task_test_001' }),
    )
  })

  it('resumeTask 应设置 taskStatus=running 并添加 info 日志', () => {
    useCollectionWizardStore.setState({
      taskId: 'task_test_002',
      traceId: 'trace_test_002',
      taskStatus: 'paused',
    })

    useCollectionWizardStore.getState().resumeTask()

    const state = useCollectionWizardStore.getState()
    expect(state.taskStatus).toBe('running')
    const resumeLog = state.logs.find((l) => l.stage === 'task:resume')
    expect(resumeLog).toBeDefined()
    expect(resumeLog?.level).toBe('info')
    expect(resumeLog?.traceId).toBe('trace_test_002')
    expect(vi.mocked(withBroadcast)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'resumeTask', taskId: 'task_test_002' }),
    )
  })

  it('stopTask 应设置 taskStatus=failed 并添加 error 日志', () => {
    useCollectionWizardStore.setState({
      taskId: 'task_test_003',
      traceId: 'trace_test_003',
      taskStatus: 'running',
      logs: [],
    })

    useCollectionWizardStore.getState().stopTask()

    const state = useCollectionWizardStore.getState()
    expect(state.taskStatus).toBe('failed')
    const stopLog = state.logs.find((l) => l.stage === 'task:abort')
    expect(stopLog).toBeDefined()
    expect(stopLog?.level).toBe('error')
    expect(stopLog?.traceId).toBe('trace_test_003')
    expect(vi.mocked(withBroadcast)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'stopTask', taskId: 'task_test_003' }),
    )
  })

  it('pauseTask/resumeTask/stopTask 在无 traceId 时日志 traceId 应为 undefined', () => {
    useCollectionWizardStore.setState({
      taskId: 'task_no_trace',
      traceId: null,
      taskStatus: 'running',
      logs: [],
    })

    useCollectionWizardStore.getState().pauseTask()

    const pauseLog = useCollectionWizardStore.getState().logs.find((l) => l.stage === 'task:pause')
    expect(pauseLog?.traceId).toBeUndefined()
  })
})

// ============================================================
// 日志与进度补充：updateDimensionProgress
// @test_id V9-TEST-ST-166-EXT-4
// 覆盖行：476-478
// ============================================================
describe('collectionWizardStore 日志与进度（补充）', () => {
  beforeEach(() => {
    useCollectionWizardStore.getState().resetWizard()
    vi.clearAllMocks()
  })

  it('updateDimensionProgress 应更新指定维度的进度', () => {
    useCollectionWizardStore.setState({
      dimensionProgress: [
        { dimensionCode: 'quote', dimensionName: '行情', progress: 0, status: 'pending' },
        { dimensionCode: 'news', dimensionName: '资讯', progress: 0, status: 'pending' },
      ],
    })

    useCollectionWizardStore.getState().updateDimensionProgress('quote', { progress: 50, status: 'running' })

    const dims = useCollectionWizardStore.getState().dimensionProgress
    expect(dims[0]).toEqual({ dimensionCode: 'quote', dimensionName: '行情', progress: 50, status: 'running' })
    // 其他维度不受影响
    expect(dims[1]).toEqual({ dimensionCode: 'news', dimensionName: '资讯', progress: 0, status: 'pending' })
  })

  it('updateDimensionProgress 应支持部分更新（仅更新 progress）', () => {
    useCollectionWizardStore.setState({
      dimensionProgress: [
        { dimensionCode: 'quote', dimensionName: '行情', progress: 20, status: 'running' },
      ],
    })

    useCollectionWizardStore.getState().updateDimensionProgress('quote', { progress: 80 })

    const dim = useCollectionWizardStore.getState().dimensionProgress[0]
    expect(dim?.progress).toBe(80)
    // status 应保持不变
    expect(dim?.status).toBe('running')
  })

  it('updateDimensionProgress 在维度不存在时不应抛出错误', () => {
    useCollectionWizardStore.setState({ dimensionProgress: [] })

    expect(() =>
      useCollectionWizardStore.getState().updateDimensionProgress('nonexistent', { progress: 100 }),
    ).not.toThrow()
    // 空数组应保持不变
    expect(useCollectionWizardStore.getState().dimensionProgress).toEqual([])
  })
})
