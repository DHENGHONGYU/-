/**
 * @fileoverview 投资组合域类型（L1 组合业务域）
 *
 * 包含组合持仓、组合快照、再平衡动作等类型。
 *
 * @module data/types/types.portfolio
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
/**
 * 组合持仓明细（目标 vs 当前）。
 * 用于主题投资组合的构建、展示与再平衡。
  * @doc [V9-DOC-PROJ-229, V9-DOC-QA-066]
*/
export interface PortfolioHolding {
  symbol: string
  name: string
  currentShares: number
  currentWeight: number
  targetWeight: number
  targetShares: number
  price: number
  marketValue: number
  score: number
  rationale: string
}

/**
 * 再平衡动作：买入/卖出某只标的以接近目标权重。
 */
export interface RebalanceAction {
  symbol: string
  action: 'buy' | 'sell' | 'hold'
  shares: number
  reason: string
}

/**
 * 投资组合快照。
 * 可由 portfolioBuilder 根据股票池、主题、评分实时计算生成。
 */
export interface Portfolio {
  id: string
  name: string
  theme: string
  totalValue: number
  cashReserve: number
  holdings: PortfolioHolding[]
  rebalancePlan: RebalanceAction[]
  createdAt: number
  updatedAt: number
}
