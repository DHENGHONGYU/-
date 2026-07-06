/**
 * @module executionStore
 * @lifecycle @Global
 * @description 执行中枢 -- 信号到订单之间的执行状态机。
 * 封装执行计划生成、状态转换(plan->confirmed->pending->executed->cancelled->reviewed)、
 * 自动执行编排、执行日志。
 *
 * @compliance
 * - isRefreshing 锁防止并发刷新
 * - 失败时快照回滚，保留旧数据不被清空
 * - 所有写操作通过 dataBridge.forward() 走信封协议
 * - 订阅 STORE_NAME.signals / STORE_NAME.orders 频道，source 过滤防自激
 *
 * @see docs/《V9核心数据字典与类型定义（整合版）》.md
 * @see docs/《功能模块数据契约》.md
 * @see docs/implementation/v9-system-blueprint.md
 * @see docs/《DataBridge端点与数据映射清单》.md
 * @see docs/《V9 架构缺陷与整改行动清单》.md
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { dataLayer } from '@/data/dataLayer'
import { refreshCoordinator } from '@/core/refreshCoordinator'
import {
  ENVELOPE_ACTION,
  MODULE_ID,
  STORE_NAME,
  type AccountType,
  type EnvelopeAction,
} from '@/config/dbConfig'
import type { Signal, ExecutionPlan, ExecutionPhase } from '@/data/types'
import type { StandardEnvelope } from '@/core/envelope'
import { dataBridge } from '@/core/databridge'
import { createBuyOrder, createSellOrder } from '@/services/trading/tradingService'
import { createExecutionPlanUseCase } from '@/services/useCase/createExecutionPlan.useCase'

const logger = getLogger()

/** 执行计划手动取消时的默认错误信息 */
const DEFAULT_CANCEL_REASON = '手动取消'

// ============================================================
// 类型定义
// ============================================================

interface ExecutionState {
  // ---- 核心数据 ----
  /** 全部执行计划 */
  plans: ExecutionPlan[]
  /** 活跃计划：phase in [plan, confirmed, pending] */
  activePlans: ExecutionPlan[]

  // ---- 加载状态 ----
  /** 是否正在处理（执行中） */
  isProcessing: boolean
  /** 是否正在加载（首次加载） */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 是否正在刷新（并发锁） */
  isRefreshing: boolean
  /** 最后更新时间戳 */
  lastUpdated: number

  // ---- Actions ----
  /** 根据信号创建执行计划（计算仓位 + 风控检查） */
  createPlan: (signal: Signal, accountType?: AccountType) => Promise<ExecutionPlan | null>
  /** 确认执行计划：phase plan -> confirmed */
  confirmPlan: (planId: string) => Promise<void>
  /** 执行计划：调用 tradingService 下单 */
  executePlan: (planId: string) => Promise<void>
  /** 取消执行计划 */
  cancelPlan: (planId: string, reason?: string) => Promise<void>
  /** 标记已复盘 */
  markReviewed: (planId: string) => Promise<void>
  /** 从 dataLayer 全量刷新 */
  refresh: () => Promise<void>
}

// ============================================================
// 初始状态
// ============================================================

const initialState: Omit<
  ExecutionState,
  'createPlan' | 'confirmPlan' | 'executePlan' | 'cancelPlan' | 'markReviewed' | 'refresh'
> = {
  plans: [],
  activePlans: [],
  isProcessing: false,
  loading: true,
  error: null,
  isRefreshing: false,
  lastUpdated: 0,
}

// ============================================================
// 工具函数
// ============================================================

/** 判断是否为活跃 phase */
function isActivePhase(phase: ExecutionPhase): boolean {
  return phase === 'plan' || phase === 'confirmed' || phase === 'pending'
}

/** 计算活跃计划列表 */
function computeActivePlans(plans: ExecutionPlan[]): ExecutionPlan[] {
  return plans.filter((p) => isActivePhase(p.phase))
}

