import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import {
  MODULE_ID,
  ENVELOPE_TARGET,
  ENVELOPE_ACTION,
  ORDER_DIRECTION,
  ORDER_STATUS,
  RESEARCH_STATUS,
  STORE_NAME,
} from '@/config/dbConfig'
import { getEffectiveTradingConfig } from '@/config/tradingConfig'
import type { DataLayerResult, Order, Stock } from '@/data/types'
import {
  generateSignalsForSymbol,
  pickStrongestSignal,
  type TradingSignal,
} from './signalGenerator'
import { calculatePosition, type PositionSizingResult } from './positionSizer'
import { checkOrderRisk, type RiskCheckResult } from './riskEngine'

import { nanoid } from 'nanoid'
export interface CreateOrderInput {
  symbol: string
  direction: 'buy' | 'sell'
  quantity: number
  price: number
  accountType?: 'paper' | 'real'
}

const DEFAULT_BUY_QUANTITY = 100

function generateId(): string {
  return nanoid(16)
}

function buildOrder(input: CreateOrderInput): Order {
  const quantity = Math.max(1, Math.floor(input.quantity))
  const price = Math.max(0, input.price)
  const amount = price * quantity

  return {
    id: generateId(),
    symbol: input.symbol,
    direction: input.direction === 'buy' ? ORDER_DIRECTION.buy : ORDER_DIRECTION.sell,
    quantity,
    price,
    amount,
    status: ORDER_STATUS.filled,
    accountType: input.accountType ?? 'paper',
    createdAt: Date.now(),
  }
}

export interface TradeAdvice {
  signal: TradingSignal
  sizing: PositionSizingResult
  risk: RiskCheckResult
}

async function computePositionForSignal(
  signal: TradingSignal,
  stock: Stock,
): Promise<DataLayerResult<PositionSizingResult>> {
  if (stock.price === undefined || stock.price <= 0) {
    return { success: false, error: '股票价格无效' }
  }

  const ordersResult = await dataBridge.query<Order[]>({
    action: ENVELOPE_ACTION.queryList,
    store: STORE_NAME.orders,
    source: MODULE_ID.trading,
  })
  if (!ordersResult.success || !ordersResult.data) {
    return { success: false, error: ordersResult.error ?? '获取订单失败' }
  }
  const orders = ordersResult.data
  const price = stock.price
  const portfolioValue = getEffectiveTradingConfig().risk.portfolioValue

  const holdingShares = orders
    .filter((o) => o.symbol === signal.symbol)
    .reduce((sum, o) => sum + (o.direction === ORDER_DIRECTION.buy ? o.quantity : -o.quantity), 0)
  const holdingValue = holdingShares * price

  const totalValue = orders.reduce(
    (sum, o) => sum + (o.direction === ORDER_DIRECTION.buy ? o.quantity : -o.quantity) * o.price,
    0,
  )

  return {
    success: true,
    data: calculatePosition({
      direction: signal.direction,
      price,
      portfolioValue,
      currentHoldingShares: holdingShares,
      currentHoldingValue: holdingValue,
      currentTotalPositionValue: totalValue,
    }),
  }
}

/**
 * 扫描观察池全部股票的交易信号
 */
export async function scanWatchingSignals(): Promise<TradingSignal[]> {
  const result = await getWatchlistStocks()
  if (!result.success || !result.data) return []

  const allSignals: TradingSignal[] = []
  for (const stock of result.data) {
    const signals = await generateSignalsForSymbol(stock.symbol)
    for (const signal of signals) {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.tradinghub,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.insertSignal,
          traceId: `signal-${nanoid(8)}-${signal.symbol}`,
        },
        signal,
      )
      await dataBridge.forward(envelope)
    }
    allSignals.push(...signals)
  }
  return allSignals
}

/**
 * 为单只股票生成交易建议：信号 + 仓位 + 风控
 */
