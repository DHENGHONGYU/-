/**
 * 技能维度定义与辅助函数
 *
 * 设计参考：
 * - Trademetria: Master discipline / Spot winning patterns / Cut emotional decisions /
 *   Improve risk management / Build data-driven habits
 * - Edgewonk: Bigger winners / Higher winrate / Fewer mistakes / Make discipline your edge
 * - Tradervue: 按 setup/instrument/condition 切分报告
 *
 * 提炼原则：
 * 1. 每个维度必须能从交易规则错误中量化推导（或从纪律评分间接推导）
 * 2. 覆盖"风险-计划-情绪-入场-出场-频率-复盘-选样"完整交易闭环
 * 3. 维度数量控制在 8-10 个，避免认知过载
  * @doc [V9-DOC-BACK-013, V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-ARCH-008, V9-DOC-BACK-005]
*/

import { TradeErrorType } from './tradeErrorClassifier'
import type { SkillDimensionDefinition, SkillLevel } from './tradeReviewAI.types'
import { TRADE_REVIEW_AI_THRESHOLDS } from '@/config/thresholds'

/**
 * 技能维度定义
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
    code: 'data_review',
    name: '数据驱动复盘',
    relatedErrors: [TradeErrorType.PLAN_VIOLATION, TradeErrorType.OVERTRADING],
    description: '基于交易日志和统计指标进行定期复盘并迭代策略',
  },
  {
    code: 'setup_selection',
    name: '模式与品种选择',
    relatedErrors: [TradeErrorType.CHASE_HIGH_SELL_LOW, TradeErrorType.AGAINST_TREND_ADDING, TradeErrorType.GREEDY_TAIL_CHASING],
    description: '识别高概率交易 setup 与适配品种，聚焦优势领域',
  },
]

/**
 * 将纪律评分映射为技能等级
 * @param score 0-100 分
 */
export function scoreToSkillLevel(score: number): SkillLevel {
  if (score >= TRADE_REVIEW_AI_THRESHOLDS.SKILL_LEVEL_EXPERT_THRESHOLD) return 'expert'
  if (score >= TRADE_REVIEW_AI_THRESHOLDS.SKILL_LEVEL_ADVANCED_THRESHOLD) return 'advanced'
  if (score >= TRADE_REVIEW_AI_THRESHOLDS.SKILL_LEVEL_INTERMEDIATE_THRESHOLD) return 'intermediate'
  if (score >= TRADE_REVIEW_AI_THRESHOLDS.SKILL_LEVEL_BEGINNER_THRESHOLD) return 'beginner'
  return 'beginner'
}

/**
 * 计算技能维度目标等级
 */
export function getTargetLevel(currentLevel: SkillLevel): SkillLevel {
  const levels: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert', 'master']
  const idx = levels.indexOf(currentLevel)
  return idx < levels.length - 1 ? levels[idx + 1]! : 'master'
}

/**
 * 获取目标分数（用于计算 gap）
 */
export function getTargetScore(targetLevel: SkillLevel): number {
  switch (targetLevel) {
    case 'beginner': return TRADE_REVIEW_AI_THRESHOLDS.TARGET_SCORE_BEGINNER
    case 'intermediate': return TRADE_REVIEW_AI_THRESHOLDS.TARGET_SCORE_INTERMEDIATE
    case 'advanced': return TRADE_REVIEW_AI_THRESHOLDS.TARGET_SCORE_ADVANCED
    case 'expert': return TRADE_REVIEW_AI_THRESHOLDS.TARGET_SCORE_EXPERT
    case 'master': return TRADE_REVIEW_AI_THRESHOLDS.TARGET_SCORE_MASTER
  }
}
