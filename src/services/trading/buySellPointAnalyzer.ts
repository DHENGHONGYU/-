/**
 * 买卖点分析服务
 *
 * 从交易对（买→卖）中分析买卖点有效性，评估参数合理性，
 * 提炼核心交易技能，生成买卖点复盘报告。
 *
 * 分析维度：
 * 1. 入场时机分析 — 各买点类型的胜率、平均收益、最优买点
 * 2. 出场时机分析 — 各卖点类型的胜率、平均收益、最优卖点
 * 3. 参数有效性评估 — 止盈止损/入场出场阈值的参数优化建议
 * 4. 核心技能提炼 — 从数据中提取可执行的交易技能洞察
 *
 * @doc [V9-DOC-BACK-013, V9-DOC-BACK-012, V9-DOC-ARCH-008]
 */

import type { Order } from '@/data/types'
import type { TradePair } from '@/services/trading/tradeReviewAI.types'
import { buildTradePairs } from '@/services/trading/tradeReviewAI.utils'
import {
  getEffectiveBuySellPointConfig,
  BUY_POINT_NAMES,
  SELL_POINT_NAMES,
} from '@/config/buySellPointConfig'
import { getEffectiveTradingConfig } from '@/config/tradingConfig'
import type {
  BuySellPointReview,
  CoreSkillInsight,
  EntryTimingAnalysis,
  ExitTimingAnalysis,
  ParameterEffectiveness,
  PointTypeStats,
  BuyPointType,
  SellPointType,
} from '@/types/modules/buySellPoint.types'
import { PERCENTAGE_BASE, MAX_SCORE } from '@/constants/trade.constants'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface TradePairWithContext {
  pair: TradePair
  buyOrder: Order | null
  sellOrder: Order | null
  profitPct: number
  holdDays: number
}

function findOrdersForPairs(orders: Order[], pairs: TradePair[]): TradePairWithContext[] {
  const orderMap = new Map(orders.map((o) => [o.id, o]))
  return pairs.map((pair) => ({
    pair,
    buyOrder: orderMap.get(pair.buyId) ?? null,
    sellOrder: orderMap.get(pair.sellId) ?? null,
    profitPct: pair.profitPct,
    holdDays: pair.holdDays,
  }))
}

function inferBuyPointType(_order: Order): BuyPointType {
  return 'buy_pivot'
}

function inferSellPointType(_order: Order, profitPct: number): SellPointType {
  const config = getEffectiveTradingConfig().signalThresholds
  if (profitPct <= -config.fixedStopLossPct) return 'sell_stop_loss'
  if (profitPct <= -config.trailingStopDrawdownPct) return 'sell_trailing_stop'
  return 'sell_profit_taking'
}

function computePointTypeStats(
  contexts: TradePairWithContext[],
  direction: 'buy' | 'sell',
): PointTypeStats[] {
  const typeGroups = new Map<string, { count: number; profitable: number; totalReturn: number }>()

  for (const ctx of contexts) {
    let type: string
    let isProfitable: boolean

    if (direction === 'buy') {
      if (!ctx.buyOrder) continue
      type = inferBuyPointType(ctx.buyOrder)
      isProfitable = ctx.profitPct > 0
    } else {
      if (!ctx.sellOrder) continue
      type = inferSellPointType(ctx.sellOrder, ctx.profitPct)
      isProfitable = ctx.profitPct > 0
    }

    const group = typeGroups.get(type) ?? { count: 0, profitable: 0, totalReturn: 0 }
    group.count++
    if (isProfitable) group.profitable++
    group.totalReturn += ctx.profitPct
    typeGroups.set(type, group)
  }

  const stats: PointTypeStats[] = []
  for (const [type, group] of typeGroups) {
    const winRate = group.count > 0
      ? Math.round((group.profitable / group.count) * PERCENTAGE_BASE * 10) / 10
      : 0
    const avgReturn = group.count > 0
      ? Math.round((group.totalReturn / group.count) * PERCENTAGE_BASE) / PERCENTAGE_BASE
      : 0

    let name: string
    let advice: string

    if (direction === 'buy') {
      name = BUY_POINT_NAMES[type as BuyPointType]
      advice = winRate >= 60
        ? `${name}胜率较高(${winRate}%)，建议继续保持此入场策略`
        : winRate >= 40
          ? `${name}胜率一般(${winRate}%)，建议结合更多信号确认入场`
          : `${name}胜率偏低(${winRate}%)，建议谨慎使用或优化入场参数`
    } else {
      name = SELL_POINT_NAMES[type as SellPointType]
      advice = winRate >= 60
        ? `${name}出场效果好(${winRate}%)，说明该出场策略有效`
        : winRate >= 40
          ? `${name}出场效果一般(${winRate}%)，可考虑优化止盈止损参数`
          : `${name}出场效果不佳(${winRate}%)，建议调整出场策略`
    }

    stats.push({
      type: type as BuyPointType | SellPointType,
      name,
      direction,
      count: group.count,
      profitableCount: group.profitable,
      winRate,
      avgReturn,
      parameterAdvice: advice,
    })
  }

  return stats.sort((a, b) => b.count - a.count)
}

