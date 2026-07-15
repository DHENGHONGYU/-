/**
 * @module orderStore
 * @lifecycle @Global
 * @description 交易总账本 —— 订单域的唯一可信源（Single Source of Truth）。
 * 统一管理全部订单、当前持仓、已实现盈亏与未实现盈亏，
 * 取代原先分散在 positionStore / holdingsStore / orderStore 中的重复计算。
 *
 * @compliance
 * - isRefreshing 锁防止并发刷新
 * - 失败时快照回滚，保留旧数据不被清空
 * - 所有写操作通过 dataBridge.forward() 走信封协议
 * - 订阅 STORE_NAME.orders 频道，source 过滤防自激，100ms 去抖合并
 * - 保持 useOrderStore 导出名，向后兼容现有引用
 *
 * @see docs/reference/v9核心数据字典与类型定义(整合版).md
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { refreshCoordinator } from '@/core/refreshCoordinator'
import {
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  STORE_NAME,
  type EnvelopeAction,
} from '@/config/dbConfig'
import type { Order } from '@/data/types'
import type { StandardEnvelope } from '@/core/envelope'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import {
  buildTradePairs,
  buildPositions,
  type SymbolTradePair,
  type PositionItem,
} from '@/services/trading/positionComputer'
import { computePnLSummary, type PnLSummary } from '@/services/trading/pnlComputer'
import { computeRiskMetrics, type RiskMetrics } from '@/services/trading/riskComputer'

import { nanoid } from 'nanoid'
const logger = getLogger()

// ============================================================
// 类型定义（从计算模块重新导出，保持向后兼容）
// ============================================================

// 重新导出类型，保持向后兼容性
export type {
  MatchedTradePair,
  SymbolTradePair,
  PositionItem,
} from '@/services/trading/positionComputer'

// 重新导出规范 TradePair 类型（来自 types 层零依赖定义）
export type { TradePair } from '@/services/trading/tradeReviewAI.types'

export type {
  PnLSummary,
} from '@/services/trading/pnlComputer'

export type {
  RiskMetrics,
} from '@/services/trading/riskComputer'

/**
 * OrderStore 状态接口 —— 订单域唯一可信源。
 * 包含订单原始数据、派生持仓、派生盈亏汇总。
 */
export interface OrderState {
  // ---- 核心数据 ----
  /** 全部订单列表（原始数据） */
  orders: Order[]
  /** 当前持仓（按 symbol 聚合，净持仓 > 0 的标的） */
  positions: PositionItem[]
  /** 已实现盈亏总金额（元） */
  realizedPnL: number
  /** 未实现盈亏总金额（元）—— 无行情时为 0 */
  unrealizedPnL: number
  /** 按 symbol 聚合的交易对（派生） */
  tradePairs: SymbolTradePair[]
  /** 盈亏汇总（派生） */
  pnlSummary: PnLSummary
  /** 风险指标（派生） */
  riskMetrics: RiskMetrics

  // ---- 加载状态 ----
  /** 是否正在加载（首次加载） */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 是否正在刷新中（用于并发锁） */
  isRefreshing: boolean
  /** 最后更新时间戳 */
  lastUpdated: number

  // ---- Actions ----
  /**
   * 从 dataLayer 全量刷新订单、持仓与盈亏数据。
   * 具备 isRefreshing 并发锁，失败时回滚到旧快照。
   */
  refresh: () => Promise<void>
  /**
   * 内部刷新方法，实际执行刷新逻辑（由 refresh() 和 coordinator 调用）。
   */
  _doRefresh: () => Promise<void>
  /**
   * 新增订单。通过 dataBridge.forward() 走信封协议写入，
   * 写入后由订阅机制异步触发刷新。
   * @param order - 订单数据（不含 id 和 createdAt，由系统生成）
   * @returns 写入结果，成功时包含完整订单
   */
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>) => Promise<{ success: boolean; data?: Order; error?: string }>
  /**
   * 更新订单。通过 dataBridge.forward() 走信封协议。
   * @param id - 订单 ID
   * @param updates - 要更新的字段
   */
  updateOrder: (id: string, updates: Partial<Order>) => Promise<{ success: boolean; error?: string }>
  /**
   * 删除订单。通过 dataBridge.forward() 走信封协议。
   * @param id - 订单 ID
   */
  deleteOrder: (id: string) => Promise<{ success: boolean; error?: string }>
  /**
   * 获取指定股票的持仓信息（selector 风格辅助函数）。
   * @param symbol - 股票代码
   * @returns 持仓项，若不存在则返回 null
   */
  getPosition: (symbol: string) => PositionItem | null
  /**
   * 重置 store 到初始空状态。
   */
  reset: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState: Omit<
  OrderState,
  'refresh' | '_doRefresh' | 'addOrder' | 'updateOrder' | 'deleteOrder' | 'getPosition' | 'reset'
