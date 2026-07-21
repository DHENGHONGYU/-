/**
 * @module tradingStore
 * @lifecycle @Global
 * @deprecated 批次B拆分后，此 Store 作为向后兼容的 Facade。
 * 新代码应直接使用拆分后的独立 Store：
 * - useWatchlistStore: 自选股管理
 * - useSignalAdviceStore: 信号建议
 * - usePortfolioStore: 投资组合
 * - useOrderStore: 订单管理（可信源）
 *
 * @description 交易信号页面状态管理 —— 向后兼容 Facade。
 * 通过订阅拆分后的子 Store 保持状态同步，确保消费方（TradingApp）的响应式更新。
 *
 * 保留的本地状态：
 * - processingSymbols: 正在执行交易的 symbol 集合
 * - message: 页面消息
 *
 * @see src/store/watchlistStore.ts — 自选股管理
 * @see src/store/signalAdviceStore.ts — 信号建议
 * @see src/store/portfolioStore.ts — 投资组合
 * @see src/store/orderStore.ts — 订单管理
  * @doc [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-DATA-031]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  createBuyOrder,
  createSellOrder,
  type TradeAdvice,
} from '@/services/trading/tradingService'
import { loadPortfolioInput } from '@/services/trading/portfolioService'
import type { TradingSignal } from '@/services/trading/signalGenerator'
import type { Order, Portfolio, Stock, StrategyResult } from '@/data/types'
import { withBroadcast } from '@/lib/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { useWatchlistStore } from './watchlistStore'
import { useSignalAdviceStore } from './signalAdviceStore'
import { usePortfolioStore } from './portfolioStore'
import { useOrderStore } from './orderStore'

const logger = getLogger()

// ============================================================
// 类型定义（向后兼容导出）
// ============================================================

/**
 * TradingStore 状态接口 —— 向后兼容的 Facade。
 * @deprecated 新代码应直接使用拆分后的独立 Store
 */
export interface TradingState {
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
  /** 组合构建加载中 */
  portfolioLoading: boolean
  /** 正在执行交易的 symbol 集合 */
  processingSymbols: Set<string>
  /** 页面消息 */
  message: string
  /** 是否正在刷新（并发锁） */
  isRefreshing: boolean

