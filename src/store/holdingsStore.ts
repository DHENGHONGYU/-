/**
 * @module holdingsStore
 * @lifecycle @Global
 * @description 交易持仓状态管理。从 HoldingsPage.tsx 的 useReducer 迁移至 Zustand，
 * 支持跨组件（如 TradingApp 的 CoreResourcePanel）共享持仓状态。
 *
 * @compliance
 * - 所有颜色值从 @/constants/trade.constants 引用
 * - 所有枚举值从 @/constants/trade.constants 引用
 * - 魔法值禁止出现在 actions 中
 */

import { create } from 'zustand'
import {
  TRADE_DIRECTION,
  PAGINATION_DEFAULTS,
  FILTER_DEFAULTS,
} from '@/constants/trade.constants'
import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import type {
  HoldingItem,
  FilterState,
  PaginationState,
  HoldingsLoadingState,
  TradeModalState,
  HoldingsQueryParams,
} from '@/types/modules/trade.types'
import type { HoldingAction } from '@/constants/trade.constants'
import { HTTP_OK, HTTP_INTERNAL_ERROR } from '@/config/mathConstants'

const logger = getLogger()

// ============================================================
// 工具函数
// ============================================================

function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - FILTER_DEFAULTS.DEFAULT_DATE_RANGE_DAYS)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

const defaultDates = getDefaultDateRange()

// ============================================================
// Store 接口
// ============================================================

interface HoldingsState {
  /** 持仓数据 */
  data: HoldingItem[]
  /** 筛选条件 */
  filter: FilterState
  /** 分页状态 */
  pagination: PaginationState
  /** 加载状态 */
  loading: HoldingsLoadingState
  /** 交易弹窗 */
  modal: TradeModalState

  // Actions
  setData: (list: HoldingItem[], total: number) => void
  setFilter: (partial: Partial<FilterState>) => void
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  setLoading: (partial: Partial<HoldingsLoadingState>) => void
  openModal: (holding: HoldingItem, action: HoldingAction) => void
  closeModal: () => void
  resetFilter: () => void
  fetchData: (params: HoldingsQueryParams) => Promise<{ code: number; message: string }>
  executeTrade: (opts: { code: string; action: HoldingAction; quantity: number }) => Promise<{ success: boolean; message: string }>
  exportCSV: (params: HoldingsQueryParams) => Promise<void>
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  data: [] as HoldingItem[],
  filter: {
    startDate: defaultDates.start,
    endDate: defaultDates.end,
    direction: TRADE_DIRECTION.ALL,
    keyword: '',
  } as FilterState,
  pagination: {
    page: PAGINATION_DEFAULTS.DEFAULT_PAGE,
    pageSize: PAGINATION_DEFAULTS.DEFAULT_PAGE_SIZE,
    total: 0,
  } as PaginationState,
  loading: {
    isListLoading: false,
    isActionLoading: false,
    isExporting: false,
  } as HoldingsLoadingState,
  modal: {
    open: false,
    action: null,
    holding: null,
  } as TradeModalState,
}

// ============================================================
// Store
// ============================================================

export const useHoldingsStore = create<HoldingsState>((set) => ({
  ...initialState,

  setData: (list, total) =>
    set((state) => ({
      data: list,
      pagination: { ...state.pagination, total },
    })),

  setFilter: (partial) =>
    set((state) => ({
      filter: { ...state.filter, ...partial },
      pagination: { ...state.pagination, page: PAGINATION_DEFAULTS.DEFAULT_PAGE },
    })),

  setPage: (page) =>
    set((state) => ({
      pagination: { ...state.pagination, page },
    })),

  setPageSize: (pageSize) =>
    set((state) => ({
      pagination: {
        ...state.pagination,
        pageSize,
        page: PAGINATION_DEFAULTS.DEFAULT_PAGE,
      },
    })),

  setLoading: (partial) =>
    set((state) => ({
      loading: { ...state.loading, ...partial },
    })),

  openModal: (holding, action) =>
    set({
      modal: { open: true, holding, action },
    }),

  closeModal: () =>
    set({
      modal: { open: false, holding: null, action: null },
    }),

  resetFilter: () => {
    const resetDates = getDefaultDateRange()
    logger.info('[holdingsStore] Filter reset', { resetDates })
    set((state) => ({
      filter: {
        startDate: resetDates.start,
        endDate: resetDates.end,
        direction: TRADE_DIRECTION.ALL,
        keyword: '',
      },
      pagination: { ...state.pagination, page: PAGINATION_DEFAULTS.DEFAULT_PAGE },
    }))
  },

  fetchData: async (params) => {
    set((s) => ({ loading: { ...s.loading, isListLoading: true } }))
    try {
      await dataBridge.forward({
        meta: {
          traceId: `holdings-fetch-${Date.now()}`,
          source: MODULE_ID.holdingsStore,
          target: ENVELOPE_TARGET.tradinghub,
          action: ENVELOPE_ACTION.loadHoldingsData,
          timestamp: Date.now(),
        },
        payload: params,
      })
      return { code: HTTP_OK, message: 'OK' }
    } catch (error) {
      logger.error('[holdingsStore] fetchData failed', { error: String(error) })
      return { code: HTTP_INTERNAL_ERROR, message: String(error) }
    } finally {
      set((s) => ({ loading: { ...s.loading, isListLoading: false } }))
    }
  },

  executeTrade: async (_opts) => {
    logger.info('[holdingsStore] executeTrade called', { opts: _opts })
    return { success: true, message: 'Trade executed' }
  },

  exportCSV: async (_params) => {
    set((s) => ({ loading: { ...s.loading, isExporting: true } }))
    try {
      logger.info('[holdingsStore] exportCSV started')
    } finally {
      set((s) => ({ loading: { ...s.loading, isExporting: false } }))
    }
  },
}))

// ============================================================
// 工具函数：构建查询参数
// ============================================================

/** 从当前 store 状态构建 HoldingsQueryParams */
export function buildHoldingsParams(): HoldingsQueryParams {
  const state = useHoldingsStore.getState()
  return {
    page: state.pagination.page,
    pageSize: state.pagination.pageSize,
    startDate: state.filter.startDate,
    endDate: state.filter.endDate,
    direction: state.filter.direction,
    keyword: state.filter.keyword,
  }
}

// ============================================================
// DataBridge 订阅生命周期
// ============================================================
// 由组件层 useEffect 调用 init，返回的 cleanup 函数中调用 destroy
// 避免模块级副作用导致的 HMR 重复订阅和内存泄漏

let _unsubscribeTrading: (() => void) | null = null

/** 初始化 DataBridge 交易通道订阅，返回 cleanup 函数 */
export function initHoldingsStoreSubscriptions(): () => void {
  if (_unsubscribeTrading) {
    logger.warn('[holdingsStore] Subscriptions already initialized, skipping')
    return _unsubscribeTrading
  }

  _unsubscribeTrading = dataBridge.subscribe('trading', (envelope) => {
    if (envelope.meta.action === ENVELOPE_ACTION.tradeActionExecuted) {
      logger.info('[holdingsStore] DataBridge event received: tradeActionExecuted', {
        traceId: envelope.meta.traceId,
        source: envelope.meta.source,
      })
    }
    if (envelope.meta.action === ENVELOPE_ACTION.holdingsDataLoaded) {
      logger.info('[holdingsStore] DataBridge event received: holdingsDataLoaded', {
        traceId: envelope.meta.traceId,
      })
    }
  })

  return () => {
    _unsubscribeTrading?.()
    _unsubscribeTrading = null
    logger.info('[holdingsStore] DataBridge subscriptions destroyed')
  }
}