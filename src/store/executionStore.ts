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
import { refreshCoordinator } from '@/core/refreshCoordinator'
import {
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  STORE_NAME,
  type AccountType,
  type EnvelopeAction,
} from '@/config/dbConfig'
import type { Signal, ExecutionPlan, ExecutionPhase, Stock } from '@/data/types'
import type { StandardEnvelope } from '@/core/envelope'
import { EnvelopeFactory } from '@/core/envelope'
import { dataBridge } from '@/core/databridge'
import { createBuyOrder, createSellOrder } from '@/services/trading/tradingService'
import { createExecutionPlanUseCase } from '@/services/useCase/createExecutionPlan.useCase'

import { nanoid } from 'nanoid'
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
  /** 通过 DataBridge 全量刷新 */
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
      logger.info('[executionStore] refresh 开始', { source: MODULE_ID.tradinghub, store: STORE_NAME.executionPlans, action: ENVELOPE_ACTION.queryList })
      const result = await dataBridge.query<ExecutionPlan[]>({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.executionPlans,
        source: MODULE_ID.tradinghub,
      })
      logger.info('[executionStore] refresh DataBridge.query 返回', { success: result.success, count: Array.isArray(result.data) ? result.data.length : 0, error: result.error })

      if (!result.success) {
        const errorMessage = result.error ?? '查询执行计划列表失败'
        logger.error(`[executionStore] refresh 查询失败: ${errorMessage}`)
        throw new Error(errorMessage)
      }

      const plans = result.data ?? []
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

      logger.info('[executionStore] confirmPlan 调用 forwardUpdateExecutionPlan', { planId, targetPhase: 'confirmed' })
      await forwardUpdateExecutionPlan(planId, { phase: 'confirmed', confirmedAt: Date.now() })

      set((state) => {
        const newPlans = state.plans.map((p) => (p.id === planId ? updated : p))
        return {
          plans: newPlans,
          activePlans: computeActivePlans(newPlans),
          lastUpdated: Date.now(),
        }
      })

      logger.info('[executionStore] confirmPlan 本地状态已更新', { planId, newPhase: get().plans[0]?.phase })
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
      logger.info('[executionStore] executePlan 开始执行', { planId, symbol: plan.symbol, direction: plan.direction, phase: plan.phase })

      // 等待 orderStore 刷新完成，确保读取到最新持仓数据用于仓位计算
      logger.info('[executionStore] executePlan 等待 orderStore 刷新完成', { planId })
      await refreshCoordinator.waitFor('orderStore')
      logger.info('[executionStore] executePlan orderStore 刷新已完成', { planId })

      // 1. phase -> pending
      logger.info('[executionStore] executePlan phase -> pending', { planId })
      const pendingPlan: ExecutionPlan = { ...plan, phase: 'pending' }
      await forwardUpdateExecutionPlan(planId, { phase: 'pending' })

      set((state) => {
        const newPlans = state.plans.map((p) => (p.id === planId ? pendingPlan : p))
        return { plans: newPlans, activePlans: computeActivePlans(newPlans) }
      })
      logger.info('[executionStore] executePlan 本地状态已更新为 pending', { planId })

      // 2. 获取股票信息
      logger.info('[executionStore] executePlan 查询股票信息', { planId, symbol: plan.symbol })
      const stockResult = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: plan.symbol,
        source: MODULE_ID.tradinghub,
      })

      if (!stockResult.success) {
        const errorMessage = stockResult.error ?? `查询股票 ${plan.symbol} 失败`
        logger.error(`[executionStore] executePlan 查询股票失败: ${errorMessage}`, { planId, symbol: plan.symbol })
        throw new Error(errorMessage)
      }

      const stock = stockResult.data
      logger.info('[executionStore] executePlan 股票信息查询成功', { planId, symbol: plan.symbol, price: stock?.price })
      if (stock?.price === undefined || stock.price <= 0) {
        throw new Error(`股票 ${plan.symbol} 价格无效`)
      }

      // 3. 根据 direction 调用 tradingService
      const quantity = plan.sizing?.quantity ?? 100
      logger.info('[executionStore] executePlan 调用 tradingService', { planId, direction: plan.direction, quantity })
      let orderResult

      if (plan.direction === 'buy') {
        orderResult = await createBuyOrder(stock, quantity)
      } else {
        orderResult = await createSellOrder(stock, quantity)
      }

      logger.info('[executionStore] executePlan tradingService 返回', { planId, success: orderResult.success, error: orderResult.error })

      // 4. 处理结果
      if (orderResult.success && orderResult.data) {
        logger.info('[executionStore] executePlan 下单成功，准备更新为 executed', { planId, orderId: orderResult.data.id })
        const executedPlan: ExecutionPlan = {
          ...pendingPlan,
          phase: 'executed',
          orderId: orderResult.data.id,
          executedAt: Date.now(),
          result: 'success',
        }
        await forwardUpdateExecutionPlan(planId, {
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
        logger.warn('[executionStore] executePlan 下单失败，准备更新为 cancelled', { planId, error: orderResult.error })
        const cancelledPlan: ExecutionPlan = {
          ...pendingPlan,
          phase: 'cancelled',
          executedAt: Date.now(),
          result: 'failed',
          errorMessage: orderResult.error ?? '下单失败',
        }
        await forwardUpdateExecutionPlan(planId, {
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

        logger.warn('[executionStore] executePlan 下单失败状态已更新', {
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
        await forwardUpdateExecutionPlan(planId, {
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

      logger.info('[executionStore] cancelPlan 调用 forwardUpdateExecutionPlan', { planId, targetPhase: 'cancelled', reason: reason ?? DEFAULT_CANCEL_REASON })
      await forwardUpdateExecutionPlan(planId, {
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

      logger.info('[executionStore] cancelPlan 本地状态已更新', { planId, newPhase: get().plans[0]?.phase })
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

      logger.info('[executionStore] markReviewed 调用 forwardUpdateExecutionPlan', { planId, targetPhase: 'reviewed' })
      await forwardUpdateExecutionPlan(planId, {
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

      logger.info('[executionStore] markReviewed 本地状态已更新', { planId, newPhase: get().plans[0]?.phase })
      logger.info('[executionStore] markReviewed 成功', { planId })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[executionStore] markReviewed 失败', { error: message, planId })
      set({ error: message })
    }
  },
}))

// ============================================================
// DataBridge 写操作辅助函数
// ============================================================

/**
 * 通过 DataBridge 转发执行计划更新。
 * 将 updates 合并到 Store 中现有的 plan 后发送 updateExecutionPlan envelope。
 * 与 dataLayer.executionPlans.update() 语义对齐，确保 updatedAt 刷新。
 */
async function forwardUpdateExecutionPlan(
  planId: string,
  updates: Partial<ExecutionPlan>,
): Promise<void> {
  logger.info('[executionStore] forwardUpdateExecutionPlan 开始', { planId, updatesKeys: Object.keys(updates) })

  const { plans } = useExecutionStore.getState()
  logger.debug('[executionStore] forwardUpdateExecutionPlan 当前 plans 快照', { planCount: plans.length, planIds: plans.map((p) => p.id) })

  const existing = plans.find((p) => p.id === planId)
  if (!existing) {
    logger.error('[executionStore] forwardUpdateExecutionPlan 失败: 计划不存在', { planId })
    throw new Error(`执行计划 ${planId} 不存在`)
  }

  const updated: ExecutionPlan = {
    ...existing,
    ...updates,
    id: planId,
    updatedAt: Date.now(),
  }
  logger.debug('[executionStore] forwardUpdateExecutionPlan 合并后 plan', {
    planId,
    oldPhase: existing.phase,
    newPhase: updated.phase,
    updatedAt: updated.updatedAt,
  })

  const envelope = EnvelopeFactory.create(
    {
      action: ENVELOPE_ACTION.updateExecutionPlan,
      source: MODULE_ID.tradinghub,
      target: ENVELOPE_TARGET.db,
      traceId: `execution-store-${nanoid(8)}`,
    },
    updated,
  )

  logger.info('[executionStore] forwardUpdateExecutionPlan envelope 已创建', {
    planId,
    action: envelope.meta.action,
    traceId: envelope.meta.traceId,
  })

  await dataBridge.forward(envelope)

  logger.info('[executionStore] forwardUpdateExecutionPlan DataBridge.forward 完成', { planId, traceId: envelope.meta.traceId })
}

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
