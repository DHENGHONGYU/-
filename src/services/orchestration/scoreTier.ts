/**
 * 评分分级纯函数
 *
 * 从 ScoreCalibrator.scoreToTier / scoreToRating 提取为公共纯函数，
 * 供资金配置面板、策略引擎、UI 组件复用，避免重复实现阈值逻辑。
 *
 * 阈值真相源：本文件（与 scoreCalibrator.ts 保持同步）
 *
 * @doc 评分三阈值分级体系（见 docs/specs/02-functional-specs.md §2.4.16）
 */

import type { StrategyClassification } from '@/data/types/types.strategy'
import { STRATEGY_TIER_TO_CAPITAL_POOL, type CapitalPoolId } from '@/config/capitalAllocationConfig'

/** 评级标签 */
export type ScoreRating = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'

/**
 * 评分 → 策略分类
 *
 * 阈值：
 * - ≥ 4.0 → core-scarce（核心稀缺，耐心资本）
 * - ≥ 3.5 → value-bargain（价值洼地，博收益-监控观察）
 * - ≥ 3.2 → hot-momentum（热门动量，博收益-高进高出）
 * - < 3.2 → watch（观察跟踪）
 */
export function scoreToTier(score: number): StrategyClassification | 'watch' {
  if (score >= 4.0) return 'core-scarce'
  if (score >= 3.5) return 'value-bargain'
  if (score >= 3.2) return 'hot-momentum'
  return 'watch'
}

/**
 * 评分 → 评级标签
 *
 * 阈值：
 * - ≥ 4.0 → strong_buy
 * - ≥ 3.5 → buy
 * - ≥ 3.0 → hold
 * - ≥ 2.5 → sell
 * - < 2.5 → strong_sell
 */
export function scoreToRating(score: number): ScoreRating {
  if (score >= 4.0) return 'strong_buy'
  if (score >= 3.5) return 'buy'
  if (score >= 3.0) return 'hold'
  if (score >= 2.5) return 'sell'
  return 'strong_sell'
}

/**
 * 评分 → 资金池归属
 *
 * core-scarce → patient-capital（耐心资本）
 * 其余 → beta-yield（博收益）
 */
export function scoreToCapitalPool(score: number): CapitalPoolId {
  const tier = scoreToTier(score)
  return STRATEGY_TIER_TO_CAPITAL_POOL[tier] ?? 'beta-yield'
}

/**
 * 评分 → 操作策略描述
 */
export function scoreToStrategyDescription(score: number): {
  tier: StrategyClassification | 'watch'
  rating: ScoreRating
  pool: CapitalPoolId
  action: string
} {
  const tier = scoreToTier(score)
  const rating = scoreToRating(score)
  const pool = scoreToCapitalPool(score)

  const actionMap: Record<string, string> = {
    'core-scarce': '长期持有，定期再平衡',
    'value-bargain': '监控观察，设核心观察值，择机建仓',
    'hot-momentum': '高进高出，严格执行止盈止损',
    watch: '观察跟踪，不参与交易',
  }

  return {
    tier,
    rating,
    pool,
    action: actionMap[tier] ?? '观察跟踪',
  }
}
