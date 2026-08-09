/**
 * 六维复盘报告核心生成逻辑
 *
 * 包含：
 * - 交易摘要生成
 * - 错误分析生成
 * - 纪律分析生成
 * - 行动计划生成
 * - AI 深度洞察生成（规则引擎版）
  * @doc [V9-DOC-BACK-013, V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-ARCH-008, V9-DOC-BACK-005]
*/

import type { Order } from '@/data/types'
import {
  type ErrorClassificationResult,
  TradeErrorType,
} from './tradeErrorClassifier'
import type {
  TradeSummary,
  ErrorAnalysis,
  DisciplineAnalysis,
  ActionPlan,
  AIDeepInsight,
} from './tradeReviewAI.types'
import type { BuySellPointReview } from '@/types/modules/buySellPoint.types'
import { generatePsychologicalProfile, generateRiskProfile } from './tradeReviewAI.profileGenerator'
import { buildTradePairs } from './tradeReviewAI.utils'
import { PERCENTAGE_BASE, PROFIT_LOSS_RATIO_UNBOUNDED } from '@/constants/trade.constants'
import { TRADE_REVIEW_AI_THRESHOLDS } from '@/config/thresholds'

// ============================================================
// 六维报告生成
// ============================================================

/**
 * 生成交易摘要
 */
export function generateTradeSummary(
  orders: Order[],
  classification: ErrorClassificationResult,
): TradeSummary {
  const pairs = buildTradePairs(orders)
  const profitablePairs = pairs.filter((p) => p.profitPct > 0)
  const losingPairs = pairs.filter((p) => p.profitPct < 0)

  const winRate = pairs.length > 0
    ? Math.round((profitablePairs.length / pairs.length) * 1000) / 10
    : 0

  const totalProfit = profitablePairs.reduce((sum, p) => sum + p.profitPct, 0)
  const totalLoss = Math.abs(losingPairs.reduce((sum, p) => sum + p.profitPct, 0))
  const avgProfit = profitablePairs.length > 0
    ? Math.round((totalProfit / profitablePairs.length) * PERCENTAGE_BASE) / PERCENTAGE_BASE
    : 0
  const avgLoss = losingPairs.length > 0
    ? Math.round((totalLoss / losingPairs.length) * PERCENTAGE_BASE) / PERCENTAGE_BASE
    : 0
  const profitLossRatio = avgLoss > 0
    ? Math.round((avgProfit / avgLoss) * PERCENTAGE_BASE) / PERCENTAGE_BASE
    : avgProfit > 0 ? PROFIT_LOSS_RATIO_UNBOUNDED : 0

  const totalPnL = Math.round((totalProfit - totalLoss) * PERCENTAGE_BASE) / PERCENTAGE_BASE

  return {
    totalTrades: pairs.length,
    profitableTrades: profitablePairs.length,
    losingTrades: losingPairs.length,
    winRate,
    profitLossRatio,
    avgProfit,
    avgLoss,
    totalPnL,
    totalPnLPercent: totalPnL,
    disciplineScore: classification.disciplineScore,
    totalErrors: classification.totalErrors,
  }
}

/**
 * 生成错误分析
 */
export function generateErrorAnalysis(
  classification: ErrorClassificationResult,
  orders: Order[],
): ErrorAnalysis {
  const sortedErrors = [...classification.errors].sort((a, b) => b.count - a.count)
  const topErrors = sortedErrors.slice(0, 5).map((e) => ({
    name: e.name,
    severity: e.severity,
    count: e.count,
    psychologicalRoot: e.psychologicalRoot,
  }))

  const psychologicalProfile = generatePsychologicalProfile(classification)
  const riskProfile = generateRiskProfile(classification, orders)

  let errorTrend = '错误趋势稳定，需持续关注'
  if (classification.criticalCount >= 3) {
    errorTrend = '严重错误频发，交易纪律亟需系统改善'
  } else if (classification.criticalCount >= 1) {
    errorTrend = '存在严重错误，建议针对性地加强相关纪律'
  }

  return {
    topErrors,
    errorTrend,
    psychologicalProfile,
    riskProfile,
  }
}

/**
 * 生成纪律分析
 */