// ============================================================
// Store
// ============================================================

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  ...initialState,

  // ----------------------------------------------------------
  // refresh -- 全量刷新
  // ----------------------------------------------------------

  refresh: async () => {
    const state = get()

    // 并发锁
    if (state.isRefreshing) {
      logger.debug('[executionStore] refresh skipped: isRefreshing is true')
      return
    }

    // 保存旧快照，用于失败回滚
    const snapshot = {
      plans: state.plans,
      activePlans: state.activePlans,
      lastUpdated: state.lastUpdated,
    }

    set({ isRefreshing: true, loading: state.plans.length === 0, error: null })

    try {
      logger.info('[executionStore] refresh 开始')
      const plans = await dataLayer.executionPlans.list()
      const activePlans = computeActivePlans(plans)

      set({
        plans,
        activePlans,
        loading: false,
        error: null,
        isRefreshing: false,
        lastUpdated: Date.now(),
      })

      logger.info(`[executionStore] refresh 完成: ${plans.length} 个计划, ${activePlans.length} 个活跃`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[executionStore] refresh 失败，回滚到旧快照', { error: message })

      set({
        ...snapshot,
        loading: false,
        error: message,
        isRefreshing: false,
      })
    }
  },

  // ----------------------------------------------------------
  // createPlan -- 创建执行计划
  // ----------------------------------------------------------

  createPlan: async (signal, accountType) => {
    logger.info('[executionStore] createPlan', {
      signalId: signal.id,
      symbol: signal.symbol,
      direction: signal.direction,
    })

    try {
      const result = await createExecutionPlanUseCase({ signal, accountType })

      if (!result.success || !result.plan) {
        if (result.error && result.error !== '非交易信号，不创建执行计划') {
          logger.error('[executionStore] createPlan 失败', { error: result.error })
          set({ error: result.error })
        }
        return null
      }

      // 更新 store 状态
      set((state) => {
        const newPlans = [...state.plans, result.plan!]
        return {
          plans: newPlans,
          activePlans: computeActivePlans(newPlans),
          lastUpdated: Date.now(),
        }
      })

      logger.info('[executionStore] createPlan 成功', {
        planId: result.plan.id,
        symbol: result.plan.symbol,
        passed: result.plan.risk?.passed,
      })

      return result.plan
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[executionStore] createPlan 失败', { error: message, symbol: signal.symbol })
      set({ error: message })
      return null
    }
  },

  // ----------------------------------------------------------
  // confirmPlan -- 确认执行计划
  // ----------------------------------------------------------

  confirmPlan: async (planId) => {
    logger.info('[executionStore] confirmPlan', { planId })

    try {
      const { plans } = get()
      const plan = plans.find((p) => p.id === planId)
      if (!plan) {
        logger.error('[executionStore] confirmPlan failed: plan not found', { planId })
        set({ error: `执行计划 ${planId} 不存在` })
        return
      }

      if (plan.phase !== 'plan') {
        logger.error('[executionStore] confirmPlan failed: invalid phase', { planId, phase: plan.phase })
        set({ error: `执行计划 ${planId} 当前阶段为 ${plan.phase}，无法确认` })
        return
      }

      const updated: ExecutionPlan = {
        ...plan,
        phase: 'confirmed',
        confirmedAt: Date.now(),
      }

      await dataLayer.executionPlans.update(planId, { phase: 'confirmed', confirmedAt: Date.now() })

      set((state) => {
        const newPlans = state.plans.map((p) => (p.id === planId ? updated : p))
        return {
          plans: newPlans,
          activePlans: computeActivePlans(newPlans),
          lastUpdated: Date.now(),
        }
      })

      logger.info('[executionStore] confirmPlan 成功', { planId })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[executionStore] confirmPlan 失败', { error: message, planId })
      set({ error: message })
    }
  },

  // ----------------------------------------------------------
  // executePlan -- 执行计划（下单）
  // ----------------------------------------------------------

  executePlan: async (planId) => {
    logger.info('[executionStore] executePlan', { planId })

    const { plans } = get()
    const plan = plans.find((p) => p.id === planId)
    if (!plan) {
      logger.error('[executionStore] executePlan failed: plan not found', { planId })
      set({ error: `执行计划 ${planId} 不存在` })
      return
    }

    if (plan.phase !== 'confirmed' && plan.phase !== 'plan') {
      logger.error('[executionStore] executePlan failed: invalid phase', { planId, phase: plan.phase })
      set({ error: `执行计划 ${planId} 当前阶段为 ${plan.phase}，无法执行` })
      return
    }

    // 设置处理中状态
    set({ isProcessing: true, error: null })

    try {
      // 等待 orderStore 刷新完成，确保读取到最新持仓数据用于仓位计算
      await refreshCoordinator.waitFor('orderStore')

      // 1. phase -> pending
      const pendingPlan: ExecutionPlan = { ...plan, phase: 'pending' }
      await dataLayer.executionPlans.update(planId, { phase: 'pending' })

      set((state) => {
        const newPlans = state.plans.map((p) => (p.id === planId ? pendingPlan : p))
        return { plans: newPlans, activePlans: computeActivePlans(newPlans) }
      })

      // 2. 获取股票信息
      const stock = await dataLayer.stocks.get(plan.symbol)
      if (!stock || stock.price === undefined || stock.price <= 0) {
        throw new Error(`股票 ${plan.symbol} 价格无效`)
      }

      // 3. 根据 direction 调用 tradingService
      const quantity = plan.sizing?.quantity ?? 100
      let orderResult

      if (plan.direction === 'buy') {
        orderResult = await createBuyOrder(stock, quantity)
      } else {
        orderResult = await createSellOrder(stock, quantity)
      }

      // 4. 处理结果
      if (orderResult.success && orderResult.data) {
        const executedPlan: ExecutionPlan = {
          ...pendingPlan,
          phase: 'executed',
          orderId: orderResult.data.id,
          executedAt: Date.now(),
          result: 'success',
        }
        await dataLayer.executionPlans.update(planId, {
          phase: 'executed',
          orderId: orderResult.data.id,
          executedAt: Date.now(),
          result: 'success',
        })

        set((state) => {
          const newPlans = state.plans.map((p) => (p.id === planId ? executedPlan : p))
          return {
            plans: newPlans,
            activePlans: computeActivePlans(newPlans),
            lastUpdated: Date.now(),
          }
        })

        logger.info('[executionStore] executePlan 成功', {
          planId,
          orderId: orderResult.data.id,
        })
      } else {
        // 下单失败 -> cancelled
        const cancelledPlan: ExecutionPlan = {
          ...pendingPlan,
          phase: 'cancelled',
          executedAt: Date.now(),
          result: 'failed',
          errorMessage: orderResult.error ?? '下单失败',
        }
        await dataLayer.executionPlans.update(planId, {
          phase: 'cancelled',
          executedAt: Date.now(),
          result: 'failed',
          errorMessage: orderResult.error ?? '下单失败',
        })

        set((state) => {
          const newPlans = state.plans.map((p) => (p.id === planId ? cancelledPlan : p))
          return {
            plans: newPlans,
            activePlans: computeActivePlans(newPlans),
            lastUpdated: Date.now(),
          }
        })

        logger.warn('[executionStore] executePlan 下单失败', {
          planId,
          error: orderResult.error,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[executionStore] executePlan 异常', { error: message, planId })

      // 异常 -> cancelled
      try {
        const cancelledPlan: ExecutionPlan = {
          ...plan,
          phase: 'cancelled',
          executedAt: Date.now(),
          result: 'failed',
          errorMessage: message,
        }
        await dataLayer.executionPlans.update(planId, {
          phase: 'cancelled',
          executedAt: Date.now(),
          result: 'failed',
          errorMessage: message,
        })

        set((state) => {
          const newPlans = state.plans.map((p) => (p.id === planId ? cancelledPlan : p))
          return {
            plans: newPlans,
            activePlans: computeActivePlans(newPlans),
            lastUpdated: Date.now(),
          }
        })
      } catch (updateErr) {
        logger.error('[executionStore] executePlan 异常后更新状态也失败', { error: updateErr })
      }

      set({ error: message })
    } finally {
      set({ isProcessing: false })
    }
  },

  // ----------------------------------------------------------
  // cancelPlan -- 取消执行计划
  // ----------------------------------------------------------

  cancelPlan: async (planId, reason) => {
    logger.info('[executionStore] cancelPlan', { planId, reason })

    try {
      const { plans } = get()
      const plan = plans.find((p) => p.id === planId)
      if (!plan) {
        logger.error('[executionStore] cancelPlan failed: plan not found', { planId })
        set({ error: `执行计划 ${planId} 不存在` })
        return
      }

      if (plan.phase === 'executed' || plan.phase === 'reviewed' || plan.phase === 'cancelled') {
        logger.warn('[executionStore] cancelPlan skipped: terminal phase', { planId, phase: plan.phase })
        return
      }

      const updated: ExecutionPlan = {
        ...plan,
        phase: 'cancelled',
        errorMessage: reason ?? DEFAULT_CANCEL_REASON,
      }

      await dataLayer.executionPlans.update(planId, {
        phase: 'cancelled',
        errorMessage: reason ?? DEFAULT_CANCEL_REASON,
      })

      set((state) => {
        const newPlans = state.plans.map((p) => (p.id === planId ? updated : p))
        return {
          plans: newPlans,
          activePlans: computeActivePlans(newPlans),
          lastUpdated: Date.now(),
        }
      })

      logger.info('[executionStore] cancelPlan 成功', { planId })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[executionStore] cancelPlan 失败', { error: message, planId })
      set({ error: message })
    }
  },

  // ----------------------------------------------------------
  // markReviewed -- 标记已复盘
  // ----------------------------------------------------------

  markReviewed: async (planId) => {
    logger.info('[executionStore] markReviewed', { planId })

    try {
      const { plans } = get()
      const plan = plans.find((p) => p.id === planId)
      if (!plan) {
        logger.error('[executionStore] markReviewed failed: plan not found', { planId })
        set({ error: `执行计划 ${planId} 不存在` })
        return
      }

      if (plan.phase !== 'executed' && plan.phase !== 'cancelled') {
        logger.warn('[executionStore] markReviewed skipped: not executed/cancelled', { planId, phase: plan.phase })
        return
      }

      const updated: ExecutionPlan = {
        ...plan,
        phase: 'reviewed',
        reviewedAt: Date.now(),
      }

      await dataLayer.executionPlans.update(planId, {
        phase: 'reviewed',
        reviewedAt: Date.now(),
      })

      set((state) => {
        const newPlans = state.plans.map((p) => (p.id === planId ? updated : p))
        return {
          plans: newPlans,
          activePlans: computeActivePlans(newPlans),
          lastUpdated: Date.now(),
        }
      })

      logger.info('[executionStore] markReviewed 成功', { planId })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[executionStore] markReviewed 失败', { error: message, planId })
      set({ error: message })
    }
  },
}))

// ============================================================
// DataBridge 订阅生命周期
// ============================================================

/**
 * 本模块 source 标识，用于订阅时 source 过滤，防止自激。
 */
const EXECUTION_STORE_SOURCE = MODULE_ID.tradinghub

/** 去抖合并窗口（毫秒） */
const DEBOUNCE_MS = 100

let _unsubscribeSignals: (() => void) | null = null
let _unsubscribeOrders: (() => void) | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

/** 需要触发刷新的执行计划相关 action 集合 */
const _EXECUTION_CHANGE_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.saveExecutionPlan,
  ENVELOPE_ACTION.updateExecutionPhase,
])

