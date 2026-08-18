/**
 * @module disciplineStore
 * @lifecycle @Global
 * @description 交易纪律与复盘报告 Store。
 * 包装 tradeReviewAI 服务，响应订单变更自动重算纪律评分与复盘报告，
 * 并将复盘摘要持久化到 trade_reviews store。
 *
 * @see docs/reference/v9核心数据字典与类型定义(整合版).md — DisciplineState 实体定义（#69）
 * 原文档（功能模块数据契约、v9-system-blueprint）已归档至 archive/historical-2026-08-16/batch7/
 * @see src/services/trading/tradeReviewAI.ts — AI 交易复盘服务
 * @see src/services/trading/tradeErrorClassifier.ts — 交易错误分类器
 *
 * @compliance
 * - isRefreshing 锁防止并发重算
 * - 失败时快照回滚，保留旧复盘数据不被清空
 * - 写操作通过 dataBridge.forward() 走信封协议
 * - 订阅 STORE_NAME.orders 频道，source 过滤防自激，100ms 去抖合并
  * @doc [V9-DOC-ARCH-010, V9-DOC-PROJ-118, V9-DOC-DATA-032, V9-DOC-DATA-031, V9-DOC-DATA-076]
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
import { useOrderStore } from './orderStore'
import {
  generateReview,
  generateReviewAsync,
  type TradeError,
  type TradeReviewRecord,
  type TradeReviewReport,
  type PsychologicalProfile,
} from '@/services/trading/tradeReviewAI'
import { classifyErrors } from '@/services/trading/tradeErrorClassifier'
import { setOrderDataSource, setTradeReviewScoreCalculator, getTradeReviewScoreCalculator, RealTradeReviewScoreCalculator } from '@/services/trading/tradeReviewScoring'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

import { nanoid } from 'nanoid'
const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export interface DisciplineState {
  /** 最新复盘报告 */
  latestReport: TradeReviewReport | null
  /** 交易错误列表（由错误分类器检测出的全部错误实例） */
  tradeErrors: TradeError[]
  /** 纪律评分 */
  disciplineScore: number
  /** 真实订单驱动的交易表现分（RealTradeReviewScoreCalculator，独立于 disciplineScore 语义） */
  realDisciplineScore: number
  /** 技能发展路径标题列表 */
  skillRoadmap: string[]
  /** 心理画像 */
  psychologicalProfile: PsychologicalProfile | null

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
   * 根据订单列表重新计算复盘报告与纪律评分。
   * 未传入 orders 时，先调用 orderStore.refresh() 再读取全部订单。
   */
  recalculate: (orders?: Order[]) => Promise<void>
  /**
   * 从 trade_reviews store 读取已持久化的复盘结果。
   */
  refresh: () => Promise<void>
  /**
   * 重置 store 到初始空状态。
   */
  reset: () => void
  /** 加载全部交易记录（委托给 orderStore.refresh，避免页面直接调用 dataLayer） */
  loadOrders: () => Promise<Order[]>
  /** 同步生成交易复盘报告（封装 generateReview，避免页面直接调用 Service） */
  generateReviewReport: (orders: Order[]) => TradeReviewReport
}

// ============================================================
// 初始状态
// ============================================================

const initialState: Omit<
  DisciplineState,
  'recalculate' | 'refresh' | 'reset' | 'loadOrders' | 'generateReviewReport'
