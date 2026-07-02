/**
 * @module positionStore
 * @lifecycle @Global
 * @description 仓位控制状态管理。管理总资产、可用资金、仓位比例及持仓明细，
 * 数据从 orderStore 派生，不再直接读取 dataLayer.orders.list()，避免与 orderStore 重复读取。
 *
 * @compliance
 * - 所有颜色值从 PIE_COLORS 常量引用
 * - 所有魔法值禁止出现在 actions 中
 * - 订阅 orderStore 内存状态，200ms 去抖合并 + isRefreshing 防重入
 * - 遵循现有 Zustand Store 风格
 *
 * @see docs/《V9核心数据字典与类型定义（整合版）》.md
 * @see src/config/chartColors.ts - PIE_CHART_PALETTE
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
// @note [DF-003] 数据流违规：Store 直接 import 并引用其他 Store
// 违规类型：Store 跨 Store 直接访问（应通过 selector 或中间层）
// 当前状态：positionStore 作为派生 Store，订阅 orderStore 状态计算仓位数据
// 整改计划：v0.9.16 评估是否通过 dataLayer 事件总线或 selector 模式解耦
// 相关规范：docs/implementation/data-flow-spec.md 第2.5节
import { useOrderStore } from '@/store/orderStore'
import { refreshCoordinator } from '@/core/refreshCoordinator'
import type { Order } from '@/data/types'
import { PIE_CHART_PALETTE } from '@/config/chartColors'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 常量
// ============================================================

/** 饼图颜色调色板（从 chartColors 统一引用） */
export const PIE_COLORS = [...PIE_CHART_PALETTE] as const

// ============================================================
// 类型定义
// ============================================================

/** 单条持仓明细 */
export interface PositionHoldingItem {
  symbol: string
  name: string
  value: number
  /** 占总投资比例 % (0-100) */
  ratio: number
  /** 饼图颜色（由 PIE_COLORS 按索引分配） */
  color: string
  /** 持仓方向 */
  direction: 'buy' | 'sell'
}

// ============================================================
// Store 接口
// ============================================================

interface PositionState {
  /** 总资产（估算值） */
  totalValue: number
  /** 可用资金 */
  availableFunds: number
  /** 仓位比例 (0-100) */
  positionRatio: number
  /** 持仓明细 */
  holdings: PositionHoldingItem[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳 */
  lastUpdated: number | null

  // Actions
  refresh: () => Promise<void>
  recomputeFromOrders: (orders: Order[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  totalValue: 0,
  availableFunds: 0,
  positionRatio: 0,
  holdings: [] as PositionHoldingItem[],
  loading: true,
  error: null as string | null,
  lastUpdated: null as number | null,
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 从订单列表汇总持仓数据
 * @remarks 按 symbol 分组，分别累加买入/卖出金额，计算净持仓
 */
function aggregateOrders(orders: Order[]): {
  totalValue: number
  availableFunds: number
  positionRatio: number
  holdings: PositionHoldingItem[]
} {
  const bySymbol = new Map<string, { buys: number; sells: number; totalValue: number }>()
  for (const order of orders) {
    const existing = bySymbol.get(order.symbol) ?? { buys: 0, sells: 0, totalValue: 0 }
    if (order.direction === 'buy') {
      existing.buys += order.amount
    } else {
      existing.sells += order.amount
    }
    existing.totalValue = existing.buys - existing.sells
    bySymbol.set(order.symbol, existing)
  }

  const holdings: PositionHoldingItem[] = Array.from(bySymbol.entries())
    .filter(([, val]) => val.totalValue > 0)
    .map(([symbol, val], i) => ({
      symbol,
      name: symbol,
      value: val.totalValue,
      ratio: 0,
      color: PIE_COLORS[i % PIE_COLORS.length]!,
      direction: 'buy' as const,
    }))

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)
  for (const h of holdings) {
    h.ratio = totalValue > 0 ? Math.round((h.value / totalValue) * 1000) / 10 : 0
  }

  // 可用资金（占位估算：假设总资产为持仓的 1.5 倍）
  const estimatedTotal = totalValue * 1.5
  const availableFunds = estimatedTotal - totalValue
  const positionRatio = estimatedTotal > 0
    ? Math.round((totalValue / estimatedTotal) * 1000) / 10
    : 0

  return { totalValue, availableFunds, positionRatio, holdings }
}

// ============================================================
// Store
// ============================================================

export const usePositionStore = create<PositionState>((set) => ({
  ...initialState,

  refresh: async () => {
    logger.info('[positionStore] refresh 开始')
    set({ loading: true, error: null })

    try {
      // 通过 RefreshCoordinator 等待 orderStore 刷新完成，
      // 避免 orderStore 正在刷新时 positionStore 读到过期订单数据
      await refreshCoordinator.waitFor('orderStore')
      // 复用 orderStore，避免重复读取 dataLayer
      await useOrderStore.getState().refresh()
      const orders = useOrderStore.getState().orders
      const result = aggregateOrders(orders)
      set({
        ...result,
        loading: false,
        lastUpdated: Date.now(),
      })
      logger.info('[positionStore] refresh 完成', {
        holdings: result.holdings.length,
        totalValue: result.totalValue,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[positionStore] refresh 失败', { error: message })
      set({ error: message, loading: false })
    }
  },

  recomputeFromOrders: (orders) => {
    const result = aggregateOrders(orders)
    set({
      ...result,
      lastUpdated: Date.now(),
    })
    logger.info('[positionStore] 从 OrderStore 派生持仓完成', {
      holdings: result.holdings.length,
      totalValue: result.totalValue,
    })
    withBroadcast(EVENT_NAMES.HOLDINGS_CHANGED, { action: 'recompute', holdings: result.holdings.length })
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  reset: () => {
    logger.info('[positionStore] reset')
    set({ ...initialState })
    withBroadcast(EVENT_NAMES.HOLDINGS_CHANGED, { action: 'reset' })
  },
}))

// OrderStore 订阅生命周期
// ============================================================
// 由组件层 useEffect 调用 init，返回的 cleanup 函数中取消订阅
// 避免模块级副作用导致的 HMR 重复订阅和内存泄漏

let _unsubscribeOrders: (() => void) | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null
let _isRefreshing = false

/** 去抖合并窗口（毫秒）：高频订单变化合并为一次重算 */
const DEBOUNCE_MS = 200

/** 初始化 OrderStore 内存状态订阅，当 orders 变化时自动重新派生持仓 */
export function initPositionStoreSubscriptions(): () => void {
  if (_unsubscribeOrders) {
    logger.warn('[positionStore] Subscriptions already initialized, skipping')
    return _unsubscribeOrders
  }

  _unsubscribeOrders = useOrderStore.subscribe(
    (state) => state.orders,
    (orders) => {
      logger.info('[positionStore] OrderStore orders changed, scheduling debounced recompute', {
        orders: orders.length,
      })
      if (_debounceTimer) {
        clearTimeout(_debounceTimer)
      }
      _debounceTimer = setTimeout(() => {
        _debounceTimer = null
        if (_isRefreshing) {
          logger.debug('[positionStore] recomputeFromOrders skipped: isRefreshing is true')
          return
        }
        _isRefreshing = true
        usePositionStore.getState().recomputeFromOrders(orders)
        _isRefreshing = false
      }, DEBOUNCE_MS)
    },
  )

  logger.info('[positionStore] OrderStore subscriptions initialized (debounce=200ms)')

  return () => {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
    _unsubscribeOrders?.()
    _unsubscribeOrders = null
    _isRefreshing = false
    logger.info('[positionStore] OrderStore subscriptions destroyed')
  }
}
