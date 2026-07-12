// @module hotSectorStore
// @lifecycle @Analysis
// 分析舱-热门板块策略页面的全局状态管理（Zustand）。
// expandedSymbol 保留为页面本地 UI 状态。
//
// 管理范围：
// - 数据层：scores / loading / error
// - 引擎调用：通过 fetchScores 调用 hotSectorAnalyzer
//
// @compliance DF-002 合规：所有引擎调用经由 Store action 分发
import { create } from 'zustand'
import type { HotSectorScore, HotSectorAnalyzerInput } from '@/services/scoring/hotSectorAnalyzer'
import { analyze as analyzeHotSector } from '@/services/scoring/hotSectorAnalyzer'
import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 默认样本数据（股票池为空时的回退数据）
// ============================================================

const HOT_SECTOR_DEFAULT_SAMPLES: HotSectorAnalyzerInput[] = [
  {
    symbol: 'AI_算力',
    sectorName: 'AI 算力',
    momentum: { sectorStrengthScore: 4.5, priceChangeRank: 1, volumeExpansion: 2.5, consecutiveInflow: 8, relativeStrength: 85 },
    sentiment: { sentimentRank: 1, retailSentiment: 0.85, institutionBuyCount: 12, limitUpCount: 5 },
    breakout: { hasBreakoutPattern: true, rsiSignal: 'bullish', rsi: 65, priceAboveMA20: true, priceAboveMA60: true },
    valuationRisk: { pe: 65, pbPercentile: 80, marketCap: 8000, dividendYield: 0.5 },
    marketEnv: { marketTrend: 'bull', systemicRisk: 'low' },
  },
  {
    symbol: '半导体',
    sectorName: '半导体',
    momentum: { sectorStrengthScore: 4.0, priceChangeRank: 3, volumeExpansion: 1.8, consecutiveInflow: 5, relativeStrength: 72 },
    sentiment: { sentimentRank: 4, retailSentiment: 0.7, institutionBuyCount: 8, limitUpCount: 3 },
    breakout: { hasBreakoutPattern: true, rsiSignal: 'bullish', rsi: 58, priceAboveMA20: true, priceAboveMA60: false },
    valuationRisk: { pe: 55, pbPercentile: 65, marketCap: 5000, dividendYield: 0.8 },
    marketEnv: { marketTrend: 'bull', systemicRisk: 'low' },
  },
  {
    symbol: '新能源',
    sectorName: '新能源',
    momentum: { sectorStrengthScore: 2.5, priceChangeRank: 8, volumeExpansion: 0.8, consecutiveInflow: 1, relativeStrength: 45 },
    sentiment: { sentimentRank: 10, retailSentiment: 0.4, institutionBuyCount: 2, limitUpCount: 0 },
    breakout: { hasBreakoutPattern: false, rsiSignal: 'bearish', rsi: 35, priceAboveMA20: false, priceAboveMA60: false },
    valuationRisk: { pe: 18, pbPercentile: 20, marketCap: 2000, dividendYield: 2.0 },
    marketEnv: { marketTrend: 'sideways', systemicRisk: 'medium' },
  },
  {
    symbol: '白酒',
    sectorName: '白酒',
    momentum: { sectorStrengthScore: 3.2, priceChangeRank: 5, volumeExpansion: 1.2, consecutiveInflow: 3, relativeStrength: 58 },
    sentiment: { sentimentRank: 6, retailSentiment: 0.55, institutionBuyCount: 5, limitUpCount: 1 },
    breakout: { hasBreakoutPattern: false, rsiSignal: 'neutral', rsi: 48, priceAboveMA20: true, priceAboveMA60: false },
    valuationRisk: { pe: 32, pbPercentile: 50, marketCap: 3000, dividendYield: 1.5 },
    marketEnv: { marketTrend: 'sideways', systemicRisk: 'medium' },
  },
]

export interface HotSectorState {
  scores: HotSectorScore[]
  loading: boolean
  error: string | null
  isRefreshing: boolean
  lastUpdated: number