  loadStocks: () => Promise<void>
  loadOrders: () => Promise<void>
  scanSignals: () => Promise<void>
  loadPortfolio: () => Promise<void>
  handleBuy: (stock: Stock) => Promise<void>
  handleSell: (stock: Stock) => Promise<void>
  getHoldingShares: (symbol: string) => number
  setMessage: (msg: string) => void
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

/**
 * useTradingStore
 */
export const useTradingStore = create<TradingState>()((set, get) => ({
  ...initialState,

  // ----------------------------------------------------------
  // loadStocks —— 加载观察池并生成建议（委托）
  // ----------------------------------------------------------
  loadStocks: async () => {
    if (get().isRefreshing) return
    set({ isRefreshing: true })
    logger.info('[tradingStore] loadStocks 开始（委托给 watchlistStore + signalAdviceStore）')
    try {
      await useWatchlistStore.getState().loadStocks()
      const stocks = useWatchlistStore.getState().stocks

      if (stocks.length > 0) {
        await useSignalAdviceStore.getState().generateAdviceForStocks(stocks)
        // 同步子 Store 状态到 Facade
        set({
          stocks,
          adviceMap: useSignalAdviceStore.getState().adviceMap,
          message: '观察池与交易建议已更新',
        })
      } else {
        set({ stocks: [], message: '观察池为空' })
      }
    } finally {
      set({ isRefreshing: false })
    }
  },

  // ----------------------------------------------------------
  // loadOrders —— 加载订单（委托）
  // ----------------------------------------------------------
  loadOrders: async () => {
    if (get().isRefreshing) return
    set({ isRefreshing: true })
    try {
      logger.info('[tradingStore] loadOrders 开始（委托给 orderStore）')
      await useOrderStore.getState().refresh()
      const orders = useOrderStore.getState().orders
      set({ orders })
      if (orders.length === 0) {
        set({ message: '订单列表为空' })
      }
    } finally {
      set({ isRefreshing: false })
    }
  },

  // ----------------------------------------------------------
  // scanSignals —— 扫描信号（委托）
  // ----------------------------------------------------------
  scanSignals: async () => {
    if (get().isRefreshing) return
    set({ isRefreshing: true })
    try {
      logger.info('[tradingStore] scanSignals 开始（委托给 signalAdviceStore）')
      await useSignalAdviceStore.getState().scanSignals()
      const signals = useSignalAdviceStore.getState().signals
      set({ signals, message: `扫描完成，共 ${signals.length} 条信号` })
    } finally {
      set({ isRefreshing: false })
    }
  },

  // ----------------------------------------------------------
  // loadPortfolio —— 构建核心组合（从真实数据源构建）
  // ----------------------------------------------------------
  loadPortfolio: async () => {
    if (get().isRefreshing) return
    set({ isRefreshing: true })
    logger.info('[tradingStore] loadPortfolio 开始（从真实数据源构建组合）')

    set({ portfolioLoading: true })

    try {
      const { stocks, orders } = await loadPortfolioInput()
      await usePortfolioStore.getState().buildPortfolio(stocks, orders)

      const portfolio = usePortfolioStore.getState().portfolio
      const strategyResult = usePortfolioStore.getState().strategyResult
      set({
        portfolioLoading: false,
        portfolio,
        strategyResult,
        message:
          portfolio && portfolio.holdings.length > 0
            ? `核心稀缺组合已构建，共 ${portfolio.holdings.length} 只标的`
            : '核心稀缺组合为空，无匹配标的或评分不足',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[tradingStore] loadPortfolio 失败', { error: message })
      usePortfolioStore.setState({ error: message, loading: false })
      set({ portfolioLoading: false, message: `组合加载失败：${message}` })
    } finally {
      set({ isRefreshing: false })
    }
  },

  // ----------------------------------------------------------
  // handleBuy —— 买入
  // ----------------------------------------------------------
  handleBuy: async (stock: Stock) => {
    const { processingSymbols } = get()
    if (processingSymbols.has(stock.symbol)) return

    set({ processingSymbols: new Set(processingSymbols).add(stock.symbol) })

    try {
      const adviceMap = useSignalAdviceStore.getState().adviceMap
      const advice = adviceMap[stock.symbol]
      const quantity = advice?.sizing?.action === 'buy' ? (advice.sizing.targetShares ?? 100) : 100
      const result = await createBuyOrder(stock, quantity)

      if (result.success) {
        set({ message: `已买入 ${stock.symbol} ${quantity} 股` })
        await get().loadOrders()
        withBroadcast(EVENT_NAMES.ORDERS_CHANGED, { action: 'buy', symbol: stock.symbol, quantity })
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
    const { processingSymbols } = get()
    if (processingSymbols.has(stock.symbol)) return

    set({ processingSymbols: new Set(processingSymbols).add(stock.symbol) })

    try {
      const adviceMap = useSignalAdviceStore.getState().adviceMap
      const advice = adviceMap[stock.symbol]
      const quantity =
        advice?.sizing?.action === 'sell'
          ? (advice.sizing.targetShares ?? 100)
          : get().getHoldingShares(stock.symbol) || 100
      const result = await createSellOrder(stock, quantity)

      if (result.success) {
        set({ message: `已卖出 ${stock.symbol} ${quantity} 股` })
        await get().loadOrders()
        withBroadcast(EVENT_NAMES.ORDERS_CHANGED, { action: 'sell', symbol: stock.symbol, quantity })
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
    const orders = useOrderStore.getState().orders
    return orders
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
    useWatchlistStore.getState().reset()
    useSignalAdviceStore.getState().reset()
    usePortfolioStore.getState().reset()
    useOrderStore.getState().reset()
    set({ ...initialState, processingSymbols: new Set<string>() })
  },
}))

// ============================================================
// 子 Store 订阅同步 —— Facade 响应式更新
// ============================================================

let _unsubscribeFacade: (() => void) | null = null

/**
 * 初始化 Facade 的子 Store 订阅同步。
 * 当子 Store 状态变更时，自动同步到 Facade 状态，确保消费方响应式更新。
 *
 * @returns 清理函数
 */
export function initTradingStoreFacadeSync(): () => void {
  if (_unsubscribeFacade) {
    logger.warn('[tradingStore] Facade sync already initialized')
    return _unsubscribeFacade
  }

  const cleanupFns: Array<() => void> = []

  // 订阅 watchlistStore（仅 stocks 引用变化时同步，避免无关字段变化触发连锁重渲染）
  let prevWatchlistStocks = useWatchlistStore.getState().stocks
  const unsubWatchlist = useWatchlistStore.subscribe((state) => {
    if (state.stocks !== prevWatchlistStocks) {
      prevWatchlistStocks = state.stocks
      useTradingStore.setState({ stocks: state.stocks })
    }
  })
  cleanupFns.push(unsubWatchlist)

  // 订阅 signalAdviceStore（仅 signals/adviceMap 引用变化时同步）
  let prevSignals = useSignalAdviceStore.getState().signals
  let prevAdviceMap = useSignalAdviceStore.getState().adviceMap
  const unsubSignal = useSignalAdviceStore.subscribe((state) => {
    if (state.signals !== prevSignals || state.adviceMap !== prevAdviceMap) {
      prevSignals = state.signals
      prevAdviceMap = state.adviceMap
      useTradingStore.setState({
        signals: state.signals,
        adviceMap: state.adviceMap,
      })
    }
  })
  cleanupFns.push(unsubSignal)

  // 订阅 portfolioStore（仅 portfolio/strategyResult/loading 引用变化时同步）
  let prevPortfolio = usePortfolioStore.getState().portfolio
  let prevStrategyResult = usePortfolioStore.getState().strategyResult
  let prevPortfolioLoading = usePortfolioStore.getState().loading
  const unsubPortfolio = usePortfolioStore.subscribe((state) => {
    if (state.portfolio !== prevPortfolio || state.strategyResult !== prevStrategyResult || state.loading !== prevPortfolioLoading) {
      prevPortfolio = state.portfolio
      prevStrategyResult = state.strategyResult
      prevPortfolioLoading = state.loading
      useTradingStore.setState({
        portfolio: state.portfolio,
        strategyResult: state.strategyResult,
        portfolioLoading: state.loading,
      })
    }
  })
  cleanupFns.push(unsubPortfolio)

  // 订阅 orderStore（仅 orders 引用变化时同步）
  let prevOrders = useOrderStore.getState().orders
  const unsubOrder = useOrderStore.subscribe((state) => {
    if (state.orders !== prevOrders) {
      prevOrders = state.orders
      useTradingStore.setState({ orders: state.orders })
    }
  })
  cleanupFns.push(unsubOrder)

  _unsubscribeFacade = () => {
    cleanupFns.forEach((fn) => fn())
    _unsubscribeFacade = null
    logger.info('[tradingStore] Facade sync destroyed')
  }

  // 初始同步一次
  const wlState = useWatchlistStore.getState()
  const sigState = useSignalAdviceStore.getState()
  const pfState = usePortfolioStore.getState()
  const ordState = useOrderStore.getState()
  useTradingStore.setState({
    stocks: wlState.stocks,
    signals: sigState.signals,
    adviceMap: sigState.adviceMap,
    portfolio: pfState.portfolio,
    strategyResult: pfState.strategyResult,
    portfolioLoading: pfState.loading,
    orders: ordState.orders,
  })

  logger.info('[tradingStore] Facade sync initialized')
  return _unsubscribeFacade
}