/** 触发自动创建计划的 action 集合 */
const _SIGNAL_INSERT_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertSignal,
])

/** 触发执行计划关联更新的 action 集合 */
const _ORDER_CHANGE_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertOrder,
  ENVELOPE_ACTION.updateOrder,
])

/**
 * 去抖执行 refresh，100ms 内多次调用合并为一次。
 */
function _debouncedRefresh(envelope: StandardEnvelope): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
  }
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null
      logger.info('[executionStore] Debounced refresh triggered', {
        traceId: envelope.meta.traceId,
        action: envelope.meta.action,
        source: envelope.meta.source,
      })
      void useExecutionStore.getState().refresh()
    }, DEBOUNCE_MS)
}

/**
 * 初始化 ExecutionStore 的 DataBridge 订阅。
 *
 * 1. 订阅 STORE_NAME.signals 频道：收到 insertSignal 时，自动调用 createPlan()（半自动模式）
 * 2. 订阅 STORE_NAME.orders 频道：订单状态变更时，更新关联执行计划的 phase
 * 3. source 过滤防止自激
 *
 * @returns 清理函数，调用后取消所有订阅并清理定时器
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   const cleanup = initExecutionStoreSubscriptions()
 *   return cleanup
 * }, [])
 * ```
 */
export function initExecutionStoreSubscriptions(): () => void {
  if (_unsubscribeSignals || _unsubscribeOrders) {
    logger.warn('[executionStore] Subscriptions already initialized, skipping')
    return _destroySubscriptions
  }

  // 订阅 signals 频道：半自动模式下，收到新信号自动创建执行计划
  _unsubscribeSignals = dataBridge.subscribe(
    STORE_NAME.signals,
    (envelope) => {
      // source 过滤：跳过本模块发出的事件，防止自激
      if (envelope.meta.source === EXECUTION_STORE_SOURCE) {
        return
      }

      if (_SIGNAL_INSERT_ACTIONS.has(envelope.meta.action)) {
        const signal = envelope.payload as Signal | undefined
        if (signal && (signal.direction === 'buy' || signal.direction === 'sell')) {
          logger.info('[executionStore] 收到新信号，自动创建执行计划', {
            signalId: signal.id,
            symbol: signal.symbol,
            direction: signal.direction,
            confidence: signal.confidence,
          })
          // 半自动模式：自动创建计划，但不自动确认和执行
          void useExecutionStore.getState().createPlan(signal)
        }
      }

      // 同步刷新执行计划列表
      if (_EXECUTION_CHANGE_ACTIONS.has(envelope.meta.action)) {
        _debouncedRefresh(envelope)
      }
    },
  )

  // 订阅 orders 频道：订单状态变更时更新关联执行计划
  _unsubscribeOrders = dataBridge.subscribe(
    STORE_NAME.orders,
    (envelope) => {
      // source 过滤：跳过本模块发出的事件，防止自激
      if (envelope.meta.source === EXECUTION_STORE_SOURCE) {
        return
      }

      if (_ORDER_CHANGE_ACTIONS.has(envelope.meta.action)) {
        logger.info('[executionStore] DataBridge orders event received', {
          action: envelope.meta.action,
          traceId: envelope.meta.traceId,
          source: envelope.meta.source,
        })

        // 订单变更触发刷新以同步最新状态
        _debouncedRefresh(envelope)
      }
    },
  )

  logger.info('[executionStore] DataBridge subscriptions initialized')

  return _destroySubscriptions
}

function _destroySubscriptions(): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  _unsubscribeSignals?.()
  _unsubscribeOrders?.()
  _unsubscribeSignals = null
  _unsubscribeOrders = null
  logger.info('[executionStore] DataBridge subscriptions destroyed')
}