function findBestAndWorst<T extends PointTypeStats>(
  stats: T[],
): { best: T | null; worst: T | null } {
  if (stats.length === 0) return { best: null, worst: null }

  const sorted = [...stats].sort((a, b) => b.winRate - a.winRate)
  return {
    best: sorted[0] ?? null,
    worst: sorted[sorted.length - 1] ?? null,
  }
}

const TIMING_SCORE_WEIGHT_ENTRY = 0.6
const TIMING_SCORE_WEIGHT_RETURN = 0.4
const OVERALL_WEIGHT_ENTRY = 0.35
const OVERALL_WEIGHT_EXIT = 0.35
const OVERALL_WEIGHT_PARAM = 0.3

function computeTimingScore(stats: PointTypeStats[]): number {
  if (stats.length === 0) return 50

  const totalTrades = stats.reduce((sum, s) => sum + s.count, 0)
  const weightedWinRate = stats.reduce((sum, s) => sum + s.winRate * s.count, 0) / totalTrades
  const avgReturn = stats.reduce((sum, s) => sum + s.avgReturn * s.count, 0) / totalTrades

  const winRateScore = Math.min(MAX_SCORE, weightedWinRate * 1.2)
  const returnScore = Math.min(MAX_SCORE, Math.max(0, 50 + avgReturn * 5))

  return Math.round(winRateScore * TIMING_SCORE_WEIGHT_ENTRY + returnScore * TIMING_SCORE_WEIGHT_RETURN)
}

function generateTimingSummary(
  direction: 'buy' | 'sell',
  stats: PointTypeStats[],
  best: PointTypeStats | null,
  worst: PointTypeStats | null,
): string {
  if (stats.length === 0) {
    return direction === 'buy' ? '暂无入场数据，无法评估入场时机' : '暂无出场数据，无法评估出场时机'
  }

  const parts: string[] = []
  const totalTrades = stats.reduce((sum, s) => sum + s.count, 0)
  const overallWinRate = stats.reduce((sum, s) => sum + s.winRate * s.count, 0) / totalTrades

  if (direction === 'buy') {
    parts.push(`共分析 ${totalTrades} 笔买入交易，整体胜率 ${overallWinRate.toFixed(1)}%`)
  } else {
    parts.push(`共分析 ${totalTrades} 笔卖出交易，整体胜率 ${overallWinRate.toFixed(1)}%`)
  }

  if (best) {
    parts.push(`最优${direction === 'buy' ? '入场' : '出场'}策略为「${best.name}」(胜率${best.winRate}%)`)
  }
  if (worst && worst !== best) {
    parts.push(`需改进「${worst.name}」(胜率${worst.winRate}%)`)
  }

  return parts.join('；')
}

