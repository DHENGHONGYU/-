/**
 * @module services/skills/factorRegressionSkill
 * @description S-01 因子回归权重校验 SKILL（Batch B 确定性计算）
 *
 * 借鉴 Alphalens 因子分析框架与 Fama-French/Barra 多因子模型，
 * 对 V6 各层因子得分与股票未来收益（或综合评分）做多元线性回归，
 * 输出系数显著性、VIF、权重校准建议，用于验证因子有效性与校准聚合权重。
 */

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import { olsRegression, type RegressionResult } from '@/services/scoring/v6-engine/regressionAnalyzer'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'

const logger = getLogger()

/**
 * VIF 兜底哨兵值。
 * 当回归分析的 VIF 计算结果缺失/非有限（如单因子退化、奇异矩阵前兆）时，
 * 使用此大值表示「无法评估/高度可疑」，而非裸魔法数字 9999。
 */
const VIF_FALLBACK = 9999

const FACTOR_IDS = [
  'lMinus1', 'l0', 'l1', 'l2', 'l3f', 'l3v', 'l4', 'l5', 'l6', 'l7', 'l8',
] as const

/**
 * FactorRegressionInputSchema
 */
export const FactorRegressionInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    /** 每只股票为一个样本：key=股票代码，value=因子得分映射 */
    samples: z.record(z.string(), z.record(z.string(), z.number())).optional(),
    /** 目标变量：股票未来收益或综合评分 */
    target: z.record(z.string(), z.number()).optional(),
    /** 当前权重配置 */
    currentWeights: z.record(z.string(), z.number()).optional(),
    /** 显著性阈值 */
    significanceLevel: z.number().min(0).max(1).optional(),
    /** VIF 阈值 */
    vifThreshold: z.number().positive().optional(),
  }).optional(),
})

export type FactorRegressionInput = z.infer<typeof FactorRegressionInputSchema>

const FactorWeightSchema = z.object({
  factorId: z.string(),
  currentWeight: z.number(),
  regressionBeta: z.number(),
  tStatistic: z.number(),
  pValue: z.number(),
  vif: z.number(),
  significant: z.boolean(),
  recommendedWeight: z.number(),
  rationale: z.string(),
})

/**
 * FactorRegressionOutputSchema
 */
export const FactorRegressionOutputSchema = z.object({
  rSquared: z.number(),
  adjustedRSquared: z.number(),
  fStatistic: z.number(),
  fPValue: z.number(),
  sampleSize: z.number().int(),
  factorCount: z.number().int(),
  factors: z.array(FactorWeightSchema),
  significantFactors: z.array(z.string()),
  insignificantFactors: z.array(z.string()),
  redundantFactors: z.array(z.string()),
  calibratedWeights: z.record(z.string(), z.number()),
  diagnostics: z.object({
    multicollinearityRisk: z.boolean(),
    lowExplanatoryPower: z.boolean(),
    calibrationNeeded: z.boolean(),
    messages: z.array(z.string()),
  }),
})

export type FactorRegressionOutput = z.infer<typeof FactorRegressionOutputSchema>

/** 将非有限数值收敛为可序列化的安全数值 */
function safeNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return value
}

function validateAndPrepareData(
  samples: Record<string, Record<string, number>> | undefined,
  target: Record<string, number> | undefined,
): {
  symbols: string[]
  factorIds: string[]
  y: number[]
  x: number[][]
} | null {
  if (!samples || Object.keys(samples).length === 0) {
    logger.warn('[factorRegressionSkill] 样本为空')
    return null
  }
  if (!target || Object.keys(target).length === 0) {
    logger.warn('[factorRegressionSkill] 目标变量为空')
    return null
  }

  const symbols = Object.keys(samples).filter(s => target[s] !== undefined)
  if (symbols.length < 3) {
    logger.warn('[factorRegressionSkill] 有效样本不足', { count: symbols.length })
    return null
  }

  // 收集所有出现过的因子 ID，保持预设顺序
  const presetSet = new Set(FACTOR_IDS)
  const extraFactorIds = new Set<string>()
  for (const s of symbols) {
    for (const fid of Object.keys(samples[s] ?? {})) {
      if (!presetSet.has(fid as typeof FACTOR_IDS[number])) {
        extraFactorIds.add(fid)
      }
    }
  }
  const factorIds = [
    ...FACTOR_IDS.filter(id => symbols.some(s => samples[s]?.[id] !== undefined)),
    ...Array.from(extraFactorIds).sort(),
  ]

  if (factorIds.length === 0) {
    logger.warn('[factorRegressionSkill] 未找到任何有效因子')
    return null
  }

  const y: number[] = []
  const xRows: number[][] = []
  for (const s of symbols) {
    y.push(target[s]!)
    xRows.push(factorIds.map(fid => samples[s]?.[fid] ?? 0))
  }

  // olsRegression 要求每列为一个自变量，因此需要转置
  const x: number[][] = factorIds.map((_, colIdx) =>
    xRows.map(row => row[colIdx] ?? 0),
  )

  return { symbols, factorIds, y, x }
}

