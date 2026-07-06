/**
 * @module backtestStore
 * @lifecycle @Global
 * @description 策略回测状态管理。支持三种回测策略（热门板块/价值洼地/复合策略），
 * 从 dataLayer.orders 获取历史交易数据，模拟回测计算净值曲线与绩效指标。
 *
 * @compliance
 * - 遵循 Zustand store 模式（参考 holdingsStore.ts）
 * - DataBridge 订阅采用显式 init/destroy 生命周期管理
 * - 模拟算法仅用于当前阶段，后续可接入真实回测引擎
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import type { StandardEnvelope } from '@/core/envelope'
import { BacktestEngine } from '@/services/backtest'
import { exportBacktestReport } from '@/services/export/backtestExportService'
import type { BacktestExportConfig, BacktestExportResult, BacktestStrategy } from '@/types/modules/backtest.types'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

// Re-export BacktestStrategy for backward compatibility
export type { BacktestStrategy }

export interface BacktestTrade {
  symbol: string
  direction: 'buy' | 'sell'
  price: number
  quantity: number
  date: string
  pnl: number
  pnlPct: number
  reason: string
}

export interface BacktestResult {
  totalReturn: number
  annualizedReturn: number
  maxDrawdown: number
  sharpeRatio: number
  winRate: number
  tradeCount: number
  profitTrades: number
  lossTrades: number
  avgProfit: number
  avgLoss: number
  pnlCurve: number[]
  trades: BacktestTrade[]
  /** 最终持仓快照（导出用，由 BacktestEngine 计算） */
  positions?: BacktestPosition[]
  /** 每日净值序列（导出用，由 BacktestEngine 计算） */
  dailyValues?: BacktestDailyValue[]
}

/** 回测持仓快照 */
export interface BacktestPosition {
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
}

/** 单日净值记录 */
export interface BacktestDailyValue {
  date: string
  totalValue: number
  cash: number
}

export interface BacktestConfig {
  strategy: BacktestStrategy
  startDate: string
  endDate: string
  initialCapital: number
}

interface BacktestState {
  // ---- 回测配置 ----
  config: BacktestConfig

  // ---- 回测结果 ----
  results: BacktestResult | null

  // ---- 加载 / 错误 ----
  loading: boolean
  error: string | null
  lastRunAt: number | null

  // ---- Actions ----
  setConfig: (partial: Partial<BacktestConfig>) => void
  runBacktest: () => Promise<void>
  clearResults: () => void
  /** 导出回测报告（封装 backtestExportService，避免页面直接调用 Service） */
  exportReport: (
    results: BacktestResult,
    config: BacktestConfig,
    options: BacktestExportConfig,
  ) => Promise<BacktestExportResult>
}

// ============================================================
// 常量
// ============================================================

const DEFAULT_CAPITAL = 1_000_000

function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setFullYear(start.getFullYear() - 1)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

const defaultDates = getDefaultDateRange()

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  config: {
    strategy: 'hot_sector' as BacktestStrategy,
    startDate: defaultDates.start,
    endDate: defaultDates.end,
    initialCapital: DEFAULT_CAPITAL,
  },
  results: null as BacktestResult | null,
  loading: false,
  error: null as string | null,
  lastRunAt: null as number | null,
}

// ============================================================
// Store
// ============================================================

export const useBacktestStore = create<BacktestState>((set, get) => ({
  ...initialState,

  setConfig: (partial) =>
    set((state) => ({
      config: { ...state.config, ...partial },
    })),

  runBacktest: async () => {
    const { config } = get()
    set({ loading: true, error: null })

    try {
      logger.info('[backtestStore] runBacktest started', { config })

      // 执行基于真实策略信号的回测
      const engine = new BacktestEngine()
      const engineResult = await engine.run({
        ...config,
        commissionRate: 0.0003,
        slippage: 0.001,
        maxPositionPct: 0.2,
      })

      set({
        results: engineResult.metrics,
        loading: false,
        lastRunAt: Date.now(),
      })

      logger.info('[backtestStore] runBacktest completed', {
        totalReturn: engineResult.metrics.totalReturn,
        sharpeRatio: engineResult.metrics.sharpeRatio,
        tradeCount: engineResult.metrics.tradeCount,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '回测执行失败'
      logger.error('[backtestStore] runBacktest failed', { error: message })
      set({
        loading: false,
        error: message,
        results: null,
      })
    }
  },

  clearResults: () => {
    set({
      results: null,
      error: null,
      lastRunAt: null,
    })
    withBroadcast(EVENT_NAMES.BACKTEST_CHANGED, { action: 'clearResults' })
  },

  exportReport: async (results, config, options) => {
    logger.info('[backtestStore] exportReport started', { format: options.format })
    try {
      const result = await exportBacktestReport(results, config, options)
      logger.info('[backtestStore] exportReport completed')
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败'
      logger.error('[backtestStore] exportReport failed', { error: message })
      throw err
    }
  },
}))

// ============================================================
// DataBridge 订阅生命周期
// ============================================================

/** 本模块 ID，用于 source 过滤，防止自激 */
const _MODULE_SOURCE = MODULE_ID.tradinghub

/** 去抖合并窗口（毫秒）：短时间内多次变更合并为一次处理 */
const DEBOUNCE_MS = 100

let _unsubscribeOrders: (() => void) | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null
let _pendingEvents: StandardEnvelope[] = []

/** 去抖处理订单变更事件，100ms 内多次调用合并为一次 */
function _debouncedHandleOrders(envelope: StandardEnvelope): void {
  _pendingEvents.push(envelope)
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
  }
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    const events = _pendingEvents
    _pendingEvents = []
    logger.info('[backtestStore] Debounced order events processed', {
      count: events.length,
      actions: events.map((e) => e.meta.action),
      traceId: events[events.length - 1]?.meta.traceId,
    })
  }, DEBOUNCE_MS)
}

/** 初始化 DataBridge 订单频道订阅，返回 cleanup 函数 */
export function initBacktestStoreSubscriptions(): () => void {
  if (_unsubscribeOrders) {
    logger.warn('[backtestStore] Subscriptions already initialized, skipping')
    return _unsubscribeOrders
  }

  _unsubscribeOrders = dataBridge.subscribe(
    STORE_NAME.orders,
    (envelope) => {
      // source 过滤：跳过本模块发出的事件，防止自激
      if (envelope.meta.source === _MODULE_SOURCE) {
        return
      }

      if (envelope.meta.action === ENVELOPE_ACTION.insertOrder) {
        logger.info('[backtestStore] DataBridge event received: insertOrder', {
          traceId: envelope.meta.traceId,
          source: envelope.meta.source,
        })
        _debouncedHandleOrders(envelope)
      }
      if (envelope.meta.action === ENVELOPE_ACTION.updateOrder) {
        logger.info('[backtestStore] DataBridge event received: updateOrder', {
          traceId: envelope.meta.traceId,
        })
        _debouncedHandleOrders(envelope)
      }
      if (envelope.meta.action === ENVELOPE_ACTION.deleteOrder) {
        logger.info('[backtestStore] DataBridge event received: deleteOrder', {
          traceId: envelope.meta.traceId,
        })
        _debouncedHandleOrders(envelope)
      }
    },
  )

  logger.info('[backtestStore] DataBridge orders subscriptions initialized')

  return () => {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
    _pendingEvents = []
    _unsubscribeOrders?.()
    _unsubscribeOrders = null
    logger.info('[backtestStore] DataBridge subscriptions destroyed')
  }
}