function evaluateParameterEffectiveness(
  contexts: TradePairWithContext[],
): ParameterEffectiveness[] {
  const results: ParameterEffectiveness[] = []
  const bsConfig = getEffectiveBuySellPointConfig()
  const tradingConfig = getEffectiveTradingConfig().signalThresholds

  const profitable = contexts.filter((c) => c.profitPct > 0)
  const losing = contexts.filter((c) => c.profitPct < 0)

  const avgProfit = profitable.length > 0
    ? profitable.reduce((s, c) => s + c.profitPct, 0) / profitable.length
    : 0
  const avgLoss = losing.length > 0
    ? Math.abs(losing.reduce((s, c) => s + c.profitPct, 0) / losing.length)
    : 0

  // 1. 止损参数评估
  const stopLossTrades = contexts.filter((c) => c.profitPct <= -tradingConfig.fixedStopLossPct)
  const stopLossScore = stopLossTrades.length === 0
    ? 85
    : Math.max(30, 85 - stopLossTrades.length * 10)

  results.push({
    parameterName: '固定止损比例',
    currentValue: tradingConfig.fixedStopLossPct,
    suggestedValue: avgLoss > 0 && avgLoss > tradingConfig.fixedStopLossPct
      ? Math.ceil(avgLoss * 1.2)
      : tradingConfig.fixedStopLossPct,
    effectivenessScore: stopLossScore,
    assessment: stopLossTrades.length === 0
      ? '止损参数有效，未触发过度止损'
      : `触发了 ${stopLossTrades.length} 次止损，建议${avgLoss > tradingConfig.fixedStopLossPct ? '适当放宽' : '收紧'}止损比例`,
  })

  // 2. 止盈参数评估
  const earlyExit = profitable.filter((c) => c.profitPct < tradingConfig.profitTakingToMA20Pct && c.profitPct > 0)
  const profitScore = earlyExit.length === 0
    ? 80
    : Math.max(30, 80 - earlyExit.length * 8)

  results.push({
    parameterName: '止盈偏离阈值',
    currentValue: tradingConfig.profitTakingToMA20Pct,
    suggestedValue: avgProfit > 0 && avgProfit < tradingConfig.profitTakingToMA20Pct
      ? Math.floor(avgProfit * 0.8)
      : tradingConfig.profitTakingToMA20Pct,
    effectivenessScore: profitScore,
    assessment: earlyExit.length === 0
      ? '止盈参数合理，盈利交易充分获利'
      : `${earlyExit.length} 笔交易过早止盈，建议${avgProfit < tradingConfig.profitTakingToMA20Pct ? '降低' : '提高'}止盈阈值`,
  })

  // 3. 移动止损回撤参数评估
  const trailingStopTrades = contexts.filter((c) =>
    c.profitPct < 0 && Math.abs(c.profitPct) >= tradingConfig.trailingStopDrawdownPct,
  )
  const trailingScore = trailingStopTrades.length === 0
    ? 75
    : Math.max(25, 75 - trailingStopTrades.length * 12)

  results.push({
    parameterName: '移动止损回撤',
    currentValue: tradingConfig.trailingStopDrawdownPct,
    suggestedValue: trailingStopTrades.length > 2
      ? Math.ceil(tradingConfig.trailingStopDrawdownPct * 0.8)
      : tradingConfig.trailingStopDrawdownPct,
    effectivenessScore: trailingScore,
    assessment: trailingStopTrades.length === 0
      ? '移动止损参数未过度触发，回撤控制有效'
      : `${trailingStopTrades.length} 次回撤止损，建议${trailingStopTrades.length > 2 ? '收紧' : '保持'}回撤参数`,
  })

  // 4. 回踩买点参数评估
  const dipTrades = contexts.filter((c) => c.buyOrder !== null && c.profitPct < 0)
  const dipScore = dipTrades.length === 0
    ? 80
    : Math.max(35, 80 - dipTrades.length * 8)

  results.push({
    parameterName: '回踩MA20偏离度',
    currentValue: bsConfig.buyPoints.dipToMA20Pct,
    suggestedValue: dipTrades.length > 3
      ? Math.ceil(bsConfig.buyPoints.dipToMA20Pct * 1.2)
      : bsConfig.buyPoints.dipToMA20Pct,
    effectivenessScore: dipScore,
    assessment: dipTrades.length === 0
      ? '回踩买点参数合理，入场后无系统性亏损'
      : `${dipTrades.length} 笔回踩买入亏损，建议${dipTrades.length > 3 ? '提高' : '保持'}回踩偏离度要求`,
  })

  return results
}

