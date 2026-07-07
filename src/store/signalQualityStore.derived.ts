/**
 * @module signalQualityStore.derived
 * @description signalQualityStore 派生查询函数集合
 *
 * 设计原则：
 *   1. 纯函数：通过 useSignalQualityStore.getState() 访问状态
 *   2. 性能优化：memoizeByRef 缓存无参数派生（reviews 引用未变时直接返回缓存）
 *   3. 派生不调用派生：directionStats 直接遍历 reviews，避免调用 reviewsByDirection
 *   4. 空状态安全
 *
 * @compliance AGENTS.md §一 分层规则
 */

import { useSignalQualityStore } from '@/store/signalQualityStore'
import type { SignalQualityMetrics, SignalReviewRecord } from '@/store/signalQualityStore'
import { memoizeByRef, safeDivide, average, safeLength } from '@/lib/derivedCache'

// ============================================================
// 类型定义
// ============================================================

/** 信号质量分级 */
export type SignalQualityGrade = 'high' | 'medium' | 'low' | 'unknown'

/** 单 symbol 指标聚合 */
export interface SymbolQualityStats {
  accuracy: number
  winRate: number
  avgReturn: number
  reviewCount: number
  grade: SignalQualityGrade
}

/** 方向统计聚合 */
export interface DirectionStat {
  direction: 'buy' | 'sell' | 'hold' | 'watch'
  count: number
  accuracy: number
  avgReturn: number
  winRate: number
}

/** 日期分布聚合 */
export interface DateDistributionEntry {
  period: string
  count: number
  accuracy: number
}

/** 信号类型统计 */
export interface SignalTypeStat {
  type: string
  count: number
  accuracy: number
  avgReturn: number
}

// ============================================================
// 派生查询：基础聚合
// ============================================================

/**
 * 是否有指标数据
 */
export function hasMetrics(): boolean {
  return useSignalQualityStore.getState().metrics !== null
}

/**
 * 复盘列表是否为空
 */
export function isReviewsEmpty(): boolean {
  return useSignalQualityStore.getState().reviews.length === 0
}

/**
 * 复盘记录总数
 */
export function reviewsCount(): number {
  return safeLength(useSignalQualityStore.getState().reviews)
}

/**
 * 综合加载状态
 */
export function isLoading(): boolean {
  return useSignalQualityStore.getState().loading
}

/**
 * 综合错误
 */
export function hasError(): boolean {
  return useSignalQualityStore.getState().error !== null
}

// ============================================================
// 派生查询：按 symbol 查询指标（必需）
// ============================================================

/**
 * 按 symbol 查询复盘记录
 * 注意：原 store 已有 reviewsBySymbol，这里提供基于派生的实现
 */
export function reviewsBySymbol(symbol: string): SignalReviewRecord[] {
  return useSignalQualityStore.getState().reviews.filter(r => r.symbol === symbol)
}

/**
 * 按 symbol 查询准确率
 * 计算：correct 为 true 的复盘数 / 已实现复盘数
 */
export function accuracyBySymbol(symbol: string): number {
  const reviews = reviewsBySymbol(symbol)
  const realized = reviews.filter(r => r.correct !== undefined)
  if (realized.length === 0) return 0
  const correct = realized.filter(r => r.correct === true).length
  return safeDivide(correct, realized.length)
}

/**
 * 按 symbol 查询胜率
 * 计算：pnlPercent > 0 的复盘数 / 已实现复盘数
 */
export function winRateBySymbol(symbol: string): number {
  const reviews = reviewsBySymbol(symbol)
  const realized = reviews.filter(r => r.pnlPercent !== undefined)
  if (realized.length === 0) return 0
  const wins = realized.filter(r => (r.pnlPercent ?? 0) > 0).length
  return safeDivide(wins, realized.length)
}

/**
 * 按 symbol 查询平均收益
 */
export function avgReturnBySymbol(symbol: string): number {
  const reviews = reviewsBySymbol(symbol)
  const returns = reviews
    .map(r => r.pnlPercent)
    .filter((v): v is number => v !== undefined)
  return average(returns)
}

/**
 * 信号质量分级（基于准确率）
 * - high: accuracy >= 0.7
 * - medium: 0.5 <= accuracy < 0.7
 * - low: accuracy < 0.5
 * - unknown: 无复盘数据
 */
