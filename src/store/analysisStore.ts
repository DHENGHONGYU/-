/**
 * @module analysisStore
 * @description 分析舱（AnalysisApp）状态管理层。集中管理分析标的列表、V6 批量评分及加载状态。
 * 从 AnalysisApp 组件中抽取的 3 个 useState，实现 Store 化。
 *
 * @status AnalysisApp.tsx 已接入 useAnalysisStore（stocks/scores/loadStocks/handleScore 等）。
 *
 * @see @/apps/analysis/AnalysisApp.tsx - 消费方
 * @see @/services/analysis/analysisService.ts - 底层数据服务
 * @see @/services/scoring/v6ScoreService.ts - V6 评分计算服务
  * @doc [V9-DOC-PROJ-053, V9-DOC-BACK-006, V9-DOC-PROJ-124, V9-DOC-PROJ-107, V9-DOC-PROD-001]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { Stock, V6Score } from '@/data/types'
import { listStocks, listV6Scores } from '@/services/analysis/analysisService'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import {
  loadIndustryScoreTrend,
  loadStockScoreTrend,
  type ScoreTrendData,
  type ScoreTrendEntityType,
  type ScoreTrendPeriod,
} from '@/services/analysis/scoreTrendService'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// Store 接口
// ============================================================

interface AnalysisState {
  /** 分析标的列表 */
  stocks: Stock[]
  /** V6 评分列表 */
  scores: V6Score[]
  /** 加载状态（标的加载 / 评分计算共用） */
  loading: boolean
  /** 错误信息 */
  error: string | null

  /** 多周期趋势数据 */
  trendData: ScoreTrendData | undefined
  /** 趋势加载状态 */
  trendLoading: boolean
  /** 趋势错误信息 */
  trendError: string | null
  /** 当前趋势周期 */
  trendPeriod: ScoreTrendPeriod

  // Actions
  /** 加载标的列表并刷新评分 */
  loadStocks: () => Promise<void>
  /** 对指定标的运行 V6 评分，完成后自动刷新评分列表 */
  handleScore: (symbol: string) => Promise<void>
  /** 刷新评分列表（静默） */
  loadScores: () => Promise<void>
  /** 清空错误 */
  clearError: () => void
  /** 切换趋势周期 */
  setTrendPeriod: (period: ScoreTrendPeriod) => void
  /** 加载指定实体（行业/个股）的多周期趋势 */
  loadTrend: (entityId: string, entityType: ScoreTrendEntityType, period?: ScoreTrendPeriod) => Promise<void>
  /** 清空趋势错误 */
  clearTrendError: () => void
  /** 重置 Store 到初始状态 */
  reset: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  stocks: [] as Stock[],
  scores: [] as V6Score[],
  loading: false,
  error: null as string | null,
  trendData: undefined as ScoreTrendData | undefined,
  trendLoading: false,
  trendError: null as string | null,
  trendPeriod: 'month' as ScoreTrendPeriod,
}

// ============================================================
// Store
// ============================================================

/**
 * useAnalysisStore
 */
export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  ...initialState,

  loadStocks: async () => {
    logger.info('[analysisStore] loadStocks 开始')
    set({ loading: true, error: null })

    try {
      const result = await listStocks()
      if (result.success && result.data) {
        set({ stocks: result.data, loading: false })
        logger.info(`[analysisStore] loadStocks 完成: ${result.data.length} 只标的`)
      } else {
        const message = result.error ?? '无法加载标的列表'
        logger.error(`[analysisStore] loadStocks 失败: ${message}`)
        set({ loading: false, error: message })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法加载标的列表'
      logger.error(`[analysisStore] loadStocks 异常: ${message}`)
      set({ loading: false, error: message })
    }
  },

  handleScore: async (symbol: string) => {
    logger.info(`[analysisStore] handleScore 开始: ${symbol}`)
    set({ loading: true, error: null })

    try {
      const result = await runV6Score(symbol)
      if (result.success && result.data) {
        const newScores = get().scores.map((s) =>
          s.symbol === symbol ? result.data! : s,
        )
        if (!newScores.some((s) => s.symbol === symbol)) {
          newScores.push(result.data)
        }
        set({ scores: newScores, loading: false })
        logger.info(`[analysisStore] handleScore 完成: ${symbol}`)
        // D-3: 广播评分变更事件
        withBroadcast(EVENT_NAMES.SCORES_CHANGED, { action: 'score', symbol })
      } else {
        const message = result.error ?? `无法对 ${symbol} 运行评分`
        logger.error(`[analysisStore] handleScore 失败: ${message}`)
        set({ loading: false, error: message })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `无法对 ${symbol} 运行评分`
      logger.error(`[analysisStore] handleScore 异常: ${message}`)
      set({ loading: false, error: message })
    }
  },

  loadScores: async () => {
    logger.info('[analysisStore] loadScores 开始')
    try {
      const result = await listV6Scores()
      if (result.success && result.data) {
        set({ scores: result.data })
        logger.info(`[analysisStore] loadScores 完成: ${result.data.length} 条评分`)
        // D-3: 广播评分变更事件
        withBroadcast(EVENT_NAMES.SCORES_CHANGED, { action: 'load', count: result.data.length })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[analysisStore] loadScores 异常: ${message}`)
    }
  },

  clearError: () => {
    set({ error: null })
  },

  setTrendPeriod: (period) => {
    set({ trendPeriod: period })
  },

  loadTrend: async (entityId, entityType, period) => {
    const effectivePeriod = period ?? get().trendPeriod
    logger.info(`[analysisStore] loadTrend 开始: ${entityType}=${entityId}, period=${effectivePeriod}`)
    set({ trendLoading: true, trendError: null, trendPeriod: effectivePeriod })

    try {
      const result = entityType === 'industry'
        ? await loadIndustryScoreTrend(entityId, effectivePeriod)
        : await loadStockScoreTrend(entityId, effectivePeriod)

      if ('data' in result) {
        const data = result.data
        set({ trendData: data, trendLoading: false })
        logger.info(`[analysisStore] loadTrend 完成: ${data.points.length} 个周期点`)
      } else {
        const message = result.error ?? '无法加载趋势数据'
        logger.error(`[analysisStore] loadTrend 失败: ${message}`)
        set({ trendLoading: false, trendError: message })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法加载趋势数据'
      logger.error(`[analysisStore] loadTrend 异常: ${message}`)
      set({ trendLoading: false, trendError: message })
    }
  },

  clearTrendError: () => {
    set({ trendError: null })
  },

  reset: () => {
    logger.info('[analysisStore] reset')
    set({ ...initialState })
  },
}))

// ============================================================
// 派生查询（从 .derived.ts 统一导出，含 memoizeByRef 缓存优化）
// 设计原则：派生查询独立函数模式，通过 getState() 访问状态，不存入 State
// ============================================================
export * from './analysisStore.derived'
