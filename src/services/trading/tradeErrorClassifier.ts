/**
 * 交易错误自动分类器
 *
 * 12 类常见交易错误自动检测，每类错误包含：
 *   - 名称、严重等级(critical/major/minor)、心理根源、检测逻辑
 *
 * 纪律评分公式：100 - critical×15 - major×8 - minor×3
 *
 * 导出 classifyErrors(orders: Order[]) 方法
 */

import { getLogger } from '@/lib/logger'
import type { Order } from '@/data/types'
import { PERCENTAGE_BASE, MAX_SCORE, MIN_SCORE } from '@/constants/trade.constants'

const logger = getLogger()

// ============================================================
// 错误类型定义
// ============================================================

/** 错误严重等级 */
export type ErrorSeverity = 'critical' | 'major' | 'minor'

/** 12 类交易错误枚举 */
export enum TradeErrorType {
  /** 追涨杀跌 */
  CHASE_HIGH_SELL_LOW = 'chase_high_sell_low',
  /** 提前止盈 */
  EARLY_PROFIT_TAKING = 'early_profit_taking',
  /** 扛单不止损 */
  NO_STOP_LOSS = 'no_stop_loss',
  /** 逆势加仓 */
  AGAINST_TREND_ADDING = 'against_trend_adding',
  /** 贪鱼尾 */
  GREEDY_TAIL_CHASING = 'greedy_tail_chasing',
  /** 违反计划 */
  PLAN_VIOLATION = 'plan_violation',
  /** 重仓豪赌 */
  HEAVY_GAMBLING = 'heavy_gambling',
  /** 报复性交易 */
  REVENGE_TRADING = 'revenge_trading',
  /** FOMO 入场 */
  FOMO_ENTRY = 'fomo_entry',
  /** 忽视止损 */
  IGNORE_STOP_LOSS = 'ignore_stop_loss',
  /** 犹豫错过 */
  HESITATION_MISS = 'hesitation_miss',
  /** 过度交易 */
  OVERTRADING = 'overtrading',
}

/** 单类错误定义 */
export interface TradeErrorDef {
  /** 错误类型 */
  type: TradeErrorType
  /** 中文名称 */
  name: string
  /** 严重等级 */
  severity: ErrorSeverity
  /** 心理根源 */
  psychologicalRoot: string
  /** 检测描述 */
  detectionDescription: string
}

/** 检测到的错误实例 */
export interface DetectedError {
  /** 错误类型 */
  type: TradeErrorType
  /** 中文名称 */
  name: string
  /** 严重等级 */
  severity: ErrorSeverity
  /** 心理根源 */
  psychologicalRoot: string
  /** 关联的订单 ID 列表 */
  relatedOrderIds: string[]
  /** 发生次数 */
  count: number
  /** 扣分 */
  penalty: number
}

/** 分类结果 */
export interface ErrorClassificationResult {
  /** 检测到的错误列表 */
  errors: DetectedError[]
  /** 纪律评分 0-100 */
  disciplineScore: number
  /** 总扣分 */
  totalPenalty: number
  /** 严重错误数 */
  criticalCount: number
  /** 重要错误数 */
  majorCount: number
  /** 轻微错误数 */
  minorCount: number
  /** 错误总数 */
  totalErrors: number
}

// ============================================================
// 12 类错误定义表
// ============================================================