> = {
  latestReport: null,
  tradeErrors: [],
  disciplineScore: 100,
  realDisciplineScore: 0,
  skillRoadmap: [],
  psychologicalProfile: null,
  loading: true,
  error: null,
  isRefreshing: false,
  lastUpdated: 0,
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 从复盘报告中提取需要独立维护的派生字段。
 */
function extractReviewDerived(report: TradeReviewReport) {
  return {
    disciplineScore: report.summary.disciplineScore,
    skillRoadmap: report.skillDevelopment.learningPath.map((node) => node.title),
    psychologicalProfile: report.errorAnalysis.psychologicalProfile,
  }
}

// ============================================================
// Store
// ============================================================

/**
 * useDisciplineStore
 */
export const useDisciplineStore = create<DisciplineState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ----------------------------------------------------------
    // recalculate —— 重新计算复盘报告
    // ----------------------------------------------------------

    /**
     * 重新计算交易复盘报告。
     *
     * @remarks
     * - 具备 isRefreshing 并发锁，防止重复调用
     * - 未传入 orders 时，先触发 orderStore.refresh() 获取最新订单
     * - 调用 tradeReviewAI.generateReviewAsync(orders) 生成报告
     * - 提取关键派生字段并持久化报告摘要到 trade_reviews store
     * - 失败时回滚到旧快照，仅更新 error / loading 状态
     */
    recalculate: async (orders?: Order[]) => {
      const state = get()

      // 并发锁：已在重算中则跳过
      if (state.isRefreshing) {
        logger.debug('[disciplineStore] recalculate skipped: isRefreshing is true')
        return
      }

      // 保存旧数据快照，用于失败回滚
      const snapshot = {
        latestReport: state.latestReport,
        tradeErrors: state.tradeErrors,
        disciplineScore: state.disciplineScore,
        realDisciplineScore: state.realDisciplineScore,
        skillRoadmap: state.skillRoadmap,
        psychologicalProfile: state.psychologicalProfile,
        lastUpdated: state.lastUpdated,
      }

      set({
        isRefreshing: true,
        loading: state.latestReport === null,
        error: null,
      })

      try {
        logger.info('[disciplineStore] recalculate 开始')

        let targetOrders = orders
        if (!targetOrders) {
          // 通过 RefreshCoordinator 等待 orderStore 刷新完成，
          // 避免 orderStore 正在刷新时 disciplineStore 读到过期数据
          await refreshCoordinator.waitFor('orderStore')
          await useOrderStore.getState().refresh()
          targetOrders = useOrderStore.getState().orders
        }

        logger.info(`[disciplineStore] 生成复盘报告: 订单数=${targetOrders.length}`)
        const report = await generateReviewAsync(targetOrders)
        const derived = extractReviewDerived(report)

        // 同步执行错误分类，获取完整 DetectedError 列表用于独立状态与持久化
        const classification = classifyErrors(targetOrders)

        // 真实订单驱动的交易表现分（独立语义，不覆盖 disciplineScore）
        const realScore = getTradeReviewScoreCalculator().calculateDisciplineScore()

        // 持久化复盘摘要
        const record: TradeReviewRecord = {
          id: 'latest',
          generatedAt: report.generatedAt,
          report,
          tradeErrors: classification.errors,
          ...derived,
          realDisciplineScore: realScore,
        }

        try {
          await dataBridge.forward(
            EnvelopeFactory.create(
              {
                source: MODULE_ID.tradeReviews,
                target: ENVELOPE_TARGET.db,
                action: ENVELOPE_ACTION.saveTradeReview,
                traceId: `discipline-save-${nanoid(8)}`,
              },
              record,
            ),
          )
          logger.info('[disciplineStore] 复盘摘要已持久化')
        } catch (err) {
          const saveMessage = err instanceof Error ? err.message : String(err)
          logger.warn('[disciplineStore] 复盘摘要持久化失败', { error: saveMessage })
        }

        set({
          latestReport: report,
          tradeErrors: classification.errors,
          ...derived,
          realDisciplineScore: realScore,
          loading: false,
          error: null,
          isRefreshing: false,
          lastUpdated: Date.now(),
        })

        logger.info('[disciplineStore] recalculate 完成', {
          disciplineScore: derived.disciplineScore,
          realDisciplineScore: realScore,
          totalTrades: report.summary.totalTrades,
        })
        // 复盘脉搏广播：LoopBanner 等下游依赖 DISCIPLINE_CHANGED 感知复盘阶段活性
        withBroadcast(EVENT_NAMES.DISCIPLINE_CHANGED, {
          action: 'recalculate',
          disciplineScore: derived.disciplineScore,
          realDisciplineScore: realScore,
          totalTrades: report.summary.totalTrades,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('[disciplineStore] recalculate 失败，回滚到旧快照', { error: message })

        set({
          ...snapshot,
          loading: false,
          error: message,
          isRefreshing: false,
        })
      }
    },

    // ----------------------------------------------------------
    // refresh —— 从持久化存储恢复复盘结果
    // ----------------------------------------------------------

    /**
     * 从 trade_reviews store 读取最新复盘记录并恢复状态。
     *
     * @remarks
     * - 具备 isRefreshing 并发锁
     * - 失败时保留旧数据快照，仅更新 error / loading 状态
     */
    refresh: async () => {
      const state = get()

      // 并发锁
      if (state.isRefreshing) {
        logger.debug('[disciplineStore] refresh skipped: isRefreshing is true')
        return
      }

      const snapshot = {
        latestReport: state.latestReport,
        tradeErrors: state.tradeErrors,
        disciplineScore: state.disciplineScore,
        realDisciplineScore: state.realDisciplineScore,
        skillRoadmap: state.skillRoadmap,
        psychologicalProfile: state.psychologicalProfile,
        lastUpdated: state.lastUpdated,
      }

      set({
        isRefreshing: true,
        loading: state.latestReport === null,
        error: null,
      })

      try {
        logger.info('[disciplineStore] refresh 开始')
        const queryResult = await dataBridge.query<TradeReviewRecord | null>({
          action: ENVELOPE_ACTION.queryGet,
          store: STORE_NAME.tradeReviews,
          source: MODULE_ID.tradeReviews,
          key: 'latest',
        })
        if (!queryResult.success) {
          throw new Error(queryResult.error ?? '读取复盘记录失败')
        }
        const record = queryResult.data ?? null

        if (!record) {
          logger.info('[disciplineStore] 未找到已持久化的复盘记录')
          set({
            loading: false,
            error: null,
            isRefreshing: false,
          })
          return
        }

        set({
          latestReport: record.report,
          tradeErrors: record.tradeErrors,
          disciplineScore: record.disciplineScore,
          realDisciplineScore: record.realDisciplineScore ?? 0,
          skillRoadmap: record.skillRoadmap,
          psychologicalProfile: record.psychologicalProfile,
          loading: false,
          error: null,
          isRefreshing: false,
          lastUpdated: record.generatedAt,
        })

        logger.info('[disciplineStore] refresh 完成', {
          disciplineScore: record.disciplineScore,
          realDisciplineScore: record.realDisciplineScore ?? 0,
          generatedAt: record.generatedAt,
        })
        // 复盘脉搏广播：仅在有持久化记录恢复时广播；无记录/失败路径不广播
        withBroadcast(EVENT_NAMES.DISCIPLINE_CHANGED, {
          action: 'refresh',
          disciplineScore: record.disciplineScore,
          realDisciplineScore: record.realDisciplineScore ?? 0,
          generatedAt: record.generatedAt,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('[disciplineStore] refresh 失败，回滚到旧快照', { error: message })

        set({
          ...snapshot,
          loading: false,
          error: message,
          isRefreshing: false,
        })
      }
    },

    // ----------------------------------------------------------
    // reset —— 重置
    // ----------------------------------------------------------

    reset: () => {
      logger.info('[disciplineStore] reset')
      set({ ...initialState })
      withBroadcast(EVENT_NAMES.DISCIPLINE_CHANGED, { action: 'reset' })
    },

    loadOrders: async () => {
      logger.info('[disciplineStore] loadOrders 开始（委托给 orderStore）')
      try {
        await useOrderStore.getState().refresh()
        const orders = useOrderStore.getState().orders
        logger.info(`[disciplineStore] loadOrders 完成: ${orders.length} 笔`)
        return orders
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`[disciplineStore] loadOrders 异常: ${message}`)
        throw err
      }
    },

    generateReviewReport: (orders) => {
      logger.info(`[disciplineStore] generateReviewReport 开始: ${orders.length} 笔`)
      try {
        const report = generateReview(orders)
        const derived = extractReviewDerived(report)
        const realScore = getTradeReviewScoreCalculator().calculateDisciplineScore()
        set({
          latestReport: report,
          ...derived,
          realDisciplineScore: realScore,
          loading: false,
          error: null,
          lastUpdated: Date.now(),
        })
        logger.info('[disciplineStore] generateReviewReport 完成，latestReport 已更新')
        return report
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`[disciplineStore] generateReviewReport 异常: ${message}`)
        throw err
      }
    },
  })),
)

