/**
 * Bollinger Bands 布林带计算引擎
 *
 * 中轨 (MB) = SMA(period)
 * 上轨 (UB) = MB + multiplier × σ
 * 下轨 (LB) = MB - multiplier × σ
 *
 * 其中 σ 为 N 周期收盘价标准差。
 * 布林带用于判断价格波动范围：价格触及上轨→超买，触及下轨→超卖。
 * 带宽收窄（squeeze）预示即将变盘。
 *
 * 专业平台常用配置：period=20, multiplier=2
 *
 * @module components/chart/indicators/bollinger
 * @created 2026-08-15
 */

import type { Time, LineData } from 'lightweight-charts'
import type { CandlestickChartData } from '../types'
import { getLogger } from '@/lib/logger'
import { CHART_INDICATOR_COLORS } from '@/constants/theme.tokens'

const logger = getLogger()

/** Bollinger Bands 计算参数 */
export interface BollingerParams {
  /** 周期（默认 20） */
  period?: number
  /** 标准差倍数（默认 2） */
  multiplier?: number
}

/** Bollinger Bands 计算结果 */
export interface BollingerResult {
  /** 上轨 Upper Band */
  upper: Array<LineData<Time> | null>
  /** 中轨 Middle Band (SMA) */
  middle: Array<LineData<Time> | null>
  /** 下轨 Lower Band */
  lower: Array<LineData<Time> | null>
  /** 带宽 = (upper - lower) / middle × 100，用于 squeeze 检测 */
  bandwidth: Array<LineData<Time> | null>
}

/**
 * 计算 Bollinger Bands
 *
 * @param data K线数据
 * @param params Bollinger 参数
 * @returns Bollinger 计算结果
 */
export function computeBollinger(
  data: CandlestickChartData[],
  params: BollingerParams = {},
): BollingerResult {
  const { period = 20, multiplier = 2 } = params

  logger.info('[BOLL] 开始计算', { dataLength: data.length, period, multiplier })

  if (data.length === 0) {
    logger.warn('[BOLL] 数据为空，返回空结果')
    return { upper: [], middle: [], lower: [], bandwidth: [] }
  }

  const closes = data.map((d) => d.close)

  const upper: Array<LineData<Time> | null> = []
  const middle: Array<LineData<Time> | null> = []
  const lower: Array<LineData<Time> | null> = []
  const bandwidth: Array<LineData<Time> | null> = []

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null)
      middle.push(null)
      lower.push(null)
      bandwidth.push(null)
      continue
    }

    // 计算 SMA
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += closes[j]!
    }
    const sma = sum / period

    // 计算标准差
    let varianceSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += (closes[j]! - sma) ** 2
    }
    const sigma = Math.sqrt(varianceSum / period)

    const ub = sma + multiplier * sigma
    const lb = sma - multiplier * sigma
    const bw = sma !== 0 ? ((ub - lb) / sma) * 100 : 0

    const time = data[i]!.time as Time
    upper.push({ time, value: Number(ub.toFixed(3)) })
    middle.push({ time, value: Number(sma.toFixed(3)) })
    lower.push({ time, value: Number(lb.toFixed(3)) })
    bandwidth.push({ time, value: Number(bw.toFixed(2)) })
  }

  const lastValid = middle.filter((d) => d !== null).length
  logger.info('[BOLL] 计算完成', {
    validPoints: lastValid,
    lastUpper: upper[data.length - 1]?.value.toFixed(3),
    lastMiddle: middle[data.length - 1]?.value.toFixed(3),
    lastLower: lower[data.length - 1]?.value.toFixed(3),
    lastBandwidth: bandwidth[data.length - 1]?.value.toFixed(2),
  })

  return { upper, middle, lower, bandwidth }
}

/** Bollinger Bands 颜色配置（暗色主题） */
export const BOLL_COLORS = {
  /** 上轨 - 浅蓝 */
  upper: CHART_INDICATOR_COLORS.blue,
  /** 中轨（SMA）- 琥珀色 */
  middle: CHART_INDICATOR_COLORS.amber,
  /** 下轨 - 浅蓝 */
  lower: CHART_INDICATOR_COLORS.blue,
  /** 填充区域 - 蓝色 8% 透明 */
  fill: CHART_INDICATOR_COLORS.blue + '14',
} as const

/** 默认 Bollinger 参数 */
export const DEFAULT_BOLL_PARAMS: Required<BollingerParams> = {
  period: 20,
  multiplier: 2,
}