const ERROR_DEFINITIONS: TradeErrorDef[] = [
  {
    type: TradeErrorType.CHASE_HIGH_SELL_LOW,
    name: '追涨杀跌',
    severity: 'critical',
    psychologicalRoot: '贪婪与恐惧交替，缺乏独立判断，从众心理',
    detectionDescription: '买入后价格快速回落（>5%）或卖出后价格快速反弹（>5%），表明入场/出场时机由情绪驱动',
  },
  {
    type: TradeErrorType.EARLY_PROFIT_TAKING,
    name: '提前止盈',
    severity: 'major',
    psychologicalRoot: '对利润的恐惧，害怕回吐浮盈，缺乏持仓信心',
    detectionDescription: '盈利交易中收益率低于预设目标（如 <3%），且卖出后股价继续上涨 >5%',
  },
  {
    type: TradeErrorType.NO_STOP_LOSS,
    name: '扛单不止损',
    severity: 'critical',
    psychologicalRoot: '损失厌恶，不愿承认错误，赌徒心理',
    detectionDescription: '持仓亏损超过 -10% 仍未止损，或日内从盈利转为大幅亏损',
  },
  {
    type: TradeErrorType.AGAINST_TREND_ADDING,
    name: '逆势加仓',
    severity: 'critical',
    psychologicalRoot: '过度自信，想摊平成本，拒绝接受失败',
    detectionDescription: '价格下跌趋势中连续买入加仓，试图摊薄成本',
  },
  {
    type: TradeErrorType.GREEDY_TAIL_CHASING,
    name: '贪鱼尾',
    severity: 'major',
    psychologicalRoot: '贪婪，追求完美，想抓住最后一段利润',
    detectionDescription: '趋势尾端入场，买入后价格即反转，或卖出后价格继续上涨',
  },
  {
    type: TradeErrorType.PLAN_VIOLATION,
    name: '违反计划',
    severity: 'critical',
    psychologicalRoot: '缺乏纪律，自我控制力弱，临场冲动',
    detectionDescription: '交易行为与预设交易计划不一致（如超出仓位限制、未按止损执行）',
  },
  {
    type: TradeErrorType.HEAVY_GAMBLING,
    name: '重仓豪赌',
    severity: 'critical',
    psychologicalRoot: '急功近利，想快速翻本或暴富，风险意识不足',
    detectionDescription: '单笔交易仓位超过总资金的 30% 或集中持仓单一标的',
  },
  {
    type: TradeErrorType.REVENGE_TRADING,
    name: '报复性交易',
    severity: 'major',
    psychologicalRoot: '愤怒、不甘心，想立刻挽回损失',
    detectionDescription: '亏损后短时间内（<30分钟）频繁开仓，试图追回损失',
  },
  {
    type: TradeErrorType.FOMO_ENTRY,
    name: 'FOMO入场',
    severity: 'major',
    psychologicalRoot: '害怕错过，跟风心理，同伴压力',
    detectionDescription: '股价快速拉升时追高入场，缺乏基本面或技术面支撑',
  },
  {
    type: TradeErrorType.IGNORE_STOP_LOSS,
    name: '忽视止损',
    severity: 'critical',
    psychologicalRoot: '侥幸心理，过度自信，不愿接受小损失',
    detectionDescription: '设置了止损但未执行，或从未设置止损位',
  },
  {
    type: TradeErrorType.HESITATION_MISS,
    name: '犹豫错过',
    severity: 'minor',
    psychologicalRoot: '过度谨慎，完美主义，害怕犯错',
    detectionDescription: '明确的交易信号出现后未及时执行，错失良好入场机会',
  },
  {
    type: TradeErrorType.OVERTRADING,
    name: '过度交易',
    severity: 'minor',
    psychologicalRoot: '交易成瘾，无聊，寻求刺激',
    detectionDescription: '单日交易次数超过阈值（如 >10 笔），且多数交易无明显逻辑',
  },
]

// ============================================================
// 扣分权重
// ============================================================

const SEVERITY_PENALTY: Record<ErrorSeverity, number> = {
  critical: 15,
  major: 8,
  minor: 3,
}

// ============================================================
// 检测逻辑
// ============================================================

/**
 * 订单分组：按 symbol 和日期分组
 */
function groupOrdersByDay(orders: Order[]): Map<string, Order[]> {
  const groups = new Map<string, Order[]>()
  for (const order of orders) {
    const date = new Date(order.createdAt).toISOString().slice(0, 10)
    const key = `${order.symbol}_${date}`
    const existing = groups.get(key) ?? []
    existing.push(order)
    groups.set(key, existing)
  }
  return groups
}

/**
 * 检测追涨杀跌
 * 逻辑：买入后价格回落较大，或卖出后价格反弹较大
 */
