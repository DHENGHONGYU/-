/**
 * @module valuePitStore
 * @lifecycle @Global
 * @description 价值洼地策略评分状态管理。管理价值洼地五维评分列表，
 * 提供评分获取、单标的刷新、清空等操作，以及 topScores/buildCandidates/waitSignalList 等派生查询。
 *
 * @compliance
 * - 所有数据展示来自 valuePitAnalyzer 服务，禁止硬编码
 * - 无输入数据时返回空结果，不 fallback 到 Mock 数据
 * - 核心分支包含 logger.info 打印
 * - 遵循现有 Zustand Store 风格
  * @doc [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { ValuePitScore } from '@/data/types'
import { analyze, type ValuePitAnalyzerInput } from '@/services/scoring/valuePitAnalyzer'
import type { RotationSignal } from '@/services/scoring/rotationSignalDetector'

const logger = getLogger()

// 已移除内联 DEFAULT_SAMPLES / DEFAULT_ROTATION_INPUTS。
// 无输入数据时 fetchScores / fetchRotationSignals 返回空结果。

// ============================================================
// 组合结果类型
// ============================================================

export interface ValuePitSectorResult {
  score: ValuePitScore
  rotation: RotationSignal
}

// ============================================================
// Store 接口
// ============================================================

interface ValuePitState {
  /** 评分列表 */
  scores: ValuePitScore[]
  /** 轮动信号列表 */
  rotationSignals: RotationSignal[]
  /** 组合结果（评分 + 轮动信号） */
  combinedResults: ValuePitSectorResult[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳 */
  lastUpdated: number

  // Actions
  /** 运行组合分析（价值洼地评分 + 轮动信号检测） */
  runAnalysis: () => void
  fetchScores: (inputs?: ValuePitAnalyzerInput[]) => void
  refreshScore: (symbol: string, inputs?: ValuePitAnalyzerInput[]) => void
  clearScores: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  scores: [] as ValuePitScore[],
  rotationSignals: [] as RotationSignal[],
  combinedResults: [] as ValuePitSectorResult[],
  loading: false,
  error: null as string | null,
  lastUpdated: 0,
}

// ============================================================
// Store
// ============================================================

/**
 * useValuePitStore
 */
export const useValuePitStore = create<ValuePitState>((set) => ({
  ...initialState,

  runAnalysis: () => {
    logger.info('[valuePitStore] runAnalysis 开始（需外部注入输入数据）')
    set({ loading: true, error: null })
    try {
      logger.warn('[valuePitStore] runAnalysis: 无输入数据，请先调用 fetchScores(inputs)')
      set({ loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[valuePitStore] runAnalysis 失败: ${message}`)
      set({ error: message, loading: false })
    }
  },

  fetchScores: (inputs) => {
    logger.info('[valuePitStore] fetchScores 开始')
    set({ loading: true, error: null })

    try {
      if (!inputs || inputs.length === 0) {
        logger.info('[valuePitStore] fetchScores: 无输入数据，返回空结果')
        set({ loading: false })
        return
      }
      const sourceInputs = inputs
      const results = sourceInputs.map((input) => {
        const score = analyze(input)
        logger.info(
          `[valuePitStore] ${input.symbol} 评分: score=${score.score.toFixed(2)} action=${score.action}`,
        )
        return score
      })

      results.sort((a, b) => b.score - a.score)
      set({
        scores: results,
        loading: false,
        lastUpdated: Date.now(),
      })
      logger.info(`[valuePitStore] fetchScores 完成: ${results.length} 个板块`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[valuePitStore] fetchScores 失败: ${message}`)
      set({ error: message, loading: false })
    }
  },

  refreshScore: (symbol, inputs) => {
    logger.info(`[valuePitStore] refreshScore: ${symbol}`)
    if (!inputs || inputs.length === 0) {
      logger.warn(`[valuePitStore] refreshScore: 无输入数据`)
      return
    }
    const sourceInputs = inputs
    const target = sourceInputs.find((i) => i.symbol === symbol)

    if (!target) {
      logger.warn(`[valuePitStore] refreshScore 未找到标的: ${symbol}`)
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
      logger.info(`[valuePitStore] refreshScore 完成: ${symbol} score=${newScore.score.toFixed(2)}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[valuePitStore] refreshScore 失败: ${message}`)
      set({ error: message })
    }
  },

  clearScores: () => {
    logger.info('[valuePitStore] clearScores')
    set({
      scores: [],
      rotationSignals: [],
      combinedResults: [],
      loading: false,
      error: null,
      lastUpdated: 0,
    })
  },
}))

// ============================================================
// 派生查询（Getters）
// ============================================================

/** 获取 Top N 评分 */
export function topScores(limit: number = 5): ValuePitScore[] {
  const { scores } = useValuePitStore.getState()
  return scores.slice(0, limit)
}

/** 获取建仓候选列表 */
export function buildCandidates(): ValuePitScore[] {
  const { scores } = useValuePitStore.getState()
  return scores.filter((s) => s.action === 'immediate')
}

/** 获取等待信号列表 */
export function waitSignalList(): ValuePitScore[] {
  const { scores } = useValuePitStore.getState()
  return scores.filter((s) => s.action === 'wait')
}