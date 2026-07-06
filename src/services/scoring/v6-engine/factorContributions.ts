/**
 * @module factorContributions
 * @description 基于 V6ScoreEngine.audit() 输出计算各因子对综合评分的贡献明细。
 * 所有权重、阈值均来自引擎配置，禁止硬编码。
 */

import type { ScoreAuditTrail, FactorContribution, LayerId } from './types'
import { ALL_LAYER_IDS, LAYER_LABELS } from './types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 因子评分或权重缺失时的默认零值 */
const DEFAULT_MISSING_VALUE = 0

/**
 * 根据审计追踪计算因子贡献明细。
 *
 * 计算规则：
 * 1. 仅参与计算的层（score > 0 且 weight > 0）纳入总权重。
 * 2. 归一化权重 = 该层权重 / 总权重。
 * 3. 绝对贡献 = 层得分 × 归一化权重 × 100 / 层满分（默认 5）。
 * 4. 中性基准 = (layerScore.min + layerScore.max) / 2，来自阈值配置。
 * 5. signedContribution = (层得分 - 中性基准) × 归一化权重 × 100 / 层满分，
 *    用于瀑布图展示正向/负向贡献。
 */
export function buildFactorContributions(trail: ScoreAuditTrail): FactorContribution[] {
  const { config, composite } = trail
  const weights = config.weights
  const layerScores = composite.layers
  const { min, max } = config.thresholds.layerScore
  const baseline = (min + max) / 2
  const scale = max > 0 ? 100 / max : 20

  // 检测缺失的因子得分和权重
  const missingFactors: string[] = []
  const missingWeights: string[] = []
  for (const id of ALL_LAYER_IDS) {
    const lid = id as LayerId
    if (layerScores[lid] == null) missingFactors.push(LAYER_LABELS[lid] ?? lid)
    if (weights[lid as keyof typeof weights] == null) missingWeights.push(lid)
  }
  if (missingFactors.length > 0) {
    logger.warn('[V6Engine] 因子贡献度缺失', { factor: missingFactors.join(', ') })
  }
  if (missingWeights.length > 0) {
    logger.warn('[V6Engine] 因子权重缺失', { factor: missingWeights.join(', ') })
  }

  const activeLayers = ALL_LAYER_IDS.filter((id) => {
    const rawScore = layerScores[id as LayerId]
    const rawWeight = weights[id as keyof typeof weights]
    const score = rawScore ?? DEFAULT_MISSING_VALUE
    const weight = rawWeight ?? DEFAULT_MISSING_VALUE
    return score > 0 && weight > 0
  })

  const totalWeight = activeLayers.reduce((sum, id) => {
    const rawW = weights[id as keyof typeof weights]
    const w = rawW ?? DEFAULT_MISSING_VALUE
    return sum + w
  }, 0)

  if (totalWeight === 0 || activeLayers.length === 0) {
    return []
  }

  const weightedAverage =
    activeLayers.reduce((sum, id) => {
      const score = layerScores[id as LayerId] ?? 0
      const weight = weights[id as keyof typeof weights] ?? 0
      return sum + score * weight
    }, 0) / totalWeight
  const finalScaled = weightedAverage * scale

  return activeLayers.map((id) => {
    const score = layerScores[id as LayerId] ?? 0
    const weight = weights[id as keyof typeof weights] ?? 0
    const normalizedWeight = weight / totalWeight
    const contribution = score * normalizedWeight * scale
    const signedContribution = (score - baseline) * normalizedWeight * scale
    const contributionRate = finalScaled > 0 ? contribution / finalScaled : 0

    return {
      factorId: id as LayerId,
      label: LAYER_LABELS[id as LayerId] ?? id,
      weight,
      normalizedWeight,
      score,
      baseline,
      contribution,
      signedContribution,
      contributionRate,
    }
  })
}