export async function adviseForStock(stock: Stock): Promise<DataLayerResult<TradeAdvice>> {
  if (!stock.symbol) {
    return { success: false, error: '股票代码不能为空' }
  }

  const signals = await generateSignalsForSymbol(stock.symbol)
  const signal = pickStrongestSignal(signals)
  if (!signal) {
    return { success: false, error: '未生成有效信号' }
  }

  // watch / hold 为非交易信号，直接返回中性建议，避免无意义的风控/仓位计算
  if (signal.direction === 'watch' || signal.direction === 'hold') {
    return {
      success: true,
      data: {
        signal,
        sizing: {
          action: 'hold',
          targetShares: 0,
          targetValue: 0,
          positionPct: 0,
          kellyPct: 0,
          roundedDown: false,
          cappedBy: 'none',
        },
        risk: { ok: true, warnings: [], blocks: [] },
      },
    }
  }

  const sizingResult = await computePositionForSignal(signal, stock)
  if (!sizingResult.success || !sizingResult.data) {
    return { success: false, error: sizingResult.error ?? '仓位计算失败' }
  }
  const sizing = sizingResult.data
  const price = stock.price
  if (price === undefined || price <= 0) {
    return { success: false, error: '股票价格无效' }
  }
  const risk = await checkOrderRisk({
    symbol: stock.symbol,
    direction: signal.direction,
    quantity: sizing.targetShares,
    price,
    portfolioValue: getEffectiveTradingConfig().risk.portfolioValue,
  })

  return { success: true, data: { signal, sizing, risk } }
}

async function createOrderWithRiskCheck(
  input: CreateOrderInput,
): Promise<DataLayerResult<Order>> {
  const price = Math.max(0, input.price)
  if (price <= 0 || input.quantity <= 0) {
    return { success: false, error: '价格或数量非法' }
  }

  const risk = await checkOrderRisk({
    symbol: input.symbol,
    direction: input.direction,
    quantity: input.quantity,
    price,
    portfolioValue: getEffectiveTradingConfig().risk.portfolioValue,
  })

  if (!risk.ok) {
    return {
      success: false,
      error: `风控未通过：${risk.blocks.join('；')}`,
    }
  }

  const order = buildOrder(input)

  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.tradinghub,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.insertOrder,
      traceId: `trading-${nanoid(8)}-${input.symbol}`,
    },
    order,
  )

  try {
    await dataBridge.forward(envelope)
    return { success: true, data: order }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 获取观察池中的股票列表
 */
export async function getWatchlistStocks(): Promise<DataLayerResult<Stock[]>> {
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.stocks,
      indexName: 'by-status',
      indexValue: RESEARCH_STATUS.watching,
      source: MODULE_ID.trading,
    })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: result.data ?? [] }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 获取全部订单
 */
export async function getOrders(): Promise<DataLayerResult<Order[]>> {
  try {
    const result = await dataBridge.query<Order[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.orders,
      source: MODULE_ID.trading,
    })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: result.data ?? [] }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 创建买入订单
 *
 * 通过 DataBridge.forward() 写入，确保 ACL 校验与审计日志。
 */
export async function createBuyOrder(
  stock: Stock,
  quantity: number = DEFAULT_BUY_QUANTITY,
): Promise<DataLayerResult<Order>> {
  if (!stock.symbol) {
    return { success: false, error: '股票代码不能为空' }
  }
  if (stock.price === undefined || stock.price <= 0) {
    return { success: false, error: '价格或数量非法' }
  }

  return createOrderWithRiskCheck({
    symbol: stock.symbol,
    direction: 'buy',
    quantity,
    price: stock.price,
  })
}

/**
 * 创建卖出订单
 */
export async function createSellOrder(
  stock: Stock,
  quantity: number = DEFAULT_BUY_QUANTITY,
): Promise<DataLayerResult<Order>> {
  if (!stock.symbol) {
    return { success: false, error: '股票代码不能为空' }
  }
  if (stock.price === undefined || stock.price <= 0) {
    return { success: false, error: '价格或数量非法' }
  }

  return createOrderWithRiskCheck({
    symbol: stock.symbol,
    direction: 'sell',
    quantity,
    price: stock.price,
  })
}
