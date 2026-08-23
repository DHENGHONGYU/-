/**
 * RSI 相对强弱指标计算引擎
 *
 * RSI = 100 - (100 / (1 + RS))
 * 其中 RS = 平均上涨幅度 / 平均下跌幅度
 *
 * RSI 范围 0-100，用于判断超买超卖：
 * - RSI > 70：超买（可能回调）
 * - RSI < 30：超卖（可能反弹）
 * - RSI 50 为多空分界线
 *
 * 专业平台常用配置：period=14（Wilder 平滑法）
 *
 * @module components/chart/indicators/rsi
 * @created 2026-08-15
 */

import type { Time, LineData } from 'lightweight-charts'
import type { CandlestickChartData } from '../types'
import { getLogger } from '@/lib/logger'
import { CHART_INDICATOR_COLORS, COLOR_SHADES } from '@/constants/theme.tokens'
import { hexToRgba } from '@/lib/utils'

const logger = getLogger()

/** RSI 计算参数 */
export interface RSIParams {
  /** 周期（默认 14） */
  period?: number
}

/** RSI 计算结果 */
export interface RSIResult {
  /** RSI 线数据 */
  rsi: Array<LineData<Time> | null>
}

/**
 * 计算 RSI 指标
 * 使用 Wilder 平滑法（与 TradingView 一致）
 *
 * @param data K线数据
 * @param params RSI 参数
 * @returns RSI 计算结果
 */
export function computeRSI(
  data: CandlestickChartData[],
  params: RSIParams = {},
): RSIResult {
  const { period = 14 } = params

  logger.info('[RSI] 开始计算', { dataLength: data.length, period })

  if (data.length < period + 1) {
    logger.warn('[RSI] 数据不足，返回空结果', { dataLength: data.length, period })
    return { rsi: [] }
  }

  const closes = data.map((d) => d.close)

  // 计算每日涨跌幅度
  const gains: number[] = []
  const losses: number[] = []

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? -diff : 0)
  }

  // Wilder 平滑法：初始平均值使用 SMA
  let avgGain = 0
  let avgLoss = 0

  for (let i = 0; i < period; i++) {
    avgGain += gains[i]!
    avgLoss += losses[i]!
  }
  avgGain /= period
  avgLoss /= period

  const rsiValues: Array<number | null> = []

  // 前 period 个数据点标记为 null（预热期）
  for (let i = 0; i < period; i++) {
    rsiValues.push(null)
  }

  // 第一个 RSI 值
  if (avgLoss === 0) {
    rsiValues.push(100)
  } else {
    const rs = avgGain / avgLoss
    rsiValues.push(100 - 100 / (1 + rs))
  }

  // 后续值使用 Wilder 平滑
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]!) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]!) / period

    if (avgLoss === 0) {
      rsiValues.push(100)
    } else {
      const rs = avgGain / avgLoss
      rsiValues.push(100 - 100 / (1 + rs))
    }
  }

  const rsi: Array<LineData<Time> | null> = data.map((item, i) => {
    if (i === 0 || rsiValues[i] === null) return null
    return { time: item.time as Time, value: Number(rsiValues[i]!.toFixed(2)) }
  })

  const lastValid = rsi.filter((d) => d !== null)
  logger.info('[RSI] 计算完成', {
    validPoints: lastValid.length,
    last: lastValid[lastValid.length - 1]?.value.toFixed(2),
  })

  return { rsi }
}

/**
 * RSI 颜色配置（暗色主题）
 * 对标 TradingView RSI 指标配色
 */
export const RSI_COLORS = {
  /** RSI 线 - 紫色（TradingView 默认） */
  line: CHART_INDICATOR_COLORS.violet,
  /** 超买线 (70) - 红色 */
  overbought: CHART_INDICATOR_COLORS.rsiOverbought,
  /** 超卖线 (30) - 绿色 */
  oversold: CHART_INDICATOR_COLORS.rsiOversold,
  /** 中轴线 (50) - 半透明灰 */
  midline: hexToRgba(COLOR_SHADES.slate.hex[400], 0.4),
} as const

/** 默认 RSI 参数 */
export const DEFAULT_RSI_PARAMS: Required<RSIParams> = {
  period: 14,
}
