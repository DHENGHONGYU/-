/**
 * @module signalQualityStore
 * @lifecycle @Global
 * @description 信号质量复盘状态管理。管理信号准确率、择时得分、最大回撤、Sharpe 等
 * 绩效指标，提供复盘数据加载和 DataBridge 订阅。
 *
 * @status 当前无 UI 消费方。经补充验证（2026-07-06）确认：
 * 1. 与 outputStore 零数据交互，outputStore 是纯导出工具 Store
 * 2. OutputApp 子页面（TradeReviewPage/ResearchReportPage/OutputHubPage）均不引用此 Store
 * 3. TradeReviewPage 使用 disciplineStore + tradeReviewAI（基于订单的纪律复盘），
 *    与本 Store（基于信号的准确率复盘）是不同维度的复盘体系，数据模型不兼容
 * 4. SIGNAL_QUALITY_CHANGED 事件零订阅者
 * 5. initSignalQualityStoreSubscriptions() 从未被调用，无自动更新机制
 *
 * 保留以备未来**信号质量复盘面板**（如 SignalQualityDashboard）使用。
 * 注意：与现有 TradeReviewPage（基于 disciplineStore 的订单复盘）是不同维度的复盘体系，不可混淆。
 * 删除前需确认未来无信号准确率复盘可视化需求。
 *
 * @see 补充验证报告（2026-07-06）：见上方 JSDoc 注释 1-5 条
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME, type EnvelopeAction } from '@/config/dbConfig'
import type { Signal } from '@/data/types'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 信号质量指标 */
export interface SignalQualityMetrics {
  /** 信号总数 */
  totalSignals: number
  /** 已实现信号数（有后续价格数据） */
  realizedSignals: number
  /** 准确率（0-1）：信号方向与实际走势一致的比例 */
  accuracy: number
  /** 择时得分（0-100）：基于信号发出时机与实际拐点的时间差 */
  timingScore: number
  /** 最大回撤（0-1，负值表示亏损） */
  maxDrawdown: number
  /** Sharpe 比率 */
  sharpeRatio: number
  /** 平均持仓天数 */
  avgHoldingDays: number
  /** 胜率（0-1） */
  winRate: number
  /** 盈亏比 */
  profitLossRatio: number
}

/** 单个信号的复盘记录 */
export interface SignalReviewRecord {
  signalId: string
  symbol: string
  direction: 'buy' | 'sell' | 'hold' | 'watch'
  type: string
  confidence: number
  issuedAt: number
  /** 信号发出后 N 日的实际走势 */
  actualReturn?: number
  /** 信号是否正确 */
  correct?: boolean
  /** 持仓天数 */
  holdingDays?: number
  /** 盈亏百分比 */
  pnlPercent?: number
}

// ============================================================
// Store 接口
// ============================================================

