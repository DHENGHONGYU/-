/**
 * 统一策略配置入口
 *
 * 本文件聚合四分类阈值（strategyRules.ts）和双策略评分阈值（dualStrategyRules.ts），
 * 作为所有策略相关模块的单一导入源。
 *
 * 分工：
 * - strategyRules.ts：四分类（core-scarce / hot-momentum / value-bargain / watchlist）选股阈值
 * - dualStrategyRules.ts：双策略（HotSectorAnalyzer / ValuePitAnalyzer）评分阈值 + 动作阈值
 * - rotationConfig.ts：板块轮动五因子（景气40% / 资金25% / 估值15% / β12% / 量能8%）
 * - tradingConfig.ts：交易风控配置（止盈止损 / 仓位管理）
 * - capitalAllocationConfig.ts：资金管理双轨配置（30%耐心资本 / 70%博收益 + KPI + 大跌应对 + 双因子）
 *
 * 三梯队：core-scarce(第一梯队) > hot-momentum + value-bargain(第二梯队) > watchlist(第三梯队)
  * @doc [V9-DOC-BACK-003, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-DATA-021, V9-DOC-QA-010]
*/

// Re-export 四分类阈值
export {
  DEFAULT_STRATEGY_RULE_CONFIG,
  getDefaultStrategyRuleConfig,
  type StrategyRuleConfig,
} from './strategyRules'

// Re-export 双策略阈值
export {
  DEFAULT_DUAL_STRATEGY_RULE_CONFIG,
  getDefaultDualStrategyRuleConfig,
  type DualStrategyRuleConfig,
} from './dualStrategyRules'

// Re-export 轮动配置
export {
  ROTATION_FACTORS,
  MARKET_STYLES,
  SIGNAL_GRADES,
  SCORE_BUCKETS,
  ALERT_LEVELS,
  THREE_BANS,
  DEFAULT_SECTORS,
  SUB_FACTOR_MAP,
} from './rotationConfig'

// Re-export 资金管理双轨配置（30%耐心资本 / 70%博收益）
export {
  DEFAULT_CAPITAL_ALLOCATION_CONFIG,
  getDefaultCapitalAllocationConfig,
  validateCapitalAllocation,
  STRATEGY_TIER_TO_CAPITAL_POOL,
  type CapitalAllocationConfig,
  type CapitalPoolId,
  type BetaYieldKpiThresholds,
  type DrawdownDisciplineThresholds,
  type DualFactorWeights,
} from './capitalAllocationConfig'