export function generateDisciplineAnalysis(
  _orders: Order[],
  classification: ErrorClassificationResult,
): DisciplineAnalysis {
  const hasPlanViolation = classification.errors.some(
    (e) => (e.type as TradeErrorType) === TradeErrorType.PLAN_VIOLATION,
  )
  const hasStopLossIssue = classification.errors.some(
    (e) => (e.type as TradeErrorType) === TradeErrorType.NO_STOP_LOSS || (e.type as TradeErrorType) === TradeErrorType.IGNORE_STOP_LOSS,
  )
  const hasPositionIssue = classification.errors.some(
    (e) => (e.type as TradeErrorType) === TradeErrorType.HEAVY_GAMBLING,
  )
  const hasEmotionIssue = classification.errors.some(
    (e) => (e.type as TradeErrorType) === TradeErrorType.REVENGE_TRADING || (e.type as TradeErrorType) === TradeErrorType.FOMO_ENTRY,
  )

  const planAdherenceRate = hasPlanViolation ? 60 : 85
  const stopLossExecutionRate = hasStopLossIssue ? 40 : 80
  const positionManagementScore = hasPositionIssue ? 45 : 75
  const emotionControlScore = hasEmotionIssue ? 40 : 70

  const overallScore = Math.round(
    planAdherenceRate * 0.25 +
    stopLossExecutionRate * 0.25 +
    positionManagementScore * 0.25 +
    emotionControlScore * 0.25,
  )

  const improvements: string[] = []
  if (hasPlanViolation) improvements.push('建立交易前检查清单，每笔交易前对照执行')
  if (hasStopLossIssue) improvements.push('使用条件单自动止损，避免手动干预')
  if (hasPositionIssue) improvements.push('严格执行仓位管理规则，单笔不超过总资金 20%')
  if (hasEmotionIssue) improvements.push('亏损后强制休息 30 分钟，记录情绪状态')
  if (improvements.length === 0) {
    improvements.push('继续保持当前纪律水平，可进一步优化交易系统')
  }

  return {
    planAdherenceRate,
    stopLossExecutionRate,
    positionManagementScore,
    emotionControlScore,
    overallScore,
    improvements,
  }
}

/**
 * 生成行动计划
 */
export function generateActionPlan(
  classification: ErrorClassificationResult,
  discipline: DisciplineAnalysis,
): ActionPlan {
  const immediate: string[] = []
  const shortTerm: string[] = []
  const longTerm: string[] = []

  // 立即执行
  if (classification.criticalCount > 0) {
    immediate.push('立即审查所有持仓，对不符合计划的头寸进行止损或减仓')
  }
  immediate.push('每笔交易前填写交易计划表（代码、方向、仓位、止损、止盈、理由）')
  if (discipline.stopLossExecutionRate < TRADE_REVIEW_AI_THRESHOLDS.STOP_LOSS_EXECUTION_RATE_LOW_THRESHOLD) {
    immediate.push('为所有持仓设置条件止损单')
  }

  // 短期
  shortTerm.push('每日收盘后使用 V6 Pro 复盘工具分析当日交易')
  shortTerm.push('建立交易错误日志，记录每次违规并分析原因')
  shortTerm.push('学习并实践仓位管理公式（凯利公式或固定比例法）')
  if (discipline.emotionControlScore < TRADE_REVIEW_AI_THRESHOLDS.EMOTION_CONTROL_SCORE_LOW_THRESHOLD) {
    shortTerm.push('每天进行 10 分钟冥想或情绪记录，提升自我觉察能力')
  }

  // 长期
  longTerm.push('建立完整的个人交易 SOP（标准操作流程）')
  longTerm.push('每季度进行一次深度 AI 复盘，评估交易系统有效性')
  longTerm.push('持续优化交易策略，建立正期望值的交易系统')
  longTerm.push('阅读至少 3 本交易经典书籍，提升交易认知')

  return { immediate, shortTerm, longTerm }
}

/**
 * 生成 AI 深度洞察（规则引擎版）
 */
