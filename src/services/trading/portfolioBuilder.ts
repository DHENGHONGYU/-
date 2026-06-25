import { CORE_RESOURCE_THEME, matchesTheme, type ThemeConfig } from '@/config/themeRegistry'
import { getDefaultTradingConfig } from '@/config/tradingConfig'
import type { Portfolio, PortfolioHolding, RebalanceAction, Stock } from '@/data/types'
import { getCompositeScores } from './scoringAdapter'
import { runStrategy } from './strategyEngine'
import type { StrategyRuleConfig } from '@/config/strategyRules'
import type { StrategyResult } from '@/data/types'

export interface PortfolioBuilderInput {
  theme: ThemeConfig
  /** 候选股票池，通常为 watching 池或全部 stocks */
  stocks: Stock[]
  /** 总资产净值，默认取 tradingConfig.risk.portfolioValue */
  totalPortfolioValue?: number
  /** 当前持仓股数（symbol -> shares），默认从空持仓开始 */
  currentHoldings?: Record<string, number>
  /** 评分适配器选项 */
  scoringOptions?: Parameters<typeof getCompositeScores>[1]
  /** 策略规则配置；若提供，则先通过 strategyEngine 进行 20 进 13 筛选 */
  ruleConfig?: StrategyRuleConfig
}

export interface PortfolioBuilderOptions {
  /** 最小价格，低于该价格的标的不纳入组合（避免低价股异常） */
  minPrice?: number
  /** 是否跳过主题匹配（策略引擎已提前筛选时使用） */
  skipThemeMatch?: boolean
}

const DEFAULT_OPTIONS: PortfolioBuilderOptions = {
  minPrice: 0.01,
  skipThemeMatch: false,
}

/**
 * 根据主题与评分构建目标投资组合。
 *
 * 流程：
 * 1. 从候选池中筛选匹配主题的标的。
 * 2. 获取综合评分，剔除低于 minCompositeScore 的标的。
 * 3. 按综合评分降序排序。
 * 4. 在主题总仓位内等权分配，受 singleMaxPct / singleMinPct 约束。
 * 5. 根据当前持仓生成再平衡计划。
 */
