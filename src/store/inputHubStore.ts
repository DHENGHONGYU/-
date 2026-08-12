/**
 * @module inputHubStore
 * @lifecycle @Global
 * @description 输入舱 Hub 页面状态管理。
 * 包含股票搜索与录入功能的状态管理，代理 inputService 的搜索/录入操作。
  * @doc [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
*/

import { create } from 'zustand'
import {
  searchStocks as searchStocksService,
  addStockFromSearch as addStockFromSearchService,
  listStocks,
  type StockSearchResult,
  type AddStockOptions,
} from '@/services/input/inputService'
import type { DataLayerResult, Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export interface InputHubState {
  /** 当前选中的模块路径（预留） */
  activeModule: string
  /** 页面加载状态（预留） */
  loading: boolean
  /** 搜索结果列表 */
  searchResults: StockSearchResult[]
  /** 是否正在录入 */
  isAddingStock: boolean
  /** 已导入的股票代码集合（用于搜索 UI 标记"已导入"） */
  existingSymbols: Set<string>
  /** 刷新已导入股票代码集合 */
  refreshExistingSymbols: () => Promise<void>
  /** 设置当前选中模块 */
  setActiveModule: (path: string) => void
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void
  /** 搜索股票（全市场 A+H 股） */
  searchStocks: (query: string) => Promise<StockSearchResult[]>
  /** 从搜索结果录入股票（代理 inputService.addStockFromSearch） */
  addStockFromSearch: (
    result: StockSearchResult,
    options?: AddStockOptions,
  ) => Promise<DataLayerResult<Stock>>
  /** 重置 */
  reset: () => void
}

const initialState = {
  activeModule: '',
  loading: false,
  searchResults: [] as StockSearchResult[],
  isAddingStock: false,
  existingSymbols: new Set<string>(),
}

/**
 * useInputHubStore
 */
export const useInputHubStore = create<InputHubState>()((set) => ({
  ...initialState,

  setActiveModule: (path: string) => {
    set({ activeModule: path })
    logger.info('[InputHubStore] setActiveModule', { path })
  },

  setLoading: (loading: boolean) => set({ loading }),

  refreshExistingSymbols: async () => {
    try {
      const result = await listStocks()
      if (result.success && result.data) {
        set({ existingSymbols: new Set(result.data.map((s) => s.symbol)) })
      }
    } catch {
      // 静默处理
    }
  },

  searchStocks: async (query: string) => {
    const results = await searchStocksService(query)
    set({ searchResults: results })
    logger.info('[InputHubStore] searchStocks() completed', {
      query,
      resultCount: results.length,
    })
    return results
  },

  addStockFromSearch: async (
    result: StockSearchResult,
    options?: AddStockOptions,
  ) => {
    set({ isAddingStock: true })
    logger.info('[InputHubStore] addStockFromSearch() started', {
      symbol: result.symbol,
      name: result.name,
    })
    try {
      const addResult = await addStockFromSearchService(result, options)
      set({ isAddingStock: false })
      logger.info('[InputHubStore] addStockFromSearch() completed', {
        symbol: result.symbol,
        success: addResult.success,
      })
      return addResult
    } catch (err) {
      set({ isAddingStock: false })
      logger.error('[InputHubStore] addStockFromSearch() failed', {
        error: err instanceof Error ? err.message : String(err),
        symbol: result.symbol,
      })
      return {
        success: false as const,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  },

  reset: () => {
    set({ ...initialState })
    logger.info('[InputHubStore] reset() completed')
  },
}))
