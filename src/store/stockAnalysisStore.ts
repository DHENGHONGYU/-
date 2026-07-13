/**
 * @module stockAnalysisStore
 * @description 个股分析页面状态管理层。集中管理单只股票的基础信息、K线数据、V6评分及加载状态。
 *
 * @see @/pages/analysis/StockAnalysisPage.tsx - 消费此 Store 的个股分析页面
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import type { DailyQuotes, Stock, V6Score } from '@/data/types'
import {
  loadDailyQuotesForAnalysis,
  loadStockForAnalysis,
  loadV6ScoreForAnalysis,
} from '@/services/analysis/scorePageService'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION } from '@/config/dbConfig'

const logger = getLogger()

// ============================================================
// Store 接口
// ============================================================

interface StockAnalysisState {
  /** 当前选中的股票代码 */
  selectedSymbol: string | null
  /** 股票基础信息 */
  stock: Stock | null
  /** 日 K 数据 */
  quotes: DailyQuotes | null
  /** V6 评分 */
  v6Score: V6Score | null
  /** 初始加载状态 */
  loading: boolean
  /** 评分刷新加载状态 */
  scoreLoading: boolean
  /** 错误信息 */
  error: string | null

  // Actions
  loadStockAnalysis: (symbol: string, signal?: AbortSignal) => Promise<void>
  refreshScore: (symbol: string) => Promise<void>
  clear: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  selectedSymbol: null as string | null,
  stock: null as Stock | null,
  quotes: null as DailyQuotes | null,
  v6Score: null as V6Score | null,
  loading: false,
  scoreLoading: false,
  error: null as string | null,
}

// ============================================================
// Store
// ============================================================

/**
 * useStockAnalysisStore
 */
