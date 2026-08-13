/**
 * @module sevenDimConfigStore
 * @description 七维采集配置 Store（Zustand），支持全层级配置与持久化。
 *
 * 职责：
 * - 管理 10 个采集维度的高级配置（启用、频率、数据源、字段、策略、优先级）
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
  /**
   * KPI-01: 当前生效的策略模板 ID
   *  - 口径：用户选择的 {full | lite | conservative | custom} 之一
   *  - 影响：决定 `dimensions[].enabled/frequency/sources` 的初始值
   *  - 刷新时机：用户调用 `applyTemplate(templateId)` 或 `saveConfig` 持久化后
   *  - 取值来源：STRATEGY_TEMPLATES（collectConfig）
   *  - @default 'full'
   */
  activeTemplate: StrategyTemplateId
  /**
   * KPI-02: 10 维度采集管线配置数组
   *  - 口径：每项代表「一个数据维度」的启用态、采集频率、数据源优先级、字段列表、重试/超时/兜底策略
   *  - 典型维：basic / quotation / finance / news / holder / insider / research / sentiment / industry / valuation
   *  - 刷新时机：`toggleDimension / setDimension*` 系列 action 触发
   *  - 使用：`runCollection()` 前通过 `enabledCount()` 计算实际开启的维度数
   */
  dimensions: DimensionPipelineConfig[]
  /**
   * KPI-03: 全局采集策略（限流/批量/超时/通知）
   *  - 子 KPI 口径：
   *    · maxSymbols          — 单次采集最大标的数（上限=1000）
   *    · defaultBatchSize    — 批次大小（默认=20）
   *    · rateLimitPerMinute  — 每分钟 API 调用上限（预估月调用量的分母之一）
   *    · defaultTimeoutMs    — 请求超时（ms），与 TimeoutPolicy 联动
   *    · defaultRetries      — 失败重试次数（不含 Fallback 链路）
   *    · notifyOnComplete/OnError — 采集完成/失败是否触发桌面通知
   *  - 刷新时机：`setGlobalPolicy()` / `loadConfig()`
   */
  global: GlobalCollectPolicy
  /**
   * KPI-04: 本次采集预期处理的标的数量
   *  - 单位：只
   *  - 范围：[1, global.maxSymbols]
   *  - 口径：用户在采集配置面板设置的“预期采 N 只”，实际符号数取意向池真实 size 与 symbolCount 的较小值
   *  - 刷新时机：`setSymbolCount()`
   *  - @default 40
   */
  symbolCount: number
  /**
   * KPI-05: 历史回溯天数（基本面指标的样本窗口）
   *  - 单位：交易日
   *  - 默认 252（约等于 1 个年度交易日）
   *  - 口径：决定 `fetchBasicDataUseCase` 与 `collectionPipeline` 拉取 K 线的 end-start 窗口
   *  - 刷新时机：`setHistoryDays()`
   *  - @default 252
   */
  historyDays: number
  /**
   * 脏标记：内存中配置是否与持久化不一致
   *  - true 表示用户有修改未保存；saveConfig 成功后重置为 false
   */
  isDirty: boolean
  /** 正在持久化到 IndexedDB 时为 true（防止重复点击保存） */
  isSaving: boolean
  /** runCollection 正在执行时为 true（与 collectionRuntimeStore.isRunning 联动） */
  isCollecting: boolean
  /** 当前正在采集的维度 code 列表（空表示无采集进行中） */
  collectingDimensions: string[]
  /**
   * KPI-06: 当前采集批次总体进度
   *  - 单位：百分比
   *  - 口径：(已完成维度任务数 × 每任务权重) / (总任务数) × 100
   *  - 范围：[0, 100]
   *  - 刷新：COLLECTION_EVENTS.TASK_PROGRESS 更新后从 collectionRuntimeStore 同步
   *  - @default 0
   */
  collectProgress: number
  /** 最近一次采集/保存错误文案（null 表示无错误），clearError 清空 */
  error: string | null

  // --- 派生计算（KPI 派生，每次读取实时计算） ---
  /**
   * KPI-DER-01: 当前启用的维度数
   *  - 公式：dimensions.filter(d => d.enabled).length
   *  - 用途：仪表盘「已启用 X/10 维度」展示
   *  @returns {number} 0~10
   */
  enabledCount: () => number
  /**
   * KPI-DER-02: 预估月度 API 调用量
   *  - 公式：estimateTotalMonthlyCalls(symbolCount, historyDays, enabled dimensions)
   *  - 口径：按「维度 × 频率 × 标的数」线性预估，用于提示用户是否触发外部数据商限流
   *  - 单位：次/月
   */
  monthlyCallEstimate: () => number
  /** 交互判断：是否允许点击「运行采集」（或某维度按钮）。条件：dirty 已保存 & 非采集进行中 & 至少 1 维度开启 */
  isClickable: (dimensionCode?: string) => boolean
  /** 根据当前采集状态、频率、数据源优先级生成 Tooltip 文案（用于配置面板问号图标） */
  tooltipText: (dimensionCode?: string) => string
  /**
   * KPI-07: 导出完整采集配置（供 runCollection 与 saveConfig 调用的结构化对象）
   *  - 含 version:1.0.0 + updatedAt:Date.now() 字段，供反序列化后与当前 DB_VERSION 比较
   */
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

/**
 * @example 读取典型 KPI 组合（仪表盘页面顶部 4 张 MetricCard）
 * ```tsx
 * import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
 * import { MetricCard } from '@/components/molecules/MetricCard'
 *
 * function SevenDimKpiStrip() {
 *   const {
 *     activeTemplate, symbolCount, historyDays, collectProgress,
 *     enabledCount, monthlyCallEstimate, isCollecting,
 *   } = useSevenDimConfigStore.getState()   // 或组件内 use() 细粒度订阅
 *
 *   return (
 *     <>
 *       <MetricCard title="已启用维度"      value={`${enabledCount()}/10`} color="scoreHigh" border />
 *       <MetricCard title="预期采集标的数" value={symbolCount}              unit="只" color="info" border />
 *       <MetricCard title="历史回溯窗口"   value={historyDays}               unit="交易日" color="purple" border />
 *       <MetricCard
 *         title={isCollecting ? "采集中..." : "月度调用预估"}
 *         value={isCollecting ? `${Math.round(collectProgress)}%` : monthlyCallEstimate()}
 *         unit={isCollecting ? undefined : "次/月"}
 *         color={isCollecting ? "warning" : "emerald"}
 *         border
 *         change={activeTemplate}
 *       />
 *     </>
 *   )
 * }
 * ```
 */

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
    set({
      ...initialState,
      dimensions: generateDimensionsFromTemplate('full'),
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
    if (state.collectingDimensions.length > 0) return

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
      set({
        isCollecting: false,
        collectingDimensions: [],
        collectProgress: 100,
        error: failures.length > 0
          ? `${failures.length} 个维度采集失败`
          : null,
      })
      runtime.setRunning(false)
      runtime.refreshStats()

      if (failures.length > 0) {
        const errMsg = failures
          .map((f) => (f as PromiseRejectedResult).reason)
          .join('; ')
        logger.error('[SevenDimConfigStore] 并发采集部分失败', { failures: failures.length, errors: errMsg })
      } else {
        logger.info('[SevenDimConfigStore] 并发采集完成')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SevenDimConfigStore] 采集失败', { error: message })
      runtime.setRunning(false)
      set({ isCollecting: false, collectingDimensions: [], error: message })
    }
  },

  clearError: () => set({ error: null }),
}))
