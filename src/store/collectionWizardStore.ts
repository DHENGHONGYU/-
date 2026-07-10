/**
 * @module collectionWizardStore
 * @description 数据采集向导状态管理
 *
 * 管理 4 步向导式数据采集流程的状态：
 * 1. 数据源配置
 * 2. 采集策略
 * 3. 任务预览
 * 4. 执行监控
 *
 * v1.1 新增：
 * - 链路追踪 ID（traceId），关联同一任务的所有日志
 * - 阶段标识（stage），标记采集生命周期阶段
 * - 耗时记录（durationMs），记录每个阶段的执行时间
 * - 配置持久化集成（saveAsTemplate 时自动保存到 IndexedDB）
 */

import { create } from 'zustand'
import { withBroadcast } from '@/lib/withBroadcast'
import { MOCK_WIZARD_API_BASE_URL } from '@/config/dataSourceUrls'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getLogger } from '@/lib/logger'
import type {
  CollectionWizardState,
  CollectionWizardStep,
  CollectionFrequency,
  CollectionPriority,
  CollectionCacheStrategy,
  ApiConfig,
  DimensionProgress,
  WizardLogEntry,
  PersistedWizardConfig,
} from '@/types/modules/collection.types'
import {
  saveWizardConfig,
  loadAllWizardConfigs,
  deleteWizardConfig,
  updateWizardConfig,
} from '@/services/collection/collectionWizardPersistence'
import { validateConfigName } from '@/utils/dataValidation'

const logger = getLogger()

/** 广播向导状态变更 */
const broadcastWizard = (action: string, payload?: Record<string, unknown>): void => {
  withBroadcast(EVENT_NAMES.COLLECTION_WIZARD_CHANGED, { action, ...payload })
}

// ============================================================
// 默认值
// ============================================================

/** Mock 配置模板数据（开发阶段使用） */
const MOCK_CONFIGS: PersistedWizardConfig[] = [
  {
    id: 'wizard_config_1_mock',
    name: '高频行情监控',
    selectedDimensions: ['quote', 'financial'],
    apiConfigs: {
      quote: { baseUrl: `${MOCK_WIZARD_API_BASE_URL}/quote/realtime`, timeoutMs: 5000, rateLimitPerMinute: 60 },
      financial: { baseUrl: `${MOCK_WIZARD_API_BASE_URL}/financial/quarterly`, timeoutMs: 10000 },
    },
    frequency: 'realtime',
    cronExpression: '* * * * *',
    priority: 'high',
    cacheTTL: 60,
    cacheStrategy: 'network-first',
    saveAsTemplate: true,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'wizard_config_2_mock',
    name: '每日舆情分析',
    selectedDimensions: ['news', 'sector'],
    apiConfigs: {
      news: { baseUrl: `${MOCK_WIZARD_API_BASE_URL}/news/sentiment`, timeoutMs: 8000 },
      sector: { baseUrl: `${MOCK_WIZARD_API_BASE_URL}/sector/rotation`, timeoutMs: 8000 },
    },
    frequency: 'hourly',
    cronExpression: '0 * * * *',
    priority: 'medium',
    cacheTTL: 1800,
    cacheStrategy: 'stale-while-revalidate',
    saveAsTemplate: true,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'wizard_config_3_mock',
    name: '基础行情采集',
    selectedDimensions: ['quote'],
    apiConfigs: {
      quote: { baseUrl: `${MOCK_WIZARD_API_BASE_URL}/quote/daily`, timeoutMs: 15000 },
    },
    frequency: 'daily',
    cronExpression: '0 0 * * *',
    priority: 'low',
    cacheTTL: 86400,
    cacheStrategy: 'cache-first',
    saveAsTemplate: true,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 3,
  },
]

