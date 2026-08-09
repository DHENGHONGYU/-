import {
  forwardRef,
  memo,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
} from 'react'
import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
} from 'lightweight-charts'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import type { ChartMarker } from '@/types/modules/buySellPoint.types'

export interface CandlestickChartData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface CandlestickChartProps extends ComponentPropsWithoutRef<'div'> {
  data: CandlestickChartData[]
  height?: number
  upColor?: string
  downColor?: string
  /** 买卖点标注列表，渲染为 K 线图上的 marker */
  markers?: ChartMarker[]
}

const CandlestickChart = forwardRef<HTMLDivElement, CandlestickChartProps>(
  ({ data, height = 400, upColor, downColor, markers, ...divProps }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
    const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

    const positiveColor = upColor ?? CHART_PALETTE.upColor
    const negativeColor = downColor ?? CHART_PALETTE.downColor

    useEffect(() => {
      if (!containerRef.current) return

      const chart = createChart(containerRef.current, {
        height,
        layout: {
          background: { color: 'transparent' },
          textColor: CHART_PALETTE.axis,
        },
        grid: {
          vertLines: { color: CHART_PALETTE.gridLight },
          horzLines: { color: CHART_PALETTE.gridLight },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: CHART_PALETTE.accent,
            width: 1,
            style: 2,
          },
          horzLine: {
            color: CHART_PALETTE.accent,
            width: 1,
            style: 2,
          },
        },
        rightPriceScale: {
          borderColor: CHART_PALETTE.gridLight,
        },
        timeScale: {
          borderColor: CHART_PALETTE.gridLight,
          timeVisible: true,
        },
      })

      const series = chart.addSeries(CandlestickSeries, {
        upColor: positiveColor,
        downColor: negativeColor,
        borderUpColor: positiveColor,
        borderDownColor: negativeColor,
        wickUpColor: positiveColor,
        wickDownColor: negativeColor,
      })

      const formattedData: CandlestickData<Time>[] = data.map((item) => ({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }))

      series.setData(formattedData)

      const markersPlugin = createSeriesMarkers(series, [])
      markersRef.current = markersPlugin

      chart.timeScale().fitContent()

      chartRef.current = chart
      seriesRef.current = series

      return () => {
        chart.remove()
        chartRef.current = null
        seriesRef.current = null
        markersRef.current = null
      }
    }, [data, height, positiveColor, negativeColor])

    useEffect(() => {
      if (!markersRef.current) return

      if (!markers || markers.length === 0) {
        markersRef.current.setMarkers([])
        return
      }

      const chartMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
        time: m.time,
        position: m.position,
        shape: m.shape,
        color: m.color,
        text: m.text,
        size: m.size,
      }))
      markersRef.current.setMarkers(chartMarkers)
    }, [markers])

    if (ref) {
      if (typeof ref === 'function') {
        ref(containerRef.current)
      } else {
        ;(ref as { current: HTMLDivElement | null }).current = containerRef.current
      }
    }

    return (
      <div ref={containerRef} style={{ height }} {...divProps} />
    )
  }
)

CandlestickChart.displayName = 'CandlestickChart'

const CandlestickChartMemo = memo(CandlestickChart)
CandlestickChartMemo.displayName = 'CandlestickChart'
/**
 * CandlestickSeriesChart
 */
export const CandlestickSeriesChart = CandlestickChartMemo
export { CandlestickSeriesChart as CandlestickChart }
export default CandlestickChartMemo
