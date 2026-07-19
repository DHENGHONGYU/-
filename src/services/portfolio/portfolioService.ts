/**
 * @module portfolioService
 * @note P1-12（已确认合规）：dataLayer store 内部通过 sendWriteEnvelope() → DataBridge 写入，
 *   queryList/queryGet 走 DataBridge 查询，是 DataBridge 的类型安全包装层。
 *   符合 services → data 分层规则（AGENTS.md §一），无需迁移。
 * @description 投资组合服务：组合构建、再平衡、持仓调整。
 *
 * 原 rebalance 实现已抽取至 services/useCase/rebalancePortfolio.useCase。
 * 本文件保留为兼容 facade，新代码请直接从 UseCase 导入。
 *
 * @deprecated 请优先使用 services/useCase/rebalancePortfolio.useCase
 * @convergence 迁移到 DataBridge 后删除此文件（Phase 2）。
 */

import { getLogger } from '@/lib/logger'
import { portfolioStore } from '@/data/dataLayerTradingStores'
import type { Portfolio, PortfolioHolding } from '@/data/types'
import { DEFAULT_MAX_HOLDING_WEIGHT } from '@/constants/execution.constants'
import { rebalancePortfolioUseCase, type RebalanceOptions } from '@/services/useCase/rebalancePortfolio.useCase'

const logger = getLogger()

// Re-export for backward compatibility
export type { RebalanceOptions }

/**
 * 根据最新订单再平衡投资组合（薄包装）。
 * 当持仓权重偏差超过阈值时触发调整。
 *
 * @deprecated 请直接使用 rebalancePortfolioUseCase
 */
export async function rebalance(
  portfolioId: string,
  orders: Parameters<typeof rebalancePortfolioUseCase>[1],
  options: RebalanceOptions = {},
): Promise<Portfolio | undefined> {
  return rebalancePortfolioUseCase(portfolioId, orders, options)
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

/**
 * portfolioService
 */
export const portfolioService = {
  rebalance,
  addHolding,
  removeHolding,
  listByTheme,
}