const INITIAL_STATE = {
  currentStep: 1 as CollectionWizardStep,
  isOpen: false,
  selectedDimensions: [] as string[],
  apiConfigs: {} as Record<string, ApiConfig>,
  frequency: 'daily' as CollectionFrequency,
  cronExpression: '0 0 * * *',
  priority: 'medium' as CollectionPriority,
  cacheTTL: 3600,
  cacheStrategy: 'stale-while-revalidate' as CollectionCacheStrategy,
  taskName: '',
  saveAsTemplate: false,
  taskId: null as string | null,
  taskStatus: 'idle' as CollectionWizardState['taskStatus'],
  dimensionProgress: [] as DimensionProgress[],
  logs: [] as WizardLogEntry[],
  /** 当前任务的链路追踪 ID */
  traceId: null as string | null,
  /** 已保存的配置模板列表（开发阶段使用 mock 数据） */
  savedConfigs: MOCK_CONFIGS,
  /** 是否正在保存配置 */
  isSavingConfig: false,
}

// ============================================================
// Store 定义
// ============================================================

interface CollectionWizardActions {
  setStep: (step: CollectionWizardStep) => void
  openWizard: () => void
  closeWizard: () => void
  toggleDimension: (code: string, checked: boolean) => void
  updateApiConfig: (code: string, config: ApiConfig) => void
  setFrequency: (frequency: CollectionFrequency) => void
  setCronExpression: (cron: string) => void
  setPriority: (priority: CollectionPriority) => void
  setCacheTTL: (ttl: number) => void
  setCacheStrategy: (strategy: CollectionCacheStrategy) => void
  setTaskName: (name: string) => void
  setSaveAsTemplate: (save: boolean) => void
  startTask: () => Promise<void>
  pauseTask: () => void
  resumeTask: () => void
  stopTask: () => void
  resetWizard: () => void
  addLog: (log: Omit<WizardLogEntry, 'id' | 'timestamp'>) => void
  updateDimensionProgress: (code: string, update: Partial<DimensionProgress>) => void
  /** 加载已保存的配置模板列表 */
  loadSavedConfigs: () => Promise<void>
  /** 从模板加载配置到向导 */
  loadConfigToWizard: (config: PersistedWizardConfig) => void
  /** 删除已保存的配置模板 */
  deleteSavedConfig: (configId: string) => Promise<void>
  /** 重命名配置模板，返回 { success, error? } */
  renameSavedConfig: (configId: string, newName: string) => Promise<{ success: boolean; error?: string }>
}

type CollectionWizardStore = typeof INITIAL_STATE & CollectionWizardActions

// ============================================================
// 工具函数
// ============================================================

