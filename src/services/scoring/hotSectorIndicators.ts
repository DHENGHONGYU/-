/**
 * @fileoverview 热门板块技术指标计算
 *
 * 从 hotSectorAnalyzer.ts 拆分而来，职责：
 * - 实现 MA（简单移动平均）计算
 * - 实现 RSI（相对强弱指数）计算
 *
 * 设计原则：纯函数，无副作用，所有参数从 HOT_SECTOR_THRESHOLDS 注入。
 *
 * @module services/scoring/hotSectorIndicators
 * @created 2026-07-07 - 从 hotSectorAnalyzer.ts 拆分
 */

import { HOT_SECTOR_THRESHOLDS } from '@/config/thresholds'

/**
 * 计算简单移动平均（MA）。
 *
 * @param closes 收盘价序列（按时间升序）
 * @param period 计算周期
 * @returns MA 值，数据不足时返回 undefined
 */
export function computeMA(closes: number[], period: number): number | undefined {
  if (closes.length < period) return undefined
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

/**
 * 计算 RSI（相对强弱指数）。
 *
 * 公式：RSI = RSI_MAX - RSI_MAX / (1 + avgGain / avgLoss)
 *
 * @param closes 收盘价序列（按时间升序）
 * @param period 计算周期，默认从 HOT_SECTOR_THRESHOLDS.RSI_PERIOD 注入
 * @returns RSI 值（0-100），数据不足时返回 undefined
 */
export function computeRSI(
  closes: number[],
  period: number = HOT_SECTOR_THRESHOLDS.RSI_PERIOD,
): number | undefined {
  if (closes.length < period + 1) return undefined
  const window = closes.slice(-(period + 1))
  let gains = 0
  let losses = 0
  for (let i = 1; i < window.length; i++) {
    const delta = window[i]! - window[i - 1]!
    if (delta > 0) gains += delta
    else losses -= delta
  }
  if (losses === HOT_SECTOR_THRESHOLDS.SCORE_MIN)
    return HOT_SECTOR_THRESHOLDS.RSI_MAX
  return (
    HOT_SECTOR_THRESHOLDS.RSI_MAX -
    HOT_SECTOR_THRESHOLDS.RSI_MAX /
      (HOT_SECTOR_THRESHOLDS.RSI_FORMULA_OFFSET + gains / losses)
  )
}
