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
import { runV6Score, runV6ScoreBatch } from '@/services/scoring/v6ScoreService'
import { listIntentionCandidates } from '@/services/input/intentionPoolService'
import type {
  AnalysisCandidate,
  AnalysisCandidateQuery,
  AnalysisScope,
} from '@/types/modules/analysis.types'
import {
  loadIndustryScoreTrend,
  loadStockScoreTrend,
  type ScoreTrendData,
  type ScoreTrendEntityType,
  type ScoreTrendPeriod,
} from '@/services/analysis/scoreTrendService'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import { createTraceId } from '@/lib/utils'

const logger = getLogger()

// ============================================================
// Store 接口
// ============================================================

interface AnalysisState {
  /** 分析标的列表（全量，scope='all' 时使用） */
  stocks: Stock[]
  /** 分析候选标的（意向候选池，scope='intention' 时使用，来自输入舱） */
  candidates: AnalysisCandidate[]
  /** 当前分析作用域 */
  scope: AnalysisScope
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
  /** 加载标的列表并刷新评分（scope='intention' 时经 intentionPoolService 读取输入舱意向候选池） */
  loadStocks: (scope?: AnalysisScope, filter?: Omit<AnalysisCandidateQuery, 'scope'>) => Promise<void>
  /** 对指定标的运行 V6 评分，完成后自动刷新评分列表 */
  handleScore: (symbol: string) => Promise<void>
  /** 对指定标的列表批量运行 V6 评分（Worker 并行），完成后自动刷新评分列表 */
  runBatchScore: (symbols: string[]) => Promise<void>
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
  candidates: [] as AnalysisCandidate[],
  scope: 'all' as AnalysisScope,
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

  loadStocks: async (scope: AnalysisScope = 'all', filter?: Omit<AnalysisCandidateQuery, 'scope'>) => {
    logger.info(`[analysisStore] loadStocks 开始: scope=${scope}`)
    set({ loading: true, error: null })

    try {
      // 意向候选池作用域：经 intentionPoolService 读取输入舱数据（含来源溯源与已有评分）
      if (scope === 'intention') {
        const result = await listIntentionCandidates({ scope: 'intention', ...filter })
        if (result.success && result.data) {
          set({ candidates: result.data, scope: 'intention', stocks: [], loading: false })
          logger.info(`[analysisStore] loadStocks(intention) 完成: ${result.data.length} 只候选`)
          // 刷新评分列表：让已评分的候选展示 V6 分值，避免交接后误显示「未评分」
          void get().loadScores()
        } else {
          const message = result.error ?? '无法加载意向候选池'
          logger.error(`[analysisStore] loadStocks(intention) 失败: ${message}`)
          set({ loading: false, error: message })
        }
        return
      }

      // 默认全量作用域（向后兼容）
      const result = await listStocks()
      if (result.success && result.data) {
        set({ stocks: result.data, scope: 'all', candidates: [], loading: false })
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
        // B6 修复：评分计算完成后通过 DataBridge 信封协议持久化到 v6Scores（刷新后不丢失）
        try {
          await dataBridge.forward(
            EnvelopeFactory.create(
              {
                source: MODULE_ID.analyzer,
                target: ENVELOPE_TARGET.db,
                action: ENVELOPE_ACTION.saveScores,
                traceId: createTraceId('analysis-score'),
              },
              result.data,
            ),
          )
          logger.info(`[analysisStore] handleScore 已持久化: ${symbol}`)
        } catch (persistErr) {
          logger.warn(`[analysisStore] handleScore 持久化失败（不影响内存评分）: ${symbol}`, {
            error: persistErr,
          })
        }
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

  runBatchScore: async (symbols: string[]) => {
    if (symbols.length === 0) {
      logger.warn('[analysisStore] runBatchScore 收到空列表，跳过')
      return
    }
    logger.info(`[analysisStore] runBatchScore 开始: ${symbols.length} 只`)
    set({ loading: true, error: null })

    try {
      const result = await runV6ScoreBatch(symbols)
      if (result.success && result.data) {
        // 批量评分落库后刷新评分列表，驱动 UI 评分标签联动
        await get().loadScores()
        logger.info(
          `[analysisStore] runBatchScore 完成: ${result.data.stats.completed}/${result.data.stats.total}`,
          { failed: result.data.errors.length },
        )
        set({ loading: false })
      } else {
        const message = result.error ?? '批量评分失败'
        logger.error(`[analysisStore] runBatchScore 失败: ${message}`)
        set({ loading: false, error: message })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '批量评分失败'
      logger.error(`[analysisStore] runBatchScore 异常: ${message}`)
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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
