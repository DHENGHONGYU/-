/**
 * @module sevenDimConfigStore
 * @description 七维采集配置 Store（Zustand），支持全层级配置与持久化。
 *
 * 职责：
 * - 管理 8 个采集维度的高级配置（启用、频率、数据源、字段、策略、优先级）
 * - 管理当前策略模板与全局参数
 * - 提供配置序列化 / 反序列化能力
 * - 通过 DataBridge.forward() 持久化到 IndexedDB
  * @doc [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-073, V9-DOC-DATA-068, V9-DOC-FRONT-020]
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
import { useIntentionPoolStore } from '@/store/intentionPoolStore'

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
  /** 当前正在采集的维度 code 列表（空表示无采集进行中） */
  collectingDimensions: string[]
  collectProgress: number
  error: string | null
  /** 是否正在自动恢复中 */
  isRecovering: boolean
  /** 是否已尝试过恢复（恢复失败后阻止再次重试） */
  recoveryAttempted: boolean

  // --- 派生计算 ---
  enabledCount: () => number
  monthlyCallEstimate: () => number
  isClickable: (dimensionCode?: string) => boolean
  tooltipText: (dimensionCode?: string) => string
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
  /** 取消待执行的自动恢复并重置恢复状态 */
  cancelRecovery: () => void
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
 * 从用户意向池读取采集标的列表。
 * 意向池为空时回退到空数组（调用方会 skip 采集）。
 */
function resolveDefaultSymbols(_count: number): string[] {
  const poolItems = useIntentionPoolStore.getState().items
  if (poolItems.length === 0) {
    logger.warn('[SevenDimConfigStore] 意向池为空，无可采集标的')
    return []
  }
  return poolItems
    .map((item) => item.symbol.trim().toUpperCase())
    .filter((symbol) => symbol.length > 0)
}

// ============================================================
// Store 实现
// ============================================================

/** 自动恢复定时器引用（模块级，跨 store 实例共享） */
let recoveryTimer: ReturnType<typeof setTimeout> | null = null

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
  | 'cancelRecovery'
> = {
  activeTemplate: 'full',
  dimensions: generateDimensionsFromTemplate('full'),
  global: createDefaultGlobal(),
  symbolCount: 40,
  historyDays: 252,
  isDirty: false,
  isSaving: false,
  isCollecting: false,
  collectingDimensions: [],
  collectProgress: 0,
  error: null,
  isRecovering: false,
  recoveryAttempted: false,
}

/**
 * useSevenDimConfigStore
 */