export function generateAIDeepInsight(
  summary: TradeSummary,
  errorAnalysis: ErrorAnalysis,
  discipline: DisciplineAnalysis,
): AIDeepInsight {
  const pnlAttribution: string[] = []
  const dataPatterns: string[] = []
  const personalizedAdvice: string[] = []

  // 盈亏归因
  if (summary.winRate >= TRADE_REVIEW_AI_THRESHOLDS.WIN_RATE_HIGH_THRESHOLD) {
    pnlAttribution.push(`胜率 ${summary.winRate}% 处于合理水平，但需关注盈亏比`)
  } else {
    pnlAttribution.push(`胜率 ${summary.winRate}% 偏低，建议提高入场信号的质量要求`)
  }

  if (summary.profitLossRatio < 1.5) {
    pnlAttribution.push(
      `盈亏比 ${summary.profitLossRatio} 偏低（目标 1.5+），平均盈利 ${summary.avgProfit}% vs 平均亏损 ${summary.avgLoss}%。建议优化止盈策略或收紧止损`,
    )
  } else {
    pnlAttribution.push(`盈亏比 ${summary.profitLossRatio} 表现良好，继续保持`)
  }

  if (summary.totalErrors > 0) {
    pnlAttribution.push(
      `存在 ${summary.totalErrors} 类交易错误，消除这些错误有望显著提升整体收益`,
    )
  }

  // 数据规律
  if (errorAnalysis.psychologicalProfile.primaryType !== 'impulsive_type') {
    dataPatterns.push(
      `心理画像分析显示您属于「${errorAnalysis.psychologicalProfile.name}」，交易行为具有明显的模式特征`,
    )
  }
  dataPatterns.push(
    `纪律评分 ${summary.disciplineScore} 分，${summary.disciplineScore >= 80 ? '表现优秀' : summary.disciplineScore >= 60 ? '有提升空间' : '需要重点关注'}`,
  )
  if (errorAnalysis.topErrors.length > 0) {
    const topError = errorAnalysis.topErrors[0]!
    dataPatterns.push(`最常犯的错误是「${topError.name}」，共发生 ${topError.count} 次`)
  }

  // 个性化建议
  if (discipline.planAdherenceRate < 80) {
    personalizedAdvice.push('建议使用交易计划模板，每笔交易前强制填写并审核')
  }
  if (discipline.stopLossExecutionRate < 80) {
    personalizedAdvice.push('止损是保护本金的最后防线，建议使用条件单自动执行止损')
  }
  if (discipline.emotionControlScore < 60) {
    personalizedAdvice.push('情绪管理是交易的核心竞争力，建议每日进行情绪记录和反思')
  }
  personalizedAdvice.push('交易纪律是核心竞争力。数据显示：无错误交易的胜率显著高于有错误交易')
  if (personalizedAdvice.length < 3) {
    personalizedAdvice.push('继续保持当前的交易纪律，可逐步优化交易系统的细节参数')
  }

  return { pnlAttribution, dataPatterns, personalizedAdvice }
}

/**
 * 生成买卖点复盘洞察（整合到 AI 深度洞察中）
 */
export function generateBuySellPointInsight(
  review: BuySellPointReview,
): { pnlAttribution: string[]; dataPatterns: string[]; personalizedAdvice: string[] } {
  const pnlAttribution: string[] = []
  const dataPatterns: string[] = []
  const personalizedAdvice: string[] = []

  // 盈亏归因：买卖点系统综合评分
  pnlAttribution.push(
    `买卖点系统综合评分 ${review.overallScore} 分，` +
      `${review.overallScore >= 80 ? '入场出场体系成熟' : review.overallScore >= 60 ? '入场出场体系基本有效，仍有优化空间' : '入场出场体系亟需系统性改善'}`,
  )

  // 入场时机归因
  if (review.entryTiming.buyPointStats.length > 0) {
    const best = review.entryTiming.buyPointStats[0]!
    pnlAttribution.push(
      `最优入场策略「${best.name}」胜率 ${best.winRate}%，平均收益 ${best.avgReturn}%`,
    )
  }

  // 出场时机归因
  if (review.exitTiming.sellPointStats.length > 0) {
    const best = review.exitTiming.sellPointStats[0]!
    pnlAttribution.push(
      `最优出场策略「${best.name}」胜率 ${best.winRate}%，保护了 ${best.profitableCount} 笔交易利润`,
    )
  }

  // 数据规律
  dataPatterns.push(review.entryTiming.summary)
  dataPatterns.push(review.exitTiming.summary)

  // 参数有效性规律
  const lowScoreParams = review.parameterEffectiveness.filter((p) => p.effectivenessScore < 60)
  if (lowScoreParams.length > 0) {
    dataPatterns.push(
      `${lowScoreParams.length} 个买卖点参数有效性偏低：${lowScoreParams.map((p) => p.parameterName).join('、')}`,
    )
  }

  // 个性化建议：核心技能
  const highPrioritySkills = review.coreSkills.filter((s) => s.priority === 'high')
  for (const skill of highPrioritySkills.slice(0, 3)) {
    personalizedAdvice.push(`【${skill.skill}】${skill.insight} → ${skill.action}`)
  }

  return { pnlAttribution, dataPatterns, personalizedAdvice }
}