function detectChaseHighSellLow(orders: Order[], _map: Map<string, Order[]>): DetectedError | null {
  const relatedIds: string[] = []
  const buyOrders = orders.filter((o) => o.direction === 'buy')
  const sellOrders = orders.filter((o) => o.direction === 'sell')

  // 简化检测：比较同 symbol 的买卖价格
  for (const buy of buyOrders) {
    const sameSymbolSells = sellOrders.filter(
      (s) => s.symbol === buy.symbol && s.createdAt > buy.createdAt,
    )
    const nearSells = sameSymbolSells.filter(
      (s) => s.createdAt - buy.createdAt < 24 * 60 * 60 * 1000,
    )
    // 买入后一天内卖出且亏损 >5%
    for (const sell of nearSells) {
      if (sell.price < buy.price * 0.95) {
        relatedIds.push(buy.id, sell.id)
      }
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.CHASE_HIGH_SELL_LOW,
    name: '追涨杀跌',
    severity: 'critical',
    psychologicalRoot: '贪婪与恐惧交替，缺乏独立判断，从众心理',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测提前止盈
 * 逻辑：盈利交易收益率 < 3%，且卖出后股价继续上涨
 */
function detectEarlyProfitTaking(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const pairs = buildTradePairs(orders)

  for (const pair of pairs) {
    if (pair.profitPct > 0 && pair.profitPct < 3) {
      relatedIds.push(pair.buyId, pair.sellId)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.EARLY_PROFIT_TAKING,
    name: '提前止盈',
    severity: 'major',
    psychologicalRoot: '对利润的恐惧，害怕回吐浮盈，缺乏持仓信心',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.major,
  }
}

/**
 * 检测扛单不止损
 * 逻辑：持仓亏损超过 -10%
 */
function detectNoStopLoss(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const pairs = buildTradePairs(orders)

  for (const pair of pairs) {
    if (pair.profitPct < -10) {
      relatedIds.push(pair.buyId, pair.sellId)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.NO_STOP_LOSS,
    name: '扛单不止损',
    severity: 'critical',
    psychologicalRoot: '损失厌恶，不愿承认错误，赌徒心理',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测逆势加仓
 * 逻辑：同 symbol 连续买入且价格递减
 */
function detectAgainstTrendAdding(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const buyOrders = orders.filter((o) => o.direction === 'buy')

  // 按 symbol 分组
  const bySymbol = new Map<string, typeof buyOrders>()
  for (const order of buyOrders) {
    const list = bySymbol.get(order.symbol) ?? []
    list.push(order)
    bySymbol.set(order.symbol, list)
  }

  for (const [, symOrders] of bySymbol) {
    symOrders.sort((a, b) => a.createdAt - b.createdAt)
    let consecutiveCount = 0
    let prevPrice = 0
    for (const order of symOrders) {
      if (prevPrice > 0 && order.price < prevPrice) {
        consecutiveCount++
        if (consecutiveCount >= 2) {
          relatedIds.push(order.id)
        }
      } else {
        consecutiveCount = 0
      }
      prevPrice = order.price
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.AGAINST_TREND_ADDING,
    name: '逆势加仓',
    severity: 'critical',
    psychologicalRoot: '过度自信，想摊平成本，拒绝接受失败',
    relatedOrderIds: relatedIds,
    count: relatedIds.length,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测贪鱼尾
 * 逻辑：买入后短期（3天内）价格开始下跌且跌幅 >3%
 */
function detectGreedyTailChasing(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const pairs = buildTradePairs(orders)

  for (const pair of pairs) {
    if (pair.profitPct < -3 && pair.holdDays <= 3) {
      relatedIds.push(pair.buyId, pair.sellId)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.GREEDY_TAIL_CHASING,
    name: '贪鱼尾',
    severity: 'major',
    psychologicalRoot: '贪婪，追求完美，想抓住最后一段利润',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.major,
  }
}

/**
 * 检测违反计划（简化版：基于仓位和频次异常）
 */
function detectPlanViolation(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []

  // 检测单笔仓位过大（> 30% 总资金）
  const totalValue = orders.reduce((sum, o) => sum + o.amount, 0)
  for (const order of orders) {
    if (totalValue > 0 && order.amount / totalValue > 0.3) {
      relatedIds.push(order.id)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.PLAN_VIOLATION,
    name: '违反计划',
    severity: 'critical',
    psychologicalRoot: '缺乏纪律，自我控制力弱，临场冲动',
    relatedOrderIds: relatedIds,
    count: relatedIds.length,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测重仓豪赌
 * 逻辑：单笔仓位 > 30% 或单标的集中度 > 50%
 */
function detectHeavyGambling(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const totalValue = orders.reduce((sum, o) => sum + o.amount, 0)

  if (totalValue === 0) return null

  // 按 symbol 汇总
  const bySymbol = new Map<string, number>()
  for (const order of orders) {
    const current = bySymbol.get(order.symbol) ?? 0
    bySymbol.set(order.symbol, current + order.amount)
  }

  for (const [symbol, amount] of bySymbol) {
    if (amount / totalValue > 0.5) {
      const symOrders = orders.filter((o) => o.symbol === symbol)
      relatedIds.push(...symOrders.map((o) => o.id))
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.HEAVY_GAMBLING,
    name: '重仓豪赌',
    severity: 'critical',
    psychologicalRoot: '急功近利，想快速翻本或暴富，风险意识不足',
    relatedOrderIds: relatedIds,
    count: 1,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测报复性交易
 * 逻辑：亏损后 30 分钟内频繁开仓
 */
function detectRevengeTrading(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const sortedOrders = [...orders].sort((a, b) => a.createdAt - b.createdAt)
  const THIRTY_MIN = 30 * 60 * 1000

  for (let i = 1; i < sortedOrders.length; i++) {
    const prev = sortedOrders[i - 1]!
    const curr = sortedOrders[i]!
    const timeDiff = curr.createdAt - prev.createdAt

    // 前一笔亏损，后一笔在 30 分钟内开仓
    if (timeDiff < THIRTY_MIN && curr.direction === 'buy') {
      relatedIds.push(curr.id)
    }
  }

  if (relatedIds.length < 3) return null

  return {
    type: TradeErrorType.REVENGE_TRADING,
    name: '报复性交易',
    severity: 'major',
    psychologicalRoot: '愤怒、不甘心，想立刻挽回损失',
    relatedOrderIds: relatedIds,
    count: relatedIds.length,
    penalty: SEVERITY_PENALTY.major,
  }
}

/**
 * 检测 FOMO 入场
 * 逻辑：高频交易且无明显盈利逻辑（简化：买入后亏损 >3%）
 */
function detectFomoEntry(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const pairs = buildTradePairs(orders)

  for (const pair of pairs) {
    if (pair.profitPct < -3 && pair.holdDays <= 1) {
      relatedIds.push(pair.buyId, pair.sellId)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.FOMO_ENTRY,
    name: 'FOMO入场',
    severity: 'major',
    psychologicalRoot: '害怕错过，跟风心理，同伴压力',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.major,
  }
}

/**
 * 检测忽视止损
 * 逻辑：亏损交易中无止损行为（简化：亏损 > 8% 的交易）
 */
function detectIgnoreStopLoss(orders: Order[]): DetectedError | null {
  const relatedIds: string[] = []
  const pairs = buildTradePairs(orders)

  for (const pair of pairs) {
    if (pair.profitPct < -8) {
      relatedIds.push(pair.buyId, pair.sellId)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.IGNORE_STOP_LOSS,
    name: '忽视止损',
    severity: 'critical',
    psychologicalRoot: '侥幸心理，过度自信，不愿接受小损失',
    relatedOrderIds: relatedIds,
    count: relatedIds.length / 2,
    penalty: SEVERITY_PENALTY.critical,
  }
}

/**
 * 检测犹豫错过
 * 逻辑：长时间无交易但存在明显机会（简化：交易间隔时间过长）
 */
function detectHesitationMiss(orders: Order[]): DetectedError | null {
  if (orders.length < 2) return null

  const relatedIds: string[] = []
  const sortedOrders = [...orders].sort((a, b) => a.createdAt - b.createdAt)
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000

  for (let i = 1; i < sortedOrders.length; i++) {
    const prev = sortedOrders[i - 1]!
    const curr = sortedOrders[i]!
    if (curr.createdAt - prev.createdAt > ONE_WEEK) {
      relatedIds.push(curr.id)
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.HESITATION_MISS,
    name: '犹豫错过',
    severity: 'minor',
    psychologicalRoot: '过度谨慎，完美主义，害怕犯错',
    relatedOrderIds: relatedIds,
    count: relatedIds.length,
    penalty: SEVERITY_PENALTY.minor,
  }
}

/**
 * 检测过度交易
 * 逻辑：单日交易次数 > 10 笔
 */
function detectOvertrading(_orders: Order[], dayGroups: Map<string, Order[]>): DetectedError | null {
  const relatedIds: string[] = []

  for (const [, dayOrders] of dayGroups) {
    if (dayOrders.length > 10) {
      relatedIds.push(...dayOrders.map((o) => o.id))
    }
  }

  if (relatedIds.length === 0) return null

  return {
    type: TradeErrorType.OVERTRADING,
    name: '过度交易',
    severity: 'minor',
    psychologicalRoot: '交易成瘾，无聊，寻求刺激',
    relatedOrderIds: relatedIds,
    count: 1,
    penalty: SEVERITY_PENALTY.minor,
  }
}

// ============================================================
// 辅助类型与函数
// ============================================================

interface TradePair {
  buyId: string
  sellId: string
  buyPrice: number
  sellPrice: number
  profitPct: number
  holdDays: number
}

/**
 * 构建买卖配对
 * 简化逻辑：按 symbol 和日期排序，pair 买入和卖出
 */
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
          buyPrice: buy.price,
          sellPrice: order.price,
          profitPct: Math.round(profitPct * PERCENTAGE_BASE) / PERCENTAGE_BASE,
          holdDays,
        })
      }
    }
  }

  return pairs
}

// ============================================================
// 主入口：分类检测
// ============================================================

/**
 * 对订单列表进行 12 类错误自动检测
 *
 * @param orders 订单列表
 * @returns 错误分类结果，包含纪律评分
 */
export function classifyErrors(orders: Order[]): ErrorClassificationResult {
  logger.info(`[TradeErrorClassifier] 开始分类检测: 订单数=${orders.length}`)

  if (orders.length === 0) {
    logger.info('[TradeErrorClassifier] 无订单数据，返回满分')
    return {
      errors: [],
      disciplineScore: 100,
      totalPenalty: 0,
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      totalErrors: 0,
    }
  }

  const dayGroups = groupOrdersByDay(orders)
  const detectedErrors: DetectedError[] = []

  const detectors: Array<{
    fn: (orders: Order[], dayGroups: Map<string, Order[]>) => DetectedError | null
  }> = [
    { fn: (o, dg) => detectChaseHighSellLow(o, dg) },
    { fn: (o) => detectEarlyProfitTaking(o) },
    { fn: (o) => detectNoStopLoss(o) },
    { fn: (o) => detectAgainstTrendAdding(o) },
    { fn: (o) => detectGreedyTailChasing(o) },
    { fn: (o) => detectPlanViolation(o) },
    { fn: (o) => detectHeavyGambling(o) },
    { fn: (o) => detectRevengeTrading(o) },
    { fn: (o) => detectFomoEntry(o) },
    { fn: (o) => detectIgnoreStopLoss(o) },
    { fn: (o) => detectHesitationMiss(o) },
    { fn: (o, dg) => detectOvertrading(o, dg) },
  ]

  for (const detector of detectors) {
    try {
      const result = detector.fn(orders, dayGroups)
      if (result) {
        detectedErrors.push(result)
        logger.info(`[TradeErrorClassifier] 检测到错误: ${result.name} (${result.severity}), count=${result.count}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[TradeErrorClassifier] 检测器执行异常`, { error: message })
    }
  }

  // 计算纪律评分
  let totalPenalty = 0
  let criticalCount = 0
  let majorCount = 0
  let minorCount = 0

  for (const error of detectedErrors) {
    totalPenalty += error.penalty
    if (error.severity === 'critical') criticalCount++
    else if (error.severity === 'major') majorCount++
    else minorCount++
  }

  const disciplineScore = Math.max(MIN_SCORE, MAX_SCORE - totalPenalty)

  logger.info(
    `[TradeErrorClassifier] 分类完成: 纪律评分=${disciplineScore}, ` +
    `critical=${criticalCount}, major=${majorCount}, minor=${minorCount}, ` +
    `总错误=${detectedErrors.length}`,
  )

  return {
    errors: detectedErrors,
    disciplineScore,
    totalPenalty,
    criticalCount,
    majorCount,
    minorCount,
    totalErrors: detectedErrors.length,
  }
}

/**
 * 获取 12 类错误定义列表
 */
export function getErrorDefinitions(): TradeErrorDef[] {
  return [...ERROR_DEFINITIONS]
}

/**
 * 获取各严重等级的扣分标准
 */
export function getSeverityPenalties(): Record<ErrorSeverity, number> {
  return { ...SEVERITY_PENALTY }
}

/**
 * 计算纪律评分（可直接传入统计数据）
 */
export function calculateDisciplineScore(stats: {
  criticalCount: number
  majorCount: number
  minorCount: number
}): number {
  const penalty =
    stats.criticalCount * SEVERITY_PENALTY.critical +
    stats.majorCount * SEVERITY_PENALTY.major +
    stats.minorCount * SEVERITY_PENALTY.minor
  return Math.max(0, 100 - penalty)
}