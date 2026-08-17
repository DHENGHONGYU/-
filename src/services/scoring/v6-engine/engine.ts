/**
 * V6 评分引擎核心
 *
 * 设计原则：
 * - 零硬编码：所有阈值/权重/公式参数从 config 注入
 * - Backtestable：注入历史行情数据 → 输出历史评分
 * - OfflineMode：完全脱离网络运行（规则引擎层）
 * - AuditTrail：每层评分的完整审计链路
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-FRONT-012]
*/

import { getLogger } from '@/lib/logger'
import { measureAsync, PERF } from '@/lib/perf'
import type {
  LayerId, LayerInput, LayerScore, CompositeScore, ScoreAuditTrail,
  AuditEntry, V6ScoreInput, LayerCalculator,
} from './types'
import { ALL_LAYER_IDS, LAYER_LABELS } from './types'
import { buildFactorContributions } from './factorContributions'
import { crossValidate } from './crossValidator'
import type { V6ScoreEngineConfig, V6ScoreConfigOverride } from './config'
import { DEFAULT_ENGINE_CONFIG } from './config'
import { scoreHistoryTracker } from './enhancer'

const logger = getLogger()
const ENGINE_VERSION = 'v6-engine-v1.0.0'

/**
 * 评分清理化工具函数
 * 
 * 处理边界条件：
 * - NaN/undefined → 0
 * - Infinity → 5（正无穷）或 0（负无穷）
 * - 超出 [0, 5] 范围 → 截断到边界
 * - 记录警告日志便于排查
 */
function sanitizeScore(score: unknown, layerId: string, context: string): number {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    logger.warn(`[V6ScoreEngine] ${layerId} ${context}: 无效评分 ${String(score)}，降级为 0`)
    return 0
  }
  if (score === Infinity) {
    logger.warn(`[V6ScoreEngine] ${layerId} ${context}: 正无穷评分，截断为 5`)
    return 5
  }
  if (score === -Infinity) {
    logger.warn(`[V6ScoreEngine] ${layerId} ${context}: 负无穷评分，截断为 0`)
    return 0
  }
  if (score < 0) {
    logger.warn(`[V6ScoreEngine] ${layerId} ${context}: 负数评分 ${score}，截断为 0`)
    return 0
  }
  if (score > 5) {
    logger.warn(`[V6ScoreEngine] ${layerId} ${context}: 超范围评分 ${score}，截断为 5`)
    return 5
  }
  return score
}

// ============================================================
// V6ScoreEngine
// ============================================================

/**
 * V6ScoreEngine
 */
export class V6ScoreEngine {
  private config: V6ScoreEngineConfig
  private calculators: Map<LayerId, LayerCalculator> = new Map()
  private auditTrail: ScoreAuditTrail | null = null

