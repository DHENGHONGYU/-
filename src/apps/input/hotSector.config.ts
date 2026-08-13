/**
 * 动态权重排序配置
 *
 * 综合评分 = 原始评分(60%) + 资金热度(30%) + 动量强度(10%)
 */
export const DYNAMIC_SCORE_WEIGHTS = {
  /** 原始板块评分权重 */
  original: 0.6,
  /** 资金热度权重 */
  capital: 0.3,
  /** 动量强度权重 */
  momentum: 0.1,
} as const

/**
 * 动量权重子项配置
 *
 * 动量权重 = 情绪因子(sentiment) 60% + 估值因子(valuation) 40%
 */
export const MOMENTUM_WEIGHTS = {
  sentiment: 0.6,
  valuation: 0.4,
} as const