export function signalQualityGrade(symbol: string): SignalQualityGrade {
  const reviews = reviewsBySymbol(symbol)
  const realized = reviews.filter(r => r.correct !== undefined)
  if (realized.length === 0) return 'unknown'

  const accuracy = accuracyBySymbol(symbol)
  if (accuracy >= 0.7) return 'high'
  if (accuracy >= 0.5) return 'medium'
  return 'low'
}

/**
 * 是否低质量信号（accuracy < 0.5）
 */
export function isLowQuality(symbol: string): boolean {
  return signalQualityGrade(symbol) === 'low'
}

// ============================================================
// 派生查询：方向与类型筛选
// ============================================================

/**
 * 按方向筛选复盘记录
 */
export function reviewsByDirection(direction: 'buy' | 'sell' | 'hold' | 'watch'): SignalReviewRecord[] {
  return useSignalQualityStore.getState().reviews.filter(r => r.direction === direction)
}

/**
 * 按信号类型筛选
 */
export function reviewsByType(type: string): SignalReviewRecord[] {
  return useSignalQualityStore.getState().reviews.filter(r => r.type === type)
}

/**
 * 按日期范围筛选
 */
export function reviewsByDateRange(start: number, end: number): SignalReviewRecord[] {
  return useSignalQualityStore.getState().reviews.filter(
    r => r.issuedAt >= start && r.issuedAt <= end
  )
}

/**
 * 最近 N 条复盘（按 issuedAt 降序）
 */
export function recentReviews(limit: number = 10): SignalReviewRecord[] {
  const reviews = useSignalQualityStore.getState().reviews
  return [...reviews]
    .sort((a, b) => b.issuedAt - a.issuedAt)
    .slice(0, limit)
}

// ============================================================
// 派生查询：盈亏分析（memoizeByRef 缓存）
// ============================================================

/**
 * 盈利的复盘记录
 */
export function profitableReviews(): SignalReviewRecord[] {
  return useSignalQualityStore.getState().reviews.filter(r => (r.pnlPercent ?? 0) > 0)
}

/**
 * 亏损的复盘记录
 */
export function losingReviews(): SignalReviewRecord[] {
  return useSignalQualityStore.getState().reviews.filter(r => (r.pnlPercent ?? 0) < 0)
}

/**
 * 平均收益
 */
export function averageReturn(): number {
  const returns = useSignalQualityStore.getState().reviews
    .map(r => r.pnlPercent)
    .filter((v): v is number => v !== undefined)
  return average(returns)
}

/**
 * 平均盈利
 */
export function averageWin(): number {
  const wins = profitableReviews()
    .map(r => r.pnlPercent)
    .filter((v): v is number => v !== undefined)
  return average(wins)
}

/**
 * 平均亏损
 */
export function averageLoss(): number {
  const losses = losingReviews()
    .map(r => r.pnlPercent)
    .filter((v): v is number => v !== undefined)
  return average(losses)
}

/**
 * 最佳复盘（最高收益）
 */
export function bestReview(): SignalReviewRecord | null {
  const reviews = useSignalQualityStore.getState().reviews
  let best: SignalReviewRecord | null = null
  for (const r of reviews) {
    if (r.pnlPercent !== undefined) {
      if (best === null || (r.pnlPercent > (best.pnlPercent ?? -Infinity))) {
        best = r
      }
    }
  }
  return best
}

/**
 * 最差复盘（最大亏损）
 */
export function worstReview(): SignalReviewRecord | null {
  const reviews = useSignalQualityStore.getState().reviews
  let worst: SignalReviewRecord | null = null
  for (const r of reviews) {
    if (r.pnlPercent !== undefined) {
      if (worst === null || (r.pnlPercent < (worst.pnlPercent ?? Infinity))) {
        worst = r
      }
    }
  }
  return worst
}

// ============================================================
// 派生查询：方向统计（memoizeByRef 缓存）
// 性能优化：单次遍历 reviews 完成所有方向统计
// ============================================================

/**
 * 方向统计聚合
 * 性能优化：基于 reviews 引用记忆化，单次遍历完成所有计算
 */
