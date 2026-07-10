/**
 * 心理画像与风险画像生成器
 *
 * 根据错误分类结果生成：
 * - 心理画像（6种类型）
 * - 风险画像（风险偏好/回撤/集中度）
 */

import { getLogger } from '@/lib/logger'
import type { Order } from '@/data/types'
import { TradeErrorType } from './tradeErrorClassifier'
import type { ErrorClassificationResult } from './tradeErrorClassifier'
import type { PsychologicalProfile, RiskProfile } from './tradeReviewAI.types'
import { buildTradePairs } from './tradeReviewAI.utils'

const logger = getLogger()

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
  const suggestions: string[] = []

  if (hasHeavyGambling) {
    riskAppetite = 'aggressive'
    suggestions.push('严格控制单笔仓位不超过总资金的 20%')
  } else if (classification.disciplineScore >= 80) {
    riskAppetite = 'conservative'
  }

  // 计算最大回撤
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

  if (hasNoStopLoss) suggestions.push('必须设置每笔交易的止损位并严格执行')
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
