/**
 * @module signalQualityStore
 * @lifecycle @Global
 * @description 信号质量复盘状态管理。管理信号准确率、择时得分、最大回撤、Sharpe 等
 * 绩效指标，提供复盘数据加载和 DataBridge 订阅。
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, type EnvelopeAction } from '@/config/dbConfig'
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

  // 胜率
  const winningTrades = realizedReviews.filter((r) => (r.pnlPercent ?? 0) > 0).length
  const winRate = winningTrades / realizedSignals

  // 盈亏比
  const avgWin =
    realizedReviews.filter((r) => (r.pnlPercent ?? 0) > 0).reduce((sum, r) => sum + (r.pnlPercent ?? 0), 0) /
    Math.max(winningTrades, 1)
  const avgLoss =
    Math.abs(
      realizedReviews.filter((r) => (r.pnlPercent ?? 0) < 0).reduce((sum, r) => sum + (r.pnlPercent ?? 0), 0) /
        Math.max(realizedSignals - winningTrades, 1),
    )
  const profitLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0

  // 平均持仓天数
  const holdingDaysList = realizedReviews.map((r) => r.holdingDays ?? 0)
  const avgHoldingDays = holdingDaysList.reduce((sum, d) => sum + d, 0) / realizedSignals

  // 最大回撤（简化计算：取最小 pnlPercent）
  const pnlValues = realizedReviews.map((r) => r.pnlPercent ?? 0)
  const maxDrawdown = Math.min(0, ...pnlValues) / 100

  // Sharpe 比率（简化：假设无风险利率为 0）
  const returns = pnlValues.map((p) => p / 100)
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length)
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
      const signals = await dataLayer.signals.list()
      logger.info(`[signalQualityStore] 加载到 ${signals.length} 个信号`)

      // 转换为复盘记录（简化：实际应查询后续价格数据）
      const reviews: SignalReviewRecord[] = signals.map((signal: Signal) => ({
        signalId: signal.id,
        symbol: signal.symbol,
        direction: signal.direction as 'buy' | 'sell' | 'hold' | 'watch',
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
// 派生查询
// ============================================================

/** 获取指定 symbol 的复盘记录 */
export function reviewsBySymbol(symbol: string): SignalReviewRecord[] {
  return useSignalQualityStore.getState().reviews.filter((r) => r.symbol === symbol)
}

/** 获取准确率最高的 Top N 信号类型 */
export function topSignalTypes(limit: number = 5): Array<{ type: string; accuracy: number; count: number }> {
  const { reviews } = useSignalQualityStore.getState()
  const typeMap = new Map<string, { correct: number; total: number }>()

  for (const review of reviews) {
    if (review.correct === undefined) continue
    const entry = typeMap.get(review.type) ?? { correct: 0, total: 0 }
    entry.total++
    if (review.correct) entry.correct++
    typeMap.set(review.type, entry)
  }

  return Array.from(typeMap.entries())
    .map(([type, stats]) => ({
      type,
      accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
      count: stats.total,
    }))
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, limit)
}

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
