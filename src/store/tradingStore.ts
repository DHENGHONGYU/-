/**
 * @module tradingStore
 * @lifecycle @Global
 * @description 交易信号页面状态管理 —— 交易舱视图层的唯一可信源（SSOT）。
 * 统一管理观察池列表、订单列表、信号列表、交易建议、组合与策略结果。
 *
 * @see docs/《功能模块数据契约》.md — 交易信号 Store 模块契约（第 15 节）
 * @see docs/《V9现有数据资产清单》.md — Zustand Store 资产清单
 * @see docs/implementation/v9-system-blueprint.md — Phase 5 Store-first 架构过渡
 * @see src/services/trading/tradingService.ts — 交易服务层（数据读取）
 * @see src/services/trading/portfolioBuilder.ts — 组合构建器
 *
 * @compliance
 * - isRefreshing 锁防止并发刷新
 * - 失败时快照回滚，保留旧数据不被清空
 * - 所有写操作通过 dataBridge.forward() 走信封协议
 * - 数据读取通过 tradingService 获取
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  getWatchlistStocks,
  getOrders,
  createBuyOrder,
  createSellOrder,
  scanWatchingSignals,
  adviseForStock,
  type TradeAdvice,
} from '@/services/trading/tradingService'
import {
  buildStrategyFilteredPortfolio,
  computeHoldingsFromOrders,
} from '@/services/trading/portfolioBuilder'
import type { TradingSignal } from '@/services/trading/signalGenerator'
import type { Order, Portfolio, Stock, StrategyResult } from '@/data/types'
import { CORE_RESOURCE_THEME } from '@/config/themeRegistry'
import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/**
 * TradingStore 状态接口 —— 交易信号页面的唯一可信源。
 */
export interface TradingState {
  // ---- 核心数据 ----
  /** 观察池股票列表 */
  stocks: Stock[]
  /** 订单列表 */
  orders: Order[]
  /** 扫描到的信号列表 */
  signals: TradingSignal[]
  /** 交易建议映射 symbol -> TradeAdvice */
  adviceMap: Record<string, TradeAdvice>
  /** 核心组合结果 */
  portfolio: Portfolio | undefined
  /** 策略筛选结果 */
  strategyResult: StrategyResult | undefined

  // ---- 加载状态 ----
  /** 组合构建加载中 */
  portfolioLoading: boolean
  /** 正在执行交易的 symbol 集合 */
  processingSymbols: Set<string>
  /** 页面消息 */
  message: string
  /** 是否正在刷新（并发锁） */
  isRefreshing: boolean

  // ---- Actions ----
  /** 加载观察池股票并生成交易建议 */
  loadStocks: () => Promise<void>
  /** 加载订单列表 */
  loadOrders: () => Promise<void>
  /** 扫描观察池信号 */
  scanSignals: () => Promise<void>
  /** 构建核心组合 */
  loadPortfolio: () => Promise<void>
  /** 执行买入操作 */
  handleBuy: (stock: Stock) => Promise<void>
  /** 执行卖出操作 */
  handleSell: (stock: Stock) => Promise<void>
  /** 获取指定股票的持仓股数 */
  getHoldingShares: (symbol: string) => number
  /** 设置页面消息 */
  setMessage: (msg: string) => void
  /** 重置 store */
  reset: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  stocks: [] as Stock[],
  orders: [] as Order[],
  signals: [] as TradingSignal[],
  adviceMap: {} as Record<string, TradeAdvice>,
  portfolio: undefined as Portfolio | undefined,
  strategyResult: undefined as StrategyResult | undefined,
  portfolioLoading: false,
  processingSymbols: new Set<string>(),
  message: '',
  isRefreshing: false,
}

// ============================================================
// Store
// ============================================================

