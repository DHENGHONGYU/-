/**
 * AI 交易复盘报告生成器
 *
 * 六维复盘报告生成：
 *   1. 交易摘要
 *   2. 错误分析
 *   3. 纪律分析
 *   4. 技能发展
 *   5. 行动计划
 *   6. AI 深度洞察
 *
 * 心理画像生成：6 种画像
 *   - 追涨型 / 恐盈型 / 扛单型 / 情绪化型 / 激进型 / 冲动型
 *
 * 导出 generateReview(orders: Order[]) 方法
 */

import { getLogger } from '@/lib/logger'
import type { Order } from '@/data/types'
import {
  classifyErrors,
  type ErrorClassificationResult,
  type DetectedError,
  TradeErrorType,
} from './tradeErrorClassifier'
import type { PartialLlmConfig } from '@/config/llmConfig'
import { isLlmConfigured } from '@/config/llmConfig'
import { chat } from '@/services/llm/llmClient'
import type { LlmMessage } from '@/services/llm/llmTypes'
import { checkReviewFreshness } from '@/services/analysis/dataFreshnessGuard'
import { PERCENTAGE_BASE, MAX_SCORE, PROFIT_LOSS_RATIO_UNBOUNDED, LOG_TRUNCATE_LENGTH } from '@/constants/trade.constants'
import { TRADE_REVIEW_AI_THRESHOLDS } from '@/config/thresholds'

const logger = getLogger()

// ============================================================
// 六维报告类型定义
// ============================================================

/** 交易摘要 */
export interface TradeSummary {
  /** 总交易笔数 */
  totalTrades: number
  /** 盈利笔数 */
  profitableTrades: number
  /** 亏损笔数 */
  losingTrades: number
  /** 胜率 (%) */
  winRate: number
  /** 盈亏比 */
  profitLossRatio: number
  /** 平均盈利 (%) */
  avgProfit: number
  /** 平均亏损 (%) */
  avgLoss: number
  /** 总盈亏 */
  totalPnL: number
  /** 总盈亏百分比 */
  totalPnLPercent: number
  /** 纪律评分 */
  disciplineScore: number
  /** 错误总数 */
  totalErrors: number
}

/** 错误分析 */
export interface ErrorAnalysis {
  /** TOP5 错误 */
  topErrors: Array<{
    name: string
    severity: string
    count: number
    psychologicalRoot: string
  }>
  /** 错误趋势描述 */
  errorTrend: string
  /** 心理画像 */
  psychologicalProfile: PsychologicalProfile
  /** 风险画像 */
  riskProfile: RiskProfile
}

/** 纪律分析 */
export interface DisciplineAnalysis {
  /** 计划遵守率 */
  planAdherenceRate: number
  /** 止损执行率 */
  stopLossExecutionRate: number
  /** 仓位管理评分 */
  positionManagementScore: number
  /** 情绪控制评分 */
  emotionControlScore: number
  /** 综合纪律评分 */
  overallScore: number
  /** 改善建议 */
  improvements: string[]
}

/** 推荐学习资源 */
export interface RecommendedResource {
  type: 'book' | 'course' | 'article' | 'video' | 'practice' | 'tool'
  title: string
  description: string
}

/** 技能发展（与 tradeReview.types.ts 设计对齐的运行时视图） */
export interface SkillDevelopment {
  /** 当前水平评估（兼容旧 UI 的展示文本） */
  currentLevel: string
  /** 优先技能排序 */
  prioritySkills: Array<{
    skill: string
    importance: 'high' | 'medium' | 'low'
    reason: string
  }>
  /** 推荐学习资源 */
  recommendedResources: RecommendedResource[]

  // ============================================================
  // 以下字段与 tradeReview.types.ts 的 SkillDevelopment 对齐
  // ============================================================
  /** 关联用户 ID（本机运行时使用固定标识） */
  userId: string
  /** 技能维度评分（按错误检测结果推导） */
  dimensions: Array<{
    code: SkillDimensionCode
    name: string
    /** 运行时扩展字段，用于里程碑展示与提示 */
    description: string
    currentLevel: SkillLevel
    targetLevel: SkillLevel
    score: number
    gap: number
  }>
  /** 技能发展里程碑 */
  milestones: Array<{
    id: string
    title: string
    description: string
    skillDimension: SkillDimensionCode
    targetLevel: SkillLevel
    criteria: string[]
    achieved: boolean
    achievedAt?: number
    targetDate: string
  }>
  /** 学习路径节点 */
  learningPath: Array<{
    order: number
    title: string
    description: string
    resources: Array<{ type: 'book' | 'course' | 'article' | 'video'; title: string; url?: string }>
    exercises: string[]
    estimatedHours: number
    completed: boolean
  }>
  /** 总体技能等级 */
  overallLevel: SkillLevel
  /** 最近更新时间 */
  updatedAt: number
}

/** 技能等级（与 tradeReview.types.ts 保持一致） */
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master'

/** 行动计划 */
export interface ActionPlan {
  /** 立即执行 / 本周 */
  immediate: string[]
  /** 短期 / 1 个月 */
  shortTerm: string[]
  /** 长期 / 3 个月 */
  longTerm: string[]
}

/** AI 深度洞察 */
export interface AIDeepInsight {
  /** 盈亏归因 */
  pnlAttribution: string[]
  /** 数据规律 */
  dataPatterns: string[]
  /** 个性化建议 */
  personalizedAdvice: string[]
}

