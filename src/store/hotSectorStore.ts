/**
 * @module hotSectorStore
 * @lifecycle @Global
 * @description 热门板块策略评分状态管理。管理热门板块五维评分列表，
 * 提供评分获取、单标的刷新、清空等操作，以及 topScores/buySignals/bySector 等派生查询。
 *
 * @compliance
 * - 所有数据展示来自 hotSectorAnalyzer 服务，禁止硬编码
 * - 核心分支包含 logger.info 打印
 * - 遵循现有 Zustand Store 风格
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { HotSectorScore } from '@/data/types'
import { analyze, type HotSectorAnalyzerInput } from '@/services/scoring/hotSectorAnalyzer'

const logger = getLogger()

// ============================================================
// 内部样本数据（后续由 dataLayer 替代）
// ============================================================

const DEFAULT_SAMPLES: HotSectorAnalyzerInput[] = [
  {
    symbol: 'AI_算力',
    sectorName: 'AI 算力',
    momentum: { sectorStrengthScore: 4.5, priceChangeRank: 1, volumeExpansion: 2.5, consecutiveInflow: 8, relativeStrength: 85 },
    sentiment: { sentimentRank: 1, retailSentiment: 0.85, institutionBuyCount: 12, limitUpCount: 5 },
    breakout: { hasBreakoutPattern: true, macdSignal: 'bullish', rsi: 65, priceAboveMA20: true, priceAboveMA60: true },
    valuationRisk: { pe: 65, pbPercentile: 80, marketCap: 8000, dividendYield: 0.5 },
    marketEnv: { marketTrend: 'bull', systemicRisk: 'low' },
  },
  {
    symbol: '半导体',
    sectorName: '半导体',
    momentum: { sectorStrengthScore: 4.0, priceChangeRank: 3, volumeExpansion: 1.8, consecutiveInflow: 5, relativeStrength: 72 },
    sentiment: { sentimentRank: 4, retailSentiment: 0.7, institutionBuyCount: 8, limitUpCount: 3 },
    breakout: { hasBreakoutPattern: true, macdSignal: 'bullish', rsi: 58, priceAboveMA20: true, priceAboveMA60: false },
    valuationRisk: { pe: 55, pbPercentile: 65, marketCap: 5000, dividendYield: 0.8 },
    marketEnv: { marketTrend: 'bull', systemicRisk: 'low' },
  },
  {
    symbol: '新能源',
    sectorName: '新能源',
    momentum: { sectorStrengthScore: 2.5, priceChangeRank: 8, volumeExpansion: 0.8, consecutiveInflow: 1, relativeStrength: 45 },
    sentiment: { sentimentRank: 10, retailSentiment: 0.4, institutionBuyCount: 2, limitUpCount: 0 },
    breakout: { hasBreakoutPattern: false, macdSignal: 'bearish', rsi: 35, priceAboveMA20: false, priceAboveMA60: false },
    valuationRisk: { pe: 18, pbPercentile: 20, marketCap: 2000, dividendYield: 2.0 },
    marketEnv: { marketTrend: 'sideways', systemicRisk: 'medium' },
  },
  {
    symbol: '白酒',
    sectorName: '白酒',
    momentum: { sectorStrengthScore: 3.2, priceChangeRank: 5, volumeExpansion: 1.2, consecutiveInflow: 3, relativeStrength: 58 },
    sentiment: { sentimentRank: 6, retailSentiment: 0.55, institutionBuyCount: 5, limitUpCount: 1 },
    breakout: { hasBreakoutPattern: false, macdSignal: 'neutral', rsi: 48, priceAboveMA20: true, priceAboveMA60: false },
    valuationRisk: { pe: 32, pbPercentile: 50, marketCap: 3000, dividendYield: 1.5 },
    marketEnv: { marketTrend: 'sideways', systemicRisk: 'medium' },
  },
]

// ============================================================
// Store 接口
// ============================================================

interface HotSectorState {
  /** 评分列表 */
  scores: HotSectorScore[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳 */
  lastUpdated: number

  // Actions
  fetchScores: (inputs?: HotSectorAnalyzerInput[]) => void
  refreshScore: (symbol: string, inputs?: HotSectorAnalyzerInput[]) => void
  clearScores: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  scores: [] as HotSectorScore[],
  loading: false,
  error: null as string | null,
  lastUpdated: 0,
}

// ============================================================
// Store
// ============================================================

export const useHotSectorStore = create<HotSectorState>((set) => ({
  ...initialState,

  fetchScores: (inputs) => {
    logger.info('[hotSectorStore] fetchScores 开始')
    set({ loading: true, error: null })

    try {
      const sourceInputs = inputs ?? DEFAULT_SAMPLES
      const results = sourceInputs.map((input) => {
        const score = analyze(input)
        logger.info(
          `[hotSectorStore] ${input.symbol} 评分: score=${score.score.toFixed(2)} action=${score.action}`,
        )
        return score
      })

      results.sort((a, b) => b.score - a.score)
      set({
        scores: results,
        loading: false,
        lastUpdated: Date.now(),
      })
      logger.info(`[hotSectorStore] fetchScores 完成: ${results.length} 个板块`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[hotSectorStore] fetchScores 失败: ${message}`)
      set({ error: message, loading: false })
    }
  },

  refreshScore: (symbol, inputs) => {
    logger.info(`[hotSectorStore] refreshScore: ${symbol}`)
    const sourceInputs = inputs ?? DEFAULT_SAMPLES
    const target = sourceInputs.find((i) => i.symbol === symbol)

    if (!target) {
      logger.warn(`[hotSectorStore] refreshScore 未找到标的: ${symbol}`)
      return
    }

    try {
      const newScore = analyze(target)
      set((state) => {
        const scores = state.scores.map((s) =>
          s.symbol === symbol ? newScore : s,
        )
        scores.sort((a, b) => b.score - a.score)
        return { scores, lastUpdated: Date.now() }
      })
      logger.info(`[hotSectorStore] refreshScore 完成: ${symbol} score=${newScore.score.toFixed(2)}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[hotSectorStore] refreshScore 失败: ${message}`)
      set({ error: message })
    }
  },

  clearScores: () => {
    logger.info('[hotSectorStore] clearScores')
    set({ ...initialState })
  },
}))

// ============================================================
// 派生查询（Getters）
// ============================================================

/** 获取 Top N 评分 */
export function topScores(limit: number = 5): HotSectorScore[] {
  const { scores } = useHotSectorStore.getState()
  return scores.slice(0, limit)
}

/** 获取买入信号列表 */
export function buySignals(): HotSectorScore[] {
  const { scores } = useHotSectorStore.getState()
  return scores.filter((s) => s.action === 'immediate')
}

/** 按标的查询 */
export function bySector(symbol: string): HotSectorScore | undefined {
  const { scores } = useHotSectorStore.getState()
  return scores.find((s) => s.symbol === symbol)
}