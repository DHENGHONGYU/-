/**
 * @module watchlistStore
 * @lifecycle @Global
 * @description 自选股管理 Store —— 观察池股票列表的唯一可信源。
 * 从 tradingStore 拆分出来，专注于自选股的加载、管理和状态维护。
 *
 * @compliance
 * - 所有写操作通过 dataBridge.forward() 走信封协议
 * - 使用 withBroadcast 实现跨 Tab 广播
 * - 具备 isRefreshing 锁防止并发刷新
 * - 失败时快照回滚，保留旧数据不被清空
 * - 添加详细的 logger.info 日志记录关键操作
 *
 * @see docs/《功能模块数据契约》.md — 交易信号 Store 模块契约（第 15 节）
 * @see src/services/trading/tradingService.ts — 交易服务层（数据读取）
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { getWatchlistStocks } from '@/services/trading/tradingService'
import type { Stock } from '@/data/types'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/**
 * WatchlistStore 状态接口 —— 自选股管理的唯一可信源。
 */
export interface WatchlistState {
  /** 观察池股票列表 */
  stocks: Stock[]
  /** 是否正在加载 */
  loading: boolean
  /** 是否正在刷新（并发锁） */
  isRefreshing: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳 */
  lastUpdated: number

  // ---- Actions ----
  /** 加载观察池股票 */
  loadStocks: () => Promise<void>
  /** 重置 store */
  reset: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  stocks: [] as Stock[],
  loading: false,
  isRefreshing: false,
  error: null as string | null,
  lastUpdated: 0,
}

// ============================================================
// Store
// ============================================================

export const useWatchlistStore = create<WatchlistState>()((set, get) => ({
  ...initialState,

  // ----------------------------------------------------------
  // loadStocks —— 加载观察池
  // ----------------------------------------------------------
  loadStocks: async () => {
    const { isRefreshing } = get()
    if (isRefreshing) {
      logger.debug('[watchlistStore] loadStocks 已在进行中，跳过并发调用')
      return
    }

    const snapshot = {
      stocks: get().stocks,
      lastUpdated: get().lastUpdated,
    }

    logger.info('[watchlistStore] loadStocks 开始')
    set({ isRefreshing: true, loading: get().stocks.length === 0, error: null })

    try {
      const result = await getWatchlistStocks()
      if (result.success && result.data) {
        set({
          stocks: result.data,
          loading: false,
          isRefreshing: false,
          error: null,
          lastUpdated: Date.now(),
        })
        logger.info('[watchlistStore] loadStocks 完成', { count: result.data.length })
        withBroadcast(EVENT_NAMES.STOCKS_CHANGED, { action: 'loadWatchlist', count: result.data.length })
      } else {
        const errorMsg = result.error ?? '加载观察池失败'
        logger.error('[watchlistStore] loadStocks 失败', { error: errorMsg })
        set({
          ...snapshot,
          loading: false,
          isRefreshing: false,
          error: errorMsg,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[watchlistStore] loadStocks 异常', { error: message })
      set({
        ...snapshot,
        loading: false,
        isRefreshing: false,
        error: message,
      })
    }
  },

  // ----------------------------------------------------------
  // reset —— 重置
  // ----------------------------------------------------------
  reset: () => {
    logger.info('[watchlistStore] reset')
    set({ ...initialState })
    withBroadcast(EVENT_NAMES.STOCKS_CHANGED, { action: 'reset' })
  },
}))