interface SignalQualityState {
  /** 质量指标 */
  metrics: SignalQualityMetrics | null
  /** 复盘记录列表 */
  reviews: SignalReviewRecord[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳 */
  lastUpdated: number

  // Actions
  /** 加载复盘数据 */
  loadReviews: () => Promise<void>
  /** 重新计算质量指标 */
  recalculateMetrics: () => void
}

// ============================================================
// 辅助函数
// ============================================================

function calculateMetrics(reviews: SignalReviewRecord[]): SignalQualityMetrics {
  const totalSignals = reviews.length
  const realizedReviews = reviews.filter((r) => r.actualReturn !== undefined)
  const realizedSignals = realizedReviews.length

  if (realizedSignals === 0) {
    return {
      totalSignals,
      realizedSignals: 0,
      accuracy: 0,
      timingScore: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      avgHoldingDays: 0,
      winRate: 0,
      profitLossRatio: 0,
    }
  }

  // 准确率
  const correctCount = realizedReviews.filter((r) => r.correct).length
  const accuracy = correctCount / realizedSignals

  // 过滤 pnlPercent 非空的记录，用于胜率/盈亏比/回撤/Sharpe 计算
  const pnlReviews = realizedReviews.filter((r) => r.pnlPercent != null)
  const pnlMissingCount = realizedSignals - pnlReviews.length
  if (pnlMissingCount > 0) {
    logger.warn('[SignalQuality] pnlPercent 缺失', { missingCount: pnlMissingCount, totalCount: realizedSignals })
  }

  // 胜率（基于有 pnlPercent 的记录）
  const pnlBase = pnlReviews.length > 0 ? pnlReviews : realizedReviews
  const winningTrades = pnlBase.filter((r) => (r.pnlPercent as number) > 0).length
  const winRate = winningTrades / pnlBase.length

  // 盈亏比
  const avgWin =
    pnlBase.filter((r) => (r.pnlPercent as number) > 0).reduce((sum, r) => sum + (r.pnlPercent as number), 0) /
    Math.max(winningTrades, 1)
  const losingTrades = pnlBase.filter((r) => (r.pnlPercent as number) < 0)
  const avgLoss =
    Math.abs(
      losingTrades.reduce((sum, r) => sum + (r.pnlPercent as number), 0) /
        Math.max(pnlBase.length - winningTrades, 1),
    )
  const profitLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0

  // 平均持仓天数（过滤 null 值）
  const holdingDaysReviews = realizedReviews.filter((r) => r.holdingDays != null)
  const holdingDaysMissing = realizedSignals - holdingDaysReviews.length
  if (holdingDaysMissing > 0) {
    logger.warn('[SignalQuality] holdingDays 缺失', { missingCount: holdingDaysMissing, totalCount: realizedSignals })
  }
  const holdingDaysList = holdingDaysReviews.map((r) => r.holdingDays as number)
  const avgHoldingDays = holdingDaysList.length > 0
    ? holdingDaysList.reduce((sum, d) => sum + d, 0) / holdingDaysList.length
    : 0

  // 最大回撤（简化计算：取最小 pnlPercent）
  const pnlValues = pnlBase.map((r) => r.pnlPercent as number)
  const maxDrawdown = pnlValues.length > 0 ? Math.min(0, ...pnlValues) / 100 : 0

  // Sharpe 比率（简化：假设无风险利率为 0）
  const returns = pnlValues.map((p) => p / 100)
  const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0
  const stdDev = returns.length > 0
    ? Math.sqrt(returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length)
    : 0
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0

  // 择时得分（简化：基于信号置信度与实际收益的相关性）
  const timingScore = Math.min(100, accuracy * 100 * 0.7 + winRate * 100 * 0.3)

  return {
    totalSignals,
    realizedSignals,
    accuracy,
    timingScore,
    maxDrawdown,
    sharpeRatio,
    avgHoldingDays,
    winRate,
    profitLossRatio,
  }
}

// ============================================================
// Store
// ============================================================

/**
 * useSignalQualityStore
 */
export const useSignalQualityStore = create<SignalQualityState>((set, get) => ({
  metrics: null,
  reviews: [],
  loading: false,
  error: null,
  lastUpdated: 0,

  loadReviews: async () => {
    logger.info('[signalQualityStore] loadReviews 开始')
    set({ loading: true, error: null })

    try {
      // 从 signals 表加载历史信号
      const result = await dataBridge.query<Signal[]>({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.signals,
        source: MODULE_ID.analyzer,
      })

      if (!result.success) {
        const errorMessage = result.error ?? '查询信号列表失败'
        logger.error(`[signalQualityStore] loadReviews 查询失败: ${errorMessage}`)
        throw new Error(errorMessage)
      }

      const signals = result.data ?? []
      logger.info(`[signalQualityStore] 加载到 ${signals.length} 个信号`)

      // 转换为复盘记录（简化：实际应查询后续价格数据）
      const reviews: SignalReviewRecord[] = signals.map((signal: Signal) => ({
        signalId: signal.id,
        symbol: signal.symbol,
        direction: signal.direction,
        type: signal.type,
        confidence: signal.confidence,
        issuedAt: signal.createdAt,
        // 实际应查询信号发出后的价格数据，此处留空
        actualReturn: undefined,
        correct: undefined,
        holdingDays: undefined,
        pnlPercent: undefined,
      }))

      set({
        reviews,
        loading: false,
        lastUpdated: Date.now(),
      })

      // 自动计算指标
      get().recalculateMetrics()

      logger.info(`[signalQualityStore] loadReviews 完成: ${reviews.length} 条记录`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[signalQualityStore] loadReviews 失败: ${message}`)
      set({ loading: false, error: message })
    }
  },

  recalculateMetrics: () => {
    const { reviews } = get()
    const metrics = calculateMetrics(reviews)
    logger.info('[signalQualityStore] recalculateMetrics 完成', {
      accuracy: metrics.accuracy.toFixed(2),
      winRate: metrics.winRate.toFixed(2),
      sharpeRatio: metrics.sharpeRatio.toFixed(2),
    })
    set({ metrics })
    withBroadcast(EVENT_NAMES.SIGNAL_QUALITY_CHANGED, { action: 'recalculateMetrics' })
  },
}))

// ============================================================
// 派生查询（从 .derived.ts 统一导出，含 memoizeByRef 缓存优化）
// 设计原则：派生查询独立函数模式，通过 getState() 访问状态，不存入 State
// 原 Store 中的 reviewsBySymbol/topSignalTypes 已由 .derived.ts 的缓存版本替代
// ============================================================
export * from './signalQualityStore.derived'

// ============================================================
// DataBridge 订阅
// ============================================================

let _unsubscribeSignals: (() => void) | null = null

const QUALITY_RELEVANT_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertSignal,
])

/** 初始化 DataBridge 订阅，返回 cleanup 函数 */
export function initSignalQualityStoreSubscriptions(): () => void {
  if (_unsubscribeSignals) {
    logger.warn('[signalQualityStore] Subscriptions already initialized')
    return () => destroySignalQualityStoreSubscriptions()
  }

  _unsubscribeSignals = dataBridge.subscribe(
    'signals',
    (envelope) => {
      if (envelope.meta.source === MODULE_ID.trading || envelope.meta.source === MODULE_ID.tradinghub) {
        return
      }
      if (QUALITY_RELEVANT_ACTIONS.has(envelope.meta.action)) {
        logger.info('[signalQualityStore] DataBridge event on signals channel', {
          action: envelope.meta.action,
          traceId: envelope.meta.traceId,
        })
        // 信号变更时，重新加载复盘数据
        void useSignalQualityStore.getState().loadReviews()
      }
    },
  )

  logger.info('[signalQualityStore] DataBridge subscriptions initialized')
  return () => destroySignalQualityStoreSubscriptions()
}

function destroySignalQualityStoreSubscriptions(): void {
  _unsubscribeSignals?.()
  _unsubscribeSignals = null
  logger.info('[signalQualityStore] DataBridge subscriptions destroyed')
}
