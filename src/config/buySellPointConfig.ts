/**
 * 买卖点参数配置
 *
 * 集中管理 K 线图买卖点标注与复盘分析所需的所有参数阈值。
 * 与 tradingConfig.ts 的 SignalThresholds 互补：
 * - tradingConfig 侧重交易引擎的信号触发阈值
 * - buySellPointConfig 侧重买卖点标注、分析与复盘的参数管理
 *
 * ## 运行时覆盖机制
 * - `getDefaultBuySellPointConfig()` 返回编译期常量（向后兼容）
 * - `getEffectiveBuySellPointConfig()` 返回"默认值 ∪ 运行时覆盖"
 * - 运行时覆盖经 `thresholds.ts` 的 `updateThresholds({ buySellPoint })` 注入
 *
 * @doc [V9-DOC-BACK-013, V9-DOC-ARCH-007, V9-DOC-ARCH-008, V9-DOC-BACK-005]
 */

import type {
  BuyPointParams,
  BuyPointType,
  SellPointParams,
  SellPointType,
} from '@/types/modules/buySellPoint.types'

// ============================================================
// 买点 / 卖点类型中文名称映射
// ============================================================

export const BUY_POINT_NAMES: Record<BuyPointType, string> = {
  buy_dip: '回踩买点',
  buy_pivot: '突破买点',
  buy_safety_margin: '估值买点',
  buy_breakout: '新高买点',
  composite_buy: '共振买点',
}

export const SELL_POINT_NAMES: Record<SellPointType, string> = {
  sell_profit_taking: '止盈卖点',
  sell_trailing_stop: '移动止损',
  sell_stop_loss: '固定止损',
  composite_sell: '共振卖点',
}

/** 买点颜色（A 股红涨，买点用红色系） */
export const BUY_POINT_COLORS: Record<BuyPointType, string> = {
  buy_dip: '#ef4444',
  buy_pivot: '#f97316',
  buy_safety_margin: '#8b5cf6',
  buy_breakout: '#ec4899',
  composite_buy: '#dc2626',
}

/** 卖点颜色（A 股绿跌，卖点用绿色系） */
export const SELL_POINT_COLORS: Record<SellPointType, string> = {
  sell_profit_taking: '#22c55e',
  sell_trailing_stop: '#10b981',
  sell_stop_loss: '#059669',
  composite_sell: '#16a34a',
}

// ============================================================
// 默认配置
// ============================================================

export function getDefaultBuySellPointConfig() {
  return {
    version: '1.0.0',
    buyPoints: {
      dipToMA20Pct: 8,
      dipRsi14Max: 30,
      pivotVolumeRatioMin: 1.5,
      peMax: 25,
      pbMax: 20,
      breakoutLookbackDays: 20,
    } satisfies BuyPointParams,
    sellPoints: {
      profitTakingToMA20Pct: 15,
      profitTakingRsi14Min: 70,
      fixedStopLossPct: 7,
      trailingStopDrawdownPct: 10,
      trailingStopLookbackDays: 60,
    } satisfies SellPointParams,
  }
}

// ============================================================
// 运行时覆盖层
// ============================================================

export interface BuySellPointOverride {
  buyPoints?: Partial<BuyPointParams>
  sellPoints?: Partial<SellPointParams>
}

let runtimeOverride: BuySellPointOverride = {}

export function setBuySellPointOverride(override: BuySellPointOverride): void {
  runtimeOverride = {
    buyPoints: { ...(runtimeOverride.buyPoints ?? {}), ...(override.buyPoints ?? {}) },
    sellPoints: { ...(runtimeOverride.sellPoints ?? {}), ...(override.sellPoints ?? {}) },
  }
}

export function resetBuySellPointOverride(): void {
  runtimeOverride = {}
}

export function getEffectiveBuySellPointConfig() {
  const base = getDefaultBuySellPointConfig()
  const ov = runtimeOverride
  return {
    version: base.version,
    buyPoints: { ...base.buyPoints, ...(ov.buyPoints ?? {}) },
    sellPoints: { ...base.sellPoints, ...(ov.sellPoints ?? {}) },
  }
}
