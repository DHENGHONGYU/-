/**
 * @module portfolioService
 * @description 交易域组合服务：从 IndexedDB 真实数据构建核心组合与策略结果。
 *
 * 真实数据源：
 * - 观察池股票：stocks 表按 `researchStatus === watching` 索引查询
 * - 订单流水：orders 表全量查询
 *
 * 与 TradingFlowPage 的持仓数据一致：当前持仓股数均从同一 orders 表流水计算。
 */
import { dataBridge } from '@/core/databridge'
import {
  ENVELOPE_ACTION,
  MODULE_ID,
  RESEARCH_STATUS,
  STORE_NAME,
} from '@/config/dbConfig'
import type { Order, Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'
import {
  buildStrategyFilteredPortfolio,
  computeHoldingsFromOrders,
  type StrategyPortfolioResult,
} from './portfolioBuilder'
import { CORE_RESOURCE_THEME } from '@/config/themeRegistry'

const logger = getLogger()

export interface PortfolioInput {
  /** 观察池股票列表 */
  stocks: Stock[]
  /** 全部订单流水 */
  orders: Order[]
}

/**
 * 从真实数据源加载构建核心组合所需的输入。
 *
 * 通过 DataBridge.query 直接读取 IndexedDB，不依赖内存中的 Store 状态。
 */
export async function loadPortfolioInput(): Promise<PortfolioInput> {
  logger.info('[portfolioService] loadPortfolioInput 开始')

  const [stocksResult, ordersResult] = await Promise.all([
    dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.stocks,
      indexName: 'by-status',
      indexValue: RESEARCH_STATUS.watching,
      source: MODULE_ID.trading,
    }),
    dataBridge.query<Order[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.orders,
      source: MODULE_ID.trading,
    }),
  ])

  if (!stocksResult.success) {
    throw new Error(stocksResult.error ?? '加载观察池股票失败')
  }
  if (!ordersResult.success) {
    throw new Error(ordersResult.error ?? '加载订单失败')
  }

  const stocks = stocksResult.data ?? []
  const orders = ordersResult.data ?? []

  logger.info('[portfolioService] loadPortfolioInput 完成', {
    stocksCount: stocks.length,
    ordersCount: orders.length,
  })

  return { stocks, orders }
}

/**
 * 基于 IndexedDB 真实数据构建核心组合与策略筛选结果。
 */
export async function buildPortfolioFromRealData(): Promise<StrategyPortfolioResult> {
  const { stocks, orders } = await loadPortfolioInput()
  return buildStrategyFilteredPortfolio({
    theme: CORE_RESOURCE_THEME,
    stocks,
    currentHoldings: computeHoldingsFromOrders(orders),
  })
}
