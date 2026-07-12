/**
 * 策略规则配置
 *
 * 集中定义 v6-pro-cockpit 核心稀缺策略的选股阈值：
 * - 20 进 13 筛选规则
 * - 价值洼地判定
 * - 热门追涨判定
 *
 * 本文件位于 L2 config，禁止依赖 services/apps/pages/components/core。
 */

export interface StrategyRuleConfig {
  /** R1：综合分最低门槛（默认 3.6） */
  compositeMin: number
  /** R2：低估值过滤阈值；估值分低于该值且综合分未达豁免线则剔除 */
  lowValuationThreshold: number
  /** R2：低估值豁免综合分；综合分 ≥ 该值时，即使估值低也不剔除 */
  lowValuationCompositeExempt: number
  /** R3：价值洼地型最低估值分 */
  valueBargainValuationMin: number
  /** R3：价值洼地型最低综合分 */
  valueBargainCompositeMin: number
  /** 热门板块数量 TOP N */
  hotMomentumTopSectors: number
  /** 热门追涨最小动量（priceToMA20） */
  hotMomentumMinMomentum: number
  /** 20 进 13：最终入选标的数量上限 */
  selectedMaxCount: number
}

export const DEFAULT_STRATEGY_RULE_CONFIG: StrategyRuleConfig = {
  compositeMin: 3.6,
  lowValuationThreshold: 2.5,
  lowValuationCompositeExempt: 4.0,
  valueBargainValuationMin: 4.0,
  valueBargainCompositeMin: 3.6,
  hotMomentumTopSectors: 5,
  hotMomentumMinMomentum: 0.05,
  selectedMaxCount: 13,
}

export function getDefaultStrategyRuleConfig(): StrategyRuleConfig {
  return { ...DEFAULT_STRATEGY_RULE_CONFIG }
}
