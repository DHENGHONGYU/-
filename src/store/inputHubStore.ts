/**
 * @module inputHubStore
 * @lifecycle @Global
 * @description 输入舱 Hub 页面状态管理。
 * 包含股票搜索与录入功能的状态管理，代理 inputService 的搜索/录入操作。
 */

import { create } from 'zustand'
import {
  searchStocks as searchStocksService,
  addStockFromSearch as addStockFromSearchService,
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
  /** 设置当前选中模块 */
  setActiveModule: (path: string) => void
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void
  /** 搜索股票（代理 inputService.searchStocks） */
  searchStocks: (query: string) => StockSearchResult[]
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
}

export const useInputHubStore = create<InputHubState>()((set) => ({
  ...initialState,

  setActiveModule: (path: string) => {
    set({ activeModule: path })
    logger.info('[InputHubStore] setActiveModule', { path })
  },

  setLoading: (loading: boolean) => set({ loading }),

  searchStocks: (query: string) => {
    const results = searchStocksService(query)
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