// 将实时订单快照读取器注入交易复盘评分计算器（tradeReviewScoring 为引擎层，禁止直接依赖 store 层；
// 此处由 store 层反向注入，满足「引擎层禁止直接依赖 store 层」架构约束，v34 复盘评分真实化）。
setOrderDataSource(() => useOrderStore.getState().orders)
// 复盘评分真实化落地：将真实订单驱动的计算器设为生产默认激活实现（与默认行为一致，此处显式激活便于追溯）。
setTradeReviewScoreCalculator(new RealTradeReviewScoreCalculator())

// ============================================================
// DataBridge 订阅生命周期
// ============================================================

/** 本模块 source 标识，用于订阅时 source 过滤，防止自激 */
const DISCIPLINE_STORE_SOURCE = MODULE_ID.tradeReviews

/** 去抖合并窗口（毫秒）：短时间内多次变更合并为一次 recalculate */
const DEBOUNCE_MS = 100

let _unsubscribeOrders: (() => void) | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

/** 需要触发重算的订单相关 action 集合 */
const _ORDER_CHANGE_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertOrder,
  ENVELOPE_ACTION.updateOrder,
  ENVELOPE_ACTION.deleteOrder,
  ENVELOPE_ACTION.tradeActionExecuted,
])

/**
 * 去抖执行 recalculate，100ms 内多次调用合并为一次。
 */
