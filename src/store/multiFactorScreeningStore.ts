/**
 * @module multiFactorScreeningStore
 * @description 多因子筛选器 Zustand Store（DA-007 四步集成合约：第 2 步 Store）。
 * 负责状态管理、模板持久化、调用 Engine 执行筛选。
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

  // Actions: 模板持久化
  saveTemplate: (name: string, description?: string) => ScreeningTemplate | null
  loadTemplate: (templateId: string) => void
  deleteTemplate: (templateId: string) => void
  loadSavedTemplates: () => void

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
      set({ results: result.items, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[multiFactorScreeningStore] 筛选失败', { error: message })
      set({ error: message, loading: false })
    }
  },

  clearResults: () => set({ results: [], error: null }),

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
}))