/** 六维复盘报告 */
export interface TradeReviewReport {
  /** 生成时间 */
  generatedAt: number
  /** 交易摘要 */
  summary: TradeSummary
  /** 错误分析 */
  errorAnalysis: ErrorAnalysis
  /** 纪律分析 */
  disciplineAnalysis: DisciplineAnalysis
  /** 技能发展 */
  skillDevelopment: SkillDevelopment
  /** 行动计划 */
  actionPlan: ActionPlan
  /** AI 深度洞察 */
  aiInsight: AIDeepInsight
  /** AI 洞察来源（仅 LLM 增强模式下存在） */
  aiInsightSource?: 'llm' | 'rule'
}

/** 交易错误实例别名（兼容 Store 层命名） */
export type TradeError = DetectedError

/** 持久化到 trade_reviews store 的复盘摘要记录 */
export interface TradeReviewRecord {
  id: string
  generatedAt: number
  report: TradeReviewReport
  tradeErrors: TradeError[]
  disciplineScore: number
  skillRoadmap: string[]
  psychologicalProfile: PsychologicalProfile | null
}

// ============================================================
// 心理画像类型
// ============================================================

/** 6 种心理画像 */
export type PsychologicalProfileType =
  | 'chase_type'        // 追涨型
  | 'fear_profit_type'  // 恐盈型
  | 'hold_loss_type'    // 扛单型
  | 'emotional_type'    // 情绪化型
  | 'aggressive_type'   // 激进型
  | 'impulsive_type'    // 冲动型

export interface PsychologicalProfile {
  /** 画像类型 */
  primaryType: PsychologicalProfileType
  /** 画像名称 */
  name: string
  /** 特征描述 */
  characteristics: string[]
  /** 心理根源 */
  rootCause: string
  /** 改进方向 */
  improvementDirection: string
}

export interface RiskProfile {
  /** 风险偏好 */
  riskAppetite: 'conservative' | 'moderate' | 'aggressive'
  /** 最大回撤 */
  maxDrawdown: number
  /** 仓位集中度 */
  concentrationLevel: 'low' | 'medium' | 'high'
  /** 风险控制建议 */
  suggestions: string[]
}

// ============================================================
// 技能维度与错误映射（与设计文档 tradeReview.types.ts 对齐）
// ============================================================

/**
 * 技能维度编码（硬编码字面量联合，避免 as const 与枚举混用导致的类型推断问题）
 */
export type SkillDimensionCode =
  | 'stop_loss'
  | 'position_management'
  | 'plan_execution'
  | 'emotion_control'
  | 'entry_timing'
  | 'exit_timing'
  | 'trade_frequency'
  | 'decision_execution'
  | 'data_review'
  | 'setup_selection'

/** 技能维度定义项 */
interface SkillDimensionDefinition {
  readonly code: SkillDimensionCode
  readonly name: string
  readonly relatedErrors: readonly TradeErrorType[]
  readonly description: string
}

/**
 * 技能维度定义
 *
 * 设计参考：
 * - Trademetria 强调 Master discipline / Spot winning patterns / Cut emotional decisions /
 *   Improve risk management / Build data-driven habits，并提供 R-multiple、Profit Factor、
 *   Expectancy 等量化指标与规则挑战（Challenges）。
 * - Edgewonk 聚焦 Bigger winners / Higher winrate / Fewer mistakes / Make discipline your edge /
 *   Structure builds consistency，通过 setup/instrument/condition 分析找出真正的优势来源。
 * - Tradervue 提供按执行、策略、品种、资产类别切分的可定制报告与小时图统计。
 *
 * 提炼原则：
 * 1. 每个维度必须能从交易规则错误中量化推导（或从纪律评分间接推导）。
 * 2. 覆盖“风险-计划-情绪-入场-出场-频率-复盘-选样”完整交易闭环。
 * 3. 维度数量控制在 8-10 个，避免认知过载。
 */
