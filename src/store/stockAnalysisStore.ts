/**
 * @module stockAnalysisStore
 * @description 个股分析页面状态管理层。集中管理单只股票的基础信息、K线数据、V6评分及加载状态。
 *
 * @see @/pages/analysis/StockAnalysisPage.tsx - 消费此 Store 的个股分析页面
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
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

export const useStockAnalysisStore = create<StockAnalysisState>((set) => ({
  ...initialState,

  loadStockAnalysis: async (symbol: string, signal?: AbortSignal) => {
    logger.info(`[stockAnalysisStore] loadStockAnalysis: ${symbol}`)
    set({
      ...initialState,
      selectedSymbol: symbol,
      loading: true,
    })

    try {
      const [stockData, quotesData, scoreData] = await Promise.all([
        loadStockForAnalysis(symbol),
        loadDailyQuotesForAnalysis(symbol),
        loadV6ScoreForAnalysis(symbol),
      ])

      if (signal?.aborted) {
        logger.info(`[stockAnalysisStore] loadStockAnalysis 已取消: ${symbol}`)
        return
      }

      set({
        stock: stockData ?? null,
        quotes: quotesData ?? null,
        v6Score: scoreData ?? null,
        loading: false,
        error: null,
      })
      logger.info(`[stockAnalysisStore] loadStockAnalysis 完成: ${symbol}`)
    } catch (err) {
      if (signal?.aborted) {
        logger.info(`[stockAnalysisStore] loadStockAnalysis 已取消: ${symbol}`)
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[stockAnalysisStore] loadStockAnalysis 失败: ${message}`)
      set({
        loading: false,
        error: message,
      })
    }
  },

  refreshScore: async (symbol: string) => {
    logger.info(`[stockAnalysisStore] refreshScore: ${symbol}`)
    set({ scoreLoading: true, error: null })

    try {
      const result = await runV6Score(symbol)
      if (!result.success || !result.data) {
        const message = result.error ?? '评分计算失败'
        logger.error(`[stockAnalysisStore] refreshScore 失败: ${message}`)
        set({ scoreLoading: false, error: message })
        return
      }

      const latest = await loadV6ScoreForAnalysis(symbol)
      set({
        v6Score: latest ?? result.data,
        scoreLoading: false,
      })
      logger.info(`[stockAnalysisStore] refreshScore 完成: ${symbol}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[stockAnalysisStore] refreshScore 失败: ${message}`)
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

export function initStockAnalysisStoreSubscriptions(): () => void {
  destroyStockAnalysisStoreSubscriptions()
  logger.info('[stockAnalysisStore] 初始化 DataBridge v6_scores 频道订阅')

  _unsubscribeV6Scores = dataBridge.subscribe(
    'v6_scores',
    (envelope) => {
      if (envelope.meta.action === ENVELOPE_ACTION.saveV6Score) {
        logger.info('[stockAnalysisStore] DataBridge event received: saveV6Score', {
          traceId: envelope.meta.traceId,
        })
      }
    },
  )

  return () => destroyStockAnalysisStoreSubscriptions()
}

export function destroyStockAnalysisStoreSubscriptions(): void {
  if (_unsubscribeV6Scores) {
    _unsubscribeV6Scores()
    _unsubscribeV6Scores = undefined
  }
}