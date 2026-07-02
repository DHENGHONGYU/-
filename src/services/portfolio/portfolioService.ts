/**
 * @module portfolioService
 * @description 投资组合服务：组合构建、再平衡、持仓调整。
 *
 * 职责：
 *   - rebalance(portfolioId, orders, options): 根据最新订单再平衡组合
 *   - addHolding(portfolioId, holding): 新增持仓
 *   - removeHolding(portfolioId, symbol): 移除持仓
 *   - listByTheme(theme): 按主题查询组合
 */

import { getLogger } from '@/lib/logger'
import { portfolioStore } from '@/data/dataLayer'
import type { Portfolio, PortfolioHolding, Order } from '@/data/types'
import {
  DEFAULT_CASH_RESERVE_PCT,
  DEFAULT_MAX_HOLDING_WEIGHT,
  DEFAULT_REBALANCE_THRESHOLD,
} from '@/constants/execution.constants'
import { checkPortfolioRebalanceFreshness } from '@/services/analysis/dataFreshnessGuard'

const logger = getLogger()

export interface RebalanceOptions {
  now?: number
  cashReservePct?: number
  maxHoldingWeight?: number
  rebalanceThreshold?: number
}

/**
 * 根据最新订单再平衡投资组合。
 * 当持仓权重偏差超过阈值时触发调整。
 */
export async function rebalance(
  portfolioId: string,
  orders: Order[],
  options: RebalanceOptions = {},
): Promise<Portfolio | undefined> {
  const now = options.now ?? Date.now()
  const cashReservePct = options.cashReservePct ?? DEFAULT_CASH_RESERVE_PCT
  const maxHoldingWeight = options.maxHoldingWeight ?? DEFAULT_MAX_HOLDING_WEIGHT
  const rebalanceThreshold = options.rebalanceThreshold ?? DEFAULT_REBALANCE_THRESHOLD

  try {
    const portfolio = await portfolioStore.get(portfolioId)
    if (!portfolio) {
      logger.warn(`[portfolioService] rebalance portfolio not found: id="${portfolioId}"`)
      return undefined
    }

    // Freshness 校验：组合更新时间必须晚于最新订单创建时间
    const latestOrderCreatedAt = orders.length > 0 ? Math.max(...orders.map((o) => o.createdAt)) : 0
    checkPortfolioRebalanceFreshness(now, latestOrderCreatedAt, portfolioId)

    // 根据订单更新持仓数量
    const updatedHoldings = [...portfolio.holdings]
    for (const order of orders) {
      const idx = updatedHoldings.findIndex((h) => h.symbol === order.symbol)
      if (idx >= 0) {
        const holding = updatedHoldings[idx]
        if (holding) {
          const delta = order.direction === 'buy' ? order.quantity : -order.quantity
          updatedHoldings[idx] = {
            ...holding,
            currentShares: Math.max(0, holding.currentShares + delta),
          }
        }
      }
    }

    // 重新计算市值与权重
    const totalValue = updatedHoldings.reduce((sum, h) => sum + h.marketValue, 0)
    const cashReserve = totalValue * cashReservePct
    const investable = totalValue - cashReserve

    const rebalancePlan: Portfolio['rebalancePlan'] = []
    for (const holding of updatedHoldings) {
      const currentWeight = totalValue > 0 ? holding.marketValue / totalValue : 0
      const deviation = Math.abs(currentWeight - holding.targetWeight)
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

    const updated: Portfolio = {
      ...portfolio,
      holdings: updatedHoldings,
      totalValue,
      cashReserve,
      rebalancePlan,
      updatedAt: now,
    }

    const result = await portfolioStore.save(updated)
    if (!result.success) {
      logger.error(`[portfolioService] rebalance save failed: ${result.error}`, { portfolioId })
      return undefined
    }

    logger.info(`[portfolioService] rebalance success: portfolioId="${portfolioId}"`, {
      holdingsCount: updatedHoldings.length,
      rebalanceActions: rebalancePlan.length,
      totalValue,
    })
    return updated
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[portfolioService] rebalance error: ${message}`, { portfolioId })
    return undefined
  }
}

/**
 * 向投资组合新增持仓。
 */
export async function addHolding(portfolioId: string, holding: PortfolioHolding): Promise<Portfolio | undefined> {
  try {
    const portfolio = await portfolioStore.get(portfolioId)
    if (!portfolio) {
      logger.warn(`[portfolioService] addHolding portfolio not found: id="${portfolioId}"`)
      return undefined
    }

    if (holding.targetWeight > DEFAULT_MAX_HOLDING_WEIGHT) {
      logger.warn(
        `[portfolioService] addHolding targetWeight ${holding.targetWeight} exceeds max ${DEFAULT_MAX_HOLDING_WEIGHT}`,
        { symbol: holding.symbol },
      )
      holding.targetWeight = DEFAULT_MAX_HOLDING_WEIGHT
    }

    const existing = portfolio.holdings.find((h) => h.symbol === holding.symbol)
    if (existing) {
      logger.warn(`[portfolioService] addHolding holding already exists: symbol="${holding.symbol}"`)
      return portfolio
    }

    const updated: Portfolio = {
      ...portfolio,
      holdings: [...portfolio.holdings, holding],
      totalValue: portfolio.totalValue + holding.marketValue,
      updatedAt: Date.now(),
    }

    const result = await portfolioStore.save(updated)
    if (!result.success) {
      logger.error(`[portfolioService] addHolding save failed: ${result.error}`, { portfolioId })
      return undefined
    }

    logger.info(`[portfolioService] addHolding success: portfolioId="${portfolioId}" symbol="${holding.symbol}"`)
    return updated
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[portfolioService] addHolding error: ${message}`, { portfolioId })
    return undefined
  }
}

/**
 * 从投资组合移除持仓。
 */
export async function removeHolding(portfolioId: string, symbol: string): Promise<Portfolio | undefined> {
  try {
    const portfolio = await portfolioStore.get(portfolioId)
    if (!portfolio) {
      logger.warn(`[portfolioService] removeHolding portfolio not found: id="${portfolioId}"`)
      return undefined
    }

    const holding = portfolio.holdings.find((h) => h.symbol === symbol)
    if (!holding) {
      logger.warn(`[portfolioService] removeHolding holding not found: symbol="${symbol}"`)
      return portfolio
    }

    const updated: Portfolio = {
      ...portfolio,
      holdings: portfolio.holdings.filter((h) => h.symbol !== symbol),
      totalValue: portfolio.totalValue - holding.marketValue,
      updatedAt: Date.now(),
    }

    const result = await portfolioStore.save(updated)
    if (!result.success) {
      logger.error(`[portfolioService] removeHolding save failed: ${result.error}`, { portfolioId })
      return undefined
    }

    logger.info(`[portfolioService] removeHolding success: portfolioId="${portfolioId}" symbol="${symbol}"`)
    return updated
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[portfolioService] removeHolding error: ${message}`, { portfolioId })
    return undefined
  }
}

/**
 * 按主题查询投资组合。
 */
export async function listByTheme(theme: string): Promise<Portfolio[]> {
  try {
    const all = await portfolioStore.list()
    return all.filter((p) => p.theme === theme)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[portfolioService] listByTheme error: ${message}`, { theme })
    return []
  }
}

export const portfolioService = {
  rebalance,
  addHolding,
  removeHolding,
  listByTheme,
}
