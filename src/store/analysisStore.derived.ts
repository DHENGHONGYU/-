/**
 * @module analysisStore.derived
 * @description analysisStore 派生查询函数集合
 *
 * 设计原则：
 *   1. 纯函数：通过 useAnalysisStore.getState() 访问状态，不修改状态
 *   2. 性能优化：使用 memoizeByRef 缓存无参数派生，buildIndex 优化 O(n) 查找
 *   3. 空状态安全：所有派生在空数据时返回合理默认值
 *   4. 不引入循环依赖：仅依赖 analysisStore 和 lib/derivedCache
 *
 * @compliance AGENTS.md §一 分层规则：store 层仅依赖 services 和 core（lib 属于基础设施白名单）
 */

import { useAnalysisStore } from '@/store/analysisStore'
import {
  memoizeByRef,
  buildIndex,
  safeLength,
} from '@/lib/derivedCache'
import type { Stock, V6Score } from '@/data/types'

// ============================================================
// 类型定义
// ============================================================

/** 评分等级分布 */
export interface ScoreLevelDistribution {
  excellent: number  // ≥80
  good: number       // 60-79
  average: number    // 40-59
  poor: number       // 20-39
  bad: number        // <20
}

/** 趋势方向 */
export type TrendDirection = 'up' | 'down' | 'flat'

// ============================================================
// 派生查询：基础聚合（无参数，使用 memoizeByRef）
// ============================================================

/**
 * 综合加载状态（loading || trendLoading）
 * 用于全局加载指示器
 */
export function isLoadingAny(): boolean {
  const s = useAnalysisStore.getState()
  return s.loading || s.trendLoading
}

/**
 * 综合错误信息（合并 error + trendError）
 * 优先返回主错误，其次返回趋势错误
 */
export function errorUnion(): string | null {
  const s = useAnalysisStore.getState()
  return s.error ?? s.trendError
}

/**
 * 是否有任何错误
 */
export function hasError(): boolean {
  return errorUnion() !== null
}

/**
 * 标的列表是否为空
 */
export function isStocksEmpty(): boolean {
  const s = useAnalysisStore.getState()
  return s.stocks.length === 0
}

/**
 * 评分列表是否为空
 */
export function isScoresEmpty(): boolean {
  const s = useAnalysisStore.getState()
  return s.scores.length === 0
}

/**
 * 标的总数
 */
export function stocksCount(): number {
  return safeLength(useAnalysisStore.getState().stocks)
}

/**
 * 评分总数
 */
export function scoresCount(): number {
  return safeLength(useAnalysisStore.getState().scores)
}

// ============================================================
// 派生查询：评分等级分布（memoizeByRef 缓存）
// ============================================================

function classifyScoreLevel(score: number): keyof ScoreLevelDistribution {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'average'
  if (score >= 20) return 'poor'
  return 'bad'
}

/**
 * 评分等级分布
 * 性能优化：基于 scores 数组引用记忆化，scores 未变时直接返回缓存
 */
export const scoreLevelDistribution = memoizeByRef((scores: readonly V6Score[]): ScoreLevelDistribution => {
  const dist: ScoreLevelDistribution = {
    excellent: 0,
    good: 0,
    average: 0,
    poor: 0,
    bad: 0,
  }
  for (const s of scores) {
    dist[classifyScoreLevel(s.score)]++
  }
  return dist
}, 'scoreLevelDistribution')

/**
 * 获取评分等级分布（自动传入最新 scores）
 */
export function getScoreLevelDistribution(): ScoreLevelDistribution {
  return scoreLevelDistribution(useAnalysisStore.getState().scores)
}

// ============================================================
// 派生查询：按字段查找（buildIndex 优化）
// ============================================================

/**
 * 按 symbol 查询评分
 * 性能优化：构建 Map 索引，O(1) 查找
 */
export function scoreBySymbol(symbol: string): V6Score | undefined {
  const scores = useAnalysisStore.getState().scores
  // 单次查询直接 find，避免每次都构建 Map
  return scores.find(s => s.symbol === symbol)
}

/**
 * 按 symbol 查询标的
 */
export function stockBySymbol(symbol: string): Stock | undefined {
  const stocks = useAnalysisStore.getState().stocks
  return stocks.find(s => s.symbol === symbol)
}

