/**
 * @module signalStore
 * @lifecycle @Global
 * @description 交易信号状态管理。管理由 signalGenerator 生成的交易信号列表，
 * 提供 refresh 重新生成、topSignals 派生查询，以及 DataBridge analyzer/scoring 频道订阅。
  * @doc [V9-DOC-ARCH-007, V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-BACK-015, V9-DOC-DATA-076]
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
  /** 数据是否就绪（股票池和评分数据都已加载） */
  dataReady: boolean

  // Actions
  refresh: () => Promise<void>
  /** 检查并更新数据就绪状态 */
  checkDataReady: () => Promise<void>
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
  dataReady: false,
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
  } catch (err) { console.warn('[signalStore.ts]', err);
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
      const stocksResult = await dataBridge.query<Stock[]>({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: MODULE_ID.trading,
      })

      if (!stocksResult.success) {
        const errorMessage = stocksResult.error ?? '查询股票池失败'
        logger.error(`[signalStore] refresh 查询失败: ${errorMessage}`)
        throw new Error(errorMessage)
      }

      const stocks = stocksResult.data ?? []
      if (stocks.length === 0) {
        logger.warn('[signalStore] refresh: 股票池为空，无法生成信号')
        set({ dataReady: false, loading: false, isRefreshing: false })
        return
      }

      const targetStocks = stocks.slice(0, 20)
      logger.info(`[signalStore] 获取股票池: ${stocks.length} 只，取前 ${targetStocks.length} 只生成信号`)

      const allSignals = (await Promise.all(
        targetStocks.map((stock) => generateSignalForStock(stock.symbol))
      )).filter((signal): signal is Signal => signal !== null)

      allSignals.sort((a, b) => b.confidence - a.confidence)

      set({
        signals: allSignals,
        loading: false,
        lastUpdated: Date.now(),
        isRefreshing: false,
        dataReady: true,
      })
      logger.info(`[signalStore] refresh 完成: ${allSignals.length} 个信号`)

      // 检查是否有排队的刷新请求（refresh 进行中到达的事件）
      if (_pendingRefresh) {
        _pendingRefresh = false
        logger.info('[signalStore] 排队刷新触发')
        debouncedRefresh()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[signalStore] refresh 失败: ${message}`)

      set({
        signals: snapshot.signals,
        lastUpdated: snapshot.lastUpdated,
        error: message,
        loading: false,
        isRefreshing: false,
        dataReady: false,
      })

      // 失败时也清除排队标记，避免死循环
      if (_pendingRefresh) {
        _pendingRefresh = false
        logger.info('[signalStore] refresh 失败，清除排队标记')
      }
    }
  },

  checkDataReady: async () => {
    logger.debug('[signalStore] checkDataReady 开始')

    try {
      const [stocksResult, scoresResult] = await Promise.all([
        dataBridge.query<Stock[]>({
          action: ENVELOPE_ACTION.queryList,
          store: STORE_NAME.stocks,
          source: MODULE_ID.trading,
        }),
        dataBridge.query<unknown[]>({
          action: ENVELOPE_ACTION.queryList,
          store: STORE_NAME.v6Scores,
          source: MODULE_ID.trading,
        }),
      ])

      const stocksReady = stocksResult.success && stocksResult.data && stocksResult.data.length > 0
      const scoresReady = scoresResult.success && scoresResult.data && scoresResult.data.length > 0

      const isReady = stocksReady && scoresReady

      if (isReady) {
        logger.info('[signalStore] checkDataReady: 数据就绪（股票池+评分数据都已加载）')
      } else {
        logger.debug('[signalStore] checkDataReady: 数据未就绪', {
          stocksReady,
          scoresReady,
          stocksCount: stocksResult.data?.length ?? 0,
          scoresCount: scoresResult.data?.length ?? 0,
        })
      }

      set({ dataReady: isReady })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[signalStore] checkDataReady 失败: ${message}`)
      set({ dataReady: false })
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
let _subscriptionsInitialized = false

/** 触发刷新的相关 action 集合 */
const SIGNAL_REFRESH_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertSignal,
  ENVELOPE_ACTION.saveScores,
])

/** 去抖定时器（300ms 合并多次事件，增强稳定性） */
let _refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null
const REFRESH_DEBOUNCE_MS = 300

/** 最小刷新间隔（2秒，防止过度刷新导致信号不稳定） */
const MIN_REFRESH_INTERVAL_MS = 2000
let _lastRefreshTime = 0

/** 首次数据事件标记（Widget 挂载后首次收到 DataBridge 事件时跳过最小间隔检查） */
let _isFirstDataEvent = true

/** 待刷新标记（refresh 进行中时有新事件到达则设 true，refresh 完成后自动重刷） */
let _pendingRefresh = false

