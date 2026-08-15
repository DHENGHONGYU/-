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
 * @see docs/reference/v9核心数据字典与类型定义(整合版).md
 * 原文档（功能模块数据契约、v9-system-blueprint、databridge端点与数据映射清单、v9-架构缺陷与整改行动清单）已归档至 archive/historical-2026-08-16/batch7/
  * @doc [V9-DOC-PROJ-068, V9-DOC-ARCH-010, V9-DOC-PROJ-118, V9-DOC-DATA-031, V9-DOC-DATA-032]
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
} from '@/config/dbConfig'
import type { Signal, ExecutionPlan, ExecutionPhase, Stock } from '@/data/types'
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
  /** 重置 store 到初始空状态。用于登出/切换账户等场景，清除执行计划残留 */
  reset: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState: Omit<
  ExecutionState,
  'createPlan' | 'confirmPlan' | 'executePlan' | 'cancelPlan' | 'markReviewed' | 'refresh' | 'reset'
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
// executePlan 子步骤辅助函数（PR-6 阶段 3.1 内部优化）
// ============================================================

/**
 * 查询股票信息并校验价格有效性
 * @throws Error 若查询失败或价格无效
 */
async function queryStockForExecution(symbol: string, planId: string): Promise<Stock> {
  logger.info('[executionStore] executePlan 查询股票信息', { planId, symbol })
  const stockResult = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: symbol,
    source: MODULE_ID.tradinghub,
  })

  if (!stockResult.success) {
    const errorMessage = stockResult.error ?? `查询股票 ${symbol} 失败`
    logger.error(`[executionStore] executePlan 查询股票失败: ${errorMessage}`, { planId, symbol })
    throw new Error(errorMessage)
  }

  const stock = stockResult.data
  logger.info('[executionStore] executePlan 股票信息查询成功', { planId, symbol, price: stock?.price })
  if (stock?.price === undefined || stock.price <= 0) {
    throw new Error(`股票 ${symbol} 价格无效`)
  }
  return stock
}

/**
 * 根据执行计划方向调用 tradingService 下单
 */
async function placeOrderForPlan(plan: ExecutionPlan, stock: Stock) {
  const quantity = plan.sizing?.quantity ?? 100
  logger.info('[executionStore] executePlan 调用 tradingService', {
    planId: plan.id,
    direction: plan.direction,
    quantity,
  })

  const orderResult = plan.direction === 'buy'
    ? await createBuyOrder(stock, quantity)
    : await createSellOrder(stock, quantity)

  logger.info('[executionStore] executePlan tradingService 返回', {
    planId: plan.id,
    success: orderResult.success,
    error: orderResult.error,
  })
  return orderResult
}

/**
 * 统一处理执行计划的 phase 状态转换：
 * 1. 构造新 plan 对象
 * 2. 通过 DataBridge 持久化（forwardUpdateExecutionPlan）
 * 3. 更新本地 Store 状态（plans + activePlans + lastUpdated）
 */
async function transitionPlanPhase(
  planId: string,
  basePlan: ExecutionPlan,
  targetPhase: ExecutionPhase,
  extraFields?: Partial<ExecutionPlan>,
): Promise<void> {
  const updatedPlan: ExecutionPlan = { ...basePlan, ...extraFields, phase: targetPhase }

  await forwardUpdateExecutionPlan(planId, { ...extraFields, phase: targetPhase })

  useExecutionStore.setState((state) => {
    const newPlans = state.plans.map((p) => (p.id === planId ? updatedPlan : p))
    return {
      plans: newPlans,
      activePlans: computeActivePlans(newPlans),
      lastUpdated: Date.now(),
    }
  })
}

/**
 * 根据下单结果转换执行计划 phase。
 */
async function finalizeExecution(
  planId: string,
  plan: ExecutionPlan,
  orderResult: Awaited<ReturnType<typeof placeOrderForPlan>>,
): Promise<void> {
  if (orderResult.success && orderResult.data) {
    await transitionPlanPhase(planId, plan, 'executed', {
      orderId: orderResult.data.id,
      executedAt: Date.now(),
      result: 'success',
    })
    logger.info('[executionStore] executePlan 成功', { planId, orderId: orderResult.data.id })
  } else {
    await transitionPlanPhase(planId, plan, 'cancelled', {
      executedAt: Date.now(),
      result: 'failed',
      errorMessage: orderResult.error ?? '下单失败',
    })
    logger.warn('[executionStore] executePlan 下单失败', { planId, error: orderResult.error })
  }
}

/**
 * 异常后将执行计划转为 cancelled。
 */
async function transitionToCancelledOnError(planId: string, plan: ExecutionPlan, message: string): Promise<void> {
  try {
    await transitionPlanPhase(planId, plan, 'cancelled', {
      executedAt: Date.now(),
      result: 'failed',
      errorMessage: message,
    })
  } catch (updateErr) {
    logger.error('[executionStore] executePlan 异常后更新状态也失败', { error: updateErr })
  }
}

// ============================================================
// Store
// ============================================================

/**
 * useExecutionStore
 */
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
        logger.error(`[executionStore] refresh 查询失败: ${errorMessage}`, { errorMessage })
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
  // 编排逻辑：refreshCoordinator 等待 → pending → 查询股票 → 下单 → executed/cancelled
  // ----------------------------------------------------------

  executePlan: async (planId) => {
    logger.info('[executionStore] executePlan', { planId })

    // ─── 入口校验 ───
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

    set({ isProcessing: true, error: null })

    try {
      // 等待 orderStore 刷新完成，确保读取到最新持仓数据用于仓位计算
      await refreshCoordinator.waitFor('orderStore')

      // 1. phase -> pending
      await transitionPlanPhase(planId, plan, 'pending')

      // 2. 查询股票信息（内部校验价格有效性）
      const stock = await queryStockForExecution(plan.symbol, planId)

      // 3. 调用 tradingService 下单
      const orderResult = await placeOrderForPlan(plan, stock)

      // 4. 根据下单结果转换 phase
      await finalizeExecution(planId, plan, orderResult)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[executionStore] executePlan 异常', { error: message, planId })
      await transitionToCancelledOnError(planId, plan, message)
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

  // ----------------------------------------------------------
  // reset -- 重置到初始空状态
  // ----------------------------------------------------------

  /**
   * 重置 store 到初始空状态。
   * 清除全部执行计划、活跃计划、处理中标记。
   * 用于登出/切换账户/重新初始化等场景。
   */
  reset: () => {
    logger.info('[executionStore] reset')
    set({ ...initialState })
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