function buildDiagnostics(
  regression: RegressionResult,
  factorIds: string[],
  significanceLevel: number,
  vifThreshold: number,
): FactorRegressionOutput['diagnostics'] {
  const messages: string[] = []
  const multicollinearityRisk = regression.vif.some(v => v > vifThreshold)
  const lowExplanatoryPower = regression.adjustedRSquared < 0.3

  if (multicollinearityRisk) {
    messages.push(`检测到 VIF > ${vifThreshold} 的因子，存在多重共线性风险`)
  }
  if (lowExplanatoryPower) {
    messages.push(`Adjusted R² ${regression.adjustedRSquared.toFixed(4)} 较低，模型解释力不足`)
  }
  if (regression.fPValue > significanceLevel) {
    messages.push(`F 检验 p 值 ${regression.fPValue.toFixed(4)} 不显著，整体模型不可靠`)
  }

  const calibrationNeeded = multicollinearityRisk || lowExplanatoryPower
    || regression.significantFactors.length !== factorIds.length

  return {
    multicollinearityRisk,
    lowExplanatoryPower,
    calibrationNeeded,
    messages,
  }
}

function calibrateWeights(
  factorIds: string[],
  regression: RegressionResult,
  currentWeights: Record<string, number> | undefined,
): Record<string, number> {
  // 提取有效 t 统计量（不含截距）
  const tStats = regression.tStatistics.slice(1)
  const absT = tStats.map(t => Math.abs(t))
  const totalAbsT = absT.reduce((a, b) => a + b, 0) || 1

  const calibrated: Record<string, number> = {}
  for (let i = 0; i < factorIds.length; i++) {
    const fid = factorIds[i]
    if (!fid) continue
    const current = currentWeights?.[fid]
    const rawWeight = absT[i]! / totalAbsT

    // 若当前权重存在且回归显著，采用 70% 当前 + 30% 回归修正的混合
    const shouldBlend = current !== undefined && !Number.isNaN(current)
    calibrated[fid] = shouldBlend
      ? Math.round((current * 0.7 + rawWeight * 0.3) * 10000) / 10000
      : Math.round(rawWeight * 10000) / 10000
  }

  // 归一化到和为 1
  const sum = Object.values(calibrated).reduce((a, b) => a + b, 0) || 1
  for (const fid of Object.keys(calibrated)) {
    calibrated[fid] = Math.round((calibrated[fid]! / sum) * 10000) / 10000
  }

  return calibrated
}

/**
 * executeFactorRegressionSkill
 */
