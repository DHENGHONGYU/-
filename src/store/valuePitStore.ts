/**
 * @module valuePitStore
 * @lifecycle @Global
 * @description 价值洼地策略评分状态管理。管理价值洼地五维评分列表，
 * 提供评分获取、单标的刷新、清空等操作，以及 topScores/buildCandidates/waitSignalList 等派生查询。
 *
 * @compliance
 * - 所有数据展示来自 valuePitAnalyzer 服务，禁止硬编码
 * - 核心分支包含 logger.info 打印
 * - 遵循现有 Zustand Store 风格
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { ValuePitScore } from '@/data/types'
import { analyze, type ValuePitAnalyzerInput } from '@/services/scoring/valuePitAnalyzer'
import { detect, type RotationSignalInput, type RotationSignal } from '@/services/scoring/rotationSignalDetector'

const logger = getLogger()

// ============================================================
// 内部样本数据（后续由 dataLayer 替代）
// ============================================================

const DEFAULT_SAMPLES: ValuePitAnalyzerInput[] = [
  {
    symbol: '银行',
    sectorName: '银行',
    catalyst: { policyCatalyst: 4.0, cycleTurningPoint: 3.5, techBreakthrough: 2.0, orderSurge: 2.5 },
    valuationMargin: { pePercentile: 5, pbPercentile: 8, dividendYield: 4.5, peg: 0.6 },
    chipStructure: { northBoundChange: 2.5, fundPositionChange: 3.0, shareholderChange: -1.5 },
    rotationPosition: { sectorVolumePercentile: 15, capitalInflowStrength: 4.0, hasGoldenCross: true },
    liquidity: { avgDailyAmount: 80000, turnoverRate: 1.5, marketCap: 1500 },
  },
  {
    symbol: '钢铁',
    sectorName: '钢铁',
    catalyst: { policyCatalyst: 3.0, cycleTurningPoint: 3.0, techBreakthrough: 2.0, orderSurge: 2.0 },
    valuationMargin: { pePercentile: 15, pbPercentile: 20, dividendYield: 3.0, peg: 0.8 },
    chipStructure: { northBoundChange: 1.0, fundPositionChange: 1.5, shareholderChange: -0.5 },
    rotationPosition: { sectorVolumePercentile: 40, capitalInflowStrength: 3.0, hasGoldenCross: false },
    liquidity: { avgDailyAmount: 30000, turnoverRate: 2.5, marketCap: 500 },
  },
  {
    symbol: '煤炭',
    sectorName: '煤炭',
    catalyst: { policyCatalyst: 2.5, cycleTurningPoint: 2.0, techBreakthrough: 1.5, orderSurge: 1.5 },
    valuationMargin: { pePercentile: 10, pbPercentile: 12, dividendYield: 5.0, peg: 0.5 },
    chipStructure: { northBoundChange: -0.5, fundPositionChange: 0.5, shareholderChange: 2.0 },
    rotationPosition: { sectorVolumePercentile: 55, capitalInflowStrength: 2.0, hasGoldenCross: false },
    liquidity: { avgDailyAmount: 15000, turnoverRate: 1.0, marketCap: 300 },
  },
]

// ============================================================
// 轮动信号检测样本数据（与 DEFAULT_SAMPLES 对应）
// ============================================================

const DEFAULT_ROTATION_INPUTS: RotationSignalInput[] = [
  {
    sectorId: '银行',
    volume: { history: [...Array(50).fill(60000), 100000, 110000, 120000, 115000, 105000] },
    capitalFlow: { dailyNetFlow: [10, 20, 15, 30, 25] },
    goldenCross: { closes: [...Array(20).fill(105), 100, 100, 100, 100, 130] },
  },
  {
    sectorId: '钢铁',
    volume: { history: [...Array(50).fill(30000), 35000, 32000, 31000, 33000, 34000] },
    capitalFlow: { dailyNetFlow: [5, 3, -2, 8, 2] },
    goldenCross: { closes: [...Array(25).fill(100)] },
  },
  {
    sectorId: '煤炭',
    volume: { history: [...Array(40).fill(15000), ...Array(10).fill(20000), 16000, 16000, 16000, 16000, 16000] },
    capitalFlow: { dailyNetFlow: [-3, -5, -2, 1, -1] },
    goldenCross: { closes: Array(25).fill(100).map((v, i) => v - i * 0.5) },
  },
]

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

export const useValuePitStore = create<ValuePitState>((set) => ({
  ...initialState,

  runAnalysis: () => {
    logger.info('[valuePitStore] runAnalysis 开始')
    set({ loading: true, error: null })

    try {
      const combinedResults: ValuePitSectorResult[] = DEFAULT_SAMPLES.map((input, index) => {
        const score = analyze(input)
        const rotationInput = DEFAULT_ROTATION_INPUTS[index]!
        const rotation = detect(rotationInput)
        logger.info(
          `[valuePitStore] ${input.symbol} 评分: score=${score.score.toFixed(2)} ` +
          `action=${score.action} rotation=${rotation.triggered ? rotation.strength : '无'}`,
        )
        return { score, rotation }
      })

      combinedResults.sort((a, b) => b.score.score - a.score.score)
      set({
        scores: combinedResults.map((r) => r.score),
        rotationSignals: combinedResults.map((r) => r.rotation),
        combinedResults,
        loading: false,
        lastUpdated: Date.now(),
      })
      logger.info(`[valuePitStore] runAnalysis 完成: ${combinedResults.length} 个板块`)
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
      const sourceInputs = inputs ?? DEFAULT_SAMPLES
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
    const sourceInputs = inputs ?? DEFAULT_SAMPLES
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