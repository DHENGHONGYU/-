/**
 * 交易引擎配置
 *
 * 所有信号阈值、仓位参数、风控阈值集中在此，禁止引擎层硬编码。
 * 本文件位于 src/config/，禁止依赖 services/、apps/、pages/、components/、core/（除类型外）。
 */

export type SignalDirection = 'buy' | 'sell' | 'hold' | 'watch'

export interface SignalThresholds {
  peBuyPercentile: number
  pbBuyPercentile: number
  peSellPercentile: number
  pbSellPercentile: number
  dipToMA20Pct: number
  dipRsi14Max: number
  pivotVolumeRatioMin: number
  profitTakingToMA20Pct: number
  profitTakingRsi14Min: number
  fixedStopLossPct: number
  trailingStopDrawdownPct: number
}

export interface KellyConfig {
  fraction: number
  defaultWinRate: number
  defaultProfitLossRatio: number
  minPositionPct: number
  maxPositionPct: number
  roundLot: number
}

export interface RiskConfig {
  maxSinglePositionPct: number
  maxTotalPositionPct: number
  maxTradesPerDay: number
  sameSymbolCooldownHours: number
  dataFreshnessHours: number
  portfolioValue: number
}

export interface TradingConfig {
  version: string
  signalThresholds: SignalThresholds
  kelly: KellyConfig
  risk: RiskConfig
}

export function getDefaultTradingConfig(): TradingConfig {
  return {
    version: '0.9.3',
    signalThresholds: {
      peBuyPercentile: 25,
      pbBuyPercentile: 20,
      peSellPercentile: 75,
      pbSellPercentile: 80,
      dipToMA20Pct: 8,
      dipRsi14Max: 30,
      pivotVolumeRatioMin: 1.5,
      profitTakingToMA20Pct: 15,
      profitTakingRsi14Min: 70,
      fixedStopLossPct: 7,
      trailingStopDrawdownPct: 10,
    },
    kelly: {
      fraction: 0.25,
      defaultWinRate: 0.55,
      defaultProfitLossRatio: 1.5,
      minPositionPct: 3,
      maxPositionPct: 15,
      roundLot: 100,
    },
    risk: {
      maxSinglePositionPct: 25,
      maxTotalPositionPct: 80,
      maxTradesPerDay: 5,
      sameSymbolCooldownHours: 24,
      dataFreshnessHours: 48,
      portfolioValue: 1_000_000,
    },
  }
}
