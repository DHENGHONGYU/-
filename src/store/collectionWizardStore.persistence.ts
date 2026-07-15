/**
 * @module collectionWizardStore.persistence
 * @description 数据采集向导持久化相关 Actions
 *
 * 包含：
 * - loadSavedConfigs: 从 IndexedDB 加载配置模板列表
 * - loadConfigToWizard: 将配置模板加载到向导状态
 * - deleteSavedConfig: 删除配置模板
 * - renameSavedConfig: 重命名配置模板
 * - exportConfig: 导出配置模板为 JSON 文件
 * - importConfig: 从 JSON 文件导入配置模板
 *
 * 通过 spread mixin 方式合并到主 Store 中，保持 actions 的统一调用方式
 * `useCollectionWizardStore.getState().xxx()`。
 */

import type { StateCreator } from 'zustand'
import { getLogger } from '@/lib/logger'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/lib/withBroadcast'
import type {
  ApiConfig,
  CollectionCacheStrategy,
  CollectionFrequency,
  CollectionPriority,
  PersistedWizardConfig,
  WizardLogEntry,
} from '@/types/modules/collection.types'
import {
  saveWizardConfig,
  loadAllWizardConfigs,
  deleteWizardConfig,
  updateWizardConfig,
} from '@/services/collection/collectionWizardPersistence'
import {
  exportAndDownloadConfig,
  importConfigFromJSON,
  validateImportedConfig,
} from '@/services/collection/configExportService'
import { validateConfigName } from '@/lib/validation'
import { generateTraceId, generateConfigId } from './collectionWizardStore.utils'

const logger = getLogger()

/**
 * 持久化 actions 需要操作的 Store 状态切片
 *
 * 仅声明 persistence 模块需要 set/get 的字段，避免与主 store 重复定义
 */
export interface PersistenceStateSlice {
  // 持久化层自有字段
  savedConfigs: PersistedWizardConfig[]
  isSavingConfig: boolean

  // loadConfigToWizard 需要重置的字段
  selectedDimensions: string[]
  apiConfigs: Record<string, ApiConfig>
  frequency: CollectionFrequency
  cronExpression: string
  priority: CollectionPriority
  cacheTTL: number
  cacheStrategy: CollectionCacheStrategy
  taskName: string
  saveAsTemplate: boolean

  // 内部依赖
  addLog: (log: Omit<WizardLogEntry, 'id' | 'timestamp'>) => void
}

/** 持久化 actions 接口 */
export interface PersistenceActions {
  /** 加载已保存的配置模板列表 */
  loadSavedConfigs: () => Promise<void>
  /** 从模板加载配置到向导 */
  loadConfigToWizard: (config: PersistedWizardConfig) => void
  /** 删除已保存的配置模板 */
  deleteSavedConfig: (configId: string) => Promise<void>
  /** 重命名配置模板，返回 { success, error? } */
  renameSavedConfig: (configId: string, newName: string) => Promise<{ success: boolean; error?: string }>
  /** 导出配置模板为 JSON 文件 */
  exportConfig: (configId: string) => void
  /** 从 JSON 文件导入配置模板 */
  importConfig: (file: File) => Promise<{ success: true; configId: string } | { success: false; error: string }>
}

/**
 * 持久化 actions mixin
 *
 * 通过 StateCreator 模式注入到主 store 中，确保：
 * 1. 持久化逻辑独立可测
 * 2. 主 store 文件保持精简
 * 3. actions 通过 store.getState() 调用方式不变
 */
export const createPersistenceActions: StateCreator<
  PersistenceStateSlice,
  [],
  [],
  PersistenceActions
> = (set, get) => ({
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
      const finalConfigs =
        configs.length > 0
          ? configs
          : previousCount > 0
            ? get().savedConfigs
            : configs

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
      withBroadcast(EVENT_NAMES.COLLECTION_WIZARD_CHANGED, { action: 'loadSavedConfigs', count: finalConfigs.length })
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
    withBroadcast(EVENT_NAMES.COLLECTION_WIZARD_CHANGED, { action: 'loadConfigToWizard', configId: config.id })
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

  exportConfig: (configId: string) => {
    const config = get().savedConfigs.find((c) => c.id === configId)
    if (!config) {
      logger.warn('[CollectionWizardStore] exportConfig - 配置不存在', { configId })
      return
    }
    logger.info('[CollectionWizardStore] exportConfig', { configId, name: config.name })
    exportAndDownloadConfig(config)
  },

  importConfig: async (
    file: File,
  ): Promise<{ success: true; configId: string } | { success: false; error: string }> => {
    const traceId = generateTraceId()
    logger.info('[CollectionWizardStore] importConfig - 开始', {
      traceId,
      fileName: file.name,
      fileSize: file.size,
    })

    try {
      const exportFile = await importConfigFromJSON(file)
      const { config } = exportFile

      const existingNames = get().savedConfigs.map((c) => c.name)
      const validation = validateImportedConfig(config, existingNames)
      if (!validation.ok) {
        logger.warn('[CollectionWizardStore] importConfig - 校验失败', {
          traceId,
          fileName: file.name,
          error: validation.error,
        })
        return { success: false, error: validation.error }
      }

      const newConfig: PersistedWizardConfig = {
        ...config,
        id: generateConfigId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await saveWizardConfig(newConfig)
      set((state) => ({ savedConfigs: [...state.savedConfigs, newConfig] }))

      logger.info('[CollectionWizardStore] importConfig - 完成', {
        traceId,
        fileName: file.name,
        newConfigId: newConfig.id,
        newConfigName: newConfig.name,
      })

      withBroadcast(EVENT_NAMES.COLLECTION_WIZARD_CHANGED, {
        action: 'importConfig',
        configId: newConfig.id,
        name: newConfig.name,
      })
      return { success: true, configId: newConfig.id }
    } catch (error) {
      logger.error('[CollectionWizardStore] importConfig - 失败', {
        traceId,
        fileName: file.name,
        error: error instanceof Error ? error.message : String(error),
      })
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  },
})
