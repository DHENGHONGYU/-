import { getDefaultTradingConfig } from '@/config/tradingConfig'
import type { SignalDirection } from '@/config/tradingConfig'
import { dataLayer } from '@/data/dataLayer'


export interface OrderRiskInput {
  symbol: string
  direction: SignalDirection
  quantity: number
  price: number
  portfolioValue: number
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
 * 风控检查
 *
 * 阻塞项：
 *   - 价格或数量非法
 *   - 同标的存在未完成买入且在冷却期内
 *   - 超出当日最大交易次数
 *   - 买入后超出单笔/总仓位上限
 *   - 行情数据过期
 * 警告项：
 *   - 单日交易次数接近上限
 *   - 仓位接近上限
 */
export async function checkOrderRisk(input: OrderRiskInput): Promise<RiskCheckResult> {
  const config = getDefaultTradingConfig()
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
  const quotes = await dataLayer.dailyQuotes.get(normalized)
  if (!quotes || !quotes.updatedAt) {
    blocks.push('无有效行情数据')
  } else if (!isWithinHours(quotes.updatedAt, risk.dataFreshnessHours)) {
    blocks.push(`行情数据超过 ${risk.dataFreshnessHours} 小时未更新`)
  }

  // 2. 同标的冷却期
  const orders = await dataLayer.orders.list()
  const symbolOrders = orders
    .filter((o) => o.symbol === normalized)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  const latestOrder = symbolOrders[0]
  if (latestOrder && isWithinHours(latestOrder.createdAt ?? 0, risk.sameSymbolCooldownHours)) {
    blocks.push(
      `${normalized} 在 ${risk.sameSymbolCooldownHours} 小时冷却期内，上次交易时间 ${new Date(latestOrder.createdAt ?? 0).toLocaleString()}`,
    )
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

  return { ok: blocks.length === 0, warnings, blocks }
}
