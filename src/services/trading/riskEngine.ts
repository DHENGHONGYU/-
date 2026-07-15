import { getEffectiveTradingConfig } from '@/config/tradingConfig'
import type { SignalDirection } from '@/config/tradingConfig'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import type { Order } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()


export interface OrderRiskInput {
  symbol: string
  direction: SignalDirection
  quantity: number
  price: number
  portfolioValue: number
  /** 调用来源，用于差异化风控策略 */
  source?: 'mcp' | 'manual' | 'strategy'
}

export interface RiskCheckResult {
  ok: boolean
  warnings: string[]
  blocks: string[]
}

function isWithinHours(timestamp: number, hours: number): boolean {
  return Date.now() - timestamp < hours * 60 * 60 * 1000
}

function startOfDayTimestamp(timestamp: number): number {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * 纯函数版本风控检查。
 *
 * 不直接访问 dataBridge，由调用方提供订单与行情快照，便于 SKILL、测试与离线场景复用。
 *
 * @param input 订单风险输入
 * @param orders 当前订单列表（可选，默认空数组）
 * @param quotes 行情快照（可选，含 updatedAt）
 * @returns RiskCheckResult
 */
export function checkOrderRiskPure(
  input: OrderRiskInput,
  orders: Order[] = [],
  quotes?: { updatedAt: number },
): RiskCheckResult {
  const config = getEffectiveTradingConfig()
  const risk = config.risk
  const warnings: string[] = []
  const blocks: string[] = []

  if (input.price <= 0 || input.quantity <= 0 || !Number.isFinite(input.price * input.quantity)) {
    blocks.push('价格或数量非法')
    return { ok: false, warnings, blocks }
  }

  if (input.portfolioValue <= 0) {
    blocks.push('组合净值非法')
    return { ok: false, warnings, blocks }
  }

  const normalized = input.symbol.trim().toUpperCase()

  // 1. 行情数据新鲜度
  if (!quotes?.updatedAt) {
    // P2 健壮化：行情「数据未到达」为可观测的降级警告（非硬阻断），
    // 避免静默全拒；「数据过期」仍为硬阻断（见 else 分支）。
    warnings.push('无有效行情数据（数据未到达，已降级放行，需关注数据源）')
  } else if (!isWithinHours(quotes.updatedAt, risk.dataFreshnessHours)) {
    blocks.push(`行情数据超过 ${risk.dataFreshnessHours} 小时未更新`)
  }

  // 2. 同标的冷却期
  // 检测 createdAt 缺失的订单
  const missingCreatedAtOrders = orders.filter((o) => o.symbol === normalized && o.createdAt == null)
  if (missingCreatedAtOrders.length > 0) {
    logger.warn('[RiskEngine] 字段缺失，使用默认值', {
      field: 'createdAt',
      context: `symbol=${normalized}, missingCount=${missingCreatedAtOrders.length}`,
    })
  }
  const symbolOrders = orders
    .filter((o) => o.symbol === normalized)
    .sort((a, b) => {
      const ta = a.createdAt ?? 0
      const tb = b.createdAt ?? 0
      return tb - ta
    })
  const latestOrder = symbolOrders[0]
  if (latestOrder) {
    // 保守策略：createdAt 缺失时视为在冷却期内，阻断交易
    const orderTime = latestOrder.createdAt ?? Date.now()
    if (isWithinHours(orderTime, risk.sameSymbolCooldownHours)) {
      blocks.push(
        `${normalized} 在 ${risk.sameSymbolCooldownHours} 小时冷却期内，上次交易时间 ${new Date(orderTime).toLocaleString()}`,
      )
    }
  }

  // 3. 当日交易次数
  const todayTs = startOfDayTimestamp(Date.now())
  const todayTrades = orders.filter((o) => (o.createdAt ?? 0) >= todayTs).length
  if (todayTrades >= risk.maxTradesPerDay) {
    blocks.push(`今日交易次数已达上限 ${risk.maxTradesPerDay}`)
  } else if (todayTrades >= risk.maxTradesPerDay - 1) {
    warnings.push(`今日交易次数接近上限 ${risk.maxTradesPerDay}`)
  }

  // 4. 仓位上限（仅买入）
  if (input.direction === 'buy') {
    const holdingShares = orders
      .filter((o) => o.symbol === normalized)
      .reduce((sum, o) => sum + (o.direction === 'buy' ? o.quantity : -o.quantity), 0)
    const holdingValue = holdingShares * input.price

    const totalShares = orders.reduce(
      (sum, o) => sum + (o.direction === 'buy' ? o.quantity : -o.quantity),
      0,
    )
    const totalValue = totalShares * input.price

    const afterSingleValue = holdingValue + input.quantity * input.price
    const afterTotalValue = totalValue + input.quantity * input.price
    const singleLimit = (risk.maxSinglePositionPct / 100) * input.portfolioValue
    const totalLimit = (risk.maxTotalPositionPct / 100) * input.portfolioValue

    if (afterSingleValue > singleLimit) {
      blocks.push(
        `买入后 ${normalized} 仓位 ${afterSingleValue.toFixed(0)} 超出单笔上限 ${singleLimit.toFixed(0)}`,
      )
    } else if (afterSingleValue > singleLimit * 0.9) {
      warnings.push(`${normalized} 仓位接近单笔上限`)
    }

    if (afterTotalValue > totalLimit) {
      blocks.push(
        `买入后总仓位 ${afterTotalValue.toFixed(0)} 超出总仓位上限 ${totalLimit.toFixed(0)}`,
      )
    } else if (afterTotalValue > totalLimit * 0.9) {
      warnings.push('总仓位接近上限')
    }
  }

  // 5. 卖出必须有持仓
  if (input.direction === 'sell') {
    const holdingShares = orders
      .filter((o) => o.symbol === normalized)
      .reduce((sum, o) => sum + (o.direction === 'buy' ? o.quantity : -o.quantity), 0)
    if (holdingShares < input.quantity) {
      blocks.push(`卖出数量 ${input.quantity} 超过当前持仓 ${holdingShares}`)
    }
  }

  // MCP 来源：增加人工确认标志
  if (input.source === 'mcp') {
    logger.info('[RiskEngine] MCP 来源调用，标记需人工复核', {
      symbol: input.symbol,
      direction: input.direction,
      quantity: input.quantity,
    })
    warnings.push('MCP 自动建议，建议人工复核')
  }

  return { ok: blocks.length === 0, warnings, blocks }
}

/**
 * 风控检查
 *
 * 阻塞项：
 *   - 价格或数量非法
 *   - 同标的存在未完成买入且在冷却期内
 *   - 超出当日最大交易次数
 *   - 买入后超出单笔/总仓位上限
 *   - 行情数据过期
 * 警告项：
 *   - 无有效行情数据（数据未到达，已降级放行，非硬阻断）
 *   - 单日交易次数接近上限
 *   - 仓位接近上限
/**
 * checkOrderRisk
 * @param input
 * @returns Promise<RiskCheckResult>
 */
export async function checkOrderRisk(input: OrderRiskInput): Promise<RiskCheckResult> {
  const normalized = input.symbol.trim().toUpperCase()

  // 1. 行情数据新鲜度
  const quotesResult = await dataBridge.query<{ updatedAt: number }>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.dailyQuotes,
    key: normalized,
    source: MODULE_ID.trading,
  })
  const quotes = quotesResult.success && quotesResult.data ? quotesResult.data : undefined

  // 2. 同标的冷却期 / 当日交易次数 / 仓位上限 / 卖出持仓充足性
  const ordersResult = await dataBridge.query<Order[]>({
    action: ENVELOPE_ACTION.queryList,
    store: STORE_NAME.orders,
    source: MODULE_ID.trading,
  })
  const orders = ordersResult.success && ordersResult.data ? ordersResult.data : []

  return checkOrderRiskPure(input, orders, quotes)
}
