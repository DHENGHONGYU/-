/**
 * @module multiFactorScreeningStore
 * @description 多因子筛选器 Zustand Store（DA-007 四步集成合约：第 2 步 Store）。
 * 负责状态管理、模板持久化、调用 Engine 执行筛选。
  * @doc [V9-DOC-BACK-004, V9-DOC-DATA-011, V9-DOC-DATA-022, V9-DOC-DATA-009, V9-DOC-ARCH-007]
*/

import { create } from 'zustand'
import { createStorage } from '@/lib/localStorageManager'
import { getLogger } from '@/lib/logger'
import type {
  ScreeningConditionGroup,
  ScreeningCriterion,
  ScreeningLogic,
  ScreeningResultItem,
  ScreeningTemplate,
} from '@/types/modules/screening.types'
import {
  loadScreenableStocks,
  runMultiFactorScreening,
  createTemplateFromGroups,
  exportScreeningResults,
} from '@/services/screening/multiFactorScreeningEngine'
import {
  screeningResultStore,
  type ScreeningRunResultRecord,
} from '@/data/dataLayerContentStores'
import {
  MULTI_FACTOR_SCREENING_DEFAULT_LOGIC,
  MULTI_FACTOR_SCREENING_FACTORS,
  MULTI_FACTOR_SCREENING_STORAGE_KEY,
  MULTI_FACTOR_SCREENING_TEMPLATE_NAME_MAX_LENGTH,
  MULTI_FACTOR_SCREENING_CSV_FILENAME_PREFIX,
} from '@/config/multiFactorScreeningConfig'

const logger = getLogger()
const storage = createStorage('multiFactorScreening')

function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function createDefaultCriterion(): ScreeningCriterion {
  const meta = MULTI_FACTOR_SCREENING_FACTORS[0]!
  return {
    id: generateId('criterion'),
    factor: meta.factor,
    operator: meta.defaultOperator,
    value: meta.defaultValue,
  }
}

function createDefaultGroup(): ScreeningConditionGroup {
  return {
    id: generateId('group'),
    logic: MULTI_FACTOR_SCREENING_DEFAULT_LOGIC,
    criteria: [createDefaultCriterion()],
  }
}

export interface MultiFactorScreeningState {
  conditionGroups: ScreeningConditionGroup[]
  results: ScreeningResultItem[]
  loading: boolean
  error: string | null
  templates: ScreeningTemplate[]
  /** 已持久化的筛选运行历史（从 screening_results 读取，支持回溯/复用） */
  savedRuns: ScreeningRunResultRecord[]

  // Actions: 条件组编辑
  addGroup: () => void
  removeGroup: (groupId: string) => void
  setGroupLogic: (groupId: string, logic: ScreeningLogic) => void
  addCriterion: (groupId: string) => void
  removeCriterion: (groupId: string, criterionId: string) => void
  updateCriterion: (
    groupId: string,
    criterionId: string,
    updates: Partial<Omit<ScreeningCriterion, 'id'>>,
  ) => void
  setGroups: (groups: ScreeningConditionGroup[]) => void
  resetGroups: () => void

  // Actions: 筛选执行
  runScreening: () => Promise<void>
  clearResults: () => void

  // Actions: 全局重置
  /** 重置 store 到初始空状态（含 templates），用于登出/切换账户 */
  reset: () => void

  // Actions: 模板持久化
  saveTemplate: (name: string, description?: string) => ScreeningTemplate | null
  loadTemplate: (templateId: string) => void
  deleteTemplate: (templateId: string) => void
  loadSavedTemplates: () => void

  // Actions: 筛选结果集持久化（P0 筛选结果集持久化，v34）
  loadSavedRuns: () => Promise<void>

  // Actions: 导出
  exportResults: () => void
}

function persistTemplates(templates: ScreeningTemplate[]): void {
  try {
    storage.set(MULTI_FACTOR_SCREENING_STORAGE_KEY, templates)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[multiFactorScreeningStore] 模板持久化失败', { error: message })
  }
}

/**
 * useMultiFactorScreeningStore
 */