function extractCoreSkills(
  contexts: TradePairWithContext[],
  entryStats: PointTypeStats[],
  exitStats: PointTypeStats[],
  paramEffectiveness: ParameterEffectiveness[],
): CoreSkillInsight[] {
  const skills: CoreSkillInsight[] = []

  // 1. 入场时机技能
  const bestEntry = entryStats.length > 0
    ? entryStats.reduce((best, s) => s.winRate > best.winRate ? s : best)
    : null
  if (bestEntry && bestEntry.winRate >= 60) {
    skills.push({
      skill: '入场时机选择',
      insight: `「${bestEntry.name}」策略表现优秀，胜率 ${bestEntry.winRate}%，平均收益 ${bestEntry.avgReturn}%`,
      action: `继续使用${bestEntry.name}作为主力入场策略，可适当增加仓位`,
      priority: 'high',
    })
  } else if (bestEntry && bestEntry.winRate < 40) {
    skills.push({
      skill: '入场时机选择',
      insight: `入场胜率偏低(${bestEntry.winRate}%)，入场时机需系统性改善`,
      action: '增加入场信号过滤条件，等待多信号共振再入场',
      priority: 'high',
    })
  }

  // 2. 出场时机技能
  const bestExit = exitStats.length > 0
    ? exitStats.reduce((best, s) => s.winRate > best.winRate ? s : best)
    : null
  if (bestExit && bestExit.winRate >= 60) {
    skills.push({
      skill: '出场时机把握',
      insight: `「${bestExit.name}」出场策略有效，保护了 ${bestExit.winRate}% 的利润`,
      action: '保持当前出场策略，重点关注止盈止损执行纪律',
      priority: 'medium',
    })
  }

  // 3. 止损执行技能
  const stopLossParam = paramEffectiveness.find((p) => p.parameterName === '固定止损比例')
  if (stopLossParam && stopLossParam.effectivenessScore < 60) {
    skills.push({
      skill: '止损纪律执行',
      insight: `止损参数有效性评分 ${stopLossParam.effectivenessScore} 分，存在过度止损或止损过晚问题`,
      action: `建议将止损比例从 ${stopLossParam.currentValue}% 调整为 ${stopLossParam.suggestedValue}%`,
      priority: 'high',
    })
  }

  // 4. 持仓时间管理
  const avgHoldDays = contexts.length > 0
    ? contexts.reduce((sum, c) => sum + c.holdDays, 0) / contexts.length
    : 0
  const profitable = contexts.filter((c) => c.profitPct > 0)
  const profitableAvgHold = profitable.length > 0
    ? profitable.reduce((sum, c) => sum + c.holdDays, 0) / profitable.length
    : 0
  const losing = contexts.filter((c) => c.profitPct < 0)
  const losingAvgHold = losing.length > 0
    ? losing.reduce((sum, c) => sum + c.holdDays, 0) / losing.length
    : 0

  if (avgHoldDays > 0) {
    if (losingAvgHold > profitableAvgHold * 1.5) {
      skills.push({
        skill: '持仓时间管理',
        insight: `亏损交易平均持有 ${losingAvgHold.toFixed(0)} 天，盈利交易仅 ${profitableAvgHold.toFixed(0)} 天，存在"截断利润让亏损奔跑"问题`,
        action: '设定最大持仓时间止损，亏损超 5 天强制减仓',
        priority: 'high',
      })
    } else if (profitableAvgHold > losingAvgHold) {
      skills.push({
        skill: '持仓时间管理',
        insight: `盈利交易平均持有 ${profitableAvgHold.toFixed(0)} 天，长于亏损交易的 ${losingAvgHold.toFixed(0)} 天，持仓时间管理良好`,
        action: '继续保持让利润奔跑的持仓策略',
        priority: 'low',
      })
    }
  }

  // 5. 盈亏比分析
  const avgProfit = profitable.length > 0
    ? profitable.reduce((s, c) => s + c.profitPct, 0) / profitable.length
    : 0
  const avgLoss = losing.length > 0
    ? Math.abs(losing.reduce((s, c) => s + c.profitPct, 0) / losing.length)
    : 0
  if (avgLoss > 0) {
    const ratio = avgProfit / avgLoss
    if (ratio < 1.5) {
      skills.push({
        skill: '盈亏比优化',
        insight: `当前盈亏比 ${ratio.toFixed(2)}，低于 1.5 的健康标准（平均盈利 ${avgProfit.toFixed(1)}% vs 平均亏损 ${avgLoss.toFixed(1)}%）`,
        action: '优化止盈策略提高平均盈利，或收紧止损减少平均亏损',
        priority: 'high',
      })
    } else {
      skills.push({
        skill: '盈亏比优化',
        insight: `盈亏比 ${ratio.toFixed(2)} 表现良好，交易系统具有正期望值`,
        action: '维持当前止盈止损参数，可适当增加交易频率',
        priority: 'low',
      })
    }
  }

  // 6. 参数调优建议
  const lowScoreParams = paramEffectiveness.filter((p) => p.effectivenessScore < 60)
  for (const param of lowScoreParams) {
    if (param.currentValue !== param.suggestedValue) {
      skills.push({
        skill: `${param.parameterName}调优`,
        insight: param.assessment,
        action: `参数从 ${param.currentValue} 调整为 ${param.suggestedValue}，预计可提升有效性`,
        priority: param.effectivenessScore < 40 ? 'high' : 'medium',
      })
    }
  }

  return skills.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

function computeOverallScore(
  entryScore: number,
  exitScore: number,
  paramEffectiveness: ParameterEffectiveness[],
): number {
  const avgParamScore = paramEffectiveness.length > 0
    ? paramEffectiveness.reduce((sum, p) => sum + p.effectivenessScore, 0) / paramEffectiveness.length
    : 70

  return Math.round(entryScore * OVERALL_WEIGHT_ENTRY + exitScore * OVERALL_WEIGHT_EXIT + avgParamScore * OVERALL_WEIGHT_PARAM)
}

function generateOverallSummary(
  overallScore: number,
  entryAnalysis: EntryTimingAnalysis,
  exitAnalysis: ExitTimingAnalysis,
  coreSkills: CoreSkillInsight[],
): string {
  const parts: string[] = []

  if (overallScore >= 80) {
    parts.push('买卖点系统整体表现优秀')
  } else if (overallScore >= 60) {
    parts.push('买卖点系统整体表现良好，仍有优化空间')
  } else {
    parts.push('买卖点系统亟需系统性优化')
  }

  parts.push(`入场时机评分 ${entryAnalysis.timingScore}，出场时机评分 ${exitAnalysis.timingScore}`)

  const highPrioritySkills = coreSkills.filter((s) => s.priority === 'high')
  if (highPrioritySkills.length > 0) {
    parts.push(`发现 ${highPrioritySkills.length} 个高优先级改进项：${highPrioritySkills.map((s) => s.skill).join('、')}`)
  }

  return parts.join('；')
}

/**
 * 分析买卖点有效性，生成完整复盘报告
 */
export function analyzeBuySellPoints(orders: Order[]): BuySellPointReview {
  logger.info('[BuySellPointAnalyzer] 开始买卖点分析', { orderCount: orders.length })

  const pairs = buildTradePairs(orders)
  const contexts = findOrdersForPairs(orders, pairs)

  const buyStats = computePointTypeStats(contexts, 'buy')
  const sellStats = computePointTypeStats(contexts, 'sell')

  const { best: bestBuy, worst: worstBuy } = findBestAndWorst(buyStats)
  const { best: bestSell, worst: worstSell } = findBestAndWorst(sellStats)

  const entryScore = computeTimingScore(buyStats)
  const exitScore = computeTimingScore(sellStats)

  const entryAnalysis: EntryTimingAnalysis = {
    buyPointStats: buyStats,
    bestBuyPointType: bestBuy ? (bestBuy.type as BuyPointType) : null,
    worstBuyPointType: worstBuy ? (worstBuy.type as BuyPointType) : null,
    timingScore: entryScore,
    summary: generateTimingSummary('buy', buyStats, bestBuy, worstBuy),
  }

  const exitAnalysis: ExitTimingAnalysis = {
    sellPointStats: sellStats,
    bestSellPointType: bestSell ? (bestSell.type as SellPointType) : null,
    worstSellPointType: worstSell ? (worstSell.type as SellPointType) : null,
    timingScore: exitScore,
    summary: generateTimingSummary('sell', sellStats, bestSell, worstSell),
  }

  const paramEffectiveness = evaluateParameterEffectiveness(contexts)
  const coreSkills = extractCoreSkills(contexts, buyStats, sellStats, paramEffectiveness)
  const overallScore = computeOverallScore(entryScore, exitScore, paramEffectiveness)

  const review: BuySellPointReview = {
    analyzedAt: Date.now(),
    entryTiming: entryAnalysis,
    exitTiming: exitAnalysis,
    parameterEffectiveness: paramEffectiveness,
    coreSkills,
    overallScore,
    summary: generateOverallSummary(overallScore, entryAnalysis, exitAnalysis, coreSkills),
  }

  logger.info('[BuySellPointAnalyzer] 买卖点分析完成', {
    overallScore,
    buyPointTypes: buyStats.length,
    sellPointTypes: sellStats.length,
    coreSkills: coreSkills.length,
  })

  return review
}