> = {
  orders: [],
  positions: [],
  realizedPnL: 0,
  unrealizedPnL: 0,
  tradePairs: [],
  pnlSummary: {
    totalRealizedPnl: 0,
    totalUnrealizedPnl: 0,
    winRate: 0,
    profitFactor: 0,
    totalTrades: 0,
    profitTrades: 0,
    lossTrades: 0,
    monthlyPnL: [],
    dailyCurve: [],
  },
  riskMetrics: {
    var95: 0,
    varLevel: 'low',
    maxDrawdown: 0,
    volatility: 0,
    sharpeRatio: 0,
    betaEstimate: 0,
    concentration: 0,
    alerts: [],
  },
  loading: true,
  error: null,
  isRefreshing: false,
  lastUpdated: 0,
}

// ============================================================
// 工具函数
// ============================================================

/** 生成 traceId */
function createTraceId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`
}

// 计算函数已从以下模块导入：
// - buildTradePairs, buildPositions, type MatchedTradePair, type TradePair, type PositionItem
//   from '@/services/trading/positionComputer'
// - computePnLSummary, type PnLSummary from '@/services/trading/pnlComputer'
// - computeRiskMetrics, type RiskMetrics from '@/services/trading/riskComputer'

// ============================================================
// Store
// ============================================================

/**
 * 订单域全局 Store —— 交易总账本。
 * 统一管理订单、持仓、盈亏，作为订单域唯一可信源。
 */
export const useOrderStore = create<OrderState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ----------------------------------------------------------
    // refresh —— 全量刷新
    // ----------------------------------------------------------

  /**
   * 从 dataLayer 全量刷新订单数据，并重新计算持仓与盈亏。
   *
   * @remarks
   * - 具备 isRefreshing 并发锁，防止重复调用
   * - 失败时保留旧数据快照（仅更新 error / loading 状态）
   * - 同时更新 positions、realizedPnL、unrealizedPnL 等派生数据
   */
  refresh: async () => {
    // 使用 RefreshCoordinator 协调跨 Store 刷新
    // isRefreshing 时不再直接 return，而是 await 正在进行的刷新 Promise
    // 这样 disciplineStore 调用 orderStore.getState().refresh() 时，
    // 如果 orderStore 正在刷新，会等待完成后使用最新数据
    await refreshCoordinator.coordinateRefresh('orderStore', () =>
      get()._doRefresh(),
    )
  },

  /**
   * 内部刷新方法，实际执行刷新逻辑。
   * 由 refresh() 和 RefreshCoordinator 共同调用。
   */
  _doRefresh: async () => {
    const state = get()

    // 保存旧数据快照，用于失败回滚
    const snapshot = {
      orders: state.orders,
      positions: state.positions,
      realizedPnL: state.realizedPnL,
      unrealizedPnL: state.unrealizedPnL,
      tradePairs: state.tradePairs,
      pnlSummary: state.pnlSummary,
      riskMetrics: state.riskMetrics,
      lastUpdated: state.lastUpdated,
    }

    set({ isRefreshing: true, loading: state.orders.length === 0, error: null })

    try {
      logger.info('[orderStore] refresh 开始', { source: MODULE_ID.orderstore, store: STORE_NAME.orders, action: ENVELOPE_ACTION.queryList })
      const result = await dataBridge.query<Order[]>({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.orders,
        source: MODULE_ID.orderstore,
      })
      logger.info('[orderStore] refresh DataBridge.query 返回', { success: result.success, count: Array.isArray(result.data) ? result.data.length : 0, error: result.error })

      if (!result.success) {
        const errorMessage = result.error ?? '查询订单列表失败'
        logger.error(`[orderStore] refresh 查询失败: ${errorMessage}`)
        throw new Error(errorMessage)
      }

      const orders = result.data ?? []

      // 计算派生数据
      const tradePairs = buildTradePairs(orders)
      const pnlSummary = computePnLSummary(tradePairs)
      const positions = buildPositions(tradePairs)
      const riskMetrics = computeRiskMetrics(tradePairs, pnlSummary, positions)

      set({
        orders,
        positions,
        tradePairs,
        pnlSummary,
        riskMetrics,
        realizedPnL: pnlSummary.totalRealizedPnl,
        unrealizedPnL: pnlSummary.totalUnrealizedPnl,
        loading: false,
        error: null,
        isRefreshing: false,
        lastUpdated: Date.now(),
      })

      logger.info('[orderStore] refresh 完成', {
        orders: orders.length,
        positions: positions.length,
        realizedPnL: pnlSummary.totalRealizedPnl,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[orderStore] refresh 失败，回滚到旧快照', { error: message })

      // 失败回滚：保留旧数据，仅更新错误和加载状态
      set({
        ...snapshot,
        loading: false,
        error: message,
        isRefreshing: false,
      })
    }
  },

  // ----------------------------------------------------------
  // addOrder —— 新增订单
  // ----------------------------------------------------------

  /**
   * 新增订单。通过 dataBridge.forward() 走信封协议写入 DB，
   * 写入成功后由 STORE_NAME.orders 频道订阅机制异步触发 refresh。
   *
   * @param order - 订单数据（不含 id 和 createdAt）
   * @returns 写入结果，成功时 data 为完整订单（含 id/createdAt）
   */
  addOrder: async (order) => {
    logger.info('[orderStore] addOrder', { symbol: order.symbol, direction: order.direction })

    try {
      const fullOrder: Order = {
        ...order,
        id: createTraceId('ord'),
        createdAt: Date.now(),
      }

      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.orderstore,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.insertOrder,
          traceId: createTraceId('os-add'),
        },
        fullOrder,
      )

      await dataBridge.forward(envelope)

      logger.info('[orderStore] addOrder 成功', { id: fullOrder.id, symbol: fullOrder.symbol })
      withBroadcast(EVENT_NAMES.ORDERS_CHANGED, { action: 'add', id: fullOrder.id, symbol: fullOrder.symbol })
      return { success: true, data: fullOrder }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[orderStore] addOrder 失败', { error: message, symbol: order.symbol })
      return { success: false, error: message }
    }
  },

  // ----------------------------------------------------------
  // updateOrder —— 更新订单
  // ----------------------------------------------------------

  /**
   * 更新订单。通过 dataBridge.forward() 走信封协议。
   *
   * @param id - 订单 ID
   * @param updates - 要更新的字段（不能修改 id 和 createdAt）
   */
  updateOrder: async (id, updates) => {
    logger.info('[orderStore] updateOrder', { id, fields: Object.keys(updates) })

    try {
      const payload = { id, ...updates }

      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.orderstore,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateOrder,
          traceId: createTraceId('os-upd'),
        },
        payload,
      )

      await dataBridge.forward(envelope)

      logger.info('[orderStore] updateOrder 成功', { id })
      withBroadcast(EVENT_NAMES.ORDERS_CHANGED, { action: 'update', id })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[orderStore] updateOrder 失败', { error: message, id })
      return { success: false, error: message }
    }
  },

  // ----------------------------------------------------------
  // deleteOrder —— 删除订单
  // ----------------------------------------------------------

  /**
   * 删除订单。通过 dataBridge.forward() 走信封协议。
   *
   * @param id - 订单 ID
   */
  deleteOrder: async (id) => {
    logger.info('[orderStore] deleteOrder', { id })

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.orderstore,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.deleteOrder,
          traceId: createTraceId('os-del'),
        },
        { id },
      )

      await dataBridge.forward(envelope)

      logger.info('[orderStore] deleteOrder 成功', { id })
      withBroadcast(EVENT_NAMES.ORDERS_CHANGED, { action: 'delete', id })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[orderStore] deleteOrder 失败', { error: message, id })
      return { success: false, error: message }
    }
  },

  // ----------------------------------------------------------
  // getPosition —— 单标的持仓 selector
  // ----------------------------------------------------------

  /**
   * 获取指定股票的持仓信息。
   *
   * @param symbol - 股票代码
   * @returns 持仓项，若不存在或已清仓则返回 null
   */
  getPosition: (symbol) => {
    const { positions } = get()
    return positions.find((p) => p.symbol === symbol) ?? null
  },

  // ----------------------------------------------------------
  // reset —— 重置
  // ----------------------------------------------------------

  /**
   * 重置 store 到初始空状态。
   * 通常用于登出/切换账户等场景。
   */
  reset: () => {
    logger.info('[orderStore] reset')
    set({ ...initialState })
    withBroadcast(EVENT_NAMES.ORDERS_CHANGED, { action: 'reset' })
  },
}))
)

// ============================================================
// DataBridge 订阅生命周期
// ============================================================

/**
 * 本模块 source 标识，用于订阅时 source 过滤，防止自激（自己发的事件自己又处理）。
 *
 * @remarks
 * 订阅 STORE_NAME.orders 频道，source 为 MODULE_ID.orderstore。
 * 写操作发出的事件 meta.source === 此值，订阅回调中据此过滤跳过。
 */
const ORDER_STORE_SOURCE = MODULE_ID.orderstore

/** 去抖合并窗口（毫秒）：短时间内多次变更合并为一次 refresh */
const DEBOUNCE_MS = 100

let _unsubscribeOrders: (() => void) | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

/** 需要触发刷新的订单相关 action 集合 */
const _ORDER_CHANGE_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertOrder,
  ENVELOPE_ACTION.updateOrder,
  ENVELOPE_ACTION.deleteOrder,
  ENVELOPE_ACTION.tradeActionExecuted,
])

/**
 * 去抖执行 refresh，100ms 内多次调用合并为一次。
 *
 * @param envelope - 触发去抖的信封（用于日志追踪）
 */
function _debouncedRefresh(envelope: StandardEnvelope): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
  }
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    logger.info('[orderStore] Debounced refresh triggered', {
      traceId: envelope.meta.traceId,
      action: envelope.meta.action,
      source: envelope.meta.source,
    })
    // 通过 coordinator 协调刷新，确保跨 Store 数据一致性
    void refreshCoordinator.coordinateRefresh('orderStore', () =>
      useOrderStore.getState()._doRefresh(),
    )
  }, DEBOUNCE_MS)
}

/**
 * 初始化 OrderStore 的 DataBridge 订阅。
 *
 * 订阅 STORE_NAME.orders 频道，监听以下 action 并触发去抖刷新：
 * - insertOrder
 * - updateOrder
 * - deleteOrder
 * - tradeActionExecuted
 *
 * 同时做 source 过滤：跳过 source 为 'orderstore' 的事件，防止自激。
 *
 * @returns 清理函数，调用后取消所有订阅并清理定时器
 *
 * @example
 * ```ts
 * // 在 App 根组件中初始化
 * useEffect(() => {
 *   const cleanup = initOrderStoreSubscriptions()
 *   return cleanup
 * }, [])
 * ```
/**
 * initOrderStoreSubscriptions
 */
export function initOrderStoreSubscriptions(): () => void {
  if (_unsubscribeOrders) {
    logger.warn('[orderStore] Subscriptions already initialized, skipping')
    return _unsubscribeOrders
  }

  _unsubscribeOrders = dataBridge.subscribe(
    STORE_NAME.orders,
    (envelope) => {
      // priority: high — 交易执行需即时响应

      // source 过滤：跳过本模块发出的事件，防止自激
      if (envelope.meta.source === ORDER_STORE_SOURCE) {
        return
      }

      if (_ORDER_CHANGE_ACTIONS.has(envelope.meta.action)) {
        logger.info('[orderStore] DataBridge orders event, scheduling debounced refresh', {
          action: envelope.meta.action,
          traceId: envelope.meta.traceId,
          source: envelope.meta.source,
        })
        _debouncedRefresh(envelope)
      }
    },
  )

  logger.info('[orderStore] DataBridge orders subscriptions initialized')

  /** 清理函数：取消订阅 + 清除去抖定时器 */
  return () => {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
    _unsubscribeOrders?.()
    _unsubscribeOrders = null
    logger.info('[orderStore] DataBridge subscriptions destroyed')
  }
}