export const useMultiFactorScreeningStore = create<MultiFactorScreeningState>((set, get) => ({
  conditionGroups: [createDefaultGroup()],
  results: [],
  loading: false,
  error: null,
  templates: [],
  savedRuns: [],

  addGroup: () => {
    set((state) => ({ conditionGroups: [...state.conditionGroups, createDefaultGroup()] }))
  },

  removeGroup: (groupId) => {
    set((state) => ({
      conditionGroups: state.conditionGroups.filter((group) => group.id !== groupId),
    }))
  },

  setGroupLogic: (groupId, logic) => {
    set((state) => ({
      conditionGroups: state.conditionGroups.map((group) =>
        group.id === groupId ? { ...group, logic } : group,
      ),
    }))
  },

  addCriterion: (groupId) => {
    set((state) => ({
      conditionGroups: state.conditionGroups.map((group) =>
        group.id === groupId
          ? { ...group, criteria: [...group.criteria, createDefaultCriterion()] }
          : group,
      ),
    }))
  },

  removeCriterion: (groupId, criterionId) => {
    set((state) => ({
      conditionGroups: state.conditionGroups.map((group) =>
        group.id === groupId
          ? { ...group, criteria: group.criteria.filter((c) => c.id !== criterionId) }
          : group,
      ),
    }))
  },

  updateCriterion: (groupId, criterionId, updates) => {
    set((state) => ({
      conditionGroups: state.conditionGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              criteria: group.criteria.map((criterion) =>
                criterion.id === criterionId ? { ...criterion, ...updates } : criterion,
              ),
            }
          : group,
      ),
    }))
  },

  setGroups: (groups) => set({ conditionGroups: groups }),

  resetGroups: () => set({ conditionGroups: [createDefaultGroup()], results: [], error: null }),

  runScreening: async () => {
    set({ loading: true, error: null })
    try {
      const stocks = await loadScreenableStocks()
      const result = runMultiFactorScreening(stocks, get().conditionGroups)
      // P0 筛选结果集持久化（v34）：将本次运行结果落库 screening_results，取代纯内存态（刷新即丢）
      const runId = generateId('run')
      const record: ScreeningRunResultRecord = {
        runId,
        symbol: result.items[0]?.symbol ?? '',
        conditionGroups: get().conditionGroups,
        items: result.items,
        total: result.total,
        elapsedMs: result.elapsedMs,
        createdAt: new Date().toISOString(),
        sourceModule: 'screening',
      }
      void screeningResultStore.save(record).catch((e) => {
        const msg = e instanceof Error ? e.message : String(e)
        logger.error('[multiFactorScreeningStore] 筛选结果集持久化失败', { error: msg })
      })
      set({
        results: result.items,
        loading: false,
        savedRuns: [record, ...get().savedRuns].slice(0, 50),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[multiFactorScreeningStore] 筛选失败', { error: message })
      set({ error: message, loading: false })
    }
  },

  clearResults: () => set({ results: [], error: null }),

  reset: () => {
    set({
      conditionGroups: [createDefaultGroup()],
      results: [],
      loading: false,
      error: null,
      templates: [],
      savedRuns: [],
    })
    // 同时清除持久化的模板
    try {
      storage.remove(MULTI_FACTOR_SCREENING_STORAGE_KEY)
    } catch {
      // localStorage 可能不可用，忽略错误
    }
  },

  saveTemplate: (name, description) => {
    const trimmed = name.trim()
    if (trimmed.length === 0 || trimmed.length > MULTI_FACTOR_SCREENING_TEMPLATE_NAME_MAX_LENGTH) {
      set({ error: `模板名称长度需在 1-${MULTI_FACTOR_SCREENING_TEMPLATE_NAME_MAX_LENGTH} 之间` })
      return null
    }

    const template = createTemplateFromGroups(trimmed, get().conditionGroups, description)
    const templates = [...get().templates, template]
    set({ templates, error: null })
    persistTemplates(templates)
    return template
  },

  loadTemplate: (templateId) => {
    const template = get().templates.find((t) => t.id === templateId)
    if (!template) {
      set({ error: `未找到模板 ${templateId}` })
      return
    }
    set({ conditionGroups: template.groups, results: [], error: null })
  },

  deleteTemplate: (templateId) => {
    const templates = get().templates.filter((t) => t.id !== templateId)
    set({ templates })
    persistTemplates(templates)
  },

  loadSavedTemplates: () => {
    try {
      const raw = storage.get<ScreeningTemplate[]>(MULTI_FACTOR_SCREENING_STORAGE_KEY) ?? []
      set({ templates: raw })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[multiFactorScreeningStore] 读取模板失败', { error: message })
      set({ templates: [] })
    }
  },

  exportResults: () => {
    exportScreeningResults(get().results, MULTI_FACTOR_SCREENING_CSV_FILENAME_PREFIX)
  },

  // P0 筛选结果集持久化（v34）：从 screening_results 读取历史运行，支持回溯/复用
  loadSavedRuns: async () => {
    try {
      const runs = await screeningResultStore.list()
      set({
        savedRuns: runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[multiFactorScreeningStore] 读取筛选历史失败', { error: message })
    }
  },
}))