export const useStockAnalysisStore = create<StockAnalysisState>((set) => ({
  ...initialState,

  loadStockAnalysis: async (symbol: string, signal?: AbortSignal) => {
    const t0 = Date.now()
    logger.info(`[stockAnalysisStore] loadStockAnalysis 开始: ${symbol}`)
    set({
      ...initialState,
      selectedSymbol: symbol,
      loading: true,
    })

    try {
      logger.info(`[stockAnalysisStore] Promise.all 发起: stock + quotes + score`, { symbol })
      const [stockData, quotesData, scoreData] = await Promise.all([
        loadStockForAnalysis(symbol),
        loadDailyQuotesForAnalysis(symbol),
        loadV6ScoreForAnalysis(symbol),
      ])

      if (signal?.aborted) {
        logger.info(`[stockAnalysisStore] loadStockAnalysis 已取消: ${symbol}`)
        return
      }

      logger.info(`[stockAnalysisStore] Promise.all 返回`, {
        symbol,
        hasStock: stockData != null,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        quotesCount: quotesData ? ((quotesData as { dates?: unknown[] }).dates?.length || 'N/A') : 0,
        hasScore: scoreData != null,
        elapsedMs: Date.now() - t0,
      })

      set({
        stock: stockData ?? null,
        quotes: quotesData ?? null,
        v6Score: scoreData ?? null,
        loading: false,
        error: null,
      })
      logger.info(`[stockAnalysisStore] loadStockAnalysis 完成: ${symbol}, 耗时 ${Date.now() - t0}ms`)
    } catch (err) {
      if (!signal?.aborted) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`[stockAnalysisStore] loadStockAnalysis 失败: ${symbol}, ${message}`, {
          elapsedMs: Date.now() - t0,
        })
        set({
          loading: false,
          error: message,
        })
      } else {
        logger.info(`[stockAnalysisStore] loadStockAnalysis 已取消: ${symbol}`)
      }
    }
  },

  refreshScore: async (symbol: string) => {
    const t0 = Date.now()
    logger.info(`[stockAnalysisStore] refreshScore 开始: ${symbol}`)
    set({ scoreLoading: true, error: null })

    try {
      logger.info(`[stockAnalysisStore] runV6Score 调用中...`, { symbol })
      const result = await runV6Score(symbol)
      logger.info(`[stockAnalysisStore] runV6Score 返回`, {
        symbol,
        success: result.success,
        hasData: !!result.data,
        elapsedMs: Date.now() - t0,
      })

      if (!result.success || !result.data) {
        const message = result.error ?? '评分计算失败'
        logger.error(`[stockAnalysisStore] refreshScore 失败: ${symbol}, ${message}`)
        set({ scoreLoading: false, error: message })
        return
      }

      logger.info(`[stockAnalysisStore] loadV6ScoreForAnalysis 调用中（获取最新评分）`, { symbol })
      const latest = await loadV6ScoreForAnalysis(symbol)
      logger.info(`[stockAnalysisStore] loadV6ScoreForAnalysis 返回`, {
        symbol,
        hasLatest: latest != null,
      })

      set({
        v6Score: latest ?? result.data ?? null,
        scoreLoading: false,
      })
      logger.info(`[stockAnalysisStore] refreshScore 完成: ${symbol}, 总耗时 ${Date.now() - t0}ms`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[stockAnalysisStore] refreshScore 异常: ${symbol}, ${message}`, {
        elapsedMs: Date.now() - t0,
      })
      set({ scoreLoading: false, error: message })
    }
  },

  clear: () => {
    logger.info('[stockAnalysisStore] clear')
    set({ ...initialState })
  },

  setLoading: (loading: boolean) => {
    set({ loading })
  },

  setError: (error: string | null) => {
    set({ error })
  },
}))

// ============================================================
// DataBridge 订阅（用于跨模块数据同步）
// ============================================================

let _unsubscribeV6Scores: (() => void) | undefined
let _unsubscribeV6ScoresChanged: (() => void) | undefined

/**
 * initStockAnalysisStoreSubscriptions
 */
export function initStockAnalysisStoreSubscriptions(): () => void {
  destroyStockAnalysisStoreSubscriptions()
  logger.info('[stockAnalysisStore] 初始化 DataBridge + EventBus v6_scores 订阅')

  // 1. DataBridge 频道订阅(保留原有逻辑,修复 action 名)
  _unsubscribeV6Scores = dataBridge.subscribe(
    'v6_scores',
    (envelope) => {
      if (envelope.meta.action === ENVELOPE_ACTION.saveScores) {
        logger.info('[stockAnalysisStore] DataBridge event received: saveScores', {
          traceId: envelope.meta.traceId,
        })
      }
    },
  )

  // 2. 链路 7 修复:订阅 EventBus V6_SCORES_CHANGED,自动刷新 Store
  _unsubscribeV6ScoresChanged = eventBus.on(
    EVENT_NAMES.V6_SCORES_CHANGED,
    (payload) => {
      void (async () => {
        const data = payload as { symbol?: string; score?: number } | undefined
        const symbol = data?.symbol
        if (!symbol) return

        const state = useStockAnalysisStore.getState()
        // 仅当当前选中的 symbol 匹配时才刷新
        if (state.selectedSymbol !== symbol) {
          logger.debug('[stockAnalysisStore] V6_SCORES_CHANGED symbol 不匹配,跳过', {
            eventSymbol: symbol,
            selectedSymbol: state.selectedSymbol,
          })
          return
        }

        logger.info('[stockAnalysisStore] V6_SCORES_CHANGED 触发 Store 刷新', {
          symbol,
          score: data.score?.toFixed(2),
        })

        try {
          const latest = await loadV6ScoreForAnalysis(symbol)
          useStockAnalysisStore.setState({ v6Score: latest ?? state.v6Score })
          logger.info('[stockAnalysisStore] V6 评分已自动刷新', { symbol })
        } catch (err) {
          logger.error('[stockAnalysisStore] V6 评分自动刷新失败', {
            symbol,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      })()
    },
  )

  return () => destroyStockAnalysisStoreSubscriptions()
}

/**
 * destroyStockAnalysisStoreSubscriptions
 * @returns void
 */
export function destroyStockAnalysisStoreSubscriptions(): void {
  if (_unsubscribeV6Scores) {
    _unsubscribeV6Scores()
    _unsubscribeV6Scores = undefined
  }
  if (_unsubscribeV6ScoresChanged) {
    _unsubscribeV6ScoresChanged()
    _unsubscribeV6ScoresChanged = undefined
  }
}

// 自动初始化订阅（与 systemMonitorStore / agentStore / widgetStore 保持一致）
initStockAnalysisStoreSubscriptions()