  constructor(override?: V6ScoreConfigOverride) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...override }
    logger.info(`[V6ScoreEngine] Initialized v${ENGINE_VERSION}, offlineMode=${this.config.offlineMode}`)
  }

  /** 注册层计算器 */
  registerCalculator(calculator: LayerCalculator): this {
    this.calculators.set(calculator.layerId, calculator)
    return this
  }

  /** 批量注册计算器 */
  registerCalculators(calculators: LayerCalculator[]): this {
    for (const calc of calculators) {
      this.calculators.set(calc.layerId, calc)
    }
    return this
  }

  /** 获取当前配置 */
  getConfig(): V6ScoreEngineConfig {
    return { ...this.config }
  }

  /** 更新配置 */
  updateConfig(override: V6ScoreConfigOverride): void {
    this.config = { ...this.config, ...override }
  }

  /**
   * 条件化记录审计条目。
   * 将 `this.config.auditEnabled` 判断收敛到单一位置，避免 calculateLayer 内重复 if。
   */
  private recordAudit(audit: AuditEntry[], partial: Omit<AuditEntry, 'timestamp'>): void {
    if (!this.config.auditEnabled) return
    audit.push({ timestamp: Date.now(), ...partial })
  }

  // ============================================================
  // 核心计算流程
  // ============================================================

  /** 计算单层得分 */
  async calculateLayer(layerId: LayerId, input: LayerInput): Promise<LayerScore> {
    const calculator = this.calculators.get(layerId)
    const layerName = LAYER_LABELS[layerId] ?? layerId
    const layerStartTs = Date.now()

    logger.info(`[V6ScoreEngine.calculateLayer] [${layerId}/${layerName}] ==== 开始计算 ====`, {
      symbol: input.stock.symbol,
      calculatorRegistered: !!calculator,
      calculatorName: calculator?.constructor?.name ?? 'N/A',
    })
    logger.debug(`[V6ScoreEngine.calculateLayer] [${layerId}] 输入摘要`, {
      hasStock: !!input.stock,
      stockPrice: input.stock?.price,
      stockPE: input.stock?.pe,
      stockPB: input.stock?.pb,
      hasFinancials: !!input.financials,
      hasQuotes: !!input.quotes,
      quoteHistoryLen: input.quotes?.history?.length ?? 0,
      hasIndustryScore: input.industryScore !== undefined,
    })

    if (!calculator) {
      logger.warn(`[V6ScoreEngine.calculateLayer] [${layerId}] 未注册计算器，返回占位层`)
      return this.placeholderLayer(layerId, input)
    }

    const audit: AuditEntry[] = []

    this.recordAudit(audit, {
      layerId,
      step: 'start',
      input: { symbol: input.stock.symbol, hasIndustryScore: input.industryScore !== undefined },
      output: {},
    })

    try {
      const calcStart = Date.now()
      const result = await calculator.calculate(input)
      const calcDuration = Date.now() - calcStart

      logger.info(`[V6ScoreEngine.calculateLayer] [${layerId}] 计算器返回原始结果`, {
        rawScore: result.score,
        scoreType: typeof result.score,
        scoreIsFinite: Number.isFinite(result.score),
        summary: result.summary?.slice(0, 80) ?? '',
        riskCount: result.risks?.length ?? 0,
        evidenceCount: result.evidence?.length ?? 0,
        dataSourceCount: result.dataSources?.length ?? 0,
        weight: result.weight,
        calcDurationMs: calcDuration,
      })

      // 防御性校验：验证计算器返回的 score 是否有效
      const sanitizedScore = sanitizeScore(result.score, layerId, 'calculateLayer 结果校验')

      const sanitizedResult = {
        ...result,
        score: sanitizedScore,
        weightedScore: sanitizedScore * result.weight,
      }

      logger.info(`[V6ScoreEngine.calculateLayer] [${layerId}] 计算完成`, {
        sanitizedScore,
        weightedScore: sanitizedResult.weightedScore,
        participated: sanitizedResult.participated,
        totalDurationMs: Date.now() - layerStartTs,
      })

      this.recordAudit(audit, {
        layerId,
        step: 'complete',
        input: { score: result.score },
        output: { score: sanitizedScore, summary: sanitizedResult.summary },
        formula: `calculator.${layerId}.calculate()`,
      })

      return {
        ...sanitizedResult,
        auditTrail: audit.length > 0 ? audit : undefined,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      logger.error(`[V6ScoreEngine.calculateLayer] [${layerId}] 计算失败: ${msg}`, {
        error: msg,
        stack,
        durationMs: Date.now() - layerStartTs,
      })

      this.recordAudit(audit, {
        layerId,
        step: 'error',
        input: {},
        output: { error: msg },
      })

      return this.placeholderLayer(layerId, input, msg)
    }
  }

  /** 计算所有层返回综合评分 */
  async calculateAll(input: V6ScoreInput): Promise<CompositeScore> {
    return measureAsync(
      PERF.SCORING_CALCULATE_ALL,
      async () => {
        const allStartTs = Date.now()
        const layerInput: LayerInput = {
          ...input,
          config: this.config,
        }

        logger.info(`[V6ScoreEngine.calculateAll] ============ 开始全量评分 ============`, {
          symbol: input.symbol,
          engineVersion: ENGINE_VERSION,
          offlineMode: this.config.offlineMode,
          llmEnabled: this.config.llmEnabled,
          auditEnabled: this.config.auditEnabled,
          registeredCalculators: Array.from(this.calculators.keys()),
        })
        logger.debug(`[V6ScoreEngine.calculateAll] 权重配置`, { ...this.config.weights })
        logger.debug(`[V6ScoreEngine.calculateAll] 输入数据摘要`, {
          stockSymbol: input.stock?.symbol ?? 'N/A',
          stockPrice: input.stock?.price,
          stockPE: input.stock?.pe,
          stockPB: input.stock?.pb,
          stockROE: input.stock?.roe,
          stockMarketCap: input.stock?.marketCap,
          industryCode: input.stock?.sector,
          financialsRevenue: input.financials?.revenue,
          financialsNetProfit: input.financials?.netProfit,
          financialsGrossMargin: input.financials?.grossMargin,
          quoteLatestClose: input.quotes?.latestClose,
          quoteHistoryLen: input.quotes?.history?.length ?? 0,
          hasIndustryScore: input.industryScore !== undefined,
        })

        const layerResults: Record<string, LayerScore> = {}
        const allRisks: string[] = []

        if (this.config.auditEnabled) {
          this.auditTrail = {
            symbol: input.symbol,
            timestamp: Date.now(),
            config: this.config,
            layers: {} as Record<LayerId, AuditEntry[]>,
            composite: { weightedSum: 0, layers: {} as Record<LayerId, number>, rating: '' },
            factorContributions: [],
          }
        }

        // 串行执行改为日志可追踪：保留 Promise.all 并发，同时记录每一层的开始与结束顺序
        logger.info(`[V6ScoreEngine.calculateAll] 并行计算 ${ALL_LAYER_IDS.length} 层：${ALL_LAYER_IDS.join(', ')}`)
        const layerScores = await Promise.all(
          ALL_LAYER_IDS.map(async (layerId) => {
            const singleStart = Date.now()
            const result = await this.calculateLayer(layerId, layerInput)
            logger.info(`[V6ScoreEngine.calculateAll] 单层完成 ${layerId}`, {
              layerId,
              score: result.score,
              scoreIsFinite: Number.isFinite(result.score),
              participated: result.participated,
              riskCount: result.risks.length,
              durationMs: Date.now() - singleStart,
            })
            return { layerId, result }
          }),
        )

        logger.info(`[V6ScoreEngine.calculateAll] 所有层计算完成，开始聚合`, {
          totalLayers: layerScores.length,
          totalDurationMs: Date.now() - allStartTs,
        })

        for (const { layerId, result } of layerScores) {
          layerResults[layerId] = result
          if (result.risks && result.risks.length > 0) {
            logger.debug(`[V6ScoreEngine.calculateAll] ${layerId} 层收集到风险：${result.risks.join(' | ')}`)
            allRisks.push(...result.risks)
          }

          if (this.auditTrail && result.auditTrail) {
            this.auditTrail.layers[layerId] = result.auditTrail
          }
        }

        logger.info(`[V6ScoreEngine.calculateAll] 聚合前摘要`, {
          collectedRiskCount: allRisks.length,
          layerResultCount: Object.keys(layerResults).length,
        })

        return this.aggregate(layerResults, allRisks)
      },
      { symbol: input.symbol },
    )
  }

  /** 聚合各层得分为综合评分 */
  aggregate(layers: Record<LayerId, LayerScore>, allRisks: string[]): CompositeScore {
    const aggStartTs = Date.now()
    logger.info(`[V6ScoreEngine.aggregate] ============ 开始聚合评分 ============`, {
      layerCount: Object.keys(layers).length,
      allRiskCount: allRisks.length,
    })

    let weightedSum = 0
    let totalWeight = 0
    const skippedLayers: LayerId[] = []
    const participatedLayers: { layerId: LayerId; score: number; weight: number; weighted: number; layerName: string }[] = []

    const { weights, thresholds } = this.config

    const weightMap: Record<LayerId, number> = {
      lMinus1: weights.lMinus1, l0: weights.l0, l1: weights.l1, l2: weights.l2,
      l3f: weights.l3f, l3v: weights.l3v, l4: weights.l4, l5: weights.l5,
      l6: weights.l6, l7: weights.l7, l8: weights.l8,
    }

    logger.info(`[V6ScoreEngine.aggregate] 开始遍历 ${ALL_LAYER_IDS.length} 层`)
    for (const layerId of ALL_LAYER_IDS) {
      const layer = layers[layerId]
      const w = weightMap[layerId]
      const layerName = LAYER_LABELS[layerId] ?? layerId

      // NaN/缺失防护：layer 缺失或 score 非有限值（NaN/±Infinity/非数字）时跳过该层，并记录具体原因
      if (layer == null || !Number.isFinite(layer.score)) {
        let reason: string
        if (layer == null) {
          reason = 'layer 缺失 (undefined)'
        } else if (typeof layer.score !== 'number') {
          reason = `score 类型非法 (${typeof layer.score} = ${String(layer.score)})`
        } else if (Number.isNaN(layer.score)) {
          reason = 'score 为 NaN'
        } else if (layer.score === Infinity) {
          reason = 'score 为 +Infinity'
        } else if (layer.score === -Infinity) {
          reason = 'score 为 -Infinity'
        } else {
          reason = `score 非有限值 (${layer.score})`
        }
        logger.warn(`[V6ScoreEngine.aggregate] 层跳过 [${layerId}/${layerName}] — ${reason}`, {
          layerId,
          layerName,
          reason,
          configuredWeight: w,
          weightContributionLost: `-${w * 100}%`,
        })
        skippedLayers.push(layerId)
        continue
      }

      const weighted = layer.score * w
      weightedSum += weighted
      totalWeight += w

      participatedLayers.push({
        layerId,
        layerName,
        score: layer.score,
        weight: w,
        weighted,
      })

      logger.info(`[V6ScoreEngine.aggregate] 层参与计算 [${layerId}/${layerName}]`, {
        layerId,
        layerName,
        rawScore: layer.score,
        weight: w,
        weightedScore: weighted,
        summary: layer.summary?.slice(0, 60) ?? '',
        riskCount: layer.risks?.length ?? 0,
        participated: layer.participated,
        accumulatedWeightedSum: weightedSum,
        accumulatedTotalWeight: totalWeight,
      })
    }

    logger.info(`[V6ScoreEngine.aggregate] 层遍历完成`, {
      participatedCount: participatedLayers.length,
      skippedCount: skippedLayers.length,
      skippedLayers: skippedLayers.join(', '),
      rawWeightedSum: weightedSum,
      rawTotalWeight: totalWeight,
    })

    // 逐层打印贡献明细（按权重贡献排序，方便排查哪层拉分/加分最多）
    const sortedByContribution = [...participatedLayers].sort((a, b) => b.weighted - a.weighted)
    logger.info(`[V6ScoreEngine.aggregate] === 各层贡献明细（按加权分排序）===`)
    for (const item of sortedByContribution) {
      const contribution = totalWeight > 0 ? (item.weighted / totalWeight) * 100 : 0
      logger.info(`[V6ScoreEngine.aggregate]   → ${item.layerName} (${item.layerId})`, {
        rawScore: item.score.toFixed(3),
        weight: `${(item.weight * 100).toFixed(1)}%`,
        weightedScore: item.weighted.toFixed(4),
        contributionToTotal: `${contribution.toFixed(2)}%`,
      })
    }

    // 归一化，防止除以零；无有效层时降级为 0
    logger.info(`[V6ScoreEngine.aggregate] 归一化计算`, {
      formula: 'weightedSum / totalWeight → clamp [0,5]',
      weightedSum,
      totalWeight,
      divisionSafe: totalWeight > 0,
    })

    const normalizedScore = totalWeight > 0
      ? Math.max(0, Math.min(5, (weightedSum / totalWeight)))
      : 0

    if (totalWeight <= 0) {
      logger.warn(`[V6ScoreEngine.aggregate] 总权重为 0（无有效层参与），归一化得分强制为 0`)
    } else {
      const rawNormalized = weightedSum / totalWeight
      logger.info(`[V6ScoreEngine.aggregate] 归一化结果`, {
        rawNormalized,
        clamped: normalizedScore,
        clampedBecauseOutOfRange: rawNormalized < 0 || rawNormalized > 5,
      })
    }

    // 最终结果再次验证
    const finalScore = Number.isFinite(normalizedScore) ? normalizedScore : 0
    if (!Number.isFinite(normalizedScore)) {
      logger.error(`[V6ScoreEngine.aggregate] 归一化后得分非有限数 (${normalizedScore})，强制置 0`, {
        normalizedScore,
        type: typeof normalizedScore,
        isNaN: Number.isNaN(normalizedScore),
        isPositiveInf: normalizedScore === Infinity,
        isNegativeInf: normalizedScore === -Infinity,
      })
    }

    const rating = this.mapRating(finalScore, thresholds)
    const recommendation = this.generateRecommendation(rating, allRisks)

    logger.info(`[V6ScoreEngine.aggregate] 评级映射`, {
      finalScore,
      roundedScore: Math.round(finalScore * 100) / 100,
      rating,
      ratingThresholds: thresholds.rating,
      recommendation,
    })

    const result: CompositeScore = {
      score: Number.isFinite(finalScore) ? Math.round(finalScore * 100) / 100 : 0,
      rating,
      layers,
      allRisks,
      recommendation,
      timestamp: Date.now(),
      engineVersion: ENGINE_VERSION,
      skippedLayers,
      coverageRate: Math.round(((ALL_LAYER_IDS.length - skippedLayers.length) / ALL_LAYER_IDS.length) * 100) / 100,
    }

    // P2-5：交叉验证
    logger.info(`[V6ScoreEngine.aggregate] 执行交叉验证 crossValidate`)
    const cv = crossValidate(result)
    result.crossValidation = {
      passed: cv.passed,
      issues: cv.issues.map((i) => ({
        ruleId: i.ruleId,
        severity: i.severity,
        title: i.title,
        description: i.description,
      })),
    }
    logger.info(`[V6ScoreEngine.aggregate] 交叉验证结果`, {
      passed: cv.passed,
      issueCount: cv.issues.length,
      issuesSummary: cv.issues.map((i) => `[${i.severity}] ${i.ruleId}: ${i.title}`).join(' | '),
    })

    if (this.auditTrail) {
      this.auditTrail.composite = {
        weightedSum: Math.round(weightedSum * 100) / 100,
        layers: ALL_LAYER_IDS.reduce((acc, id) => {
          acc[id] = layers[id]?.score ?? 0
          return acc
        }, {} as Record<LayerId, number>),
        rating,
      }
      
      // 记录失败层信息
      if (skippedLayers.length > 0) {
        logger.warn(`[V6ScoreEngine.aggregate] aggregate: ${skippedLayers.length} 层评分无效，已跳过: ${skippedLayers.join(', ')}`)
      }
      
      this.auditTrail.factorContributions = buildFactorContributions(this.auditTrail)
    }

    // P4-2 R007: 时序一致性校验 — 记录评分历史并检测跳变
    const compositeSymbol = this.auditTrail?.symbol ?? 'unknown'
    const layerScoreMap: Record<string, number> = {}
    for (const [id, layer] of Object.entries(layers)) {
      layerScoreMap[id] = layer.score ?? 0
    }
    const jumpWarning = scoreHistoryTracker.checkJump(compositeSymbol, result.score)
    if (jumpWarning) {
      logger.warn(`[V6ScoreEngine.aggregate] ${jumpWarning}`)
      result.allRisks.push(jumpWarning)
    }
    scoreHistoryTracker.record(compositeSymbol, result.score, layerScoreMap)

    logger.info(`[V6ScoreEngine.aggregate] ============ 聚合完成 ============`, {
      finalScore: result.score,
      rating: result.rating,
      coverageRate: `${((result.coverageRate ?? 0) * 100).toFixed(0)}%`,
      skippedLayers: (result.skippedLayers ?? []).length,
      riskCount: result.allRisks.length,
      cvPassed: result.crossValidation?.passed,
      totalDurationMs: Date.now() - aggStartTs,
    })

    return result
  }

  /** 获取审计追踪 */
  audit(): ScoreAuditTrail | null {
    return this.auditTrail
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  private placeholderLayer(layerId: LayerId, _input: LayerInput, errorMsg?: string): LayerScore {
    const w = this.config.weights
    const weightMap: Record<LayerId, number> = {
      lMinus1: w.lMinus1, l0: w.l0, l1: w.l1, l2: w.l2,
      l3f: w.l3f, l3v: w.l3v, l4: w.l4, l5: w.l5,
      l6: w.l6, l7: w.l7, l8: w.l8,
    }
    const weight = weightMap[layerId]

    const layerName = LAYER_LABELS[layerId] ?? layerId
    const summary = (errorMsg ?? '') !== ''
      ? `[计算失败] ${layerName} 层计算失败: ${errorMsg}`
      : `[未注册计算器] ${layerName} 层无可用计算器`

    return {
      layerId,
      layerName,
      score: 0,
      summary,
      risks: (errorMsg ?? '') !== '' ? [errorMsg!] : ['数据缺失：该层评分未参与综合计算'],
      evidence: [],
      weight,
      weightedScore: 0,
      dataSources: [],
      participated: false,
    }
  }

  private mapRating(score: number, thresholds: V6ScoreEngineConfig['thresholds']): CompositeScore['rating'] {
    const { rating } = thresholds
    if (score >= rating.strongBuy) return 'strong_buy'
    if (score >= rating.buy) return 'buy'
    if (score >= rating.hold) return 'hold'
    if (score >= rating.sell) return 'sell'
    return 'strong_sell'
  }

  private generateRecommendation(rating: CompositeScore['rating'], risks: string[]): string {
    const base: Record<CompositeScore['rating'], string> = {
      strong_buy: '综合评分优秀，建议积极配置。',
      buy: '综合评分良好，建议关注买入机会。',
      hold: '综合评分中等，建议持有观望。',
      sell: '综合评分偏弱，建议减仓。',
      strong_sell: '综合评分较差，建议回避。',
    }
    const riskNote = risks.length > 0 ? ` 需关注风险：${risks.slice(0, 3).join('；')}` : ''
    return (base[rating] ?? '') + riskNote
  }
}