export async function buildThemePortfolio(
  input: PortfolioBuilderInput,
  options: PortfolioBuilderOptions = {},
): Promise<Portfolio> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const theme = input.theme
  const totalValue = input.totalPortfolioValue ?? getDefaultTradingConfig().risk.portfolioValue
  const currentHoldings = input.currentHoldings ?? {}

  // 1. 主题匹配 + 基础过滤
  const matchedStocks = input.stocks.filter((stock) => {
    const price = stock.price ?? 0
    if (price <= (opts.minPrice ?? 0)) return false
    return opts.skipThemeMatch ? true : matchesTheme(stock, theme)
  })

  if (matchedStocks.length === 0) {
    return emptyPortfolio(theme, totalValue)
  }

  // 2. 获取评分
  const scores = await getCompositeScores(matchedStocks, input.scoringOptions)
  const scoredMap = new Map(scores.map((s) => [s.symbol, s]))

  // 3. 按评分排序并过滤
  const qualified = matchedStocks
    .map((stock) => ({ stock, score: scoredMap.get(stock.symbol) }))
    .filter(({ score }) => (score?.composite ?? 0) >= theme.minCompositeScore)
    .sort((a, b) => (b.score?.composite ?? 0) - (a.score?.composite ?? 0))

  if (qualified.length === 0) {
    return emptyPortfolio(theme, totalValue)
  }

  // 4. 权重分配
  const allocations = allocateWeights(qualified.length, theme)

  // 5. 构建持仓明细
  const themeValue = totalValue * (theme.totalAllocationPct / 100)
  const cashReserve = themeValue * (theme.cashReservePct / 100)
  const investableValue = themeValue - cashReserve

  const holdings: PortfolioHolding[] = qualified.map(({ stock, score }, index) => {
    const targetWeight = allocations[index] ?? 0
    const targetValue = investableValue * targetWeight
    const price = stock.price ?? 0
    const roundLot = getDefaultTradingConfig().kelly.roundLot
    const targetShares = price > 0 ? Math.floor(targetValue / price / roundLot) * roundLot : 0
    const marketValue = targetShares * price
    const currentShares = currentHoldings[stock.symbol] ?? 0

    return {
      symbol: stock.symbol,
      name: stock.name,
      currentShares,
      currentWeight: 0, // 当前权重将在后续统一计算
      targetWeight,
      targetShares,
      price,
      marketValue,
      score: score?.composite ?? 0,
      rationale: score?.rationale ?? '无评分',
    }
  })

  // 6. 重新计算当前权重（基于当前持仓）
  holdings.forEach((h) => {
    const currentMarketValue = h.currentShares * h.price
    h.currentWeight = totalValue > 0 ? currentMarketValue / totalValue : 0
  })

  // 7. 生成再平衡计划
  const rebalancePlan = buildRebalancePlan(holdings, theme)

  return {
    id: `${theme.id}-${Date.now()}`,
    name: theme.name,
    theme: theme.id,
    totalValue,
    cashReserve,
    holdings,
    rebalancePlan,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * 分配主题内权重。
 *
 * 说明：
 * - theme.singleMaxPct / singleMinPct 均指“占总资产净值的百分比”。
 * - 主题内权重需转换为占总资产的比例后再受约束。
 * - 为简化 MVP，采用等权分配；若等权导致单只超出上限，则对高评分标的按上限封顶，
 *   其余标的权重归零（由调用方按评分排序后传入）。
 */
function allocateWeights(count: number, theme: ThemeConfig): number[] {
  if (count <= 0) return []

  const investableRatio = (1 - theme.cashReservePct / 100)
  // 单只标的在主题内允许的最大权重（使其实际占比不超过 singleMaxPct）
  const effectiveMax = (theme.singleMaxPct / 100) / ((theme.totalAllocationPct / 100) * investableRatio)
  const effectiveMin = (theme.singleMinPct / 100) / ((theme.totalAllocationPct / 100) * investableRatio)

  const equalWeight = 1 / count

  if (equalWeight <= effectiveMax) {
    return Array(count).fill(Math.max(effectiveMin, equalWeight))
  }

  // 等权超出上限：仅前 floor(1/effectiveMax) 只标的按上限配置，其余为 0
  const cappedCount = Math.min(count, Math.floor(1 / effectiveMax))
  const weights = Array(count).fill(0)
  for (let i = 0; i < cappedCount; i++) {
    weights[i] = effectiveMax
  }

  return weights
}

function buildRebalancePlan(
  holdings: PortfolioHolding[],
  theme: ThemeConfig,
): RebalanceAction[] {
  const plan: RebalanceAction[] = []

  for (const h of holdings) {
    const diff = h.targetShares - h.currentShares
    const drift = Math.abs(h.targetWeight - h.currentWeight)

    if (Math.abs(diff) < getDefaultTradingConfig().kelly.roundLot) {
      plan.push({
        symbol: h.symbol,
        action: 'hold',
        shares: 0,
        reason: '已接近目标仓位',
      })
      continue
    }

    if (drift < theme.rebalanceThreshold) {
      plan.push({
        symbol: h.symbol,
        action: 'hold',
        shares: 0,
        reason: `偏离度 ${(drift * 100).toFixed(2)}% 低于再平衡阈值 ${theme.rebalanceThreshold * 100}%`,
      })
      continue
    }

    if (diff > 0) {
      plan.push({
        symbol: h.symbol,
        action: 'buy',
        shares: diff,
        reason: `目标 ${h.targetShares} 股，当前 ${h.currentShares} 股，需补仓`,
      })
    } else {
      plan.push({
        symbol: h.symbol,
        action: 'sell',
        shares: Math.abs(diff),
        reason: `目标 ${h.targetShares} 股，当前 ${h.currentShares} 股，需减仓`,
      })
    }
  }

  return plan
}

export interface StrategyPortfolioResult {
  portfolio: Portfolio
  strategyResult: StrategyResult
}

/**
 * 先通过 strategyEngine 进行 20 进 13 筛选与分类，再构建主题组合。
 *
 * 适用于需要应用核心稀缺策略规则引擎的场景。
 */
export async function buildStrategyFilteredPortfolio(
  input: PortfolioBuilderInput,
  options: PortfolioBuilderOptions = {},
): Promise<StrategyPortfolioResult> {
  const strategyResult = await runStrategy(input.stocks, {
    theme: input.theme,
    ruleConfig: input.ruleConfig,
  })

  const selectedSymbols = new Set(strategyResult.selected.map((c) => c.symbol))
  const selectedStocks = input.stocks.filter((s) => selectedSymbols.has(s.symbol))

  const portfolio = await buildThemePortfolio(
    {
      ...input,
      stocks: selectedStocks,
    },
    { ...options, skipThemeMatch: true },
  )

  return { portfolio, strategyResult }
}

function emptyPortfolio(theme: ThemeConfig, totalValue: number): Portfolio {
  const themeValue = totalValue * (theme.totalAllocationPct / 100)
  const cashReserve = themeValue * (theme.cashReservePct / 100)

  return {
    id: `${theme.id}-${Date.now()}`,
    name: theme.name,
    theme: theme.id,
    totalValue,
    cashReserve,
    holdings: [],
    rebalancePlan: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * 便捷函数：为“第四次工业革命稀缺核心资源”主题构建投资组合。
 */
export async function buildCoreResourcePortfolio(
  stocks: Stock[],
  orders: Array<{ symbol: string; direction: 'buy' | 'sell'; quantity: number }>,
  totalPortfolioValue?: number,
): Promise<Portfolio> {
  return buildThemePortfolio({
    theme: CORE_RESOURCE_THEME,
    stocks,
    totalPortfolioValue,
    currentHoldings: computeHoldingsFromOrders(orders),
  })
}

/**
 * 计算当前持仓股数（基于订单流水）。
 */
export function computeHoldingsFromOrders(
  orders: Array<{ symbol: string; direction: 'buy' | 'sell'; quantity: number }>,
): Record<string, number> {
  const holdings: Record<string, number> = {}

  for (const order of orders) {
    const current = holdings[order.symbol] ?? 0
    holdings[order.symbol] = current + (order.direction === 'buy' ? order.quantity : -order.quantity)
  }

  return holdings
}
