/**
 * @module sevenDimConfigStore
 * @description 七维采集配置 Store（Zustand），支持全层级配置与持久化。
 *
 * 职责：
 * - 管理 8 个采集维度的高级配置（启用、频率、数据源、字段、策略、优先级）
 * - 管理当前策略模板与全局参数
 * - 提供配置序列化 / 反序列化能力
 * - 通过 DataBridge.forward() 持久化到 IndexedDB
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import type {
  CollectionConfig,
  DimensionPipelineConfig,
  GlobalCollectPolicy,
  SourcePriorityItem,
  StrategyTemplateId,
  UpdateFrequency,
  DataSourceType,
  RetryPolicy,
  TimeoutPolicy,
  FallbackPolicy,
} from '@/types/modules/collection.types'
import {
  DEFAULT_DIMENSIONS,
  STRATEGY_TEMPLATES,
  GLOBAL_LIMITS,
  estimateTotalMonthlyCalls,
  DEFAULT_RETRY_POLICY,
  DEFAULT_TIMEOUT_POLICY,
} from '@/config/collectConfig'
import { upgradeDimensionsToPipeline, runBatchTrace } from '@/services/data-collector/collectionPipeline'
import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'
import { MOCK_STOCK_LIBRARY } from '@/services/input/mockStockLibrary'

const logger = getLogger()

const COLLECT_CONFIG_ID = 'default'

// ============================================================
// Store 接口定义
// ============================================================

export interface SevenDimConfigState {
  // --- 状态 ---
  activeTemplate: StrategyTemplateId
  dimensions: DimensionPipelineConfig[]
  global: GlobalCollectPolicy
  symbolCount: number
  historyDays: number
  isDirty: boolean
  isSaving: boolean
  isCollecting: boolean
  collectProgress: number
  error: string | null

  // --- 派生计算 ---
  enabledCount: () => number
  monthlyCallEstimate: () => number
  isClickable: () => boolean
  tooltipText: () => string
  getCollectionConfig: () => CollectionConfig

  // --- Actions ---
  applyTemplate: (templateId: StrategyTemplateId) => void
  toggleDimension: (code: string) => void
  setDimensionFrequency: (code: string, frequency: UpdateFrequency) => void
  setDimensionSources: (code: string, sources: DataSourceType[]) => void
  setDimensionSourcePriority: (code: string, priority: SourcePriorityItem[]) => void
  setDimensionPolicy: (
    code: string,
    policy: Partial<{ retryPolicy: RetryPolicy; timeoutPolicy: TimeoutPolicy; fallbackPolicy: FallbackPolicy }>,
  ) => void
  setDimensionFields: (code: string, fields: string[]) => void
  setSymbolCount: (count: number) => void
  setHistoryDays: (days: number) => void
  setGlobalPolicy: (policy: Partial<GlobalCollectPolicy>) => void
  reset: () => void
  saveConfig: () => Promise<void>
  loadConfig: () => Promise<void>
  runCollection: () => Promise<void>
  clearError: () => void
}

// ============================================================
// 辅助函数
// ============================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function createDefaultGlobal(): GlobalCollectPolicy {
  return {
    maxSymbols: GLOBAL_LIMITS.maxSymbols,
    defaultBatchSize: GLOBAL_LIMITS.defaultBatchSize,
    rateLimitPerMinute: GLOBAL_LIMITS.rateLimitPerMinute,
    rateLimitPerHour: GLOBAL_LIMITS.rateLimitPerHour,
    rateLimitPerDay: GLOBAL_LIMITS.rateLimitPerDay,
    notifyOnComplete: true,
    notifyOnError: true,
    defaultTimeoutMs: DEFAULT_TIMEOUT_POLICY.requestTimeoutMs,
    defaultRetries: DEFAULT_RETRY_POLICY.maxRetries,
  }
}

function createPipelineDimensions(): DimensionPipelineConfig[] {
  return upgradeDimensionsToPipeline(DEFAULT_DIMENSIONS as DimensionPipelineConfig[])
}

function generateDimensionsFromTemplate(templateId: StrategyTemplateId): DimensionPipelineConfig[] {
  const template = STRATEGY_TEMPLATES.find((t) => t.id === templateId)
  if (!template) return createPipelineDimensions()

  return createPipelineDimensions().map((dim) => ({
    ...dim,
    enabled: template.dimensions.includes(dim.code),
    frequency: template.dimensions.includes(dim.code) ? template.updateInterval : dim.frequency,
    sources: template.sources,
  }))
}

function buildCollectionConfig(state: SevenDimConfigState): CollectionConfig {
  return {
    version: '1.0.0',
    activeTemplate: state.activeTemplate,
    dimensions: state.dimensions,
    global: state.global,
    symbolCount: state.symbolCount,
    historyDays: state.historyDays,
    updatedAt: Date.now(),
  }
}

/**
 * 生成默认采集标的池。
 * TODO: 后端真实股票池服务就绪后，替换为从 stockPoolService / watchlist 获取的标的列表。
 */