function _debouncedRecalculate(envelope: StandardEnvelope): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
  }
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null
      logger.info('[disciplineStore] Debounced recalculate triggered', {
        traceId: envelope.meta.traceId,
        action: envelope.meta.action,
        source: envelope.meta.source,
      })
      void useDisciplineStore.getState().recalculate()
    }, DEBOUNCE_MS)
}

/**
 * 初始化 DisciplineStore 的 DataBridge 订阅。
 *
 * 订阅 STORE_NAME.orders 频道，监听以下 action 并触发去抖动重算：
 * - insertOrder
 * - updateOrder
 * - deleteOrder
 * - tradeActionExecuted
 *
 * 同时做 source 过滤：跳过 source 为 'trading' 的事件，防止自激。
 *
 * @returns 清理函数，调用后取消所有订阅并清理定时器
/**
 * initDisciplineStoreSubscriptions
 */
export function initDisciplineStoreSubscriptions(): () => void {
  if (_unsubscribeOrders) {
    logger.warn('[disciplineStore] Subscriptions already initialized, skipping')
    return _unsubscribeOrders
  }

  _unsubscribeOrders = dataBridge.subscribe(
    STORE_NAME.orders,
    (envelope) => {
      // source 过滤：跳过本模块发出的事件，防止自激
      if (envelope.meta.source === DISCIPLINE_STORE_SOURCE) {
        return
      }

      if (_ORDER_CHANGE_ACTIONS.has(envelope.meta.action)) {
        logger.info('[disciplineStore] DataBridge orders event, scheduling debounced recalculate', {
          action: envelope.meta.action,
          traceId: envelope.meta.traceId,
          source: envelope.meta.source,
        })
        _debouncedRecalculate(envelope)
      }
    },
  )

  logger.info('[disciplineStore] DataBridge orders subscriptions initialized')

  /** 清理函数：取消订阅 + 清除去抖定时器 */
  return () => {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
    _unsubscribeOrders?.()
    _unsubscribeOrders = null
    logger.info('[disciplineStore] DataBridge subscriptions destroyed')
  }
}