/** 生成链路追踪 ID */
const generateTraceId = (): string => {
  return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/** 格式化耗时 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ============================================================
// Store 实现
// ============================================================

/**
 * useCollectionWizardStore
 */
export const useCollectionWizardStore = create<CollectionWizardStore>()(
  (set, get) => ({
    ...INITIAL_STATE,

    setStep: (step: CollectionWizardStep) => {
      const { currentStep } = get()
      logger.info('[CollectionWizardStore] setStep', {
        from: currentStep,
        to: step,
        traceId: get().traceId,
      })
      set({ currentStep: step })
      broadcastWizard('setStep', { from: currentStep, to: step })
    },

    openWizard: () => {
      logger.info('[CollectionWizardStore] openWizard', {
        previousTaskId: get().taskId,
        previousStatus: get().taskStatus,
      })
      set({ isOpen: true })
      broadcastWizard('openWizard')
      // 打开时自动加载已保存的配置模板
      void get().loadSavedConfigs()
    },

    closeWizard: () => {
      logger.info('[CollectionWizardStore] closeWizard', {
        taskId: get().taskId,
        taskStatus: get().taskStatus,
        logCount: get().logs.length,
      })
      set({ isOpen: false })
      broadcastWizard('closeWizard')
    },

    toggleDimension: (code: string, checked: boolean) => {
      const { selectedDimensions } = get()
      const newDimensions = checked
        ? [...selectedDimensions, code]
        : selectedDimensions.filter((d) => d !== code)
      logger.info('[CollectionWizardStore] toggleDimension', {
        code,
        checked,
        beforeCount: selectedDimensions.length,
        afterCount: newDimensions.length,
        newDimensions,
      })
      set({ selectedDimensions: newDimensions })
      broadcastWizard('toggleDimension', { code, checked })
    },

    updateApiConfig: (code: string, config: ApiConfig) => {
      const { apiConfigs } = get()
      const previous = apiConfigs[code]
      logger.info('[CollectionWizardStore] updateApiConfig', {
        code,
        previous: previous ?? null,
        updated: config,
      })
      set({ apiConfigs: { ...apiConfigs, [code]: config } })
      broadcastWizard('updateApiConfig', { code, config })
    },

    setFrequency: (frequency: CollectionFrequency) => {
      const { frequency: prev } = get()
      logger.info('[CollectionWizardStore] setFrequency', { from: prev, to: frequency })
      set({ frequency })
      broadcastWizard('setFrequency', { from: prev, to: frequency })
    },

    setCronExpression: (cron: string) => {
      const { cronExpression: prev } = get()
      logger.info('[CollectionWizardStore] setCronExpression', { from: prev, to: cron })
      set({ cronExpression: cron })
      broadcastWizard('setCronExpression', { from: prev, to: cron })
    },

    setPriority: (priority: CollectionPriority) => {
      const { priority: prev } = get()
      logger.info('[CollectionWizardStore] setPriority', { from: prev, to: priority })
      set({ priority })
      broadcastWizard('setPriority', { from: prev, to: priority })
    },

    setCacheTTL: (ttl: number) => {
      const { cacheTTL: prev } = get()
      logger.info('[CollectionWizardStore] setCacheTTL', { from: prev, to: ttl })
      set({ cacheTTL: ttl })
      broadcastWizard('setCacheTTL', { from: prev, to: ttl })
    },

    setCacheStrategy: (strategy: CollectionCacheStrategy) => {
      const { cacheStrategy: prev } = get()
      logger.info('[CollectionWizardStore] setCacheStrategy', { from: prev, to: strategy })
      set({ cacheStrategy: strategy })
      broadcastWizard('setCacheStrategy', { from: prev, to: strategy })
    },

    setTaskName: (name: string) => {
      logger.info('[CollectionWizardStore] setTaskName', { name })
      set({ taskName: name })
      broadcastWizard('setTaskName', { name })
    },

    setSaveAsTemplate: (save: boolean) => {
      logger.info('[CollectionWizardStore] setSaveAsTemplate', { save })
      set({ saveAsTemplate: save })
      broadcastWizard('setSaveAsTemplate', { save })
    },

    startTask: async () => {
      const state = get()
      const { selectedDimensions, taskName, saveAsTemplate } = state
      const traceId = generateTraceId()
      const taskStartTime = Date.now()

      logger.info('[CollectionWizardStore] startTask - 初始化', {
        traceId,
        taskName,
        dimensions: selectedDimensions,
        dimensionCount: selectedDimensions.length,
        frequency: state.frequency,
        priority: state.priority,
        cacheStrategy: state.cacheStrategy,
        cacheTTL: state.cacheTTL,
        saveAsTemplate,
      })

      // 如果选择了保存为模板，先持久化配置
      if (saveAsTemplate) {
        logger.info('[CollectionWizardStore] startTask - 保存配置模板', { traceId })
        set({ isSavingConfig: true })
        try {
          await saveWizardConfig({
            name: taskName || `配置_${new Date().toLocaleDateString('zh-CN')}`,
            selectedDimensions,
            apiConfigs: state.apiConfigs,
            frequency: state.frequency,
            cronExpression: state.cronExpression,
            priority: state.priority,
            cacheTTL: state.cacheTTL,
            cacheStrategy: state.cacheStrategy,
            saveAsTemplate: true,
          })
          logger.info('[CollectionWizardStore] startTask - 配置模板保存成功', { traceId })
          // 刷新模板列表
          await get().loadSavedConfigs()
        } catch (error) {
          logger.error('[CollectionWizardStore] startTask - 配置模板保存失败', {
            traceId,
            error: error instanceof Error ? error.message : String(error),
          })
          // 保存失败不阻断任务执行
        }
        set({ isSavingConfig: false })
      }

      set({
        traceId,
        taskId: `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        taskStatus: 'running',
        logs: [],
        dimensionProgress: selectedDimensions.map((code: string) => ({
          dimensionCode: code,
          dimensionName: code,
          progress: 0,
          status: 'pending',
        })),
      })

      get().addLog({
        level: 'info',
        message: `任务 ${taskName || '未命名'} 已启动`,
        traceId,
        stage: 'task:start',
      })

      get().addLog({
        level: 'info',
        message: `配置: 维度×${selectedDimensions.length} | 频率=${state.frequency} | 优先级=${state.priority} | 缓存=${state.cacheStrategy}(${state.cacheTTL}s)`,
        traceId,
        stage: 'task:config',
      })

      // 模拟采集进度（带详细阶段日志）
      const simulateProgress = async () => {
        for (const dim of selectedDimensions) {
          const dimStartTime = Date.now()

          // 阶段1: 开始采集
          get().updateDimensionProgress(dim, { status: 'running', progress: 0 })
          get().addLog({
            level: 'info',
            message: `[${dim}] 开始采集 - source:start`,
            dimensionCode: dim,
            traceId,
            stage: 'source:start',
          })

          // 阶段2: 模拟数据拉取
          await new Promise((resolve) => setTimeout(resolve, 300))
          const fetchDuration = Date.now() - dimStartTime
          get().addLog({
            level: 'info',
            message: `[${dim}] 数据拉取完成 - source:success (${formatDuration(fetchDuration)})`,
            dimensionCode: dim,
            traceId,
            stage: 'source:success',
            durationMs: fetchDuration,
          })

          // 阶段3: 模拟数据转换
          get().addLog({
            level: 'info',
            message: `[${dim}] 数据转换中 - transform`,
            dimensionCode: dim,
            traceId,
            stage: 'transform',
          })
          await new Promise((resolve) => setTimeout(resolve, 200))

          // 阶段4: 模拟写入
          const writeStartTime = Date.now()
          get().addLog({
            level: 'info',
            message: `[${dim}] 写入存储 - write:start`,
            dimensionCode: dim,
            traceId,
            stage: 'write:start',
          })

          // 模拟进度
          for (let i = 20; i <= 100; i += 20) {
            await new Promise((resolve) => setTimeout(resolve, 300))
            get().updateDimensionProgress(dim, { progress: i })
          }

          const writeDuration = Date.now() - writeStartTime
          get().addLog({
            level: 'info',
            message: `[${dim}] 写入完成 - write:success (${formatDuration(writeDuration)})`,
            dimensionCode: dim,
            traceId,
            stage: 'write:success',
            durationMs: writeDuration,
          })

          // 阶段5: 维度完成
          const totalDimDuration = Date.now() - dimStartTime
          get().updateDimensionProgress(dim, { status: 'completed', progress: 100 })
          get().addLog({
            level: 'success',
            message: `[${dim}] 维度采集完成 - complete (总耗时 ${formatDuration(totalDimDuration)})`,
            dimensionCode: dim,
            traceId,
            stage: 'complete',
            durationMs: totalDimDuration,
          })
        }

        // 任务完成
        const totalDuration = Date.now() - taskStartTime
        set({ taskStatus: 'completed' })
        get().addLog({
          level: 'success',
          message: `所有维度采集完成 - 总耗时 ${formatDuration(totalDuration)}`,
          traceId,
          stage: 'task:complete',
          durationMs: totalDuration,
        })
      }

      void simulateProgress()
    },

    pauseTask: () => {
      const { taskId, taskStatus } = get()
      logger.info('[CollectionWizardStore] pauseTask', { taskId, fromStatus: taskStatus })
      set({ taskStatus: 'paused' })
      get().addLog({
        level: 'warn',
        message: '任务已暂停 - task:pause',
        traceId: get().traceId ?? undefined,
        stage: 'task:pause',
      })
      broadcastWizard('pauseTask', { taskId })
    },

    resumeTask: () => {
      const { taskId } = get()
      logger.info('[CollectionWizardStore] resumeTask', { taskId })
      set({ taskStatus: 'running' })
      get().addLog({
        level: 'info',
        message: '任务已恢复 - task:resume',
        traceId: get().traceId ?? undefined,
        stage: 'task:resume',
      })
      broadcastWizard('resumeTask', { taskId })
    },

    stopTask: () => {
      const { taskId, logs } = get()
      logger.info('[CollectionWizardStore] stopTask', {
        taskId,
        logCount: logs.length,
      })
      set({ taskStatus: 'failed' })
      get().addLog({
        level: 'error',
        message: '任务已停止 - task:abort',
        traceId: get().traceId ?? undefined,
        stage: 'task:abort',
      })
      broadcastWizard('stopTask', { taskId })
    },

    resetWizard: () => {
      const { taskId, logs, traceId } = get()
      logger.info('[CollectionWizardStore] resetWizard', {
        taskId,
        traceId,
        logCount: logs.length,
      })
      set({ ...INITIAL_STATE, savedConfigs: get().savedConfigs })
      broadcastWizard('resetWizard')
    },

    addLog: (log: Omit<WizardLogEntry, 'id' | 'timestamp'>) => {
      const entry: WizardLogEntry = {
        ...log,
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
      }
      set((state) => ({ logs: [...state.logs, entry] }))
    },

    updateDimensionProgress: (code: string, update: Partial<DimensionProgress>) => {
      set((state) => ({
        dimensionProgress: state.dimensionProgress.map((d) =>
          d.dimensionCode === code ? { ...d, ...update } : d
        ),
      }))
    },

    loadSavedConfigs: async () => {
      const traceId = generateTraceId()
      const startTime = Date.now()
      const previousCount = get().savedConfigs.length

      logger.info('[CollectionWizardStore] loadSavedConfigs - 开始', {
        traceId,
        previousCount,
      })
      try {
        const configs = await loadAllWizardConfigs()
        const duration = Date.now() - startTime

        // 如果 IndexedDB 返回空，保留 mock 数据（开发阶段）
        const finalConfigs = configs.length > 0 ? configs : previousCount > 0 ? get().savedConfigs : configs

        logger.info('[CollectionWizardStore] loadSavedConfigs - 完成', {
          traceId,
          previousCount,
          newCount: finalConfigs.length,
          countDiff: finalConfigs.length - previousCount,
          source: configs.length > 0 ? 'indexedDB' : 'mock/fallback',
          configIds: finalConfigs.map((c) => c.id),
          configNames: finalConfigs.map((c) => c.name),
          durationMs: duration,
        })

        set({ savedConfigs: finalConfigs })
        broadcastWizard('loadSavedConfigs', { count: finalConfigs.length })
      } catch (error) {
        const duration = Date.now() - startTime
        logger.error('[CollectionWizardStore] loadSavedConfigs - 失败', {
          traceId,
          previousCount,
          durationMs: duration,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },

    loadConfigToWizard: (config: PersistedWizardConfig) => {
      logger.info('[CollectionWizardStore] loadConfigToWizard', {
        configId: config.id,
        name: config.name,
        dimensions: config.selectedDimensions,
      })
      set({
        selectedDimensions: config.selectedDimensions,
        apiConfigs: config.apiConfigs,
        frequency: config.frequency,
        cronExpression: config.cronExpression,
        priority: config.priority,
        cacheTTL: config.cacheTTL,
        cacheStrategy: config.cacheStrategy,
        taskName: config.name,
        saveAsTemplate: config.saveAsTemplate,
      })
      get().addLog({
        level: 'info',
        message: `已加载配置模板: ${config.name}`,
        stage: 'config:loaded',
      })
      broadcastWizard('loadConfigToWizard', { configId: config.id })
    },

    deleteSavedConfig: async (configId: string) => {
      const traceId = generateTraceId()
      logger.info('[CollectionWizardStore] deleteSavedConfig - 开始', {
        traceId,
        configId,
      })
      try {
        const success = await deleteWizardConfig(configId)
        // 无论 IndexedDB 是否成功，都更新本地状态（兼容 mock 数据）
        logger.info('[CollectionWizardStore] deleteSavedConfig - 更新本地状态', {
          traceId,
          configId,
          indexedDBSuccess: success,
        })
        set((state) => ({
          savedConfigs: state.savedConfigs.filter((c) => c.id !== configId),
        }))
        if (!success) {
          logger.warn('[CollectionWizardStore] deleteSavedConfig - IndexedDB 删除失败，仅更新本地', {
            traceId,
            configId,
          })
        }
      } catch (error) {
        logger.error('[CollectionWizardStore] deleteSavedConfig - 异常', {
          traceId,
          configId,
          error: error instanceof Error ? error.message : String(error),
        })
        // 异常时也从本地移除
        set((state) => ({
          savedConfigs: state.savedConfigs.filter((c) => c.id !== configId),
        }))
      }
    },

    renameSavedConfig: async (configId: string, newName: string) => {
      const traceId = generateTraceId()
      logger.info('[CollectionWizardStore] renameSavedConfig - 开始', {
        traceId,
        configId,
        newName,
      })

      // 1. 名称格式校验
      const validation = validateConfigName(newName)
      if (!validation.valid) {
        logger.warn('[CollectionWizardStore] renameSavedConfig - 名称校验失败', {
          traceId,
          configId,
          newName,
          error: validation.error,
        })
        return { success: false, error: validation.error }
      }

      // 2. 重名检测（排除自身）
      const hasDuplicate = get().savedConfigs.some(
        (c) => c.id !== configId && c.name.trim().toLowerCase() === newName.trim().toLowerCase(),
      )
      if (hasDuplicate) {
        logger.warn('[CollectionWizardStore] renameSavedConfig - 名称重复', {
          traceId,
          configId,
          newName,
          existingConfigs: get().savedConfigs
            .filter((c) => c.id !== configId && c.name.trim().toLowerCase() === newName.trim().toLowerCase())
            .map((c) => ({ id: c.id, name: c.name })),
        })
        return { success: false, error: `配置名称"${newName}"已存在` }
      }

      try {
        const updated = await updateWizardConfig(configId, { name: newName })
        // 无论 IndexedDB 是否成功，都更新本地状态（兼容 mock 数据）
        const newUpdatedAt = updated?.updatedAt ?? Date.now()
        logger.info('[CollectionWizardStore] renameSavedConfig - 更新本地状态', {
          traceId,
          configId,
          newName,
          indexedDBSuccess: !!updated,
        })
        set((state) => ({
          savedConfigs: state.savedConfigs.map((c) =>
            c.id === configId ? { ...c, name: newName, updatedAt: newUpdatedAt } : c,
          ),
        }))
        if (!updated) {
          logger.warn('[CollectionWizardStore] renameSavedConfig - IndexedDB 更新失败，仅更新本地', {
            traceId,
            configId,
          })
        }
        return { success: true }
      } catch (error) {
        logger.error('[CollectionWizardStore] renameSavedConfig - 异常', {
          traceId,
          configId,
          newName,
          error: error instanceof Error ? error.message : String(error),
        })
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }),
)