function resolveDefaultSymbols(count: number): string[] {
  const normalized = MOCK_STOCK_LIBRARY
    .map((stock) => stock.symbol.split('.')[0])
    .filter((symbol): symbol is string => typeof symbol === 'string')
  return normalized.slice(0, Math.max(1, Math.min(count, normalized.length)))
}

// ============================================================
// Store 实现
// ============================================================

const initialState: Omit<
  SevenDimConfigState,
  | 'enabledCount'
  | 'monthlyCallEstimate'
  | 'isClickable'
  | 'tooltipText'
  | 'getCollectionConfig'
  | 'applyTemplate'
  | 'toggleDimension'
  | 'setDimensionFrequency'
  | 'setDimensionSources'
  | 'setDimensionSourcePriority'
  | 'setDimensionPolicy'
  | 'setDimensionFields'
  | 'setSymbolCount'
  | 'setHistoryDays'
  | 'setGlobalPolicy'
  | 'reset'
  | 'saveConfig'
  | 'loadConfig'
  | 'runCollection'
  | 'clearError'
> = {
  activeTemplate: 'value',
  dimensions: generateDimensionsFromTemplate('value'),
  global: createDefaultGlobal(),
  symbolCount: 40,
  historyDays: 252,
  isDirty: false,
  isSaving: false,
  isCollecting: false,
  collectProgress: 0,
  error: null,
}

