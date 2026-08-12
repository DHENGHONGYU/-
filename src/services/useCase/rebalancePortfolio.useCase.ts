/**
 * @module services/useCase/rebalancePortfolio.useCase
 * @note P1-12（已确认合规）：dataLayer store 内部通过 sendWriteEnvelope() → DataBridge 写入，
 *   queryList/queryGet 走 DataBridge 查询，是 DataBridge 的类型安全包装层。
 *   符合 services → data 分层规则（AGENTS.md §一），无需迁移。
 * @description 投资组合再平衡用例
 *
 * 将原先 portfolioService 中的 rebalance 业务逻辑抽取为独立 UseCase，
 * 包含完整的业务流程编排：参数校验→数据获取→业务逻辑→结果返回。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-021, V9-DOC-BACK-033, V9-DOC-BACK-027]
*/

import { getLogger } from '@/lib/logger'
import { portfolioStore } from '@/data/dataLayerTradingStores'
import { runInTransaction } from '@/core/transaction'
import { STORE_NAME } from '@/config/dbConfig'
import type { Portfolio, Order } from '@/data/types'
import {
  DEFAULT_CASH_RESERVE_PCT,
  DEFAULT_MAX_HOLDING_WEIGHT,
  DEFAULT_REBALANCE_THRESHOLD,
} from '@/constants/execution.constants'
import { checkPortfolioRebalanceFreshness } from '@/core/freshnessGuard'

const logger = getLogger()

export interface RebalanceOptions {
  now?: number
  cashReservePct?: number
  maxHoldingWeight?: number
  rebalanceThreshold?: number
}

/**
 * 投资组合再平衡用例
 *
 * 业务流程：
 * 1. 参数校验与默认值填充
 * 2. 事务内获取组合数据
 * 3. Freshness 校验（组合更新时间必须晚于最新订单创建时间）
 * 4. 根据订单更新持仓数量
 * 5. 重新计算市值与权重
 * 6. 生成再平衡计划（权重偏差超过阈值时触发调整）
 * 7. 保存更新后的组合
 *
 * @returns 更新后的 Portfolio 或 undefined（失败时）
/**
 * rebalancePortfolioUseCase
 */
export async function rebalancePortfolioUseCase(
  portfolioId: string,
  orders: Order[],
  options: RebalanceOptions = {},
): Promise<Portfolio | undefined> {
  // 1. 参数校验与默认值填充
  const now = options.now ?? Date.now()
  const cashReservePct = options.cashReservePct ?? DEFAULT_CASH_RESERVE_PCT
  const maxHoldingWeight = options.maxHoldingWeight ?? DEFAULT_MAX_HOLDING_WEIGHT
  const rebalanceThreshold = options.rebalanceThreshold ?? DEFAULT_REBALANCE_THRESHOLD

  logger.info(`[RebalancePortfolioUseCase] 开始再平衡: portfolioId="${portfolioId}", orders=${orders.length}`, {
    cashReservePct,
    maxHoldingWeight,
    rebalanceThreshold,
  })

  try {
    // 2. 事务内获取组合数据并执行再平衡
    return await runInTransaction<Portfolio | undefined>(
      [STORE_NAME.portfolios],
      'readwrite',
      async (tx) => {
        // 3. 获取组合数据
        let portfolio: Portfolio | undefined
        try {
          portfolio = await portfolioStore.getWithTx(portfolioId, tx)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          logger.error(`[RebalancePortfolioUseCase] 获取组合失败: ${message}`, { portfolioId })
          return undefined
        }

        if (!portfolio) {
          logger.warn(`[RebalancePortfolioUseCase] 组合不存在: id="${portfolioId}"`)
          return undefined
        }

        // 4. Freshness 校验：组合更新时间必须晚于最新订单创建时间
        const latestOrderCreatedAt = orders.length > 0 ? Math.max(...orders.map((o) => o.createdAt)) : 0
        checkPortfolioRebalanceFreshness(now, latestOrderCreatedAt, portfolioId)

function updateHoldingForOrder(
  holding: Portfolio['holdings'][number],
  order: Order,
): Portfolio['holdings'][number] {
  const delta = order.direction === 'buy' ? order.quantity : -order.quantity
  return {
    ...holding,
    currentShares: Math.max(0, holding.currentShares + delta),
  }
}

// 5. 根据订单更新持仓数量
        const updatedHoldings = [...portfolio.holdings]
        for (const order of orders) {
          const idx = updatedHoldings.findIndex((h) => h.symbol === order.symbol)
          const holding = updatedHoldings[idx]
          if (idx >= 0 && holding) {
            updatedHoldings[idx] = updateHoldingForOrder(holding, order)
          }
        }

        // 6. 重新计算市值与权重
        const totalValue = updatedHoldings.reduce((sum, h) => sum + h.marketValue, 0)
        const cashReserve = totalValue * cashReservePct
        const investable = totalValue - cashReserve

        // 7. 生成再平衡计划
        const rebalancePlan: Portfolio['rebalancePlan'] = []
        for (const holding of updatedHoldings) {
          const currentWeight = totalValue > 0 ? holding.marketValue / totalValue : 0
          const deviation = Math.abs(currentWeight - holding.targetWeight)

          // 权重偏差超过阈值时触发调整
          if (deviation > rebalanceThreshold) {
            const targetShares = Math.floor((investable * holding.targetWeight) / holding.price)
            const delta = targetShares - holding.currentShares
            rebalancePlan.push({
              symbol: holding.symbol,
              action: delta > 0 ? 'buy' : 'sell',
              shares: Math.abs(delta),
              reason: `权重偏差 ${(deviation * 100).toFixed(2)}% 超过阈值 ${(rebalanceThreshold * 100).toFixed(2)}%`,
            })
          }

          // 强制权重上限
          if (holding.targetWeight > maxHoldingWeight) {
            holding.targetWeight = maxHoldingWeight
          }
        }

        // 8. 构建更新后的组合对象
        const updated: Portfolio = {
          ...portfolio,
          holdings: updatedHoldings,
          totalValue,
          cashReserve,
          rebalancePlan,
          updatedAt: now,
        }

        // 9. 保存更新后的组合
        try {
          await portfolioStore.saveWithTx(updated, tx)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          logger.error(`[RebalancePortfolioUseCase] 保存组合失败: ${message}`, { portfolioId })
          return undefined
        }

        logger.info(`[RebalancePortfolioUseCase] 再平衡成功: portfolioId="${portfolioId}"`, {
          holdingsCount: updatedHoldings.length,
          rebalanceActions: rebalancePlan.length,
          totalValue,
        })

        return updated
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[RebalancePortfolioUseCase] 再平衡失败: ${message}`, { portfolioId })
    return undefined
  }
}
