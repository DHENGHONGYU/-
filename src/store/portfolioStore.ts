/**
 * @module portfolioStore
 * @lifecycle @Global
 * @description 投资组合 Store —— 核心组合与策略结果的唯一可信源。
 * 从 tradingStore 拆分出来，专注于投资组合的构建和管理。
 *
 * @compliance
 * - 所有写操作通过 dataBridge.forward() 走信封协议
 * - 使用 withBroadcast 实现跨 Tab 广播
 * - 具备 isRefreshing 锁防止并发刷新
 * - 失败时快照回滚，保留旧数据不被清空
 * - 添加详细的 logger.info 日志记录关键操作
 *
 * 原文档（功能模块数据契约）已归档至 archive/historical-2026-08-16/batch7/
 * @see src/services/trading/portfolioBuilder.ts — 组合构建器
  * @doc [V9-DOC-PROJ-118, V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  buildStrategyFilteredPortfolio,
  computeHoldingsFromOrders,
} from '@/services/trading/portfolioBuilder'
import type { Portfolio, Stock, StrategyResult, Order } from '@/data/types'
import { CORE_RESOURCE_THEME } from '@/config/themeRegistry'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/**
 * PortfolioStore 状态接口 —— 投资组合的唯一可信源。
 */
export interface PortfolioState {
  /** 核心组合结果 */
  portfolio: Portfolio | undefined
  /** 策略筛选结果 */
  strategyResult: StrategyResult | undefined
  /** 组合构建加载中 */
  loading: boolean
  /** 是否正在刷新（并发锁） */
  isRefreshing: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳 */
  lastUpdated: number

  // ---- Actions ----
  /** 构建核心组合 */
  buildPortfolio: (stocks: Stock[], orders: Order[]) => Promise<void>
  /** 重置 store */
  reset: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  portfolio: undefined as Portfolio | undefined,
  strategyResult: undefined as StrategyResult | undefined,
  loading: false,
  isRefreshing: false,
  error: null as string | null,
  lastUpdated: 0,
}

// ============================================================
// Store
// ============================================================

/**
 * usePortfolioStore
 */
export const usePortfolioStore = create<PortfolioState>()((set, get) => ({
  ...initialState,

  // ----------------------------------------------------------
  // buildPortfolio —— 构建核心组合
  // ----------------------------------------------------------
  buildPortfolio: async (stocks: Stock[], orders: Order[]) => {
    const { isRefreshing } = get()
    if (isRefreshing) {
      logger.debug('[portfolioStore] buildPortfolio 已在进行中，跳过并发调用')
      return
    }

    // 快照回滚目标
    const snapshot = {
      portfolio: get().portfolio,
      strategyResult: get().strategyResult,
      lastUpdated: get().lastUpdated,
    }

    logger.info('[portfolioStore] buildPortfolio 开始', {
      stocksCount: stocks.length,
      ordersCount: orders.length,
    })
    set({ isRefreshing: true, loading: true, error: null })

    try {
      const result = await buildStrategyFilteredPortfolio({
        theme: CORE_RESOURCE_THEME,
        stocks,
        currentHoldings: computeHoldingsFromOrders(orders),
      })

      set({
        portfolio: result.portfolio,
        strategyResult: result.strategyResult,
        loading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: Date.now(),
      })

      logger.info('[portfolioStore] buildPortfolio 完成', {
        holdingsCount: result.portfolio.holdings.length,
      })
      withBroadcast(EVENT_NAMES.HOLDINGS_CHANGED, { action: 'buildPortfolio', holdingsCount: result.portfolio.holdings.length })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[portfolioStore] buildPortfolio 失败', { error: message })
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
    logger.info('[portfolioStore] reset')
    set({ ...initialState })
    withBroadcast(EVENT_NAMES.HOLDINGS_CHANGED, { action: 'reset' })
  },
}))