export const directionStatsMemo = memoizeByRef((reviews: readonly SignalReviewRecord[]): DirectionStat[] => {
  const directions: Array<'buy' | 'sell' | 'hold' | 'watch'> = ['buy', 'sell', 'hold', 'watch']
  const statsMap = new Map<string, {
    count: number
    correct: number
    realized: number
    wins: number
    returns: number[]
  }>()

  for (const r of reviews) {
    let stat = statsMap.get(r.direction)
    if (!stat) {
      stat = { count: 0, correct: 0, realized: 0, wins: 0, returns: [] }
      statsMap.set(r.direction, stat)
    }
    stat.count++
    if (r.correct !== undefined) {
      stat.realized++
      if (r.correct) stat.correct++
    }
    if (r.pnlPercent !== undefined) {
      stat.returns.push(r.pnlPercent)
      if (r.pnlPercent > 0) stat.wins++
    }
  }

  return directions.map(dir => {
    const stat = statsMap.get(dir) ?? { count: 0, correct: 0, realized: 0, wins: 0, returns: [] }
    return {
      direction: dir,
      count: stat.count,
      accuracy: safeDivide(stat.correct, stat.realized),
      avgReturn: average(stat.returns),
      winRate: safeDivide(stat.wins, stat.returns.length),
    }
  })
}, 'directionStats')

/**
 * 获取方向统计（自动传入最新 reviews）
 */
export function getDirectionStats(): DirectionStat[] {
  return directionStatsMemo(useSignalQualityStore.getState().reviews)
}

/**
 * 信号类型统计
 * 性能优化：基于 reviews 引用记忆化
 */
export const signalTypeStatsMemo = memoizeByRef((reviews: readonly SignalReviewRecord[]): SignalTypeStat[] => {
  const statsMap = new Map<string, { count: number; correct: number; realized: number; returns: number[] }>()

  for (const r of reviews) {
    let stat = statsMap.get(r.type)
    if (!stat) {
      stat = { count: 0, correct: 0, realized: 0, returns: [] }
      statsMap.set(r.type, stat)
    }
    stat.count++
    if (r.correct !== undefined) {
      stat.realized++
      if (r.correct) stat.correct++
    }
    if (r.pnlPercent !== undefined) {
      stat.returns.push(r.pnlPercent)
    }
  }

  return Array.from(statsMap.entries())
    .map(([type, stat]) => ({
      type,
      count: stat.count,
      accuracy: safeDivide(stat.correct, stat.realized),
      avgReturn: average(stat.returns),
    }))
    .sort((a, b) => b.count - a.count)
}, 'signalTypeStats')

/**
 * 获取 Top N 信号类型（按数量降序）
 */
export function topSignalTypes(limit: number = 5): SignalTypeStat[] {
  return signalTypeStatsMemo(useSignalQualityStore.getState().reviews).slice(0, limit)
}

// ============================================================
// 派生查询：趋势分析
// ============================================================

/**
 * 准确率随时间变化（滑动窗口）
 * @param windowSize 每个窗口的复盘数（默认 20）
 */
export function accuracyTrend(windowSize: number = 20): Array<{ period: number; accuracy: number }> {
  const reviews = useSignalQualityStore.getState().reviews
  const sorted = [...reviews].sort((a, b) => a.issuedAt - b.issuedAt)
  const result: Array<{ period: number; accuracy: number }> = []

  for (let i = 0; i + windowSize <= sorted.length; i += windowSize) {
    const window = sorted.slice(i, i + windowSize)
    const realized = window.filter(r => r.correct !== undefined)
    const correct = realized.filter(r => r.correct === true).length
    result.push({
      period: i + windowSize,
      accuracy: safeDivide(correct, realized.length),
    })
  }

  return result
}

/**
 * 胜率随时间变化
 */
export function winRateTrend(windowSize: number = 20): Array<{ period: number; winRate: number }> {
  const reviews = useSignalQualityStore.getState().reviews
  const sorted = [...reviews].sort((a, b) => a.issuedAt - b.issuedAt)
  const result: Array<{ period: number; winRate: number }> = []

  for (let i = 0; i + windowSize <= sorted.length; i += windowSize) {
    const window = sorted.slice(i, i + windowSize)
    const realized = window.filter(r => r.pnlPercent !== undefined)
    const wins = realized.filter(r => (r.pnlPercent ?? 0) > 0).length
    result.push({
      period: i + windowSize,
      winRate: safeDivide(wins, realized.length),
    })
  }

  return result
}

// ============================================================
// React Hook 形式派生（可选）
// ============================================================

/**
 * Hook：订阅指标数据
 */
export function useMetrics(): SignalQualityMetrics | null {
  return useSignalQualityStore(state => state.metrics)
}

/**
 * Hook：订阅方向统计
 */
export function useDirectionStats(): DirectionStat[] {
  const reviews = useSignalQualityStore(state => state.reviews)
  return directionStatsMemo(reviews)
}

/**
 * Hook：订阅是否为空
 */
export function useIsReviewsEmpty(): boolean {
  return useSignalQualityStore(state => state.reviews.length === 0)
}
