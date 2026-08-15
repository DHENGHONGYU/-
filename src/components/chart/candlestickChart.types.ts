/**
 * CandlestickChart 类型定义
 * 从 CandlestickChart.tsx 提取，保持组件文件精简
 */
import type { ComponentPropsWithoutRef } from 'react'
import type { ChartMarker } from '@/types/modules/buySellPoint.types'
import type { KlinePeriod, KlineAdjust } from '@/services/fetcher/fetcherTypes'
import type { KDJParams } from './indicators/kdj'
import type { MACDParams } from './indicators/macd'
import type { RSIParams } from './indicators/rsi'
import type { EMAParams, BollingerParams } from './indicators'
import type { CandlestickChartData } from './types'

export type { CandlestickChartData }

/** 副图类型定义 */
export type SubChartType = 'none' | 'volume' | 'macd' | 'kdj' | 'rsi'

/** 叠加指标类型 */
export type OverlayType = 'none' | 'ema' | 'bollinger' | 'all'

/** 十字光标 tooltip 数据结构 */
export interface TooltipData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
  /** 涨跌幅（相对上一根K线收盘价） */
  changePct?: number
  macd?: { dif: number; dea: number; histogram: number }
  kdj?: { k: number; d: number; j: number }
  rsi?: number
  visible: boolean
}

export interface CandlestickChartProps extends ComponentPropsWithoutRef<'div'> {
  data: CandlestickChartData[]
  height?: number
  upColor?: string
  downColor?: string
  /** 买卖点标注列表，渲染为 K 线图上的 marker */
  markers?: ChartMarker[]
  /** 是否显示周期切换工具栏 */
  showToolbar?: boolean
  /** 副图类型（向后兼容：showVolume=true 等价于 subChart='volume'） */
  subChart?: SubChartType
  /** 是否显示成交量副图（已废弃，请使用 subChart） */
  showVolume?: boolean
  /** MACD 参数（可选） */
  macdParams?: MACDParams
  /** KDJ 参数（可选） */
  kdjParams?: KDJParams
  /** RSI 参数（可选） */
  rsiParams?: RSIParams
  /** 叠加指标类型 */
  overlay?: OverlayType
  /** EMA 参数（可选） */
  emaParams?: EMAParams
  /** Bollinger 参数（可选） */
  bollingerParams?: BollingerParams
  /** 当前K线周期 */
  period?: KlinePeriod
  /** 当前复权方式 */
  adjust?: KlineAdjust
  /** 周期切换回调 */
  onPeriodChange?: (period: KlinePeriod) => void
  /** 复权切换回调 */
  onAdjustChange?: (adjust: KlineAdjust) => void
  /** 副图切换回调 */
  onSubChartChange?: (subChart: SubChartType) => void
  /** 叠加指标切换回调 */
  onOverlayChange?: (overlay: OverlayType) => void
}