export async function executeFactorRegressionSkill(
  ctx: SkillContext,
): Promise<SkillResult<FactorRegressionOutput>> {
  const startedAt = Date.now()
  const params = (ctx.params ?? {}) as FactorRegressionInput['params']
  const samples = params?.samples
  const target = params?.target
  const currentWeights = params?.currentWeights
  const significanceLevel = params?.significanceLevel ?? 0.05
  const vifThreshold = params?.vifThreshold ?? 5.0

  logger.info('[factorRegressionSkill] 开始因子回归权重校验', {
    symbol: ctx.symbol,
    sampleCount: samples ? Object.keys(samples).length : 0,
  })

  const prepared = validateAndPrepareData(samples, target)
  if (!prepared) {
    return {
      skillId: factorRegressionSkill.name,
      status: 'failed',
      evidence: [],
      error: '样本或目标变量不足，无法进行回归分析',
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }

  const { symbols, factorIds, y, x } = prepared

  try {
    const regression = olsRegression(y, x, factorIds)
    const diagnostics = buildDiagnostics(regression, factorIds, significanceLevel, vifThreshold)
    const calibratedWeights = calibrateWeights(factorIds, regression, currentWeights)

    const factors: FactorRegressionOutput['factors'] = []
    const redundantFactors: string[] = []

    for (let i = 0; i < factorIds.length; i++) {
      const fid = factorIds[i]
      if (!fid) continue
      const beta = safeNumber(regression.coefficients[i + 1] ?? 0, 0)
      const tStat = safeNumber(regression.tStatistics[i + 1] ?? 0, 0)
      const pValue = safeNumber(regression.pValues[i + 1] ?? 1, 1)
      const vif = safeNumber(regression.vif[i] ?? 1, VIF_FALLBACK)
      const significant = pValue < significanceLevel
      const currentWeight = currentWeights?.[fid] ?? 0
      const recommendedWeight = calibratedWeights[fid] ?? currentWeight

      if (vif > vifThreshold) {
        redundantFactors.push(fid)
      }

      const rationale = significant
        ? `回归系数 ${beta.toFixed(4)} 在 ${(1 - significanceLevel) * 100}% 水平显著 (p=${pValue.toFixed(4)}, VIF=${vif.toFixed(2)})`
        : `回归系数 ${beta.toFixed(4)} 不显著 (p=${pValue.toFixed(4)}, VIF=${vif.toFixed(2)})`

      factors.push({
        factorId: fid,
        currentWeight,
        regressionBeta: beta,
        tStatistic: tStat,
        pValue,
        vif,
        significant,
        recommendedWeight,
        rationale,
      })
    }

    const output: FactorRegressionOutput = {
      rSquared: safeNumber(regression.rSquared, 0),
      adjustedRSquared: safeNumber(regression.adjustedRSquared, 0),
      fStatistic: safeNumber(regression.fStatistic, 0),
      fPValue: safeNumber(regression.fPValue, 1),
      sampleSize: regression.n,
      factorCount: regression.k,
      factors,
      significantFactors: regression.significantFactors,
      insignificantFactors: regression.insignificantFactors,
      redundantFactors,
      calibratedWeights,
      diagnostics,
    }

    logger.info('[factorRegressionSkill] 因子回归权重校验完成', {
      symbol: ctx.symbol,
      sampleSize: output.sampleSize,
      factorCount: output.factorCount,
      rSquared: output.rSquared.toFixed(4),
      adjustedRSquared: output.adjustedRSquared.toFixed(4),
      significantCount: output.significantFactors.length,
      redundantCount: output.redundantFactors.length,
      calibrationNeeded: output.diagnostics.calibrationNeeded,
    })

    return {
      skillId: factorRegressionSkill.name,
      status: 'success',
      data: output,
      evidence: [
        `ols-regression:n=${regression.n},k=${regression.k}`,
        `r2=${output.rSquared.toFixed(4)},adjR2=${output.adjustedRSquared.toFixed(4)}`,
        `significant=${output.significantFactors.length}/${output.factorCount}`,
      ],
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[factorRegressionSkill] 回归执行失败: ${message}`, { symbol: ctx.symbol })

    // 完全多重共线性时返回诊断结果而非直接失败
    if (message.includes('奇异') || message.includes('完全多重共线性')) {
      const fallbackWeights = { ...currentWeights }
      const output: FactorRegressionOutput = {
        rSquared: 0,
        adjustedRSquared: 0,
        fStatistic: 0,
        fPValue: 1,
        sampleSize: symbols.length,
        factorCount: factorIds.length,
        factors: factorIds.map(fid => ({
          factorId: fid,
          currentWeight: currentWeights?.[fid] ?? 0,
          regressionBeta: 0,
          tStatistic: 0,
          pValue: 1,
          vif: VIF_FALLBACK,
          significant: false,
          recommendedWeight: currentWeights?.[fid] ?? 0,
          rationale: 'X\'X 矩阵奇异，存在完全多重共线性，无法估计回归系数',
        })),
        significantFactors: [],
        insignificantFactors: factorIds,
        redundantFactors: factorIds,
        calibratedWeights: fallbackWeights,
        diagnostics: {
          multicollinearityRisk: true,
          lowExplanatoryPower: true,
          calibrationNeeded: true,
          messages: [message, '建议剔除高度相关或重复因子后重新运行'],
        },
      }
      return {
        skillId: factorRegressionSkill.name,
        status: 'success',
        data: output,
        evidence: ['ols-singular-matrix', 'multicollinearity-detected'],
        meta: { startedAt, durationMs: Date.now() - startedAt },
      }
    }

    return {
      skillId: factorRegressionSkill.name,
      status: 'failed',
      evidence: [],
      error: message,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }
}

/**
 * factorRegressionSkill
 */
export const factorRegressionSkill: SkillDefinition<FactorRegressionOutput> = {
  name: 'factor-regression',
  title: '因子回归权重校验',
  description: '对 V6 分层因子与目标变量做多元线性回归，校验因子显著性、多重共线性并给出权重校准建议',
  inputSchema: FactorRegressionInputSchema,
  outputSchema: FactorRegressionOutputSchema,
  executor: executeFactorRegressionSkill,
  requiresLlm: false,
  version: '1.0.0',
}