export const useSevenDimConfigStore = create<SevenDimConfigState>((set, get) => ({
  ...initialState,

  enabledCount: () => get().dimensions.filter((d) => d.enabled).length,

  monthlyCallEstimate: () =>
    estimateTotalMonthlyCalls(get().dimensions, get().symbolCount),

  isClickable: () => {
    const state = get()
    return !state.isSaving && !state.isCollecting
  },

  tooltipText: () => {
    const state = get()
    if (state.isSaving) return '配置保存中，请稍候...'
    if (state.isCollecting) return '采集进行中，请稍候...'
    return ''
  },

  getCollectionConfig: () => buildCollectionConfig(get()),

  applyTemplate: (templateId) => {
    const template = STRATEGY_TEMPLATES.find((t) => t.id === templateId)
    if (!template) {
      logger.warn(`[SevenDimConfigStore] 未找到策略模板: ${templateId}`)
      return
    }

    logger.info(`[SevenDimConfigStore] 应用策略模板: ${template.name}`, {
      dimensions: template.dimensions,
      frequency: template.updateInterval,
    })

    set({
      activeTemplate: templateId,
      dimensions: generateDimensionsFromTemplate(templateId),
      historyDays: template.historyDays,
      isDirty: true,
    })
  },

  toggleDimension: (code) => {
    set((state) => ({
      dimensions: state.dimensions.map((dim) =>
        dim.code === code ? { ...dim, enabled: !dim.enabled } : dim,
      ),
      isDirty: true,
    }))

    const dim = get().dimensions.find((d) => d.code === code)
    logger.info(`[SevenDimConfigStore] 维度切换: ${code} → ${dim?.enabled ? '启用' : '禁用'}`)
  },

  setDimensionFrequency: (code, frequency) => {
    set((state) => ({
      dimensions: state.dimensions.map((dim) =>
        dim.code === code ? { ...dim, frequency } : dim,
      ),
      isDirty: true,
    }))

    logger.info(`[SevenDimConfigStore] 维度频率更新: ${code} → ${frequency}`)
  },

  setDimensionSources: (code, sources) => {
    set((state) => ({
      dimensions: state.dimensions.map((dim) =>
        dim.code === code
          ? {
              ...dim,
              sources,
              sourcePriority: sources.length > 0
                ? dim.sourcePriority.filter((item) => {
                    const mapped = item.id === 'akshare' ? 'akshare' : 'ifind'
                    return sources.includes(mapped as DataSourceType) || item.id === 'mock'
                  })
                : dim.sourcePriority,
            }
          : dim,
      ),
      isDirty: true,
    }))

    logger.info(`[SevenDimConfigStore] 维度数据源更新: ${code} → ${sources.join(', ')}`)
  },

  setDimensionSourcePriority: (code, sourcePriority) => {
    set((state) => ({
      dimensions: state.dimensions.map((dim) =>
        dim.code === code ? { ...dim, sourcePriority } : dim,
      ),
      isDirty: true,
    }))

    logger.info(`[SevenDimConfigStore] 维度优先级更新: ${code} → ${sourcePriority.map((s) => s.id).join('>')}`)
  },

  setDimensionPolicy: (code, policy) => {
    set((state) => ({
      dimensions: state.dimensions.map((dim) =>
        dim.code === code
          ? {
              ...dim,
              retryPolicy: policy.retryPolicy ?? dim.retryPolicy,
              timeoutPolicy: policy.timeoutPolicy ?? dim.timeoutPolicy,
              fallbackPolicy: policy.fallbackPolicy ?? dim.fallbackPolicy,
            }
          : dim,
      ),
      isDirty: true,
    }))

    logger.info(`[SevenDimConfigStore] 维度策略更新: ${code}`)
  },

  setDimensionFields: (code, fields) => {
    set((state) => ({
      dimensions: state.dimensions.map((dim) =>
        dim.code === code ? { ...dim, fields } : dim,
      ),
      isDirty: true,
    }))

    logger.info(`[SevenDimConfigStore] 维度字段更新: ${code} → ${fields.join(',')}`)
  },

  setSymbolCount: (count) => {
    const clamped = clamp(count, 1, GLOBAL_LIMITS.maxSymbols)
    set({ symbolCount: clamped, isDirty: true })
    logger.info(`[SevenDimConfigStore] 标的数设置: ${clamped}`)
  },

  setHistoryDays: (days) => {
    const clamped = clamp(days, 1, 1000)
    set({ historyDays: clamped, isDirty: true })
  },

  setGlobalPolicy: (policy) => {
    set((state) => ({
      global: { ...state.global, ...policy },
      isDirty: true,
    }))

    logger.info('[SevenDimConfigStore] 全局策略更新', policy)
  },

  reset: () => {
    logger.info('[SevenDimConfigStore] 重置为默认配置')
    set({
      ...initialState,
      dimensions: generateDimensionsFromTemplate('value'),
      global: createDefaultGlobal(),
      isDirty: false,
      isSaving: false,
      isCollecting: false,
      collectProgress: 0,
      error: null,
    })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'reset' })
  },

  saveConfig: async () => {
    const state = get()
    if (state.isSaving) return

    set({ isSaving: true, error: null })

    try {
      const config = buildCollectionConfig(state)
      logger.info('[SevenDimConfigStore] 保存采集配置', {
        template: config.activeTemplate,
        enabledCount: state.enabledCount(),
        symbolCount: config.symbolCount,
      })

      await dataBridge.forward({
        meta: {
          source: MODULE_ID.fetcher,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.saveCollectConfig,
          traceId: `save-collect-config-${Date.now()}`,
          timestamp: Date.now(),
        },
        payload: {
          store: STORE_NAME.collectConfig,
          data: { id: COLLECT_CONFIG_ID, ...config },
        },
      })

      set({ isSaving: false, isDirty: false })
      logger.info('[SevenDimConfigStore] 配置保存成功')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SevenDimConfigStore] 配置保存失败', { error: message })
      set({ isSaving: false, error: message })
    }
  },

  loadConfig: async () => {
    try {
      logger.info('[SevenDimConfigStore] 从 IndexedDB 加载采集配置')
      const result = await dataBridge.query<Record<string, unknown>>({
        action: 'QUERY_GET',
        store: STORE_NAME.collectConfig,
        key: COLLECT_CONFIG_ID,
        source: MODULE_ID.fetcher,
      })

      if (!result.success || !result.data) {
        logger.info('[SevenDimConfigStore] 未找到已保存配置，使用默认配置')
        return
      }

      const raw = result.data
      const loadedConfig: CollectionConfig = {
        version: typeof raw.version === 'string' ? raw.version : '1.0.0',
        activeTemplate: (raw.activeTemplate as StrategyTemplateId) ?? 'value',
        dimensions: Array.isArray(raw.dimensions)
          ? upgradeDimensionsToPipeline(raw.dimensions as DimensionPipelineConfig[])
          : createPipelineDimensions(),
        global: raw.global ? (raw.global as GlobalCollectPolicy) : createDefaultGlobal(),
        symbolCount: typeof raw.symbolCount === 'number' ? raw.symbolCount : 40,
        historyDays: typeof raw.historyDays === 'number' ? raw.historyDays : 252,
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
      }

      set({
        activeTemplate: loadedConfig.activeTemplate,
        dimensions: loadedConfig.dimensions,
        global: loadedConfig.global,
        symbolCount: loadedConfig.symbolCount,
        historyDays: loadedConfig.historyDays,
        isDirty: false,
        error: null,
      })

      logger.info('[SevenDimConfigStore] 配置加载成功', {
        activeTemplate: loadedConfig.activeTemplate,
        enabledCount: loadedConfig.dimensions.filter((d) => d.enabled).length,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SevenDimConfigStore] 配置加载失败', { error: message })
      set({ error: message })
    }
  },

  runCollection: async () => {
    const state = get()
    if (state.isCollecting) return

    set({ isCollecting: true, collectProgress: 0, error: null })
    const runtime = useCollectionRuntimeStore.getState()
    runtime.setRunning(true)

    try {
      const config = buildCollectionConfig(state)
      const enabledDims = state.dimensions.filter((d) => d.enabled)
      const symbols = resolveDefaultSymbols(state.symbolCount)
      const taskId = `collect-${Date.now()}`

      if (enabledDims.length === 0 || symbols.length === 0) {
        logger.warn('[SevenDimConfigStore] 无可用维度或标的，跳过采集')
        set({ isCollecting: false, collectProgress: 100 })
        runtime.setRunning(false)
        return
      }

      logger.info('[SevenDimConfigStore] 开始真实采集', {
        dimensions: enabledDims.map((d) => d.code).join(', '),
        symbolCount: symbols.length,
        taskId,
      })

      const totalSteps = enabledDims.length
      let completedSteps = 0

      for (const dim of enabledDims) {
        logger.info(`[SevenDimConfigStore] 采集维度: ${dim.code}`)
        await runBatchTrace({
          symbols,
          dimensionCode: dim.code,
          config,
          taskId,
        })
        completedSteps++
        set({ collectProgress: Math.round((completedSteps / totalSteps) * 100) })
      }

      set({ isCollecting: false, collectProgress: 100 })
      runtime.setRunning(false)
      logger.info('[SevenDimConfigStore] 采集完成')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SevenDimConfigStore] 采集失败', { error: message })
      runtime.setRunning(false)
      set({ isCollecting: false, error: message })
    }
  },

  clearError: () => set({ error: null }),
}))
