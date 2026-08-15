import type { ComponentPropsWithoutRef, RefObject } from 'react'
import type {
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts'
import type { ChartMarker } from '@/types/modules/buySellPoint.types'
import type { KlinePeriod, KlineAdjust } from '@/services/fetcher/fetcherTypes'
import type { KDJParams, KDJResult } from './indicators/kdj'
import type { MACDParams, MACDResult } from './indicators/macd'
import type { RSIParams, RSIResult } from './indicators/rsi'
import type { CandlestickChartData } from './types'

/** Tooltip 数据类型 */
export interface TooltipData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
  changePct?: number
  macd?: { dif: number; dea: number; histogram: number }
  kdj?: { k: number; d: number; j: number }
  rsi?: number
  visible: boolean
}

/** Tooltip 组件 Props */
export interface ChartTooltipProps {
  data: TooltipData | null
  positiveColor: string
  negativeColor: string
}

export interface MultiPaneChartProps extends ComponentPropsWithoutRef<'div'> {
  data: CandlestickChartData[]
  height?: number
  upColor?: string
  downColor?: string
  markers?: ChartMarker[]
  showToolbar?: boolean
  /** 是否显示 MACD 副图 */
  showMACD?: boolean
  /** 是否显示 KDJ 副图 */
  showKDJ?: boolean
  /** 是否显示 RSI 副图 */
  showRSI?: boolean
  /** MACD 参数 */
  macdParams?: MACDParams
  /** KDJ 参数 */
  kdjParams?: KDJParams
  /** RSI 参数 */
  rsiParams?: RSIParams
  period?: KlinePeriod
  adjust?: KlineAdjust
  onPeriodChange?: (period: KlinePeriod) => void
  onAdjustChange?: (adjust: KlineAdjust) => void
}

/** 主图窗格创建结果 */
export interface MainChartPaneResult {
  mainChart: IChartApi
  mainSeries: ISeriesApi<'Candlestick'>
  maSeriesList: Array<ISeriesApi<'Line'> | null>
}

/** MACD 副图窗格创建结果 */
export interface MacdChartPaneResult {
  macdChart: IChartApi
  macdResult: MACDResult
  macdSeriesList: Array<ISeriesApi<'Line' | 'Histogram'> | null>
}

/** KDJ 副图窗格创建结果 */
export interface KdjChartPaneResult {
  kdjChart: IChartApi
  kdjResult: KDJResult
  kdjSeriesList: Array<ISeriesApi<'Line'> | null>
}

/** RSI 副图窗格创建结果 */
export interface RsiChartPaneResult {
  rsiChart: IChartApi
  rsiResult: RSIResult
  rsiSeriesList: Array<ISeriesApi<'Line'> | null>
}

/** 十字光标处理器选项 */
export interface CrosshairHandlerOptions {
  mainSeries: ISeriesApi<'Candlestick'>
  data: CandlestickChartData[]
  dataIndex: Map<string, number>
  showMACD: boolean
  showKDJ: boolean
  showRSI: boolean
  macdResultRef: RefObject<MACDResult | null>
  kdjResultRef: RefObject<KDJResult | null>
  rsiResultRef: RefObject<RSIResult | null>
  macdChart: IChartApi | null
  kdjChart: IChartApi | null
  rsiChart: IChartApi | null
  macdSeriesList: Array<ISeriesApi<'Line' | 'Histogram'> | null>
  kdjSeriesList: Array<ISeriesApi<'Line'> | null>
  rsiSeriesList: Array<ISeriesApi<'Line'> | null>
  updateTooltip: (data: TooltipData | null) => void
}