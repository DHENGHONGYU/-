/**
 * MACD 指标计算引擎
 * 
 * MACD (Moving Average Convergence Divergence) 指标计算
 * - DIF (快线): EMA(12) - EMA(26)
 * - DEA (信号线): EMA(DIF, 9)
 * - MACD 柱状: (DIF - DEA) × 2
 * 
 * @see https://en.wikipedia.org/wiki/MACD
 */

import type { Time, LineData, HistogramData } from 'lightweight-charts'
import { COLOR_SHADES, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import type { CandlestickChartData } from '../types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** MACD 计算参数 */
export interface MACDParams {
  /** 快线周期（默认 12） */
  fastPeriod?: number
  /** 慢线周期（默认 26） */
  slowPeriod?: number
  /** 信号线周期（默认 9） */
  signalPeriod?: number
}

/** MACD 计算结果 */
export interface MACDResult {
  /** DIF 线数据 */
  dif: Array<LineData<Time> | null>
  /** DEA 线数据 */
  dea: Array<LineData<Time> | null>
  /** MACD 柱状数据 */
  histogram: Array<HistogramData<Time> | null>
}

/**
 * 计算指数移动平均线（EMA）
 * 
 * EMA(t) = Price(t) × k + EMA(t-1) × (1-k)
 * 其中 k = 2 / (period + 1)
 */
function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return []
  
  const k = 2 / (period + 1)
  const ema: number[] = []
  
  // 初始值使用第一个数据点
  ema[0] = values[0]!
  
  for (let i = 1; i < values.length; i++) {
    ema[i] = values[i]! * k + ema[i - 1]! * (1 - k)
  }
  
  return ema
}

/**
 * 计算 MACD 指标
 * 
 * @param data K线数据
 * @param params MACD 参数（可选）
 * @returns MACD 计算结果
 * 
 * @example
 * ```typescript
 * const result = computeMACD(klineData, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 })
 * // result.dif - DIF 线
 * // result.dea - DEA 线
 * // result.histogram - MACD 柱状
 * ```
 */
export function computeMACD(
  data: CandlestickChartData[],
  params: MACDParams = {},
): MACDResult {
  const { fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = params
  
  logger.info('[MACD] 开始计算', {
    dataLength: data.length,
    fastPeriod,
    slowPeriod,
    signalPeriod,
  })
  
  if (data.length === 0) {
    logger.warn('[MACD] 数据为空，返回空结果')
    return { dif: [], dea: [], histogram: [] }
  }
  
  // 提取收盘价序列
  const closes = data.map((d) => d.close)
  
  // 计算快线和慢线的 EMA
  const emaFast = computeEMA(closes, fastPeriod)
  const emaSlow = computeEMA(closes, slowPeriod)
  
  // 计算 DIF = EMA(fast) - EMA(slow)
  const difValues: number[] = []
  for (let i = 0; i < closes.length; i++) {
    difValues.push(emaFast[i]! - emaSlow[i]!)
  }
  
  // 计算 DEA = EMA(DIF, signalPeriod)
  const deaValues = computeEMA(difValues, signalPeriod)
  
  // 计算 MACD 柱状 = (DIF - DEA) × 2
  const histogramValues: number[] = []
  for (let i = 0; i < difValues.length; i++) {
    histogramValues.push((difValues[i]! - deaValues[i]!) * 2)
  }
  
  logger.info('[MACD] 计算完成', {
    difLast: difValues[difValues.length - 1]?.toFixed(4),
    deaLast: deaValues[deaValues.length - 1]?.toFixed(4),
    histogramLast: histogramValues[histogramValues.length - 1]?.toFixed(4),
  })
  
  // 转换为 lightweight-charts 数据格式
  const dif: Array<LineData<Time> | null> = data.map((item, i) => ({
    time: item.time,
    value: difValues[i]!,
  }))
  
  const dea: Array<LineData<Time> | null> = data.map((item, i) => ({
    time: item.time,
    value: deaValues[i]!,
  }))
  
  const histogram: Array<HistogramData<Time> | null> = data.map((item, i) => ({
    time: item.time,
    value: histogramValues[i]!,
    color: histogramValues[i]! >= 0 ? '#ef444480' : '#22c55e80',
  }))
  
  return { dif, dea, histogram }
}

/**
 * 获取 MACD 最新值（用于实时显示）
 */
export function getLatestMACD(
  data: CandlestickChartData[],
  params: MACDParams = {},
): { dif: number; dea: number; histogram: number } | null {
  const result = computeMACD(data, params)
  
  if (result.dif.length === 0) return null
  
  const lastDif = result.dif[result.dif.length - 1]
  const lastDea = result.dea[result.dea.length - 1]
  const lastHistogram = result.histogram[result.histogram.length - 1]
  
  if (!lastDif || !lastDea || !lastHistogram) return null
  
  return {
    dif: lastDif.value,
    dea: lastDea.value,
    histogram: lastHistogram.value,
  }
}

/**
 * MACD 颜色配置
 */
export const MACD_COLORS = {
  dif: COLOR_SHADES.blue[500], // DIF 线颜色：蓝色
  dea: COLOR_SHADES.orange[500], // DEA 线颜色：橙色
  histogramPositive: STOCK_COLOR_TOKENS.up.hexAlpha50, // 正值柱状：股票上涨红色半透明
  histogramNegative: STOCK_COLOR_TOKENS.down.hexAlpha50, // 负值柱状：股票下跌绿色半透明
} as const