export const SKILL_DIMENSIONS: readonly SkillDimensionDefinition[] = [
  {
    code: 'stop_loss',
    name: '止损执行',
    relatedErrors: [TradeErrorType.NO_STOP_LOSS, TradeErrorType.IGNORE_STOP_LOSS],
    description: '按计划设置并执行止损的能力',
  },
  {
    code: 'position_management',
    name: '仓位管理',
    relatedErrors: [TradeErrorType.HEAVY_GAMBLING],
    description: '合理分配单笔和单标的仓位，控制集中度',
  },
  {
    code: 'plan_execution',
    name: '交易计划执行',
    relatedErrors: [TradeErrorType.PLAN_VIOLATION],
    description: '制定并严格执行交易计划的能力',
  },
  {
    code: 'emotion_control',
    name: '情绪控制',
    relatedErrors: [TradeErrorType.REVENGE_TRADING, TradeErrorType.FOMO_ENTRY],
    description: '避免情绪化、报复性和FOMO驱动的交易',
  },
  {
    code: 'entry_timing',
    name: '入场时机',
    relatedErrors: [TradeErrorType.CHASE_HIGH_SELL_LOW, TradeErrorType.AGAINST_TREND_ADDING],
    description: '选择合理入场点，避免追涨杀跌和逆势加仓',
  },
  {
    code: 'exit_timing',
    name: '出场时机',
    relatedErrors: [TradeErrorType.EARLY_PROFIT_TAKING, TradeErrorType.GREEDY_TAIL_CHASING],
    description: '把握止盈出场节奏，避免过早止盈或贪鱼尾',
  },
  {
    code: 'trade_frequency',
    name: '交易频率管理',
    relatedErrors: [TradeErrorType.OVERTRADING],
    description: '控制交易频次，避免过度交易和手续费损耗',
  },
  {
    code: 'decision_execution',
    name: '决策执行力',
    relatedErrors: [TradeErrorType.HESITATION_MISS],
    description: '在明确信号出现后及时执行决策',
  },
  {
    // 新增维度：Edgewonk/Trademetria 均强调数据驱动复盘习惯，是长期进步的底层技能。
    // 间接推导：当交易计划混乱、频繁犯错且无规律时，说明缺乏复盘习惯。
    code: 'data_review',
    name: '数据驱动复盘',
    relatedErrors: [TradeErrorType.PLAN_VIOLATION, TradeErrorType.OVERTRADING],
    description: '基于交易日志和统计指标进行定期复盘并迭代策略',
  },
  {
    // 新增维度：对应 Edgewonk "Spot winning patterns" 与 Tradervue 按 setup/instrument 切分报告。
    // 间接推导：追涨杀跌、逆势加仓往往源于对品种和 setup 的筛选不足。
    code: 'setup_selection',
    name: '模式与品种选择',
    relatedErrors: [TradeErrorType.CHASE_HIGH_SELL_LOW, TradeErrorType.AGAINST_TREND_ADDING, TradeErrorType.GREEDY_TAIL_CHASING],
    description: '识别高概率交易 setup 与适配品种，聚焦优势领域',
  },
]

// ============================================================
// 心理画像生成
// ============================================================

/**
 * 根据错误分类结果生成心理画像
 */
export function generatePsychologicalProfile(
  classification: ErrorClassificationResult,
): PsychologicalProfile {
  logger.info('[TradeReviewAI] 生成心理画像')

  const errorTypes = classification.errors.map((e) => e.type)
  const criticalErrors = classification.errors.filter((e) => e.severity === 'critical')

  // 追涨型：存在追涨杀跌 + FOMO
  if (
    errorTypes.includes(TradeErrorType.CHASE_HIGH_SELL_LOW) &&
    errorTypes.includes(TradeErrorType.FOMO_ENTRY)
  ) {
    return {
      primaryType: 'chase_type',
      name: '追涨型',
      characteristics: [
        '容易在股价快速拉升时追高买入',
        '缺乏耐心等待回调',
        '容易受到市场情绪影响',
        '买入后常遭遇价格回落',
      ],
      rootCause: 'FOMO 心理和从众效应，害怕错过行情',
      improvementDirection: '建立严格的入场规则，等待回调确认后再入场，使用限价单而非市价单',
    }
  }

  // 恐盈型：提前止盈 + 犹豫错过
  if (
    errorTypes.includes(TradeErrorType.EARLY_PROFIT_TAKING) &&
    (errorTypes.includes(TradeErrorType.HESITATION_MISS) || classification.errors.length <= 2)
  ) {
    return {
      primaryType: 'fear_profit_type',
      name: '恐盈型',
      characteristics: [
        '盈利后急于兑现，过早止盈',
        '对持仓利润感到不安',
        '错过更大的盈利空间',
        '交易决策偏保守',
      ],
      rootCause: '对利润的恐惧，害怕回吐浮盈，缺乏持仓信心',
      improvementDirection: '使用移动止损锁定利润，让利润奔跑，建立分批止盈策略',
    }
  }

  // 扛单型：扛单不止损 + 逆势加仓
  if (
    errorTypes.includes(TradeErrorType.NO_STOP_LOSS) &&
    errorTypes.includes(TradeErrorType.AGAINST_TREND_ADDING)
  ) {
    return {
      primaryType: 'hold_loss_type',
      name: '扛单型',
      characteristics: [
        '亏损时不愿止损，抱有侥幸心理',
        '下跌趋势中逆势加仓',
        '小亏变大亏',
        '止损纪律执行差',
      ],
      rootCause: '损失厌恶和沉没成本谬误，不愿承认错误',
      improvementDirection: '严格设置止损位并执行，每笔交易前预设最大亏损金额，使用条件单自动止损',
    }
  }

  // 激进型：重仓豪赌 + 违反计划
  if (
    errorTypes.includes(TradeErrorType.HEAVY_GAMBLING) ||
    errorTypes.includes(TradeErrorType.PLAN_VIOLATION)
  ) {
    return {
      primaryType: 'aggressive_type',
      name: '激进型',
      characteristics: [
        '仓位管理激进，单笔仓位过大',
        '容易违反交易计划',
        '追求高收益但忽视风险',
        '风险控制意识不足',
      ],
      rootCause: '急功近利，想快速获利，过度自信',
      improvementDirection: '严格执行仓位管理规则（单笔 < 20%），使用仓位计算器，建立交易检查清单',
    }
  }

  // 情绪化型：报复性交易主导
  if (errorTypes.includes(TradeErrorType.REVENGE_TRADING)) {
    return {
      primaryType: 'emotional_type',
      name: '情绪化型',
      characteristics: [
        '亏损后容易情绪失控',
        '报复性交易频繁',
        '交易决策受情绪影响大',
        '缺乏冷静期机制',
      ],
      rootCause: '情绪管理能力不足，亏损后急于翻本',
      improvementDirection: '建立交易冷静期规则（亏损后强制休息 30 分钟），每日冥想或情绪记录',
    }
  }

  // 冲动型：过度交易 + 贪鱼尾
  if (
    errorTypes.includes(TradeErrorType.OVERTRADING) ||
    errorTypes.includes(TradeErrorType.GREEDY_TAIL_CHASING)
  ) {
    return {
      primaryType: 'impulsive_type',
      name: '冲动型',
      characteristics: [
        '交易频率过高',
        '缺乏耐心等待最佳时机',
        '容易追尾行情',
        '交易决策缺乏深思熟虑',
      ],
      rootCause: '交易成瘾倾向，寻求刺激感，缺乏交易计划',
      improvementDirection: '限制每日交易次数，每笔交易前填写交易计划表，减少盯盘时间',
    }
  }

  // 默认：偏中性
  if (criticalErrors.length > 0) {
    return {
      primaryType: 'emotional_type',
      name: '情绪化型',
      characteristics: ['存在明显交易纪律问题', '错误类型多样', '需系统性改善'],
      rootCause: '交易纪律和情绪管理均有待提升',
      improvementDirection: '从基础交易纪律入手，逐步建立完整的交易体系',
    }
  }

  return {
    primaryType: 'impulsive_type',
    name: '冲动型',
    characteristics: ['交易行为需要进一步观察', '建议增加交易记录'],
    rootCause: '交易经验不足或缺乏系统化交易方法',
    improvementDirection: '建立交易日志，记录每笔交易的决策逻辑',
  }
}

