/**
 * @module factorContributions
 * @description 基于 V6ScoreEngine.audit() 输出计算各因子对综合评分的贡献明细。
 * 所有权重、阈值均来自引擎配置，禁止硬编码。
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-FRONT-012]
*/

import type { ScoreAuditTrail, FactorContribution } from './types'
import { ALL_LAYER_IDS, LAYER_LABELS } from './types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 将 score 转换为有限值，NaN/±Infinity/非数字 → 0
 */
function toFiniteScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return value
}

/**
 * 检测层得分是否有效（非缺失、非 NaN/Infinity、非非数字）
 */
function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 获取层得分无效的原因描述（与 engine.ts aggregate 保持一致）
 */
function invalidScoreReason(layerId: string, score: unknown): string {
  if (score == null) return `层 ${layerId} 缺失 (${score === null ? 'null' : 'undefined'})`
  if (typeof score !== 'number') {
    let scoreStr: string
    if (typeof score === 'object' && score !== null) {
      scoreStr = JSON.stringify(score)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      scoreStr = String(score)
    }
    return `层 ${layerId} score 类型非法 (${typeof score} = ${scoreStr})`
  }
  if (Number.isNaN(score)) return `层 ${layerId} score 为 NaN`
  if (score === Infinity) return `层 ${layerId} score 为 +Infinity`
  if (score === -Infinity) return `层 ${layerId} score 为 -Infinity`
  return `层 ${layerId} score 非有限值 (${score})`
}

/**
 * 根据审计追踪计算因子贡献明细。
 *
 * 计算规则：
 * 1. 仅参与计算的层（score > 0 且 weight > 0，且 score 为有限数字）纳入总权重。
 * 2. 归一化权重 = 该层权重 / 总权重。
 * 3. 绝对贡献 = 层得分 × 归一化权重 × 100 / 层满分（默认 5）。
 * 4. 中性基准 = (layerScore.min + layerScore.max) / 2，来自阈值配置。
 * 5. signedContribution = (层得分 - 中性基准) × 归一化权重 × 100 / 层满分，
 *    用于瀑布图展示正向/负向贡献。
 *
 * @param trail - 审计追踪
 * @returns 因子贡献明细数组
 */
export function buildFactorContributions(trail: ScoreAuditTrail): FactorContribution[] {
  const { config, composite } = trail
  const weights = config.weights
  const layerScores = composite.layers
  const { min, max } = config.thresholds.layerScore
  const baseline = (min + max) / 2
  const scale = max > 0 ? 100 / max : 20

  // 检测缺失/无效的因子得分
  const missingFactors: string[] = []
  const missingWeights: string[] = []
  const invalidScores: string[] = []
  for (const id of ALL_LAYER_IDS) {
    const score = layerScores[id]
    const w = weights[id]
    if (score == null) missingFactors.push(LAYER_LABELS[id])
    else if (!isValidScore(score)) invalidScores.push(`${LAYER_LABELS[id]}(${id}) — ${invalidScoreReason(id, score)}`)
    if (w == null) missingWeights.push(id)
  }
  if (missingFactors.length > 0) {
    logger.warn('[V6Engine] 因子贡献度缺失', { factor: missingFactors.join(', ') })
  }
  if (invalidScores.length > 0) {
    for (const msg of invalidScores) {
      logger.warn(`[V6Engine] 因子贡献度无效评分，跳过该层。原因: ${msg}`)
    }
  }
  if (missingWeights.length > 0) {
    logger.warn('[V6Engine] 因子权重缺失', { factor: missingWeights.join(', ') })
  }

  const activeLayers = ALL_LAYER_IDS.filter((id) => {
    const rawScore = layerScores[id]
    const rawWeight = weights[id]
    const score = toFiniteScore(rawScore)
    const weight = rawWeight
    return score > 0 && weight > 0
  })

  const totalWeight = activeLayers.reduce((sum, id) => {
    const rawW = weights[id]
    const w = rawW
    return sum + w
  }, 0)

  if (totalWeight === 0 || activeLayers.length === 0) {
    return []
  }

  const weightedAverage =
    activeLayers.reduce((sum, id) => {
      const score = layerScores[id]
      const weight = weights[id]
      return sum + score * weight
    }, 0) / totalWeight
  const finalScaled = weightedAverage * scale

  return activeLayers.map((id) => {
    const score = layerScores[id]
    const weight = weights[id]
    const normalizedWeight = weight / totalWeight
    const contribution = score * normalizedWeight * scale
    const signedContribution = (score - baseline) * normalizedWeight * scale
    const contributionRate = finalScaled > 0 ? contribution / finalScaled : 0

    return {
      factorId: id,
      label: LAYER_LABELS[id],
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
