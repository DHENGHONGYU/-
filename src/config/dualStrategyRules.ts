/**
 * 双策略规则配置
 *
 * 集中定义热门板块策略与价值洼地策略的评分阈值、动作阈值、轮动信号条件。
 * 本文件位于 L2 config，禁止依赖 services/apps/pages/components/core。
  * @doc [V9-DOC-BACK-003, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-DATA-021, V9-DOC-QA-010]
*/

export interface DualStrategyRuleConfig {
  /** 热门板块路径：V6 个股评分最低门槛 */
  hotSectorV6Min: number
  /** 热门板块路径：HotSectorScore 立即跟进阈值 */
  hotSectorImmediateThreshold: number
  /** 热门板块路径：HotSectorScore 试探阈值 */
  hotSectorProbeThreshold: number

  /** 价值洼地路径：V6 个股评分下限 */
  valuePitV6Min: number
  /** 价值洼地路径：V6 个股评分上限 */
  valuePitV6Max: number
  /** 价值洼地路径：ValuePitScore 立即建仓阈值 */
  valuePitImmediateThreshold: number
  /** 价值洼地路径：ValuePitScore 试探阈值 */
  valuePitProbeThreshold: number
  /** 价值洼地路径：ValuePitScore 等待轮动信号阈值 */
  valuePitWaitThreshold: number

  /** 轮动信号检测：成交量放大比率（近 5 日均量 / 近 20 日均量） */
  rotationVolumeSurgeRatio: number
  /** 轮动信号检测：资金净流入连续天数 */
  rotationFundFlowConsecutiveDays: number
  /** 轮动信号检测：价格相对 MA20 的上涨幅度 */
  rotationPriceToMA20Threshold: number

  /** 热门板块策略：止损线 */
  hotSectorStopLossPct: number
  /** 热门板块策略：止盈线（触发后卖出比例） */
  hotSectorTakeProfitPct: number
  /** 热门板块策略：止盈触发后卖出仓位比例 */
  hotSectorTakeProfitSellRatio: number

  /** 价值洼地策略：止损线 */
  valuePitStopLossPct: number
  /** 价值洼地策略：止盈线 */
  valuePitTakeProfitPct: number
  /** 价值洼地策略：止盈触发后卖出仓位比例 */
  valuePitTakeProfitSellRatio: number
}

export const DEFAULT_DUAL_STRATEGY_RULE_CONFIG: DualStrategyRuleConfig = {
  hotSectorV6Min: 3.5,
  hotSectorImmediateThreshold: 4.0,
  hotSectorProbeThreshold: 3.5,

  valuePitV6Min: 2.8,
  valuePitV6Max: 3.5,
  valuePitImmediateThreshold: 4.0,
  valuePitProbeThreshold: 3.5,
  valuePitWaitThreshold: 3.0,

  rotationVolumeSurgeRatio: 1.5,
  rotationFundFlowConsecutiveDays: 2,
  rotationPriceToMA20Threshold: 0.03,

  hotSectorStopLossPct: -0.08,
  hotSectorTakeProfitPct: 0.15,
  hotSectorTakeProfitSellRatio: 0.5,

  valuePitStopLossPct: -0.15,
  valuePitTakeProfitPct: 0.2,
  valuePitTakeProfitSellRatio: 0.3,
}

export function getDefaultDualStrategyRuleConfig(): DualStrategyRuleConfig {
  return { ...DEFAULT_DUAL_STRATEGY_RULE_CONFIG }
}