/**
 * 生成风险画像
 */
export function generateRiskProfile(
  classification: ErrorClassificationResult,
  orders: Order[],
): RiskProfile {
  logger.info('[TradeReviewAI] 生成风险画像')

  const hasHeavyGambling = classification.errors.some(
    (e) => e.type === TradeErrorType.HEAVY_GAMBLING,
  )
  const hasNoStopLoss = classification.errors.some(
    (e) => e.type === TradeErrorType.NO_STOP_LOSS,
  )

  let riskAppetite: RiskProfile['riskAppetite'] = 'moderate'
  if (hasHeavyGambling) riskAppetite = 'aggressive'
  else if (classification.disciplineScore >= 80) riskAppetite = 'conservative'

  // 计算最大回撤（简化）
  const pairs = buildTradePairs(orders)
  let maxDrawdown = 0
  let runningPnL = 0
  let peak = 0
  for (const pair of pairs) {
    runningPnL += pair.profitPct
    if (runningPnL > peak) peak = runningPnL
    const drawdown = peak - runningPnL
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }
  maxDrawdown = Math.round(maxDrawdown * 100) / 100

  // 仓位集中度
  const bySymbol = new Map<string, number>()
  for (const order of orders) {
    const current = bySymbol.get(order.symbol) ?? 0
    bySymbol.set(order.symbol, current + order.amount)
  }
  const totalAmount = orders.reduce((sum, o) => sum + o.amount, 0)
  let maxConcentration = 0
  for (const [, amount] of bySymbol) {
    const conc = totalAmount > 0 ? amount / totalAmount : 0
    if (conc > maxConcentration) maxConcentration = conc
  }

  let concentrationLevel: RiskProfile['concentrationLevel'] = 'medium'
  if (maxConcentration > 0.5) concentrationLevel = 'high'
  else if (maxConcentration < 0.2) concentrationLevel = 'low'

  const suggestions: string[] = []
  if (hasNoStopLoss) suggestions.push('必须设置每笔交易的止损位并严格执行')
  if (hasHeavyGambling) suggestions.push('严格控制单笔仓位不超过总资金的 20%')
  if (concentrationLevel === 'high') suggestions.push('建议分散持仓，降低单一标的集中度')
  if (maxDrawdown > 15) suggestions.push('最大回撤偏高，建议设置组合层面的回撤止损线')
  if (riskAppetite === 'aggressive') suggestions.push('建议降低风险偏好，采用更稳健的仓位管理策略')

  return {
    riskAppetite,
    maxDrawdown,
    concentrationLevel,
    suggestions,
  }
}

// ============================================================
// 六维报告生成
// ============================================================

/**
 * 生成交易摘要
 */
