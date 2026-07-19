/**
 * @fileoverview 检索状态 Store
 *
 * 管理检索条件、结果、分面统计与视图模式。
 *
 * @module store/searchStore
 * @created 2026-07-14 - 双通道整改 P2-3
  * @doc [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import type { SearchCriteria, SearchResult } from '@/types/modules/data-sync.types'

const logger = getLogger()

/** 视图模式 */
export type SearchViewMode = 'timeline' | 'grouped'

/** 检索 Store 状态 */
export interface SearchState {
  // 检索条件
  keyword: string
  datePreset: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'all' | 'custom'
  channels: Array<'auto-collect' | 'file-import' | 'manual-trigger'>
  symbols: string[]
  dimensions: string[]
  statuses: Array<'success' | 'partial' | 'failed'>
  fileTypes: string[]

  // 分页
  page: number
  pageSize: number

  // 视图
  viewMode: SearchViewMode

  // 结果
  result: SearchResult | null
  loading: boolean

  // 操作
  setKeyword: (keyword: string) => void
  setDatePreset: (preset: SearchState['datePreset']) => void
  toggleChannel: (channel: 'auto-collect' | 'file-import' | 'manual-trigger') => void
  toggleStatus: (status: 'success' | 'partial' | 'failed') => void
  toggleFileType: (fileType: string) => void
  setSymbols: (symbols: string[]) => void
  setDimensions: (dimensions: string[]) => void
  setPage: (page: number) => void
  setViewMode: (mode: SearchViewMode) => void
  setResult: (result: SearchResult) => void
  setLoading: (loading: boolean) => void
  buildCriteria: () => SearchCriteria
  reset: () => void
}

const initialState = {
  keyword: '',
  datePreset: 'all' as SearchState['datePreset'],
  channels: [] as SearchState['channels'],
  symbols: [] as string[],
  dimensions: [] as string[],
  statuses: [] as SearchState['statuses'],
  fileTypes: [] as string[],
  page: 1,
  pageSize: 20,
  viewMode: 'timeline' as SearchViewMode,
  result: null,
  loading: false,
}

/** 计算时间范围预设 */
function computeDateRange(preset: SearchState['datePreset']): SearchCriteria['dateRange'] {
  if (preset === 'all') return undefined
  const now = new Date()
  const start = new Date()
  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      return { start: start.toISOString(), end: now.toISOString(), preset: 'custom' }
    case 'yesterday': {
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setHours(23, 59, 59, 999)
      return { start: start.toISOString(), end: end.toISOString(), preset: 'custom' }
    }
    case 'last7days':
      start.setDate(start.getDate() - 7)
      return { start: start.toISOString(), end: now.toISOString(), preset: 'last7days' }
    case 'last30days':
      start.setDate(start.getDate() - 30)
      return { start: start.toISOString(), end: now.toISOString(), preset: 'last30days' }
    default:
      return undefined
  }
}

/**
 * useSearchStore
 */
export const useSearchStore = create<SearchState>((set, get) => ({
  ...initialState,

  setKeyword: (keyword) => {
    set({ keyword, page: 1 })
  },

  setDatePreset: (datePreset) => {
    set({ datePreset, page: 1 })
  },

  toggleChannel: (channel) => {
    set((state) => {
      const exists = state.channels.includes(channel)
      return {
        channels: exists
          ? state.channels.filter(c => c !== channel)
          : [...state.channels, channel],
        page: 1,
      }
    })
  },

  toggleStatus: (status) => {
    set((state) => {
      const exists = state.statuses.includes(status)
      return {
        statuses: exists
          ? state.statuses.filter(s => s !== status)
          : [...state.statuses, status],
        page: 1,
      }
    })
  },

  toggleFileType: (fileType) => {
    set((state) => {
      const exists = state.fileTypes.includes(fileType)
      return {
        fileTypes: exists
          ? state.fileTypes.filter(f => f !== fileType)
          : [...state.fileTypes, fileType],
        page: 1,
      }
    })
  },

  setSymbols: (symbols) => set({ symbols, page: 1 }),
  setDimensions: (dimensions) => set({ dimensions, page: 1 }),
  setPage: (page) => set({ page }),
  setViewMode: (viewMode) => set({ viewMode }),

  setResult: (result) => {
    set({ result })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'searchComplete', total: result.total })
    logger.info('[searchStore] 检索结果已设置', { total: result.total, page: result.page })
  },

  setLoading: (loading) => set({ loading }),

  buildCriteria: () => {
    const state = get()
    return {
      keyword: state.keyword || undefined,
      dateRange: computeDateRange(state.datePreset),
      channels: state.channels.length > 0 ? state.channels : undefined,
      symbols: state.symbols.length > 0 ? state.symbols : undefined,
      dimensions: state.dimensions.length > 0 ? state.dimensions : undefined,
      statuses: state.statuses.length > 0 ? state.statuses : undefined,
      fileTypes: state.fileTypes.length > 0 ? state.fileTypes : undefined,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      page: state.page,
      pageSize: state.pageSize,
    }
  },

  reset: () => {
    set(initialState)
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'searchReset' })
    logger.info('[searchStore] 已重置')
  },
}))
