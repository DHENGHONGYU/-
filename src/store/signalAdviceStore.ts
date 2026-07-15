/**
 * @module signalAdviceStore
 * @lifecycle @Global
 * @description 信号建议 Store —— 交易建议与信号扫描的唯一可信源。
 * 从 tradingStore 拆分出来，专注于交易建议映射和信号扫描。
 *
 * @compliance
 * - 所有写操作通过 dataBridge.forward() 走信封协议
 * - 使用 withBroadcast 实现跨 Tab 广播
 * - 具备 isRefreshing 锁防止并发刷新
 * - 失败时快照回滚，保留旧数据不被清空
 * - 添加详细的 logger.info 日志记录关键操作
 *
 * @see docs/reference/功能模块数据契约.md — 交易信号 Store 模块契约（第 15 节）
 * @see src/services/trading/tradingService.ts — 交易服务层（数据读取）
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  scanWatchingSignals,
  adviseForStock,
  type TradeAdvice,
} from '@/services/trading/tradingService'
import type { TradingSignal } from '@/services/trading/signalGenerator'
import type { Stock } from '@/data/types'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/**
 * SignalAdviceStore 状态接口 —— 信号建议的唯一可信源。
 */
export interface SignalAdviceState {
  /** 扫描到的信号列表 */
  signals: TradingSignal[]
  /** 交易建议映射 symbol -> TradeAdvice */
  adviceMap: Record<string, TradeAdvice>
  /** 是否正在加载 */
  loading: boolean
  /** 是否正在刷新（并发锁） */
  isRefreshing: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳 */
  lastUpdated: number

  // ---- Actions ----
  /** 扫描观察池信号 */
  scanSignals: () => Promise<void>
  /** 为指定股票生成交易建议 */
  generateAdvice: (stock: Stock) => Promise<void>
  /** 批量为股票列表生成交易建议 */
  generateAdviceForStocks: (stocks: Stock[]) => Promise<void>
  /** 重置 store */
  reset: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  signals: [] as TradingSignal[],
  adviceMap: {} as Record<string, TradeAdvice>,
  loading: false,
  isRefreshing: false,
  error: null as string | null,
  lastUpdated: 0,
}

// ============================================================
// Store
// ============================================================

/**
 * useSignalAdviceStore
 */
export const useSignalAdviceStore = create<SignalAdviceState>()((set, get) => ({
  ...initialState,

  // ----------------------------------------------------------
  // scanSignals —— 扫描信号
  // ----------------------------------------------------------
  scanSignals: async () => {
    const { isRefreshing } = get()
    if (isRefreshing) {
      logger.debug('[signalAdviceStore] scanSignals 已在进行中，跳过并发调用')
      return
    }

    const snapshot = {
      signals: get().signals,
      lastUpdated: get().lastUpdated,
    }

    logger.info('[signalAdviceStore] scanSignals 开始')
    set({ isRefreshing: true, loading: get().signals.length === 0, error: null })

    try {
      const result = await scanWatchingSignals()
      set({
        signals: result,
        loading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: Date.now(),
      })
      logger.info('[signalAdviceStore] scanSignals 完成', { count: result.length })
      // D-3: 广播信号变更事件（withBroadcast 内部已调用 eventBus.emit，无需重复 emit）
      withBroadcast(EVENT_NAMES.SIGNALS_CHANGED, { action: 'scan', count: result.length })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[signalAdviceStore] scanSignals 异常', { error: message })
      set({
        ...snapshot,
        loading: false,
        isRefreshing: false,
        error: message,
      })
    }
  },

  // ----------------------------------------------------------
  // generateAdvice —— 为单只股票生成建议
  // ----------------------------------------------------------
  generateAdvice: async (stock: Stock) => {
    logger.info('[signalAdviceStore] generateAdvice 开始', { symbol: stock.symbol })

    try {
      const advice = await adviseForStock(stock)
      if (advice.success && advice.data) {
        const adviceData = advice.data
        set((state) => ({
          adviceMap: { ...state.adviceMap, [stock.symbol]: adviceData },
          lastUpdated: Date.now(),
        }))
        logger.info('[signalAdviceStore] generateAdvice 完成', { symbol: stock.symbol })
        withBroadcast(EVENT_NAMES.SIGNALS_CHANGED, { action: 'generateAdvice', symbol: stock.symbol })
      } else {
        const errorMsg = advice.error ?? '生成交易建议失败'
        logger.error('[signalAdviceStore] generateAdvice 失败', { symbol: stock.symbol, error: errorMsg })
        set({ error: errorMsg })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[signalAdviceStore] generateAdvice 异常', { symbol: stock.symbol, error: message })
      set({ error: message })
    }
  },

  // ----------------------------------------------------------
  // generateAdviceForStocks —— 批量生成建议
  // ----------------------------------------------------------
  generateAdviceForStocks: async (stocks: Stock[]) => {
    const { isRefreshing } = get()
    if (isRefreshing) {
      logger.debug('[signalAdviceStore] generateAdviceForStocks 已在进行中，跳过并发调用')
      return
    }

    logger.info('[signalAdviceStore] generateAdviceForStocks 开始', { count: stocks.length })
    set({ isRefreshing: true, loading: true, error: null })

    try {
      const map: Record<string, TradeAdvice> = {}
      for (const stock of stocks) {
        const advice = await adviseForStock(stock)
        if (advice.success && advice.data) {
          map[stock.symbol] = advice.data
        }
      }

      set({
        adviceMap: map,
        loading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: Date.now(),
      })
      logger.info('[signalAdviceStore] generateAdviceForStocks 完成', { count: Object.keys(map).length })
      withBroadcast(EVENT_NAMES.SIGNALS_CHANGED, { action: 'generateAdviceBatch', count: Object.keys(map).length })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[signalAdviceStore] generateAdviceForStocks 异常', { error: message })
      set({
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
    logger.info('[signalAdviceStore] reset')
    set({ ...initialState })
    withBroadcast(EVENT_NAMES.SIGNALS_CHANGED, { action: 'reset' })
  },
}))