function generateTradeSummary(
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
function generateErrorAnalysis(
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
function generateDisciplineAnalysis(
  _orders: Order[],
  classification: ErrorClassificationResult,
): DisciplineAnalysis {
  const hasPlanViolation = classification.errors.some(
    (e) => e.type === TradeErrorType.PLAN_VIOLATION,
  )
  const hasStopLossIssue = classification.errors.some(
    (e) => e.type === TradeErrorType.NO_STOP_LOSS || e.type === TradeErrorType.IGNORE_STOP_LOSS,
  )
  const hasPositionIssue = classification.errors.some(
    (e) => e.type === TradeErrorType.HEAVY_GAMBLING,
  )
  const hasEmotionIssue = classification.errors.some(
    (e) => e.type === TradeErrorType.REVENGE_TRADING || e.type === TradeErrorType.FOMO_ENTRY,
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
 * 将纪律评分映射为技能等级
 * @param score 0-100 分
 */
function scoreToSkillLevel(score: number): SkillLevel {
  if (score >= TRADE_REVIEW_AI_THRESHOLDS.SKILL_LEVEL_EXPERT_THRESHOLD) return 'expert'
  if (score >= TRADE_REVIEW_AI_THRESHOLDS.SKILL_LEVEL_ADVANCED_THRESHOLD) return 'advanced'
  if (score >= TRADE_REVIEW_AI_THRESHOLDS.SKILL_LEVEL_INTERMEDIATE_THRESHOLD) return 'intermediate'
  if (score >= TRADE_REVIEW_AI_THRESHOLDS.SKILL_LEVEL_BEGINNER_THRESHOLD) return 'beginner'
  return 'beginner'
}

/**
 * 计算技能维度目标等级
 */
function getTargetLevel(currentLevel: SkillLevel): SkillLevel {
  const levels: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert', 'master']
  const idx = levels.indexOf(currentLevel)
  return idx < levels.length - 1 ? levels[idx + 1]! : 'master'
}

/**
 * 根据检测到的错误，计算每个技能维度的得分
 * @returns code → score(0-100)
 */
function calculateSkillDimensionScores(
  classification: ErrorClassificationResult,
): Map<SkillDimensionCode, number> {
  logger.info('[TradeReviewAI] 计算技能维度评分')

  const scores = new Map<SkillDimensionCode, number>()

  // 初始默认分数：无错误时 85 分，有错误时按错误扣分
  for (const dim of SKILL_DIMENSIONS) {
    scores.set(dim.code, TRADE_REVIEW_AI_THRESHOLDS.DIMENSION_DEFAULT_SCORE)
  }

  for (const error of classification.errors) {
    for (const dim of SKILL_DIMENSIONS) {
      // 使用 indexOf() 避免 readonly tuple 上 includes() 的类型推断问题
      if (dim.relatedErrors.indexOf(error.type) !== -1) {
        const current = scores.get(dim.code) ?? TRADE_REVIEW_AI_THRESHOLDS.DIMENSION_DEFAULT_SCORE
        const penalty =
          error.severity === 'critical'
            ? TRADE_REVIEW_AI_THRESHOLDS.ERROR_PENALTY_CRITICAL
            : error.severity === 'major'
              ? TRADE_REVIEW_AI_THRESHOLDS.ERROR_PENALTY_MAJOR
              : TRADE_REVIEW_AI_THRESHOLDS.ERROR_PENALTY_MINOR
        scores.set(dim.code, Math.max(0, current - penalty * error.count))
      }
    }
  }

  return scores
}

/**
 * 生成技能发展建议
 * @remarks 重构后与 tradeReview.types.ts 的 SkillDevelopment 结构对齐
 */
function generateSkillDevelopment(
  classification: ErrorClassificationResult,
  _orders: Order[],
): SkillDevelopment {
  logger.info('[TradeReviewAI] 生成技能发展路径')

  // 1. 兼容旧 UI 的当前水平文本
  let currentLevelText = '中级交易者'
  if (classification.disciplineScore >= 85) currentLevelText = '高级交易者'
  else if (classification.disciplineScore < 50) currentLevelText = '初级交易者'

  // 2. 计算每个技能维度得分
  const dimensionScores = calculateSkillDimensionScores(classification)

  // 3. 构建 dimensions（与类型定义对齐）
  const dimensions: SkillDevelopment['dimensions'] = SKILL_DIMENSIONS.map((dim) => {
    const score = Math.round(dimensionScores.get(dim.code) ?? TRADE_REVIEW_AI_THRESHOLDS.DIMENSION_DEFAULT_SCORE)
    const currentLevel = scoreToSkillLevel(score)
    const targetLevel = getTargetLevel(currentLevel)
    const targetScore =
      targetLevel === 'beginner' ? TRADE_REVIEW_AI_THRESHOLDS.TARGET_SCORE_BEGINNER :
      targetLevel === 'intermediate' ? TRADE_REVIEW_AI_THRESHOLDS.TARGET_SCORE_INTERMEDIATE :
      targetLevel === 'advanced' ? TRADE_REVIEW_AI_THRESHOLDS.TARGET_SCORE_ADVANCED :
      targetLevel === 'expert' ? TRADE_REVIEW_AI_THRESHOLDS.TARGET_SCORE_EXPERT : TRADE_REVIEW_AI_THRESHOLDS.TARGET_SCORE_MASTER
    return {
      code: dim.code,
      name: dim.name,
      description: dim.description,
      currentLevel,
      targetLevel,
      score,
      gap: Math.max(0, targetScore - score),
    }
  })

  // 4. 构建优先技能排序（按 score 升序，gap 越大越优先）
  const prioritySkills: SkillDevelopment['prioritySkills'] = [...dimensions]
    .filter((d) => d.score < 80)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5)
    .map((d) => ({
      skill: d.name,
      importance: d.gap >= 25 ? 'high' : d.gap >= 15 ? 'medium' : 'low',
      reason: `${d.name}当前评分 ${d.score}，距离目标等级 ${d.targetLevel} 还有 ${d.gap} 分差距`,
    }))

  // 兜底：如果没有低分技能，保持基础建议
  if (prioritySkills.length === 0) {
    prioritySkills.push(
      { skill: '仓位管理', importance: 'medium', reason: '合理的仓位管理是控制风险的基础' },
      { skill: '情绪控制', importance: 'medium', reason: '情绪稳定是长期盈利的关键' },
    )
  }

  // 5. 推荐学习资源
  const recommendedResources: SkillDevelopment['recommendedResources'] = [
    {
      type: 'book',
      title: '《交易心理分析》',
      description: 'Mark Douglas 经典著作，帮助理解交易心理和纪律的重要性',
    },
    {
      type: 'book',
      title: '《股票大作手回忆录》',
      description: 'Jesse Livermore 的交易哲学，理解市场情绪和人性弱点',
    },
    {
      type: 'article',
      title: '每日交易日志',
      description: '记录每笔交易的决策逻辑、情绪状态和结果，定期复盘',
    },
    {
      type: 'video',
      title: 'V6 Pro 复盘工具',
      description: '使用 AI 驱动的交易复盘系统，自动分析交易行为模式',
    },
  ]

  // 6. 里程碑（与 tradeReview.types.ts 对齐）
  const milestones: SkillDevelopment['milestones'] = dimensions.map((d, idx) => ({
    id: `milestone_${d.code}_${Date.now()}_${idx}`,
    title: `${d.name}达到${d.targetLevel === 'intermediate' ? '进阶' : d.targetLevel === 'advanced' ? '高级' : d.targetLevel === 'expert' ? '专家' : '大师'}水平`,
    description: d.name,
    skillDimension: d.code,
    targetLevel: d.targetLevel,
    criteria: [
      `${d.name}连续 10 笔交易无相关错误`,
      `${d.name}评分从 ${d.score} 提升到 ${Math.min(MAX_SCORE, d.score + d.gap)}`,
      `完成对应学习路径中的练习任务`,
    ],
    achieved: d.score >= 85,
    targetDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  }))

  // 7. 学习路径（与 tradeReview.types.ts 对齐）
  const learningPath: SkillDevelopment['learningPath'] = [
    {
      order: 1,
      title: '建立交易纪律基础',
      description: '从止损执行和交易计划入手，建立可重复的交易纪律',
      resources: [
        { type: 'book', title: '《交易心理分析》' },
        { type: 'course', title: '交易纪律训练营' },
      ],
      exercises: ['连续 5 个交易日填写交易计划表', '为所有持仓设置条件止损单'],
      estimatedHours: 10,
      completed: classification.disciplineScore >= 70,
    },
    {
      order: 2,
      title: '优化仓位与情绪管理',
      description: '学习仓位管理公式，建立情绪冷却机制',
      resources: [
        { type: 'article', title: '凯利公式与仓位管理' },
        { type: 'video', title: '情绪管理 Meditation for Traders' },
      ],
      exercises: ['单笔仓位不超过总资金 20%', '亏损后强制休息 30 分钟'],
      estimatedHours: 8,
      completed: classification.disciplineScore >= 80,
    },
    {
      order: 3,
      title: '提升入场与出场时机',
      description: '通过技术分析和回测优化进出场信号',
      resources: [
        { type: 'course', title: '技术分析进阶' },
        { type: 'course', title: 'V6 Pro 回测工具实战' },
      ],
      exercises: ['对最近 20 笔交易进行买卖点复盘', '建立个人交易信号 checklist'],
      estimatedHours: 15,
      completed: classification.disciplineScore >= 90,
    },
    {
      order: 4,
      title: '系统化交易系统',
      description: '整合技能维度，形成完整的个人交易系统',
      resources: [
        { type: 'book', title: '《通向财务自由之路》' },
        { type: 'article', title: '季度深度复盘指南' },
      ],
      exercises: ['撰写个人交易 SOP', '完成一次季度 AI 深度复盘'],
      estimatedHours: 12,
      completed: classification.disciplineScore >= 95,
    },
  ]

  // 8. 总体技能等级
  const avgScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
  const overallLevel = scoreToSkillLevel(Math.round(avgScore))

  return {
    currentLevel: currentLevelText,
    prioritySkills,
    recommendedResources,
    userId: 'local_user',
    dimensions,
    milestones,
    learningPath,
    overallLevel,
    updatedAt: Date.now(),
  }
}

/**
 * 生成行动计划
 */
function generateActionPlan(
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
  if (discipline.stopLossExecutionRate < 70) {
    immediate.push('为所有持仓设置条件止损单')
  }

  // 短期
  shortTerm.push('每日收盘后使用 V6 Pro 复盘工具分析当日交易')
  shortTerm.push('建立交易错误日志，记录每次违规并分析原因')
  shortTerm.push('学习并实践仓位管理公式（凯利公式或固定比例法）')
  if (discipline.emotionControlScore < 60) {
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
 * 生成 AI 深度洞察
 */
function generateAIDeepInsight(
  summary: TradeSummary,
  errorAnalysis: ErrorAnalysis,
  discipline: DisciplineAnalysis,
): AIDeepInsight {
  const pnlAttribution: string[] = []
  const dataPatterns: string[] = []
  const personalizedAdvice: string[] = []

  // 盈亏归因
  if (summary.winRate >= 55) {
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

// ============================================================
// 主入口
// ============================================================

/**
 * 生成六维 AI 交易复盘报告
 *
 * @param orders 订单列表
 * @returns 完整的六维复盘报告
 */
function getLatestOrderCreatedAt(orders: Order[]): number {
  if (orders.length === 0) return 0
  return Math.max(...orders.map((o) => o.createdAt))
}

/** 同步复盘选项（仅支持 now 时间戳注入，用于单元测试和 freshness 校验） */
export interface SyncReviewOptions {
  now?: number
}

export function generateReview(
  orders: Order[],
  options?: SyncReviewOptions,
): TradeReviewReport {
  const now = options?.now ?? Date.now()
  logger.info(`[TradeReviewAI] 开始生成复盘报告: 订单数=${orders.length}`)

  try {
    // 0. Freshness 校验：报告生成时间必须晚于最新订单创建时间
    const latestOrderCreatedAt = getLatestOrderCreatedAt(orders)
    const freshness = checkReviewFreshness(now, latestOrderCreatedAt)
    logger.info(`[TradeReviewAI] review freshness check`, {
      valid: freshness.valid,
      outputTime: freshness.outputTime,
      inputTime: freshness.inputTime,
    })

    // 1. 错误分类
    const classification = classifyErrors(orders)

    // 2. 交易摘要
    const summary = generateTradeSummary(orders, classification)

    // 3. 错误分析
    const errorAnalysis = generateErrorAnalysis(classification, orders)

    // 4. 纪律分析
    const disciplineAnalysis = generateDisciplineAnalysis(orders, classification)

    // 5. 技能发展
    const skillDevelopment = generateSkillDevelopment(classification, orders)

    // 6. 行动计划
    const actionPlan = generateActionPlan(classification, disciplineAnalysis)

    // 7. AI 深度洞察
    const aiInsight = generateAIDeepInsight(summary, errorAnalysis, disciplineAnalysis)

    const report: TradeReviewReport = {
      generatedAt: now,
      summary,
      errorAnalysis,
      disciplineAnalysis,
      skillDevelopment,
      actionPlan,
      aiInsight,
    }

    logger.info(
      `[TradeReviewAI] 复盘报告生成完成: 纪律评分=${summary.disciplineScore}, ` +
      `胜率=${summary.winRate}%, 盈亏比=${summary.profitLossRatio}`,
    )

    return report
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[TradeReviewAI] 报告生成失败`, { error: message })
    throw err
  }
}

// ============================================================
// 辅助函数
// ============================================================

interface TradePair {
  buyId: string
  sellId: string
  profitPct: number
  holdDays: number
}

function buildTradePairs(orders: Order[]): TradePair[] {
  const pairs: TradePair[] = []
  const bySymbol = new Map<string, Order[]>()

  for (const order of orders) {
    const list = bySymbol.get(order.symbol) ?? []
    list.push(order)
    bySymbol.set(order.symbol, list)
  }

  for (const [, symOrders] of bySymbol) {
    symOrders.sort((a, b) => a.createdAt - b.createdAt)
    const buys: Order[] = []
    for (const order of symOrders) {
      if (order.direction === 'buy') {
        buys.push(order)
      } else if (buys.length > 0) {
        const buy = buys.shift()!
        const profitPct = ((order.price - buy.price) / buy.price) * 100
        const holdDays = Math.round((order.createdAt - buy.createdAt) / (24 * 60 * 60 * 1000))
        pairs.push({
          buyId: buy.id,
          sellId: order.id,
          profitPct: Math.round(profitPct * 100) / 100,
          holdDays,
        })
      }
    }
  }

  return pairs
}

// ============================================================
// LLM 增强版本
// ============================================================

/**
 * 生成 LLM 深度洞察 Prompt
 */
function buildAIDeepInsightPrompt(
  summary: TradeSummary,
  errorAnalysis: ErrorAnalysis,
  discipline: DisciplineAnalysis,
): LlmMessage[] {
  return [
    {
      role: 'system',
      content: `你是一位资深交易心理与行为分析专家。请根据交易者的交易统计数据和心理画像，生成深度个性化洞察。

输出格式（严格 JSON，不要 markdown 代码块或额外解释）：
{
  "pnlAttribution": ["盈亏归因分析1", "盈亏归因分析2"],
  "dataPatterns": ["数据规律洞察1", "数据规律洞察2"],
  "personalizedAdvice": ["个性化建议1", "个性化建议2"]
}

要求：
- 每个数组 3-5 条，每条 30-60 字
- 必须结合具体数据（胜率、盈亏比、错误次数等）
- 建议必须可操作、可量化
- 不使用空泛套话`,
    },
    {
      role: 'user',
      content: `请分析以下交易数据并生成深度洞察：

## 交易摘要
- 总交易笔数: ${summary.totalTrades}
- 胜率: ${summary.winRate}%
- 盈亏比: ${summary.profitLossRatio}
- 平均盈利: ${summary.avgProfit}%
- 平均亏损: ${summary.avgLoss}%
- 总盈亏: ${summary.totalPnL}%
- 错误总数: ${summary.totalErrors}

## 心理画像
- 类型: ${errorAnalysis.psychologicalProfile.name}
- 特征: ${errorAnalysis.psychologicalProfile.characteristics.join('、')}
- 心理根源: ${errorAnalysis.psychologicalProfile.rootCause}

## 纪律分析
- 计划遵守率: ${discipline.planAdherenceRate}%
- 止损执行率: ${discipline.stopLossExecutionRate}%
- 仓位管理评分: ${discipline.positionManagementScore}
- 情绪控制评分: ${discipline.emotionControlScore}
- 综合纪律评分: ${discipline.overallScore}

## TOP5 错误
${errorAnalysis.topErrors.map((e, i) => `${i + 1}. ${e.name}（${e.count}次，${e.severity}）：${e.psychologicalRoot}`).join('\n')}`,
    },
  ]
}

/** 解析 LLM 洞察 JSON */
function parseAIDeepInsightFromLlm(content: string): AIDeepInsight {
  try {
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    const jsonStr = jsonMatch?.[1] ?? content
    const parsed = JSON.parse(jsonStr.trim())
    return {
      pnlAttribution: Array.isArray(parsed.pnlAttribution) ? parsed.pnlAttribution.map(String) : [],
      dataPatterns: Array.isArray(parsed.dataPatterns) ? parsed.dataPatterns.map(String) : [],
      personalizedAdvice: Array.isArray(parsed.personalizedAdvice) ? parsed.personalizedAdvice.map(String) : [],
    }
  } catch {
    logger.warn('[TradeReviewAI] LLM 洞察解析失败，降级为规则模板', { snippet: content.slice(0, LOG_TRUNCATE_LENGTH) })
    return { pnlAttribution: [], dataPatterns: [], personalizedAdvice: [] }
  }
}

export interface TradeReviewOptions {
  /** LLM 配置覆盖，启用 LLM 深度洞察 */
  llmConfig?: PartialLlmConfig
  /** 进度回调 */
  onProgress?: (phase: string, message: string) => void
  /** 报告生成时间戳（用于 freshness 校验与测试） */
  now?: number
}

/**
 * 生成六维 AI 交易复盘报告（LLM 增强版）
 *
 * 与 generateReview() 的区别：
 * - 支持异步（可选 LLM 洞察增强）
 * - 当 llmConfig 可用时，AI 洞察由 LLM 生成而非硬编码模板
 * - LLM 不可用时自动降级为规则引擎模板
 *
 * @param orders 订单列表
 * @param options 可选配置
 */
export async function generateReviewAsync(
  orders: Order[],
  options?: TradeReviewOptions,
): Promise<TradeReviewReport> {
  const { llmConfig: llmOverride, onProgress, now: nowOption } = options ?? {}
  const now = nowOption ?? Date.now()

  logger.info(`[TradeReviewAI] 开始生成异步复盘报告: 订单数=${orders.length}`)

  try {
    // 0. Freshness 校验：报告生成时间必须晚于最新订单创建时间
    const latestOrderCreatedAt = getLatestOrderCreatedAt(orders)
    const freshness = checkReviewFreshness(now, latestOrderCreatedAt)
    logger.info(`[TradeReviewAI] async review freshness check`, {
      valid: freshness.valid,
      outputTime: freshness.outputTime,
      inputTime: freshness.inputTime,
    })

    // 1-6: 规则引擎生成前五维（同步，不依赖 LLM）
    const classification = classifyErrors(orders)
    const summary = generateTradeSummary(orders, classification)
    const errorAnalysis = generateErrorAnalysis(classification, orders)
    const disciplineAnalysis = generateDisciplineAnalysis(orders, classification)
    const skillDevelopment = generateSkillDevelopment(classification, orders)
    const actionPlan = generateActionPlan(classification, disciplineAnalysis)

    // 7: AI 深度洞察 — LLM 增强
    let aiInsight: AIDeepInsight
    let usedLlm = false

    if (llmOverride) {
      const defaults = { baseURL: '', apiKey: '', model: '', ...llmOverride }
      if (isLlmConfigured(defaults)) {
        try {
          onProgress?.('llm', '调用 LLM 生成深度洞察...')
          logger.info('[TradeReviewAI] 使用 LLM 生成 AI 深度洞察')

          const messages = buildAIDeepInsightPrompt(summary, errorAnalysis, disciplineAnalysis)
          const response = await chat(messages, { ...llmOverride })
          logger.info(`[TradeReviewAI] LLM 洞察返回: model=${response.model}, tokens=${response.usage?.totalTokens ?? 'unknown'}`)

          const llmInsight = parseAIDeepInsightFromLlm(response.content)
          // 确保 LLM 返回有有效内容
          if (llmInsight.pnlAttribution.length > 0 || llmInsight.personalizedAdvice.length > 0) {
            aiInsight = llmInsight
            usedLlm = true
          } else {
            logger.warn('[TradeReviewAI] LLM 返回空洞察，降级为规则模板')
            aiInsight = generateAIDeepInsight(summary, errorAnalysis, disciplineAnalysis)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          logger.warn(`[TradeReviewAI] LLM 洞察失败，降级为规则模板: ${msg}`)
          onProgress?.('llm', `LLM 洞察失败: ${msg}`)
          aiInsight = generateAIDeepInsight(summary, errorAnalysis, disciplineAnalysis)
        }
      } else {
        aiInsight = generateAIDeepInsight(summary, errorAnalysis, disciplineAnalysis)
      }
    } else {
      aiInsight = generateAIDeepInsight(summary, errorAnalysis, disciplineAnalysis)
    }

    const report: TradeReviewReport = {
      generatedAt: now,
      summary,
      errorAnalysis,
      disciplineAnalysis,
      skillDevelopment,
      actionPlan,
      aiInsight,
      ...(usedLlm && { aiInsightSource: 'llm' as const }),
    }

    logger.info(
      `[TradeReviewAI] 异步复盘报告生成完成${usedLlm ? '（含LLM洞察）' : ''}: ` +
      `纪律评分=${summary.disciplineScore}, 胜率=${summary.winRate}%, 盈亏比=${summary.profitLossRatio}`,
    )

    return report
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[TradeReviewAI] 异步报告生成失败`, { error: message })
    throw err
  }
}