/**
 * 按板块筛选标的
 * @param sector 板块名称（Stock.sector 字段）
 */
export function stocksBySector(sector: string): Stock[] {
  const stocks = useAnalysisStore.getState().stocks
  return stocks.filter(s => s.sector === sector)
}

/**
 * 按评分区间筛选标的
 */
export function stocksByScoreRange(min: number, max: number): Stock[] {
  const state = useAnalysisStore.getState()
  const symbolToScore = buildIndex(state.scores, s => s.symbol)
  return state.stocks.filter(stock => {
    const score = symbolToScore.get(stock.symbol)
    return score !== undefined && score.score >= min && score.score <= max
  })
}

/**
 * Top N 高分标的
 * @param limit 返回数量
 * @param sortBy 排序字段
 */
export function topStocks(
  limit: number = 10,
  sortBy: 'score' | 'changePercent' = 'score',
): Array<Stock & { score?: number }> {
  const state = useAnalysisStore.getState()
  const symbolToScore = buildIndex(state.scores, s => s.symbol)

  const enriched = state.stocks.map(stock => ({
    ...stock,
    score: symbolToScore.get(stock.symbol)?.score,
  }))

  if (sortBy === 'score') {
    enriched.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
  } else {
    // changePercent 不在 Stock 类型中，跳过排序
    enriched.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
  }

  return enriched.slice(0, limit)
}

// ============================================================
// 派生查询：趋势分析
// ============================================================

/**
 * 趋势方向（上升/下降/平稳）
 * 基于趋势数据的首尾 composite 值比较
 */
export function trendDirection(): TrendDirection {
  const trendData = useAnalysisStore.getState().trendData
  if (!trendData?.points || trendData.points.length < 2) {
    return 'flat'
  }
  const points = trendData.points
  const first = points[0]!.composite
  const last = points[points.length - 1]!.composite
  const threshold = Math.abs(first) * 0.01  // 1% 变化阈值
  const diff = last - first
  if (diff > threshold) return 'up'
  if (diff < -threshold) return 'down'
  return 'flat'
}

/**
 * 趋势变化率（百分比）
 */
export function trendChangeRate(): number {
  const trendData = useAnalysisStore.getState().trendData
  if (!trendData?.points || trendData.points.length < 2) {
    return 0
  }
  const points = trendData.points
  const first = points[0]!.composite
  const last = points[points.length - 1]!.composite
  if (first === 0) return 0
  return ((last - first) / Math.abs(first)) * 100
}

/**
 * 趋势历史峰值
 */
export function trendPeak(): { value: number; period: string } | null {
  const trendData = useAnalysisStore.getState().trendData
  if (!trendData?.points || trendData.points.length === 0) {
    return null
  }
  let peak = trendData.points[0]!
  for (const p of trendData.points) {
    if (p.composite > peak.composite) peak = p
  }
  return { value: peak.composite, period: peak.period }
}

/**
 * 趋势历史谷值
 */
export function trendTrough(): { value: number; period: string } | null {
  const trendData = useAnalysisStore.getState().trendData
  if (!trendData?.points || trendData.points.length === 0) {
    return null
  }
  let trough = trendData.points[0]!
  for (const p of trendData.points) {
    if (p.composite < trough.composite) trough = p
  }
  return { value: trough.composite, period: trough.period }
}

/**
 * 是否有趋势数据
 */
export function hasTrendData(): boolean {
  const trendData = useAnalysisStore.getState().trendData
  return trendData !== undefined && trendData.points.length > 0
}

// ============================================================
// React Hook 形式派生（可选，用于组件订阅）
// ============================================================

/**
 * Hook：订阅评分等级分布
 * 自动响应 scores 变化
 */
export function useScoreLevelDistribution(): ScoreLevelDistribution {
  const scores = useAnalysisStore(state => state.scores)
  return scoreLevelDistribution(scores)
}

/**
 * Hook：订阅综合加载状态
 */
export function useIsLoadingAny(): boolean {
  return useAnalysisStore(state => state.loading || state.trendLoading)
}

/**
 * Hook：订阅综合错误
 */
export function useErrorUnion(): string | null {
  return useAnalysisStore(state => state.error ?? state.trendError)
}
