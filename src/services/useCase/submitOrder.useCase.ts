/**
 * @module services/useCase/submitOrder.useCase
 * @lifecycle @Global
 * @description 提交订单用例 — 封装订单提交的完整业务流程
 *
 * 业务流程（4步）：
 * 1. 参数校验（金额精度、数量合法性、方向有效性）
 * 2. 构造完整 Order 对象（生成 id/createdAt/traceId）
 * 3. 通过 DataBridge 信封协议持久化
 * 4. 广播 ORDERS_CHANGED 事件通知其他 Store/Tab
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, ORDER_STATUS, ACCOUNT_TYPE, STORE_NAME } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/lib/withBroadcast'
import { startOperation, succeedOperation, failOperation } from '@/services/feedbackService'
import { runInTransaction } from '@/core/transaction'
import type { Order } from '@/data/types'

const logger = getLogger()

export interface SubmitOrderInput {
  symbol: string
  direction: 'buy' | 'sell'
  quantity: number
  price: number
  note?: string
}

export interface SubmitOrderResult {
  success: boolean
  orderId?: string
  error?: string
}

/**
 * 提交订单用例
 *
 * @param input 订单输入参数
 * @returns 提交结果（含 orderId 或 error）
 */
export async function submitOrderUseCase(
  input: SubmitOrderInput,
): Promise<SubmitOrderResult> {
  const opId = startOperation('submitOrder', {
    message: `提交${input.direction === 'buy' ? '买入' : '卖出'}订单: ${input.symbol} × ${input.quantity} @ ¥${input.price}`,
    metadata: { symbol: input.symbol, direction: input.direction },
  })

  logger.info('[submitOrderUseCase] 开始提交订单', { symbol: input.symbol, direction: input.direction })

  // Step 1: 参数校验
  if (!input.symbol || input.symbol.trim().length === 0) {
    return { success: false, error: '股票代码不能为空' }
  }

  if (input.quantity <= 0 || !Number.isFinite(input.quantity)) {
    return { success: false, error: '交易数量必须为正数' }
  }

  if (input.price <= 0 || !Number.isFinite(input.price)) {
    return { success: false, error: '交易价格必须为正数' }
  }

  if (input.direction !== 'buy' && input.direction !== 'sell') {
    return { success: false, error: `不支持的方向: ${String(input.direction)}` }
  }

  // Step 2: 构造完整 Order 对象
  const now = Date.now()
  const traceId = `uc-submit-${now}-${input.symbol}`
  const orderId = `ord_${now}_${Math.random().toString(36).slice(2, 8)}`
  const roundedPrice = Math.round(input.price * 100) / 100
  const roundedAmount = Math.round(input.quantity * roundedPrice * 100) / 100

  const order: Order = {
    id: orderId,
    symbol: input.symbol.toUpperCase(),
    direction: input.direction,
    quantity: input.quantity,
    price: roundedPrice,
    amount: roundedAmount,
    status: ORDER_STATUS.pending,
    accountType: ACCOUNT_TYPE.paper,
    createdAt: now,
  }

  logger.info('[submitOrderUseCase] 订单构造完成', { orderId, symbol: order.symbol })

  // Step 3: 在事务中通过 DataBridge 持久化
  try {
    await runInTransaction<void>(
      [STORE_NAME.orders],
      'readwrite',
      async (_tx) => {
        const envelope = EnvelopeFactory.create(
          { source: MODULE_ID.trading, target: ENVELOPE_TARGET.db, action: ENVELOPE_ACTION.insertOrder, traceId },
          order,
        )

        await dataBridge.forward(envelope)
      },
    )

    // Step 4: 广播事件
    withBroadcast(EVENT_NAMES.ORDERS_CHANGED, { action: 'add', id: orderId, traceId })

    logger.info('[submitOrderUseCase] 订单提交成功', { orderId })
    succeedOperation(opId, { message: `订单 ${orderId} 提交成功` })

    return { success: true, orderId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[submitOrderUseCase] 订单提交失败', { error: message, orderId })
    failOperation(opId, message, { message: `订单提交失败: ${message}` })

    return { success: false, error: message }
  }
}
