/**
 * @test_id V9-TEST-ST-150
 * @covers_docs [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-073, V9-DOC-DATA-068, V9-DOC-FRONT-020]
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useSevenDimConfigStore } from './sevenDimConfigStore'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { STRATEGY_TEMPLATES, GLOBAL_LIMITS } from '@/config/collectConfig'

// ============================================================
// Mocks
// ============================================================

const mockQuery = vi.hoisted(() => vi.fn())
const mockForward = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: mockForward,
    query: mockQuery,
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  },
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: {
    saveCollectConfig: 'SAVE_COLLECT_CONFIG',
  },
  ENVELOPE_TARGET: { db: 'DB' },
  MODULE_ID: { fetcher: 'fetcher' },
  STORE_NAME: { collectConfig: 'collect_config' },
}))

vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: {
    DATA_TEST_CHANGED: 'data:test:changed',
  },
}))

// Mock collectionPipeline
vi.mock('@/services/data-collector/collectionPipeline', () => ({
  upgradeDimensionsToPipeline: vi.fn((dims) =>
    (dims ?? []).map((d: Record<string, unknown>) => ({
      ...d,
      sourcePriority: d.sourcePriority ?? [],
      concurrency: d.concurrency ?? 3,
      retryPolicy: d.retryPolicy ?? { maxRetries: 2, backoffMultiplier: 2, initialDelayMs: 500 },
      timeoutPolicy: d.timeoutPolicy ?? { requestTimeoutMs: 5000, dimensionTimeoutMs: 30000 },
      fallbackPolicy: d.fallbackPolicy ?? { allowFallback: true, allowMockFallback: false, alertFailureRate: 80 },
    })),
  ),
  runBatchTrace: vi.fn().mockResolvedValue([{ success: true }]),
}))

// Mock collectionRuntimeStore
const mockSetRunning = vi.fn()
const mockRefreshStats = vi.fn()
vi.mock('@/store/collectionRuntimeStore', () => ({
  useCollectionRuntimeStore: {
    getState: () => ({
      setRunning: mockSetRunning,
      refreshStats: mockRefreshStats,
    }),
  },
}))

// Mock intentionPoolStore
vi.mock('@/store/intentionPoolStore', () => ({
  useIntentionPoolStore: {
    getState: vi.fn(() => ({ items: [] })),
  },
}))

// ============================================================
// Helpers
// ============================================================

function getFirstDimensionCode(): string {
  const dims = useSevenDimConfigStore.getState().dimensions
  return dims[0]?.code ?? '01'
}

function setIntentionPoolSymbols(symbols: string[]) {
  vi.mocked(useIntentionPoolStore.getState).mockReturnValue(
    { items: symbols.map((s) => ({ symbol: s })) } as unknown as ReturnType<typeof useIntentionPoolStore.getState>,
  )
}

// ============================================================
// useSevenDimConfigStore
// ============================================================

describe('useSevenDimConfigStore', () => {
  beforeEach(() => {
    useSevenDimConfigStore.getState().reset()
    vi.clearAllMocks()
  })

  // ==========================================================
  // 1. 初始状态
  // ==========================================================

  describe('初始状态', () => {
    it('默认 activeTemplate 为 full', () => {
      expect(useSevenDimConfigStore.getState().activeTemplate).toBe('full')
    })

    it('默认维度数量为 8 个', () => {
      expect(useSevenDimConfigStore.getState().dimensions).toHaveLength(8)
    })

    it('所有维度都有 code 和 name 字段', () => {
      const dims = useSevenDimConfigStore.getState().dimensions
      dims.forEach((dim) => {
        expect(dim.code).toBeDefined()
        expect(dim.name).toBeDefined()
        expect(typeof dim.enabled).toBe('boolean')
      })
    })

    it('full 模板下所有维度均启用', () => {
      const dims = useSevenDimConfigStore.getState().dimensions
      const enabledCount = dims.filter((d) => d.enabled).length
      expect(enabledCount).toBe(8)
    })

    it('默认 symbolCount 为 40', () => {
      expect(useSevenDimConfigStore.getState().symbolCount).toBe(40)
    })

    it('默认 historyDays 为 252', () => {
      expect(useSevenDimConfigStore.getState().historyDays).toBe(252)
    })

    it('默认全局策略包含所有字段', () => {
      const global = useSevenDimConfigStore.getState().global
      expect(global.maxSymbols).toBe(GLOBAL_LIMITS.maxSymbols)
      expect(global.defaultBatchSize).toBe(GLOBAL_LIMITS.defaultBatchSize)
      expect(global.rateLimitPerMinute).toBe(GLOBAL_LIMITS.rateLimitPerMinute)
      expect(global.notifyOnComplete).toBe(true)
      expect(global.notifyOnError).toBe(true)
    })

    it('默认 isDirty 为 false', () => {
      expect(useSevenDimConfigStore.getState().isDirty).toBe(false)
    })

    it('默认 isCollecting 为 false', () => {
      expect(useSevenDimConfigStore.getState().isCollecting).toBe(false)
    })

    it('默认 collectingDimensions 为空数组', () => {
      expect(useSevenDimConfigStore.getState().collectingDimensions).toEqual([])
    })

    it('默认 collectProgress 为 0', () => {
      expect(useSevenDimConfigStore.getState().collectProgress).toBe(0)
    })

    it('默认 error 为 null', () => {
      expect(useSevenDimConfigStore.getState().error).toBeNull()
    })
  })

  // ==========================================================
  // 2. 派生计算
  // ==========================================================

  describe('派生计算', () => {
    it('enabledCount: full 模板下返回 8', () => {
      const count = useSevenDimConfigStore.getState().enabledCount()
      expect(count).toBe(8)
    })

    it('monthlyCallEstimate: 返回数字且大于 0', () => {
      const estimate = useSevenDimConfigStore.getState().monthlyCallEstimate()
      expect(typeof estimate).toBe('number')
      expect(estimate).toBeGreaterThan(0)
    })

    it('isClickable: 无采集进行中返回 true', () => {
      const clickable = useSevenDimConfigStore.getState().isClickable()
      expect(clickable).toBe(true)
    })

    it('isClickable: 指定维度未采集中返回 true', () => {
      const clickable = useSevenDimConfigStore.getState().isClickable('01')
      expect(clickable).toBe(true)
    })

    it('tooltipText: 无采集进行中返回空字符串', () => {
      const text = useSevenDimConfigStore.getState().tooltipText()
      expect(text).toBe('')
    })

    it('tooltipText: 指定维度未采集中返回空字符串', () => {
      const text = useSevenDimConfigStore.getState().tooltipText('01')
      expect(text).toBe('')
    })

    it('getCollectionConfig: 返回完整配置对象', () => {
      const config = useSevenDimConfigStore.getState().getCollectionConfig()
      expect(config.version).toBe('1.0.0')
      expect(config.activeTemplate).toBe('full')
      expect(config.dimensions).toHaveLength(8)
      expect(config.symbolCount).toBe(40)
      expect(config.historyDays).toBe(252)
      expect(typeof config.updatedAt).toBe('number')
    })
  })

  // ==========================================================
  // 3. 配置管理 - 模板切换
  // ==========================================================

  describe('配置模板切换', () => {
    it('applyTemplate: 切换到 value 模板', () => {
      useSevenDimConfigStore.getState().applyTemplate('value')
      const state = useSevenDimConfigStore.getState()
      expect(state.activeTemplate).toBe('value')
      expect(state.historyDays).toBe(252)
      expect(state.isDirty).toBe(true)
    })

    it('applyTemplate: value 模板启用 4 个维度', () => {
      useSevenDimConfigStore.getState().applyTemplate('value')
      const enabled = useSevenDimConfigStore.getState().dimensions.filter((d) => d.enabled)
      expect(enabled).toHaveLength(4)
    })

    it('applyTemplate: 切换到 growth 模板', () => {
      useSevenDimConfigStore.getState().applyTemplate('growth')
      const state = useSevenDimConfigStore.getState()
      expect(state.activeTemplate).toBe('growth')
      expect(state.historyDays).toBe(126)
    })

    it('applyTemplate: 切换到 defense 模板', () => {
      useSevenDimConfigStore.getState().applyTemplate('defense')
      const state = useSevenDimConfigStore.getState()
      expect(state.activeTemplate).toBe('defense')
      expect(state.historyDays).toBe(504)
    })

    it('applyTemplate: 切换到 cycle 模板', () => {
      useSevenDimConfigStore.getState().applyTemplate('cycle')
      const state = useSevenDimConfigStore.getState()
      expect(state.activeTemplate).toBe('cycle')
      expect(state.historyDays).toBe(252)
    })

    it('applyTemplate: 无效模板 ID 不改变状态', () => {
      const before = useSevenDimConfigStore.getState().activeTemplate
      useSevenDimConfigStore.getState().applyTemplate('invalid' as never)
      const after = useSevenDimConfigStore.getState().activeTemplate
      expect(after).toBe(before)
    })

    it('所有 5 个模板都可正常切换', () => {
      const templates: Array<'value' | 'growth' | 'defense' | 'cycle' | 'full'> = ['value', 'growth', 'defense', 'cycle', 'full']
      templates.forEach((t) => {
        useSevenDimConfigStore.getState().applyTemplate(t)
        expect(useSevenDimConfigStore.getState().activeTemplate).toBe(t)
      })
    })
  })

  // ==========================================================
  // 4. 配置管理 - 维度操作
  // ==========================================================

  describe('维度启用/禁用', () => {
    it('toggleDimension: 禁用单个维度', () => {
      const code = getFirstDimensionCode()
      useSevenDimConfigStore.getState().toggleDimension(code)
      const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === code)
      expect(dim?.enabled).toBe(false)
    })

    it('toggleDimension: 再次调用恢复启用', () => {
      const code = getFirstDimensionCode()
      useSevenDimConfigStore.getState().toggleDimension(code)
      useSevenDimConfigStore.getState().toggleDimension(code)
      const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === code)
      expect(dim?.enabled).toBe(true)
    })

    it('toggleDimension: 切换后 isDirty 变为 true', () => {
      const code = getFirstDimensionCode()
      useSevenDimConfigStore.getState().toggleDimension(code)
      expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
    })

    it('toggleDimension: 禁用后 enabledCount 减 1', () => {
      const before = useSevenDimConfigStore.getState().enabledCount()
      const code = getFirstDimensionCode()
      useSevenDimConfigStore.getState().toggleDimension(code)
      const after = useSevenDimConfigStore.getState().enabledCount()
      expect(after).toBe(before - 1)
    })
  })

  describe('维度频率设置', () => {
    it('setDimensionFrequency: 修改频率', () => {
      const code = getFirstDimensionCode()
      useSevenDimConfigStore.getState().setDimensionFrequency(code, 'weekly')
      const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === code)
      expect(dim?.frequency).toBe('weekly')
    })

    it('setDimensionFrequency: 修改后 isDirty 为 true', () => {
      const code = getFirstDimensionCode()
      useSevenDimConfigStore.getState().setDimensionFrequency(code, 'monthly')
      expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
    })
  })

  describe('维度数据源设置', () => {
    it('setDimensionSources: 修改数据源列表', () => {
      const code = getFirstDimensionCode()
      useSevenDimConfigStore.getState().setDimensionSources(code, ['akshare', 'yahoo'])
      const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === code)
      expect(dim?.sources).toEqual(['akshare', 'yahoo'])
    })

    it('setDimensionSources: 修改后 isDirty 为 true', () => {
      const code = getFirstDimensionCode()
      useSevenDimConfigStore.getState().setDimensionSources(code, ['akshare'])
      expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
    })
  })

  describe('维度数据源优先级设置', () => {
    it('setDimensionSourcePriority: 修改优先级', () => {
      const code = getFirstDimensionCode()
      const priority = [
        { id: 'akshare' as const, priority: 1, enabled: true },
        { id: 'ifind' as const, priority: 2, enabled: true },
      ]
      useSevenDimConfigStore.getState().setDimensionSourcePriority(code, priority)
      const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === code)
      expect(dim?.sourcePriority).toEqual(priority)
    })
  })

  describe('维度策略设置', () => {
    it('setDimensionPolicy: 修改重试策略', () => {
      const code = getFirstDimensionCode()
      const retryPolicy = { maxRetries: 5, backoffMultiplier: 3, initialDelayMs: 1000 }
      useSevenDimConfigStore.getState().setDimensionPolicy(code, { retryPolicy })
      const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === code)
      expect(dim?.retryPolicy).toEqual(retryPolicy)
    })

    it('setDimensionPolicy: 修改超时策略', () => {
      const code = getFirstDimensionCode()
      const timeoutPolicy = { requestTimeoutMs: 10000, dimensionTimeoutMs: 60000 }
      useSevenDimConfigStore.getState().setDimensionPolicy(code, { timeoutPolicy })
      const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === code)
      expect(dim?.timeoutPolicy).toEqual(timeoutPolicy)
    })

    it('setDimensionPolicy: 同时修改多个策略', () => {
      const code = getFirstDimensionCode()
      const retryPolicy = { maxRetries: 3, backoffMultiplier: 2, initialDelayMs: 800 }
      const timeoutPolicy = { requestTimeoutMs: 8000, dimensionTimeoutMs: 40000 }
      useSevenDimConfigStore.getState().setDimensionPolicy(code, { retryPolicy, timeoutPolicy })
      const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === code)
      expect(dim?.retryPolicy).toEqual(retryPolicy)
      expect(dim?.timeoutPolicy).toEqual(timeoutPolicy)
    })
  })

  describe('维度字段设置', () => {
    it('setDimensionFields: 修改字段列表', () => {
      const code = getFirstDimensionCode()
      const fields = ['field1', 'field2', 'field3']
      useSevenDimConfigStore.getState().setDimensionFields(code, fields)
      const dim = useSevenDimConfigStore.getState().dimensions.find((d) => d.code === code)
      expect(dim?.fields).toEqual(fields)
    })
  })

  // ==========================================================
  // 5. 全局配置
  // ==========================================================

  describe('全局配置', () => {
    it('setSymbolCount: 修改标的数', () => {
      useSevenDimConfigStore.getState().setSymbolCount(100)
      expect(useSevenDimConfigStore.getState().symbolCount).toBe(100)
    })

    it('setSymbolCount: 低于最小值时钳制到 1', () => {
      useSevenDimConfigStore.getState().setSymbolCount(0)
      expect(useSevenDimConfigStore.getState().symbolCount).toBe(1)
    })

    it('setSymbolCount: 超过最大值时钳制', () => {
      useSevenDimConfigStore.getState().setSymbolCount(99999)
      expect(useSevenDimConfigStore.getState().symbolCount).toBe(GLOBAL_LIMITS.maxSymbols)
    })

    it('setSymbolCount: 修改后 isDirty 为 true', () => {
      useSevenDimConfigStore.getState().setSymbolCount(50)
      expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
    })

    it('setHistoryDays: 修改历史天数', () => {
      useSevenDimConfigStore.getState().setHistoryDays(365)
      expect(useSevenDimConfigStore.getState().historyDays).toBe(365)
    })

    it('setHistoryDays: 低于最小值时钳制到 1', () => {
      useSevenDimConfigStore.getState().setHistoryDays(0)
      expect(useSevenDimConfigStore.getState().historyDays).toBe(1)
    })

    it('setHistoryDays: 超过 1000 时钳制', () => {
      useSevenDimConfigStore.getState().setHistoryDays(2000)
      expect(useSevenDimConfigStore.getState().historyDays).toBe(1000)
    })

    it('setGlobalPolicy: 部分更新全局策略', () => {
      useSevenDimConfigStore.getState().setGlobalPolicy({
        rateLimitPerMinute: 20,
        notifyOnComplete: false,
      })
      const global = useSevenDimConfigStore.getState().global
      expect(global.rateLimitPerMinute).toBe(20)
      expect(global.notifyOnComplete).toBe(false)
      expect(global.maxSymbols).toBe(GLOBAL_LIMITS.maxSymbols) // 未修改的保持原值
    })
  })

  // ==========================================================
  // 6. 重置功能
  // ==========================================================

  describe('reset 重置功能', () => {
    it('reset: 修改后重置恢复默认 activeTemplate', () => {
      useSevenDimConfigStore.getState().applyTemplate('value')
      expect(useSevenDimConfigStore.getState().activeTemplate).toBe('value')

      useSevenDimConfigStore.getState().reset()
      expect(useSevenDimConfigStore.getState().activeTemplate).toBe('full')
    })

    it('reset: 重置后 isDirty 为 false', () => {
      useSevenDimConfigStore.getState().toggleDimension('01')
      expect(useSevenDimConfigStore.getState().isDirty).toBe(true)

      useSevenDimConfigStore.getState().reset()
      expect(useSevenDimConfigStore.getState().isDirty).toBe(false)
    })

    it('reset: 重置后 error 为 null', () => {
      useSevenDimConfigStore.getState().clearError()
      useSevenDimConfigStore.getState().reset()
      expect(useSevenDimConfigStore.getState().error).toBeNull()
    })

    it('reset: 重置后采集状态清零', () => {
      useSevenDimConfigStore.getState().reset()
      const state = useSevenDimConfigStore.getState()
      expect(state.isCollecting).toBe(false)
      expect(state.collectingDimensions).toEqual([])
      expect(state.collectProgress).toBe(0)
    })

    it('reset: 重置后 symbolCount 恢复默认', () => {
      useSevenDimConfigStore.getState().setSymbolCount(200)
      useSevenDimConfigStore.getState().reset()
      expect(useSevenDimConfigStore.getState().symbolCount).toBe(40)
    })
  })

  // ==========================================================
  // 7. 持久化 - saveConfig
  // ==========================================================

  describe('saveConfig 保存配置', () => {
    it('saveConfig: 成功保存后 isDirty 为 false', async () => {
      mockForward.mockResolvedValueOnce({ success: true })
      useSevenDimConfigStore.getState().toggleDimension('01')
      expect(useSevenDimConfigStore.getState().isDirty).toBe(true)

      await useSevenDimConfigStore.getState().saveConfig()
      expect(useSevenDimConfigStore.getState().isDirty).toBe(false)
    })

    it('saveConfig: 成功保存后 isSaving 为 false', async () => {
      mockForward.mockResolvedValueOnce({ success: true })
      await useSevenDimConfigStore.getState().saveConfig()
      expect(useSevenDimConfigStore.getState().isSaving).toBe(false)
    })

    it('saveConfig: 调用 dataBridge.forward', async () => {
      mockForward.mockResolvedValueOnce({ success: true })
      await useSevenDimConfigStore.getState().saveConfig()
      expect(mockForward).toHaveBeenCalledTimes(1)
    })

    it('saveConfig: 保存失败设置 error', async () => {
      mockForward.mockRejectedValueOnce(new Error('保存失败'))
      await useSevenDimConfigStore.getState().saveConfig()
      expect(useSevenDimConfigStore.getState().error).toBe('保存失败')
      expect(useSevenDimConfigStore.getState().isSaving).toBe(false)
    })

    it('saveConfig: 保存中并发调用直接返回', async () => {
      let resolveSave: (value: unknown) => void
      const savePromise = new Promise((r) => { resolveSave = r })
      mockForward.mockReturnValueOnce(savePromise)

      const promise1 = useSevenDimConfigStore.getState().saveConfig()
      // 第二次调用时 isSaving 应为 true，直接返回
      const promise2 = useSevenDimConfigStore.getState().saveConfig()

      resolveSave!({ success: true })
      await promise1
      await promise2

      // 只有第一次真正调用了 forward
      expect(mockForward).toHaveBeenCalledTimes(1)
    })
  })

  // ==========================================================
  // 8. 持久化 - loadConfig
  // ==========================================================

  describe('loadConfig 加载配置', () => {
    it('loadConfig: 成功加载配置', async () => {
      const savedConfig = {
        id: 'default',
        version: '1.0.0',
        activeTemplate: 'value',
        dimensions: [
          { code: '01', name: '基本信息', enabled: true, frequency: 'daily', batchSize: 50, sources: ['akshare'], fields: ['name'], importance: 'low', cacheTtl: 100, storageType: 'full' },
        ],
        global: { maxSymbols: 100, defaultBatchSize: 30, rateLimitPerMinute: 5, rateLimitPerHour: 100, rateLimitPerDay: 1000, notifyOnComplete: false, notifyOnError: false, defaultTimeoutMs: 3000, defaultRetries: 1 },
        symbolCount: 30,
        historyDays: 200,
        updatedAt: 1234567890,
      }
      mockQuery.mockResolvedValueOnce({ success: true, data: savedConfig })

      await useSevenDimConfigStore.getState().loadConfig()
      const state = useSevenDimConfigStore.getState()
      expect(state.activeTemplate).toBe('value')
      expect(state.symbolCount).toBe(30)
      expect(state.historyDays).toBe(200)
      expect(state.isDirty).toBe(false)
    })

    it('loadConfig: 未找到已保存配置时使用默认', async () => {
      mockQuery.mockResolvedValueOnce({ success: false, data: null })

      await useSevenDimConfigStore.getState().loadConfig()
      const state = useSevenDimConfigStore.getState()
      expect(state.activeTemplate).toBe('full') // 保持默认
    })

    it('loadConfig: 加载失败设置 error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('加载失败'))

      await useSevenDimConfigStore.getState().loadConfig()
      expect(useSevenDimConfigStore.getState().error).toBe('加载失败')
    })

    it('loadConfig: 配置缺少 version 时使用默认值', async () => {
      const savedConfig = {
        id: 'default',
        activeTemplate: 'growth',
        dimensions: [],
        global: { maxSymbols: 200, defaultBatchSize: 50, rateLimitPerMinute: 10, rateLimitPerHour: 200, rateLimitPerDay: 2000, notifyOnComplete: true, notifyOnError: true, defaultTimeoutMs: 5000, defaultRetries: 2 },
        symbolCount: 50,
        historyDays: 300,
        updatedAt: 1234567890,
      }
      mockQuery.mockResolvedValueOnce({ success: true, data: savedConfig })

      await useSevenDimConfigStore.getState().loadConfig()
      const config = useSevenDimConfigStore.getState().getCollectionConfig()
      expect(config.version).toBe('1.0.0')
    })
  })

  // ==========================================================
  // 9. 采集流程
  // ==========================================================

  describe('runCollection 采集流程', () => {
    beforeEach(() => {
      // 设置意向池标的
      setIntentionPoolSymbols(['AAPL', 'TSLA'])
    })

    it('runCollection: 成功采集完成', async () => {
      const { runBatchTrace } = await import('@/services/data-collector/collectionPipeline')
      vi.mocked(runBatchTrace).mockResolvedValue([{ success: true }])

      await useSevenDimConfigStore.getState().runCollection()

      const state = useSevenDimConfigStore.getState()
      expect(state.isCollecting).toBe(false)
      expect(state.collectingDimensions).toEqual([])
      expect(state.collectProgress).toBe(100)
      expect(state.error).toBeNull()
    })

    it('runCollection: 调用 runBatchTrace 次数等于启用维度数', async () => {
      const { runBatchTrace } = await import('@/services/data-collector/collectionPipeline')
      vi.mocked(runBatchTrace).mockResolvedValue([{ success: true }])

      await useSevenDimConfigStore.getState().runCollection()

      // full 模板 8 个维度都启用
      expect(runBatchTrace).toHaveBeenCalledTimes(8)
    })

    it('runCollection: 部分维度失败时设置错误信息', async () => {
      const { runBatchTrace } = await import('@/services/data-collector/collectionPipeline')
      vi.mocked(runBatchTrace)
        .mockResolvedValueOnce([{ success: true }])
        .mockResolvedValueOnce([{ success: true }])
        .mockRejectedValueOnce(new Error('维度3失败'))
        .mockResolvedValueOnce([{ success: true }])
        .mockResolvedValueOnce([{ success: true }])
        .mockResolvedValueOnce([{ success: true }])
        .mockResolvedValueOnce([{ success: true }])
        .mockResolvedValueOnce([{ success: true }])

      await useSevenDimConfigStore.getState().runCollection()

      const state = useSevenDimConfigStore.getState()
      expect(state.error).toContain('个维度采集失败')
      expect(state.isCollecting).toBe(false)
    })

    it('runCollection: 无启用维度时直接返回', async () => {
      // 禁用所有维度
      const state = useSevenDimConfigStore.getState()
      state.dimensions.forEach((d) => {
        if (d.enabled) state.toggleDimension(d.code)
      })

      const { runBatchTrace } = await import('@/services/data-collector/collectionPipeline')
      await useSevenDimConfigStore.getState().runCollection()

      expect(runBatchTrace).not.toHaveBeenCalled()
      expect(useSevenDimConfigStore.getState().isCollecting).toBe(false)
    })

    it('runCollection: 意向池为空时跳过采集', async () => {
      setIntentionPoolSymbols([])

      const { runBatchTrace } = await import('@/services/data-collector/collectionPipeline')
      await useSevenDimConfigStore.getState().runCollection()

      expect(runBatchTrace).not.toHaveBeenCalled()
    })

    it('runCollection: 防重入 - 采集中再次调用直接返回', async () => {
      const { runBatchTrace } = await import('@/services/data-collector/collectionPipeline')

      let resolveBatch: (value: unknown) => void
      const batchPromise = new Promise((r) => { resolveBatch = r })
      vi.mocked(runBatchTrace).mockReturnValue(batchPromise as never)

      const promise1 = useSevenDimConfigStore.getState().runCollection()

      // 等一下让第一次调用进入采集状态
      await new Promise((r) => setTimeout(r, 10))

      // 第二次调用
      const promise2 = useSevenDimConfigStore.getState().runCollection()

      resolveBatch!([{ success: true }])
      await promise1
      await promise2

      // 只有第一次真正触发了采集（调用 runBatchTrace）
      // 注意：runBatchTrace 会被调用多次（每个维度一次），但第二次 runCollection 应该直接返回
      // 我们验证第二次调用时 collectingDimensions 已经非空所以直接返回
      const callCount = vi.mocked(runBatchTrace).mock.calls.length
      expect(callCount).toBe(8) // 只有第一次的 8 个维度
    })

    it('runCollection: 维度缺少数据源时设置错误', async () => {
      // 设置一个维度的 sources 为空
      const code = getFirstDimensionCode()
      useSevenDimConfigStore.getState().setDimensionSources(code, [])

      await useSevenDimConfigStore.getState().runCollection()

      const state = useSevenDimConfigStore.getState()
      expect(state.error).toContain('维度配置不完整')
      expect(state.isCollecting).toBe(false)
    })

    it('runCollection: 调用 runtime.setRunning', async () => {
      const { runBatchTrace } = await import('@/services/data-collector/collectionPipeline')
      vi.mocked(runBatchTrace).mockResolvedValue([{ success: true }])

      await useSevenDimConfigStore.getState().runCollection()

      expect(mockSetRunning).toHaveBeenCalled()
    })

    it('runCollection: 采集完成后调用 refreshStats', async () => {
      const { runBatchTrace } = await import('@/services/data-collector/collectionPipeline')
      vi.mocked(runBatchTrace).mockResolvedValue([{ success: true }])

      await useSevenDimConfigStore.getState().runCollection()

      expect(mockRefreshStats).toHaveBeenCalled()
    })
  })

  // ==========================================================
  // 10. 错误处理
  // ==========================================================

  describe('错误处理', () => {
    it('clearError: 清除错误信息', () => {
      // 先制造一个错误
      useSevenDimConfigStore.getState().saveConfig().catch(() => {})
      // 直接设置 error 状态
      useSevenDimConfigStore.setState({ error: '测试错误' })
      expect(useSevenDimConfigStore.getState().error).toBe('测试错误')

      useSevenDimConfigStore.getState().clearError()
      expect(useSevenDimConfigStore.getState().error).toBeNull()
    })
  })

  // ==========================================================
  // 11. isClickable / tooltipText 采集中状态
  // ==========================================================

  describe('采集中交互状态', () => {
    it('isClickable: 保存中返回 false', () => {
      useSevenDimConfigStore.setState({ isSaving: true })
      expect(useSevenDimConfigStore.getState().isClickable()).toBe(false)
    })

    it('isClickable: 指定维度采集中返回 false', () => {
      useSevenDimConfigStore.setState({ collectingDimensions: ['01', '02'] })
      expect(useSevenDimConfigStore.getState().isClickable('01')).toBe(false)
      expect(useSevenDimConfigStore.getState().isClickable('03')).toBe(true)
    })

    it('tooltipText: 保存中返回保存提示', () => {
      useSevenDimConfigStore.setState({ isSaving: true })
      expect(useSevenDimConfigStore.getState().tooltipText()).toContain('保存中')
    })

    it('tooltipText: 指定维度采集中返回维度提示', () => {
      useSevenDimConfigStore.setState({ collectingDimensions: ['01'] })
      expect(useSevenDimConfigStore.getState().tooltipText('01')).toContain('01')
      expect(useSevenDimConfigStore.getState().tooltipText('01')).toContain('采集中')
    })

    it('tooltipText: 多维度采集中返回逗号分隔列表', () => {
      useSevenDimConfigStore.setState({ collectingDimensions: ['01', '02', '03'] })
      const text = useSevenDimConfigStore.getState().tooltipText()
      expect(text).toContain('01')
      expect(text).toContain('02')
      expect(text).toContain('03')
    })
  })
})