export const useSevenDimConfigStore = create<SevenDimConfigState>((set, get) => ({
  ...initialState,

  enabledCount: () => get().dimensions.filter((d) => d.enabled).length,

  monthlyCallEstimate: () =>
    estimateTotalMonthlyCalls(get().dimensions, get().symbolCount),

  isClickable: (dimensionCode) => {
    const state = get()
    if (state.isSaving) return false
    if (dimensionCode) return !state.collectingDimensions.includes(dimensionCode)
    return state.collectingDimensions.length === 0
  },

  tooltipText: (dimensionCode) => {
    const state = get()
    if (state.isSaving) return '配置保存中，请稍候...'
    if (dimensionCode) {
      return state.collectingDimensions.includes(dimensionCode)
        ? `维度 ${dimensionCode} 采集中，请稍候...`
        : ''
    }
    if (state.collectingDimensions.length > 0)
      return `维度 ${state.collectingDimensions.join(', ')} 采集中，请稍候...`
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
                    return sources.includes(mapped) || item.id === 'mock'
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
    if (recoveryTimer) {
      clearTimeout(recoveryTimer)
      recoveryTimer = null
    }
    set({
      ...initialState,
      dimensions: generateDimensionsFromTemplate('full'),
      global: createDefaultGlobal(),
      isDirty: false,
      isSaving: false,
      isCollecting: false,
      collectProgress: 0,
      error: null,
      isRecovering: false,
      recoveryAttempted: false,
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
    if (state.collectingDimensions.length > 0) return

    // 取消待执行的自动恢复（用户手动触发采集优先）
    if (recoveryTimer) {
      clearTimeout(recoveryTimer)
      recoveryTimer = null
      set({ isRecovering: false, recoveryAttempted: false })
    }

    const enabledDims = state.dimensions.filter((d) => d.enabled)
    const symbols = resolveDefaultSymbols(state.symbolCount)
    if (enabledDims.length === 0 || symbols.length === 0) {
      logger.warn('[SevenDimConfigStore] 无可用维度或标的，跳过采集')
      return
    }

    // Palantir Foundry 对标：维度就绪度检查（采集前验证配置完整性）
    const unreadyDims = enabledDims.filter((d) => !d.code || d.sources.length === 0)
    if (unreadyDims.length > 0) {
      const unreadyCodes = unreadyDims.map((d) => d.code).join(', ')
      logger.warn('[SevenDimConfigStore] 维度就绪度检查未通过', {
        unreadyDimensions: unreadyCodes,
        reason: '缺少 code 或 sources 为空',
      })
      set({ error: `维度配置不完整: ${unreadyCodes}（缺少 code 或数据源）` })
      return
    }

    const dimCodes = enabledDims.map((d) => d.code)
    set({
      isCollecting: true,
      collectingDimensions: [...dimCodes],
      collectProgress: 0,
      error: null,
    })
    const runtime = useCollectionRuntimeStore.getState()
    runtime.setRunning(true)

    const config = buildCollectionConfig(state)
    const parentTaskId = `collect-${Date.now()}`

    logger.info('[SevenDimConfigStore] 开始并发采集', {
      dimensions: dimCodes.join(', '),
      symbolCount: symbols.length,
      parentTaskId,
    })

    try {
      const results = await Promise.allSettled(
        dimCodes.map((dimCode) =>
          runBatchTrace({ symbols, dimensionCode: dimCode, config, parentTaskId }),
        ),
      )

      const failures = results.filter((r) => r.status === 'rejected')
      const hasFailures = failures.length > 0

      set({
        isCollecting: false,
        collectingDimensions: [],
        collectProgress: 100,
        error: hasFailures
          ? `${failures.length} 个维度采集失败`
          : null,
      })
      runtime.setRunning(false)
      runtime.refreshStats()

      if (hasFailures) {
        const errMsg = failures
          .map((f) => (f).reason)
          .join('; ')
        logger.error('[SevenDimConfigStore] 并发采集部分失败', { failures: failures.length, errors: errMsg })

        // 自动恢复逻辑：失败后 30s 尝试一次恢复
        if (!get().recoveryAttempted) {
          set({ isRecovering: true, recoveryAttempted: true })
          logger.info('[SevenDimConfigStore] 将在 30s 后尝试自动恢复')

          recoveryTimer = setTimeout(async () => {
            recoveryTimer = null
            try {
              logger.info('[SevenDimConfigStore] 开始自动恢复采集')
              await useSevenDimConfigStore.getState().runCollection()
              const afterState = useSevenDimConfigStore.getState()
              if (!afterState.error) {
                logger.info('[SevenDimConfigStore] 自动恢复成功')
                set({ isRecovering: false, recoveryAttempted: false })
              } else {
                logger.warn('[SevenDimConfigStore] 自动恢复仍失败，不再重试')
                set({ isRecovering: false })
              }
            } catch (err) {
              logger.error('[SevenDimConfigStore] 自动恢复异常', { error: err })
              set({ isRecovering: false })
            }
          }, 30_000)
        }
      } else {
        logger.info('[SevenDimConfigStore] 并发采集完成')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SevenDimConfigStore] 采集失败', { error: message })
      runtime.setRunning(false)
      set({ isCollecting: false, collectingDimensions: [], error: message })

      // 全量异常也触发恢复
      if (!get().recoveryAttempted) {
        set({ isRecovering: true, recoveryAttempted: true })
        recoveryTimer = setTimeout(async () => {
          recoveryTimer = null
          try {
            await useSevenDimConfigStore.getState().runCollection()
            const afterState = useSevenDimConfigStore.getState()
            if (!afterState.error) {
              set({ isRecovering: false, recoveryAttempted: false })
            } else {
              set({ isRecovering: false })
            }
          } catch {
            set({ isRecovering: false })
          }
        }, 30_000)
      }
    }
  },

  clearError: () => set({ error: null }),

  cancelRecovery: () => {
    if (recoveryTimer) {
      clearTimeout(recoveryTimer)
      recoveryTimer = null
    }
    set({ isRecovering: false, recoveryAttempted: false })
    logger.info('[SevenDimConfigStore] 已取消待执行的自动恢复')
  },
}))
