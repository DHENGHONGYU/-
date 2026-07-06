/**
 * @module services/useCase/executePlan.useCase
 * @lifecycle @Global
 * @description 执行计划用例 — 将 executionStore.executePlan 中的多步骤编排逻辑提取为独立用例
 *
 * 业务流程（6步）：
 * 1. 设置 isProcessing 状态
 * 2. 更新计划状态为 pending
 * 3. 获取最新股票价格
 * 4. 根据 direction 创建买入/卖出订单
 * 5. 根据结果更新计划状态为 executed 或 cancelled
 * 6. 清理 isProcessing
 *
 * @see Clean Architecture Use Case Interactor 模式
 */

import { getLogger } from '@/lib/logger'
import { runInTransaction } from '@/core/transaction'
import { STORE_NAME } from '@/config/dbConfig'
import type { ExecutionPlan, Stock } from '@/data/types'

// 注意：dataLayer 通过 runInTransaction 间接使用，无需直接导入

const logger = getLogger()

export interface ExecutePlanContext {
  /** 获取执行计划 */
  getPlan: (planId: string) => ExecutionPlan | undefined
  /** 更新执行计划状态 */
  updatePlanState: (planId: string, updates: Partial<ExecutionPlan>) => void
  /** 设置处理中标志 */
  setProcessing: (planId: string, isProcessing: boolean) => void
  /** 创建买入订单 */
  createBuyOrder: (symbol: string, price: number, quantity: number) => Promise<string | null>
  /** 创建卖出订单 */
  createSellOrder: (symbol: string, price: number, quantity: number) => Promise<string | null>
}

export interface ExecutePlanResult {
  success: boolean
  planId: string
  orderId?: string
  error?: string
  phase: ExecutionPlan['phase']
}

/**
 * 执行交易计划用例
 *
 * @param planId 计划ID
 * @param ctx 依赖上下文（由调用方注入 Store action）
 * @returns 执行结果
 */
export async function executePlanUseCase(
  planId: string,
  ctx: ExecutePlanContext,
): Promise<ExecutePlanResult> {
  logger.info(`[executePlanUseCase] 开始执行计划: ${planId}`)

  // Step 1: 设置处理中状态
  ctx.setProcessing(planId, true)

  try {
    const plan = ctx.getPlan(planId)
    if (!plan) {
      throw new Error(`计划不存在: ${planId}`)
    }

    if (plan.phase !== 'confirmed') {
      throw new Error(`计划状态不允许执行（当前: ${plan.phase}，需 confirmed）`)
    }

    // Step 2: 更新为 pending
    ctx.updatePlanState(planId, { phase: 'pending' })
    logger.info(`[executePlanUseCase] 计划 ${planId} 状态更新为 pending`)

    // Step 3: 在事务中获取最新价格（保证读取一致性）
    const stock = await runInTransaction<Stock | undefined>(
      [STORE_NAME.stocks],
      'readonly',
      async (tx) => {
        const store = tx.objectStore(STORE_NAME.stocks)
        return new Promise<Stock | undefined>((resolve, reject) => {
          const request = store.get(plan.symbol)
          request.onsuccess = () => resolve(request.result as Stock | undefined)
          request.onerror = () => reject(request.error instanceof Error ? request.error : new Error(String(request.error)))
        })
      },
    )

    if (!stock) {
      throw new Error(`股票 ${plan.symbol} 不存在`)
    }

    const currentPrice = stock.price ?? 0
    if (currentPrice <= 0) {
      throw new Error(`股票 ${plan.symbol} 当前价格无效: ${currentPrice}`)
    }

    logger.info(`[executePlanUseCase] 获取价格成功: ${plan.symbol} = ${currentPrice}`)

    // Step 4: 根据 direction 创建订单
    const quantity = plan.sizing?.quantity ?? 0
    if (quantity <= 0 || !Number.isFinite(quantity)) {
      throw new Error(`计划 ${planId} 交易数量无效: ${quantity}`)
    }

    let orderId: string | null = null

    if (plan.direction === 'buy') {
      orderId = await ctx.createBuyOrder(plan.symbol, currentPrice, quantity)
    } else if (plan.direction === 'sell') {
      orderId = await ctx.createSellOrder(plan.symbol, currentPrice, quantity)
    } else {
      throw new Error(`不支持的方向: ${String(plan.direction)}`)
    }

    // Step 5: 根据结果更新计划状态
    if (orderId) {
      ctx.updatePlanState(planId, {
        phase: 'executed',
        executedAt: Date.now(),
        orderId,
      })
      logger.info(`[executePlanUseCase] 计划 ${planId} 执行成功, orderId=${orderId}`)

      return {
        success: true,
        planId,
        orderId,
        phase: 'executed',
      }
    } else {
      ctx.updatePlanState(planId, {
        phase: 'cancelled',
        errorMessage: '订单创建失败',
      })
      logger.warn(`[executePlanUseCase] 计划 ${planId} 因订单创建失败而取消`)

      return {
        success: false,
        planId,
        error: '订单创建失败',
        phase: 'cancelled',
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[executePlanUseCase] 计划 ${planId} 执行异常: ${message}`)

    ctx.updatePlanState(planId, {
      phase: 'cancelled',
      errorMessage: message,
    })

    return {
      success: false,
      planId,
      error: message,
      phase: 'cancelled',
    }
  } finally {
    // Step 6: 清理处理中状态
    ctx.setProcessing(planId, false)
  }
}
