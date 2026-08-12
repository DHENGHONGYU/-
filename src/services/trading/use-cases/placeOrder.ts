/**
 * @module services/trading/use-cases/placeOrder
 * @description 下单用例 —— 编排"创建订单 + 风控校验 + 持久化"完整流程
 *
 * 用例层职责：
 *   - 编排领域服务（交易服务、风控服务、持仓服务）
 *   - 不包含业务规则（业务规则下沉到 domain service）
 *   - 作为对外稳定的 API 契约层
 *
 * 对应 ADR-012：用例层显式化
 */

import { createOrderWithRiskCheck, type CreateOrderInput } from '../tradingService'
import type { DataLayerResult } from '@/data/types/types.dataLayer'
import type { Order } from '@/data/types/types.order'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 下单用例：创建买入订单（含风控校验）
 *
 * 流程：
 *   1. 参数校验
 *   2. 风控检查（仓位、资金、止损）
 *   3. 创建订单并持久化
 *   4. 返回结果
 */
export async function placeBuyOrder(input: CreateOrderInput): Promise<DataLayerResult<Order>> {
  logger.info('[use-case] placeBuyOrder', { symbol: input.symbol })
  return createOrderWithRiskCheck({ ...input, direction: 'buy' })
}

/**
 * 下单用例：创建卖出订单（含风控校验）
 */
export async function placeSellOrder(input: CreateOrderInput): Promise<DataLayerResult<Order>> {
  logger.info('[use-case] placeSellOrder', { symbol: input.symbol })
  return createOrderWithRiskCheck({ ...input, direction: 'sell' })
}

/**
 * 下单用例执行结果
 */
export type PlaceOrderResult = DataLayerResult<Order>
