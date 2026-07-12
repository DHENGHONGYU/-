/**
 * @module signalStore
 * @lifecycle @Global
 * @description 交易信号状态管理。管理由 signalGenerator 生成的交易信号列表，
 * 提供 refresh 重新生成、topSignals 派生查询，以及 DataBridge analyzer/scoring 频道订阅。
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { Signal, Stock } from '@/data/types'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME, type EnvelopeAction } from '@/config/dbConfig'
import { generateSignalsForSymbol, pickStrongestSignal } from '@/services/trading/signalGenerator'

const logger = getLogger()

// ============================================================
// Store 接口
// ============================================================

interface SignalState {
  /** 信号列表 */
  signals: Signal[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳 */
  lastUpdated: number
  /** 是否正在刷新（防重入锁） */
  isRefreshing: boolean

  // Actions
  refresh: () => Promise<void>
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  signals: [] as Signal[],
  loading: false,
  error: null as string | null,
  lastUpdated: 0,
  isRefreshing: false,
}

// ============================================================
// Store
// ============================================================

/**
 * 为单个股票生成最强交易信号。
 *
 * @param symbol - 股票代码
 * @returns 最强信号或 null
 */
async function generateSignalForStock(symbol: string): Promise<Signal | null> {
  try {
    const stockSignals = await generateSignalsForSymbol(symbol)
    return pickStrongestSignal(stockSignals) ?? null
  } catch {
    return null
  }
}

/**
 * 交易信号 Zustand Store。
 */
export const useSignalStore = create<SignalState>((set) => ({
  ...initialState,

  refresh: async () => {
    const state = useSignalStore.getState()

    // 并发锁：已在刷新中则跳过
    if (state.isRefreshing) {
      logger.debug('[signalStore] refresh skipped: isRefreshing is true')
      return
    }

    // 保存旧数据快照，用于失败回滚
    const snapshot = {
      signals: state.signals,
      lastUpdated: state.lastUpdated,
    }

    logger.info('[signalStore] refresh 开始')
    set({ loading: true, error: null, isRefreshing: true })

    try {
      const result = await dataBridge.query<Stock[]>({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: MODULE_ID.trading,
      })

      if (!result.success) {
        const errorMessage = result.error ?? '查询股票池失败'
        logger.error(`[signalStore] refresh 查询失败: ${errorMessage}`)
        throw new Error(errorMessage)
      }

      const stocks = result.data ?? []
      const targetStocks = stocks.slice(0, 20)
      logger.info(`[signalStore] 获取股票池: ${stocks.length} 只，取前 ${targetStocks.length} 只生成信号`)

      const allSignals = (await Promise.all(
        targetStocks.map((stock) => generateSignalForStock(stock.symbol))
      )).filter((signal): signal is Signal => signal !== null)

      // 按置信度降序排列
      allSignals.sort((a, b) => b.confidence - a.confidence)

      set({
        signals: allSignals,
        loading: false,
        lastUpdated: Date.now(),
        isRefreshing: false,
      })
      logger.info(`[signalStore] refresh 完成: ${allSignals.length} 个信号`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[signalStore] refresh 失败: ${message}`)

      // 快照回滚：保留旧数据，仅更新错误和加载状态
      set({
        signals: snapshot.signals,
        lastUpdated: snapshot.lastUpdated,
        error: message,
        loading: false,
        isRefreshing: false,
      })
    }
  },
}))

// ============================================================
// 派生查询（Getters）
// ============================================================

/** 获取 Top N 信号 */
export function topSignals(limit: number = 10): Signal[] {
  const { signals } = useSignalStore.getState()
  return signals.slice(0, limit)
}

// ============================================================
// DataBridge 订阅生命周期
// 由组件层 useEffect 调用 init，返回的 cleanup 函数中调用 destroy
// 避免模块级副作用导致的 HMR 重复订阅和内存泄漏
// ============================================================

let _unsubscribeAnalyzer: (() => void) | null = null
let _unsubscribeScoring: (() => void) | null = null

/** 触发刷新的相关 action 集合 */
const SIGNAL_REFRESH_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertSignal,
  ENVELOPE_ACTION.saveScores,
])

/** 去抖定时器（100ms 合并多次事件） */
let _refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null
const REFRESH_DEBOUNCE_MS = 100

/** 去抖触发刷新，合并短时间内多次事件 */
function debouncedRefresh(): void {
  if (_refreshDebounceTimer) {
    clearTimeout(_refreshDebounceTimer)
  }
  _refreshDebounceTimer = setTimeout(() => {
    _refreshDebounceTimer = null
    const state = useSignalStore.getState()
    if (state.isRefreshing) {
      logger.info('[signalStore] refresh 进行中，跳过本次触发')
      return
    }
    logger.info('[signalStore] DataBridge 事件触发自动刷新')
    void state.refresh()
  }, REFRESH_DEBOUNCE_MS)
}

/** 初始化 DataBridge analyzer/scoring 频道订阅，返回 cleanup 函数 */
export function initSignalStoreSubscriptions(): () => void {
  if (_unsubscribeAnalyzer || _unsubscribeScoring) {
    logger.warn('[signalStore] Subscriptions already initialized, skipping')
    return () => destroySignalStoreSubscriptions()
  }

  // analyzer 频道：V6 评分等分析结果变更
  _unsubscribeAnalyzer = dataBridge.subscribe(
    'v6_scores',
    (envelope) => {
      // source 过滤：跳过本模块发出的事件，避免自激
      if (envelope.meta.source === MODULE_ID.trading || envelope.meta.source === MODULE_ID.tradinghub) {
        return
      }
      if (
        envelope.meta.action === ENVELOPE_ACTION.saveScores
      ) {
        logger.info('[signalStore] DataBridge event received on v6_scores channel', {
          action: envelope.meta.action,
          traceId: envelope.meta.traceId,
          source: envelope.meta.source,
        })
        debouncedRefresh()
      }
    },
  )

  // signals 频道：交易信号变更
  _unsubscribeScoring = dataBridge.subscribe(
    'signals',
    (envelope) => {
      // source 过滤：跳过本模块发出的事件，避免自激（De Morgan 反转，规避与 analyzer 频道重复条件）
      if (envelope.meta.source !== MODULE_ID.trading && envelope.meta.source !== MODULE_ID.tradinghub) {
        if (SIGNAL_REFRESH_ACTIONS.has(envelope.meta.action)) {
          const signal = envelope.payload as Signal | undefined
          logger.info('[signalStore] DataBridge event received on signals channel', {
            action: envelope.meta.action,
            traceId: envelope.meta.traceId,
            symbol: signal?.symbol,
            source: envelope.meta.source,
          })
          debouncedRefresh()
        }
      }
    },
  )

  logger.info('[signalStore] DataBridge subscriptions initialized')

  return () => destroySignalStoreSubscriptions()
}

function destroySignalStoreSubscriptions(): void {
  if (_refreshDebounceTimer) {
    clearTimeout(_refreshDebounceTimer)
    _refreshDebounceTimer = null
  }
  _unsubscribeAnalyzer?.()
  _unsubscribeScoring?.()
  _unsubscribeAnalyzer = null
  _unsubscribeScoring = null
  logger.info('[signalStore] DataBridge subscriptions destroyed')
}