  // Actions
  setScores: (scores: HotSectorScore[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
  clearScores: () => void
  /**
   * 执行热门板块评分。
   * - 传入 inputs 时直接作为分析输入
   * - 否则使用默认样本数据进行演示分析
   */
  fetchScores: (inputs?: HotSectorAnalyzerInput[]) => Promise<void>
  /**
   * 刷新指定标的的评分。
   */
  refreshScore: (symbol: string) => void
}

const initialState = {
  scores: [] as HotSectorScore[],
  loading: false,
  error: null as string | null,
  isRefreshing: false,
  lastUpdated: 0,
}

/**
 * useHotSectorStore
 */
export const useHotSectorStore = create<HotSectorState>((set, get) => ({
  ...initialState,

  setScores: (scores) => {
    set({ scores })
    withBroadcast(EVENT_NAMES.HOT_SECTOR_CHANGED, { action: 'setScores', count: scores.length })
  },
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  reset: () => {
    set(initialState)
    withBroadcast(EVENT_NAMES.HOT_SECTOR_CHANGED, { action: 'reset' })
  },

  clearScores: () => {
    set(initialState)
    withBroadcast(EVENT_NAMES.HOT_SECTOR_CHANGED, { action: 'clearScores' })
  },

  refreshScore: (symbol) => {
    const { scores } = get()
    const index = scores.findIndex((s) => s.symbol === symbol)
    if (index === -1) return

    // 重新计算该标的的评分（需要原始输入，这里简化处理）
    logger.info(`[hotSectorStore] refreshScore: ${symbol}`)
  },

  fetchScores: async (inputs) => {
    const { isRefreshing } = get()
    if (isRefreshing) {
      logger.debug('[hotSectorStore] fetchScores 已在进行中，跳过并发调用')
      return
    }

    const isFirstLoad = get().scores.length === 0 && get().error === null
    logger.info(`[hotSectorStore] fetchScores 开始 (${isFirstLoad ? '首次加载' : '增量刷新'})`)
    set({ isRefreshing: true, loading: isFirstLoad, error: null })

    try {
      const analysisInputs = inputs ?? HOT_SECTOR_DEFAULT_SAMPLES
      logger.info(`[hotSectorStore] 使用 ${analysisInputs.length} 个标的进行分析`)

      // 调用引擎进行批量分析
      const scores: HotSectorScore[] = analysisInputs.map((input) => {
        const score = analyzeHotSector(input)
        logger.info(`[hotSectorStore] ${input.symbol} 评分完成: score=${score.score.toFixed(2)} action=${score.action}`)
        return score
      })

      // 按评分降序排序
      scores.sort((a, b) => b.score - a.score)

      set({
        scores,
        loading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: Date.now(),
      })

      logger.info(`[hotSectorStore] fetchScores 完成: ${scores.length} 个板块`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[hotSectorStore] fetchScores 失败: ${message}`)
      set({
        error: message,
        loading: false,
        isRefreshing: false,
      })
    }
  },
}))

// ============================================================
// DataBridge 订阅（用于跨模块数据同步）
// ============================================================

let _unsubscribeHotSectorScores: (() => void) | undefined

/**
 * initHotSectorStoreSubscriptions
 */
export function initHotSectorStoreSubscriptions(): () => void {
  destroyHotSectorStoreSubscriptions()
  logger.info('[hotSectorStore] 初始化 DataBridge hot_sector_scores 频道订阅')

  _unsubscribeHotSectorScores = dataBridge.subscribe(
    'hot_sector_scores',
    (envelope) => {
      if (envelope.meta.action === ENVELOPE_ACTION.saveHotSectorScores) {
        logger.info('[hotSectorStore] DataBridge event received: saveHotSectorScore', {
          traceId: envelope.meta.traceId,
        })
        // 收到数据更新通知后，可以触发重新获取数据
        // 实际刷新逻辑由页面通过 fetchScores 或直接调用 hotSectorAnalyzer 执行
      }
    },
  )

  return () => destroyHotSectorStoreSubscriptions()
}

/**
 * destroyHotSectorStoreSubscriptions
 * @returns void
 */
export function destroyHotSectorStoreSubscriptions(): void {
  if (_unsubscribeHotSectorScores) {
    _unsubscribeHotSectorScores()
    _unsubscribeHotSectorScores = undefined
  }
}

// ============================================================
// 派生查询
// ============================================================

/** 获取评分最高的前 N 条 */
export function topScores(n: number = 5): HotSectorScore[] {
  return useHotSectorStore.getState().scores.slice(0, n)
}

/** 获取买入信号（action='immediate'） */
export function buySignals(): HotSectorScore[] {
  return useHotSectorStore.getState().scores.filter((s) => s.action === 'immediate')
}

/** 按 symbol 查找评分 */
export function bySector(symbol: string): HotSectorScore | undefined {
  return useHotSectorStore.getState().scores.find((s) => s.symbol === symbol)
}