/** 去抖触发刷新，合并短时间内多次事件 */
function debouncedRefresh(): void {
  if (_refreshDebounceTimer) {
    clearTimeout(_refreshDebounceTimer)
  }
  _refreshDebounceTimer = setTimeout(() => {
    _refreshDebounceTimer = null
    const state = useSignalStore.getState()
    // Task #9: isRefreshing 时不丢弃，设 pending 标志排队
    if (state.isRefreshing) {
      logger.info('[signalStore] refresh 进行中，标记 _pendingRefresh 排队等待')
      _pendingRefresh = true
      return
    }
    const now = Date.now()
    // 首次数据事件跳过最小间隔检查（确保 Widget 初始加载数据能 0 延迟渲染）
    if (_isFirstDataEvent && _lastRefreshTime === 0) {
      logger.info('[signalStore] 首次数据事件，跳过最小刷新间隔检查')
    } else if (now - _lastRefreshTime < MIN_REFRESH_INTERVAL_MS) {
      logger.info(`[signalStore] 刷新间隔过短（${now - _lastRefreshTime}ms），延迟到最小间隔后执行`)
      _refreshDebounceTimer = setTimeout(() => {
        _refreshDebounceTimer = null
        const s = useSignalStore.getState()
        if (!s.isRefreshing) {
          logger.info('[signalStore] 延迟刷新触发')
          _lastRefreshTime = Date.now()
          void s.refresh()
        }
      }, MIN_REFRESH_INTERVAL_MS - (now - _lastRefreshTime))
      return
    }
    _lastRefreshTime = now
    _isFirstDataEvent = false
    logger.info('[signalStore] DataBridge 事件触发自动刷新')
    void state.refresh()
  }, REFRESH_DEBOUNCE_MS)
}

/**
 * 初始化 DataBridge analyzer/scoring 频道订阅，返回 cleanup 函数。
 *
 * 设计说明（幂等调用 + 全局/组件双轨）：
 * - 全局初始化由 App.tsx 调用 initSignalStoreGlobalSubscriptions()，负责 DataBridge
 *   事件监听和解抖刷新调度
 * - Widget 的 useEffect 调用本函数做幂等检查：若全局已初始化则复用全局订阅，
 *   Widget 通过 Zustand selector 订阅 signals/etc 字段被动接收更新
 * - 幂等设计：重复调用不会重复注册订阅，返回的 cleanup 在全局场景为 no-op
 *   （全局订阅不由组件生命周期管理），在组件场景会正确销毁
 */
export function initSignalStoreSubscriptions(): () => void {
  // 全局已初始化 → 复用全局订阅，返回 no-op cleanup（不销毁全局订阅）
  if (_subscriptionsInitialized) {
    logger.debug('[signalStore] 全局订阅已就绪，组件复用全局 DataBridge 通道')
    return () => {
      // 全局订阅不随组件卸载
    }
  }

  // 订阅已存在但未标记为全局（组件级初始化）→ 返回正确销毁函数
  if (_unsubscribeAnalyzer || _unsubscribeScoring) {
    logger.warn('[signalStore] 订阅已存在（组件级），将返回销毁函数')
    return destroySignalStoreSubscriptions
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

/**
 * 全局初始化信号订阅（应用启动时调用）。
 * 与组件级 initSignalStoreSubscriptions 不同，全局初始化的订阅
 * 不会随组件卸载而销毁，确保信号数据在懒加载widget挂载前就已就绪。
 */
export function initSignalStoreGlobalSubscriptions(): void {
  if (_subscriptionsInitialized) {
    logger.debug('[signalStore] Global subscriptions already initialized')
    return
  }

  if (_unsubscribeAnalyzer || _unsubscribeScoring) {
    logger.warn('[signalStore] Subscriptions already exist, marking as global')
    _subscriptionsInitialized = true
    return
  }

  // analyzer 频道：V6 评分等分析结果变更
  _unsubscribeAnalyzer = dataBridge.subscribe(
    'v6_scores',
    (envelope) => {
      if (envelope.meta.source === MODULE_ID.trading || envelope.meta.source === MODULE_ID.tradinghub) {
        return
      }
      if (envelope.meta.action === ENVELOPE_ACTION.saveScores) {
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

  _subscriptionsInitialized = true
  logger.info('[signalStore] Global DataBridge subscriptions initialized')

  // 启动时检查数据就绪状态
  void useSignalStore.getState().checkDataReady()
}

function destroySignalStoreSubscriptions(): void {
  if (_subscriptionsInitialized) {
    logger.debug('[signalStore] Global subscriptions, skip destroy from component')
    return
  }
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

/**
 * 重置所有订阅状态（仅供测试使用）。
 * @internal
 */
export function _resetSignalStoreSubscriptionsForTest(): void {
  if (_refreshDebounceTimer) {
    clearTimeout(_refreshDebounceTimer)
    _refreshDebounceTimer = null
  }
  _unsubscribeAnalyzer?.()
  _unsubscribeScoring?.()
  _unsubscribeAnalyzer = null
  _unsubscribeScoring = null
  _subscriptionsInitialized = false
  _lastRefreshTime = 0
  _isFirstDataEvent = true
  _pendingRefresh = false
  useSignalStore.setState({ ...initialState })
}
