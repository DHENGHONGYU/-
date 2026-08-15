/**
 * EMA 指数移动平均线计算引擎
 *
 * EMA(t) = Price(t) × k + EMA(t-1) × (1-k)
 * 其中 k = 2 / (period + 1)
 *
 * 与 SMA 相比，EMA 对近期价格赋予更高权重，反应更灵敏。
 * 专业平台常用配置：EMA12（快线）、EMA26（慢线）、EMA50（中线）
 *
 * @module components/chart/indicators/ema
 * @created 2026-08-15
 */

import type { Time, LineData } from 'lightweight-charts'
import type { CandlestickChartData } from '../types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** EMA 计算参数 */
export interface EMAParams {
  /** 周期（默认 12） */
  period?: number
}

/** EMA 计算结果 */
export interface EMAResult {
  /** EMA 线数据 */
  ema: Array<LineData<Time> | null>
}

/**
 * 计算指数移动平均线（EMA）
 *
 * @param data K线数据
 * @param params EMA 参数
 * @returns EMA 计算结果
 */
export function computeEMA(
  data: CandlestickChartData[],
  params: EMAParams = {},
): EMAResult {
  const { period = 12 } = params

  logger.info('[EMA] 开始计算', { dataLength: data.length, period })

  if (data.length === 0) {
    logger.warn('[EMA] 数据为空，返回空结果')
    return { ema: [] }
  }

  const closes = data.map((d) => d.close)
  const k = 2 / (period + 1)
  const emaValues: number[] = []

  // 初始值使用第一个收盘价
  emaValues.push(closes[0]!)

  for (let i = 1; i < closes.length; i++) {
    emaValues.push(closes[i]! * k + emaValues[i - 1]! * (1 - k))
  }

  const ema: Array<LineData<Time> | null> = data.map((item, i) => ({
    time: item.time,
    value: Number(emaValues[i]!.toFixed(3)),
  }))

  logger.info('[EMA] 计算完成', {
    last: emaValues[emaValues.length - 1]?.toFixed(3),
  })

  return { ema }
}

/**
 * 批量计算多组 EMA（用于 EMA12/EMA26/EMA50 叠加）
 */
export function computeMultiEMA(
  data: CandlestickChartData[],
  periods: number[],
): Array<{ period: number; ema: Array<LineData<Time> | null> }> {
  return periods.map((period) => ({
    period,
    ema: computeEMA(data, { period }).ema,
  }))
}

/**
 * EMA 颜色配置
 * 专业级暗色主题配色：EMA12 青蓝、EMA26 琥珀、EMA50 紫罗兰
 * 对标 TradingView 暗色主题风格，在深色背景下高辨识度
 */
export const EMA_COLORS: Record<number, string> = {
  12: '#60a5fa',  // blue-400
  26: '#fbbf24',  // amber-400
  50: '#a78bfa',  // violet-400
} as const

/** 默认 EMA 周期组 */
export const DEFAULT_EMA_PERIODS = [12, 26, 50] as const