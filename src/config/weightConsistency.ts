/**
 * @module WeightConsistencyValidator
 * @description 权重一致性校验（P1 修复 R10：权重配置错误 和≠1）
 *
 * 校验所有评分权重配置的有效性：
 * 1. 维度权重和 = 1.0
 * 2. 子因子权重和 = 1.0
 * 3. 权重范围 [0, 1]
 * 4. 权重格式正确（非 NaN、非 Infinity）
 *
 * @doc V9-DOC-QUALITY-010
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ── 类型定义 ──

/** 权重校验结果 */
export interface WeightValidationResult {
  /** 配置名称 */
  configName: string
  /** 权重和 */
  sum: number
  /** 是否通过（和 = 1.0，容差 0.001） */
  valid: boolean
  /** 偏差 */
  deviation: number
  /** 权重列表 */
  weights: Array<{ name: string; value: number }>
  /** 无效的权重 */
  invalidWeights: string[]
  /** 建议修正值 */
  suggestion?: string
}

/** 权重校验报告 */
export interface WeightValidationReport {
  /** 是否全部通过 */
  allValid: boolean
  /** 各项校验结果 */
  results: WeightValidationResult[]
  /** 总结 */
  summary: string
}

// ── 容差 ──

const WEIGHT_TOLERANCE = 0.001

// ── 校验逻辑 ──

/**
 * 校验一组权重
 *
 * @param configName - 配置名称
 * @param weights - 权重映射 { name: weight }
 * @returns 校验结果
 */
export function validateWeights(
  configName: string,
  weights: Record<string, number>,
): WeightValidationResult {
  const weightList = Object.entries(weights).map(([name, value]) => ({ name, value }))
  const sum = weightList.reduce((acc, w) => acc + w.value, 0)
  const deviation = Math.abs(sum - 1.0)
  const valid = deviation <= WEIGHT_TOLERANCE

  const invalidWeights: string[] = []

  for (const w of weightList) {
    if (isNaN(w.value)) {
      invalidWeights.push(`${w.name}: NaN`)
    } else if (!isFinite(w.value)) {
      invalidWeights.push(`${w.name}: Infinity`)
    } else if (w.value < 0 || w.value > 1) {
      invalidWeights.push(`${w.name}: ${w.value} (超出 [0,1] 范围)`)
    }
  }

  let suggestion: string | undefined
  if (!valid && sum > 0) {
    // 建议按比例归一化
    const normalized = weightList.map((w) => ({
      name: w.name,
      value: parseFloat((w.value / sum).toFixed(4)),
    }))
    suggestion = `建议归一化: ${normalized.map((w) => `${w.name}=${w.value}`).join(', ')}`
  }

  return {
    configName,
    sum: parseFloat(sum.toFixed(4)),
    valid,
    deviation: parseFloat(deviation.toFixed(4)),
    weights: weightList,
    invalidWeights,
    suggestion,
  }
}

/**
 * 校验多组权重配置
 *
 * @param configs - 多组权重配置
 * @returns 校验报告
 */
export function validateAllWeights(
  configs: Record<string, Record<string, number>>,
): WeightValidationReport {
  const results: WeightValidationResult[] = []

  for (const [configName, weights] of Object.entries(configs)) {
    results.push(validateWeights(configName, weights))
  }

  const allValid = results.every((r) => r.valid && r.invalidWeights.length === 0)
  const invalidCount = results.filter((r) => !r.valid).length
  const invalidWeightCount = results.filter((r) => r.invalidWeights.length > 0).length

  const summaryParts: string[] = []
  if (allValid) {
    summaryParts.push('✅ 所有权重配置有效')
  } else {
    summaryParts.push(`❌ ${invalidCount} 组权重和不等于 1.0`)
    if (invalidWeightCount > 0) {
      summaryParts.push(`${invalidWeightCount} 组包含无效权重值`)
    }
  }

  return {
    allValid,
    results,
    summary: summaryParts.join('；'),
  }
}

/**
 * 校验 V6 引擎的因子权重配置
 *
 * 适用于 src/config/intelligentScoreConfig.ts 中的 FACTOR_WEIGHTS
 */
export function validateFactorWeights(
  factorWeights: Record<string, number>,
): WeightValidationResult {
  return validateWeights('V6 因子权重', factorWeights)
}

/**
 * 校验行业评分权重配置
 */
export function validateIndustryScoreWeights(
  industryWeights: Record<string, number>,
): WeightValidationResult {
  return validateWeights('行业评分权重', industryWeights)
}

/**
 * 按比例归一化权重
 *
 * @param weights - 原始权重
 * @returns 归一化后的权重
 */
export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0)
  if (sum === 0) return weights

  const normalized: Record<string, number> = {}
  for (const [key, value] of Object.entries(weights)) {
    normalized[key] = parseFloat((value / sum).toFixed(4))
  }
  return normalized
}

/**
 * 运行时权重校验（在评分计算前调用）
 *
 * 如果权重和不等于 1.0，自动归一化并记录告警
 */
export function ensureValidWeights(
  configName: string,
  weights: Record<string, number>,
): { weights: Record<string, number>; normalized: boolean; result: WeightValidationResult } {
  const result = validateWeights(configName, weights)

  if (!result.valid) {
    logger.warn(`[WeightValidation] ${configName} 权重校验失败`, {
      sum: result.sum,
      deviation: result.deviation,
      suggestion: result.suggestion,
    })
    return {
      weights: normalizeWeights(weights),
      normalized: true,
      result,
    }
  }

  return {
    weights,
    normalized: false,
    result,
  }
}