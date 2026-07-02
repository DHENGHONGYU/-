/**
 * @module sevenDimConfigStore
 * @description 七维采集配置 Store（Zustand）。
 *
 * 职责：
 * - 管理 8 个采集维度的启用/频率/数据源等配置
 * - 管理当前选中的策略模板
 * - 管理全局参数（标的数、限流等）
 * - 提供配置序列化/反序列化能力
 * - 提供 isClickable / isVisible 等页面守卫状态
 *
 * @see V6 Pro: cockpit-app/src/data/collectConfig.ts (createPresetConfig)
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  type DimensionConfig,
  type StrategyTemplateId,
  type UpdateFrequency,
  type DataSourceType,
  type StrategyTemplate,
  DEFAULT_DIMENSIONS,
  STRATEGY_TEMPLATES,
  GLOBAL_LIMITS,
  estimateTotalMonthlyCalls,
} from '@/config/collectConfig'

const logger = getLogger()

// ============================================================
// Store 接口定义
// ============================================================

export interface SevenDimConfigState {
  // --- 状态 ---
  /** 当前选中的策略模板 */
  activeTemplate: StrategyTemplateId
  /** 8个维度配置 */
  dimensions: DimensionConfig[]
  /** 目标标的数 */
  symbolCount: number
  /** 历史数据天数 */
  historyDays: number
  /** 是否有未保存的修改 */
  isDirty: boolean
  /** 是否正在保存 */
  isSaving: boolean
  /** 是否正在执行采集 */
  isCollecting: boolean
  /** 采集进度（0-100） */
  collectProgress: number
  /** 错误信息 */
  error: string | null

  // --- 派生计算 ---
  /** 已启用的维度数 */
  enabledCount: () => number
  /** 月调用总量预估 */
  monthlyCallEstimate: () => number
  /** 是否可交互（页面守卫） */
  isClickable: () => boolean
  /** 不可交互时的提示文本 */
  tooltipText: () => string

  // --- Actions ---
  /** 应用策略模板 */
  applyTemplate: (templateId: StrategyTemplateId) => void
  /** 切换维度启用状态 */
  toggleDimension: (code: string) => void
  /** 设置维度频率 */
  setDimensionFrequency: (code: string, frequency: UpdateFrequency) => void
  /** 设置维度数据源 */
  setDimensionSources: (code: string, sources: DataSourceType[]) => void
  /** 设置目标标的数 */
  setSymbolCount: (count: number) => void
  /** 设置历史天数 */
  setHistoryDays: (days: number) => void
  /** 重置为默认配置 */
  reset: () => void
  /** 保存配置 */
  saveConfig: () => Promise<void>
  /** 执行采集 */
  runCollection: () => Promise<void>
  /** 清除错误 */
  clearError: () => void
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 根据策略模板生成维度配置
 */
function generateDimensionsFromTemplate(template: StrategyTemplate): DimensionConfig[] {
  return DEFAULT_DIMENSIONS.map((dim) => ({
    ...dim,
    enabled: template.dimensions.includes(dim.code),
    frequency: dim.enabled ? template.updateInterval : dim.frequency,
  }))
}

// ============================================================
// Store 实现
// ============================================================

export const useSevenDimConfigStore = create<SevenDimConfigState>((set, get) => ({
  // --- 初始状态 ---
  activeTemplate: 'value',
  dimensions: generateDimensionsFromTemplate(STRATEGY_TEMPLATES[0]!),
  symbolCount: 40,
  historyDays: 252,
  isDirty: false,
  isSaving: false,
  isCollecting: false,
  collectProgress: 0,
  error: null,

  // --- 派生计算 ---
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

  // --- Actions ---
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
      dimensions: generateDimensionsFromTemplate(template),
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
        dim.code === code ? { ...dim, sources } : dim,
      ),
      isDirty: true,
    }))

    logger.info(`[SevenDimConfigStore] 维度数据源更新: ${code} → ${sources.join(', ')}`)
  },

  setSymbolCount: (count) => {
    const clamped = Math.max(1, Math.min(count, GLOBAL_LIMITS.maxSymbols))
    set({ symbolCount: clamped, isDirty: true })
    logger.info(`[SevenDimConfigStore] 标的数设置: ${clamped}`)
  },

  setHistoryDays: (days) => {
    const clamped = Math.max(1, Math.min(days, 1000))
    set({ historyDays: clamped, isDirty: true })
  },

  reset: () => {
    logger.info('[SevenDimConfigStore] 重置为默认配置')
    set({
      activeTemplate: 'value',
      dimensions: generateDimensionsFromTemplate(STRATEGY_TEMPLATES[0]!),
      symbolCount: 40,
      historyDays: 252,
      isDirty: false,
      isSaving: false,
      isCollecting: false,
      collectProgress: 0,
      error: null,
    })
  },

  saveConfig: async () => {
    const state = get()
    if (state.isSaving) return

    set({ isSaving: true, error: null })

    try {
      logger.info('[SevenDimConfigStore] 保存采集配置', {
        template: state.activeTemplate,
        enabledCount: state.enabledCount(),
        symbolCount: state.symbolCount,
      })

      // TODO: 调用 DataBridge.forward() 持久化配置到 IndexedDB
      // await dataBridge.forward('collectConfig.save', { dimensions, symbolCount })

      await new Promise((resolve) => setTimeout(resolve, 300))

      set({ isSaving: false, isDirty: false })
      logger.info('[SevenDimConfigStore] 配置保存成功')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SevenDimConfigStore] 配置保存失败', { error: message })
      set({ isSaving: false, error: message })
    }
  },

  runCollection: async () => {
    const state = get()
    if (state.isCollecting) return

    set({ isCollecting: true, collectProgress: 0, error: null })

    try {
      const enabledDims = state.dimensions.filter((d) => d.enabled)
      logger.info('[SevenDimConfigStore] 开始采集', {
        dimensions: enabledDims.map((d) => d.code).join(', '),
        symbolCount: state.symbolCount,
      })

      // TODO: 调用 fetcherService 执行实际采集
      // 模拟进度更新
      for (let i = 0; i <= 100; i += 10) {
        set({ collectProgress: i })
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      set({ isCollecting: false, collectProgress: 100 })
      logger.info('[SevenDimConfigStore] 采集完成')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[SevenDimConfigStore] 采集失败', { error: message })
      set({ isCollecting: false, error: message })
    }
  },

  clearError: () => set({ error: null }),
}))
