/**
 * @fileoverview V6 评分因子相关性分析器
 *
 * 计算 11 层因子间的 Pearson/Spearman 相关系数矩阵，
 * 用于评估因子独立性、检测冗余因子、验证评分体系稳健性。
 *
 * @module services/scoring/v6-engine/correlationAnalyzer
 * @created 2026-07-14 - 二次校对整改
 */

import { getLogger } from '@/lib/logger'
import { pearsonCorrelation, spearmanCorrelation } from '@/core/statistics'
import type { LayerId } from '@/types/modules/engine.types'

const logger = getLogger()

/** 11 层 ID 列表 */
const LAYER_IDS: readonly LayerId[] = [
  'lMinus1', 'l0', 'l1', 'l2', 'l3f', 'l3v', 'l4', 'l5', 'l6', 'l7', 'l8',
]

/** 相关性矩阵单元格 */
export interface CorrelationCell {
  readonly layerA: LayerId
  readonly layerB: LayerId
  readonly pearson: number
  readonly spearman: number
  readonly interpretation: 'strong-positive' | 'moderate-positive' | 'weak' | 'moderate-negative' | 'strong-negative'
}

/** 相关性分析结果 */
export interface CorrelationResult {
  /** Pearson 相关矩阵 */
  readonly pearsonMatrix: Readonly<Record<string, Readonly<Record<string, number>>>>
  /** Spearman 相关矩阵 */
  readonly spearmanMatrix: Readonly<Record<string, Readonly<Record<string, number>>>>
  /** 显著的配对（|r| > 0.7） */
  readonly significantPairs: readonly CorrelationCell[]
  /** 冗余因子对（|r| > 0.8，提示信息重复） */
  readonly redundantPairs: readonly CorrelationCell[]
  /** 独立因子对（|r| < 0.3） */
  readonly independentPairs: readonly CorrelationCell[]
  /** 样本数 */
  readonly sampleSize: number
  /** 统计摘要 */
  readonly summary: {
    readonly avgAbsCorrelation: number
    readonly maxCorrelation: number
    readonly minCorrelation: number
    readonly redundantCount: number
    readonly independentCount: number
  }
}

/**
 * 计算 Pearson 相关系数（re-export from core/statistics）
 * @see {@link ../../../core/statistics.ts}
 */
export { pearsonCorrelation, spearmanCorrelation } from '@/core/statistics'

/**
 * 解释相关系数
 * @param r - 相关系数
 * @returns 解释类别
 */
function interpretCorrelation(r: number): CorrelationCell['interpretation'] {
  const absR = Math.abs(r)
  if (r > 0.7) return 'strong-positive'
  if (r > 0.3) return 'moderate-positive'
  if (absR < 0.3) return 'weak'
  if (r < -0.7) return 'strong-negative'
  return 'moderate-negative'
}

/**
 * 分析 V6 评分因子相关性
 *
 * @param scores - 多只股票的层级评分数据
 * @returns 相关性分析结果
 */
export function analyzeCorrelations(
  scores: ReadonlyArray<Record<LayerId, number>>,
): CorrelationResult {
  const sampleSize = scores.length
  logger.info('[correlationAnalyzer] 开始相关性分析', { sampleSize })

  // 提取每层的得分数组
  const layerScores: Record<string, number[]> = {}
  for (const layerId of LAYER_IDS) {
    layerScores[layerId] = scores.map(s => s[layerId] ?? NaN).filter(v => !Number.isNaN(v))
  }

  // 计算相关矩阵
  const pearsonMatrix: Record<string, Record<string, number>> = {}
  const spearmanMatrix: Record<string, Record<string, number>> = {}
  const significantPairs: CorrelationCell[] = []
  const redundantPairs: CorrelationCell[] = []
  const independentPairs: CorrelationCell[] = []

  const allAbsCorrelations: number[] = []

  for (const layerA of LAYER_IDS) {
    pearsonMatrix[layerA] = {}
    spearmanMatrix[layerA] = {}

    for (const layerB of LAYER_IDS) {
      const scoresA = layerScores[layerA] ?? []
      const scoresB = layerScores[layerB] ?? []

      const r = layerA === layerB ? 1 : pearsonCorrelation(scoresA, scoresB)
      const rho = layerA === layerB ? 1 : spearmanCorrelation(scoresA, scoresB)

      pearsonMatrix[layerA][layerB] = Math.round(r * 1000) / 1000
      spearmanMatrix[layerA][layerB] = Math.round(rho * 1000) / 1000

      if (layerA !== layerB) {
        allAbsCorrelations.push(Math.abs(r))
        const cell: CorrelationCell = {
          layerA: layerA,
          layerB: layerB,
          pearson: r,
          spearman: rho,
          interpretation: interpretCorrelation(r),
        }

        if (Math.abs(r) > 0.7) {
          significantPairs.push(cell)
        }
        if (Math.abs(r) > 0.8) {
          redundantPairs.push(cell)
        }
        if (Math.abs(r) < 0.3) {
          independentPairs.push(cell)
        }
      }
    }
  }

  const avgAbs = allAbsCorrelations.length > 0
    ? allAbsCorrelations.reduce((a, b) => a + b, 0) / allAbsCorrelations.length
    : 0
  const maxCorr = allAbsCorrelations.length > 0 ? Math.max(...allAbsCorrelations) : 0
  const minCorr = allAbsCorrelations.length > 0 ? Math.min(...allAbsCorrelations) : 0

  const result: CorrelationResult = {
    pearsonMatrix,
    spearmanMatrix,
    significantPairs,
    redundantPairs,
    independentPairs,
    sampleSize,
    summary: {
      avgAbsCorrelation: Math.round(avgAbs * 1000) / 1000,
      maxCorrelation: Math.round(maxCorr * 1000) / 1000,
      minCorrelation: Math.round(minCorr * 1000) / 1000,
      redundantCount: redundantPairs.length,
      independentCount: independentPairs.length,
    },
  }

  logger.info('[correlationAnalyzer] 相关性分析完成', {
    sampleSize,
    significantPairs: significantPairs.length,
    redundantPairs: redundantPairs.length,
    independentPairs: independentPairs.length,
    avgAbsCorrelation: result.summary.avgAbsCorrelation,
  })

  return result
}