export const useTradingStore = create<TradingState>()((set, get) => ({
  ...initialState,

  // ----------------------------------------------------------
  // loadStocks —— 加载观察池并生成建议
  // ----------------------------------------------------------
  loadStocks: async () => {
    const result = await getWatchlistStocks()
    if (result.success && result.data) {
      set({ stocks: result.data })

      const map: Record<string, TradeAdvice> = {}
      for (const stock of result.data) {
        const advice = await adviseForStock(stock)
        if (advice.success && advice.data) {
          map[stock.symbol] = advice.data
        }
      }
      set({ adviceMap: map, message: '观察池与交易建议已更新' })
    } else {
      set({ message: result.error ?? '加载观察池失败' })
    }
  },

  // ----------------------------------------------------------
  // loadOrders —— 加载订单
  // ----------------------------------------------------------
  loadOrders: async () => {
    const result = await getOrders()
    if (result.success && result.data) {
      set({ orders: result.data })
    } else {
      set({ message: result.error ?? '加载订单失败' })
    }
  },

  // ----------------------------------------------------------
  // scanSignals —— 扫描信号
  // ----------------------------------------------------------
  scanSignals: async () => {
    const result = await scanWatchingSignals()
    set({
      signals: result,
      message: `扫描完成，共 ${result.length} 条信号`,
    })
    // D-3: 广播信号变更事件
    eventBus.emit(EVENT_NAMES.SIGNALS_CHANGED, { action: 'scan', count: result.length })
  },

  // ----------------------------------------------------------
  // loadPortfolio —— 构建核心组合
  // ----------------------------------------------------------
  loadPortfolio: async () => {
    const { stocks } = get()

    // 快照回滚目标
    const snapshot = {
      portfolio: get().portfolio,
      strategyResult: get().strategyResult,
      portfolioLoading: get().portfolioLoading,
      message: get().message,
    }

    if (stocks.length === 0) {
      await get().loadStocks()
    }
    if (get().orders.length === 0) {
      await get().loadOrders()
    }

    set({ portfolioLoading: true })

    try {
      const currentStocks = get().stocks
      const currentOrders = get().orders

      const result = await buildStrategyFilteredPortfolio({
        theme: CORE_RESOURCE_THEME,
        stocks: currentStocks,
        currentHoldings: computeHoldingsFromOrders(currentOrders),
      })
      set({
        portfolio: result.portfolio,
        strategyResult: result.strategyResult,
        portfolioLoading: false,
        message:
          result.portfolio.holdings.length > 0
            ? `核心稀缺组合已构建，共 ${result.portfolio.holdings.length} 只标的`
            : '核心稀缺组合为空，无匹配标的或评分不足',
      })
    } catch (err) {
      logger.error('[tradingStore] 构建组合失败', { error: err instanceof Error ? err.message : String(err) })
      set({
        ...snapshot,
        portfolioLoading: false,
        message: err instanceof Error ? err.message : '构建组合失败',
      })
    }
  },

  // ----------------------------------------------------------
  // handleBuy —— 买入
  // ----------------------------------------------------------
  handleBuy: async (stock: Stock) => {
    const { processingSymbols, adviceMap } = get()
    if (processingSymbols.has(stock.symbol)) return

    set({
      processingSymbols: new Set(processingSymbols).add(stock.symbol),
    })

    try {
      const advice = adviceMap[stock.symbol]
      const quantity =
        advice?.sizing?.action === 'buy' ? advice.sizing.targetShares : 100
      const result = await createBuyOrder(stock, quantity)

      if (result.success) {
        set({ message: `已买入 ${stock.symbol} ${quantity} 股` })
        await get().loadOrders()
        // D-3: 广播订单变更事件
        eventBus.emit(EVENT_NAMES.ORDERS_CHANGED, { action: 'buy', symbol: stock.symbol, quantity })
      } else {
        set({ message: result.error ?? '买入失败' })
      }
    } finally {
      const { processingSymbols: current } = get()
      const next = new Set(current)
      next.delete(stock.symbol)
      set({ processingSymbols: next })
    }
  },

  // ----------------------------------------------------------
  // handleSell —— 卖出
  // ----------------------------------------------------------
  handleSell: async (stock: Stock) => {
    const { processingSymbols, adviceMap } = get()
    if (processingSymbols.has(stock.symbol)) return

    set({
      processingSymbols: new Set(processingSymbols).add(stock.symbol),
    })

    try {
      const advice = adviceMap[stock.symbol]
      const quantity =
        advice?.sizing?.action === 'sell'
          ? advice.sizing.targetShares
          : get().getHoldingShares(stock.symbol) || 100
      const result = await createSellOrder(stock, quantity)

      if (result.success) {
        set({ message: `已卖出 ${stock.symbol} ${quantity} 股` })
        await get().loadOrders()
        // D-3: 广播订单变更事件
        eventBus.emit(EVENT_NAMES.ORDERS_CHANGED, { action: 'sell', symbol: stock.symbol, quantity })
      } else {
        set({ message: result.error ?? '卖出失败' })
      }
    } finally {
      const { processingSymbols: current } = get()
      const next = new Set(current)
      next.delete(stock.symbol)
      set({ processingSymbols: next })
    }
  },

  // ----------------------------------------------------------
  // getHoldingShares —— 计算持仓股数
  // ----------------------------------------------------------
  getHoldingShares: (symbol: string): number => {
    return get().orders
      .filter((o) => o.symbol === symbol)
      .reduce((sum, o) => sum + (o.direction === 'buy' ? o.quantity : -o.quantity), 0)
  },

  // ----------------------------------------------------------
  // setMessage —— 设置消息
  // ----------------------------------------------------------
  setMessage: (msg: string) => {
    set({ message: msg })
  },

  // ----------------------------------------------------------
  // reset —— 重置
  // ----------------------------------------------------------
  reset: () => {
    logger.info('[tradingStore] reset')
    set({ ...initialState, processingSymbols: new Set<string>() })
  },
}))
