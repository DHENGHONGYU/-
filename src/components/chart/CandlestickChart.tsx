import {
  forwardRef,
  memo,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type RefObject,
} from 'react'
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type Time } from 'lightweight-charts'

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
}

const CandlestickChart = forwardRef<HTMLDivElement, CandlestickChartProps>(
  ({ data, height = 400, upColor, downColor, ...divProps }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

    // 涨跌色默认值
    const positiveColor = upColor ?? 'hsl(152, 60%, 45%)'
    const negativeColor = downColor ?? 'hsl(0, 65%, 55%)'

    useEffect(() => {
      if (!containerRef.current) return

      // 创建图表
      const chart = createChart(containerRef.current, {
        height,
        layout: {
          background: { color: 'transparent' },
          textColor: 'hsl(220, 9%, 46%)',
        },
        grid: {
          vertLines: { color: 'hsl(220, 13%, 91%)' },
          horzLines: { color: 'hsl(220, 13%, 91%)' },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: 'hsl(195, 85%, 42%)',
            width: 1,
            style: 2,
          },
          horzLine: {
            color: 'hsl(195, 85%, 42%)',
            width: 1,
            style: 2,
          },
        },
        rightPriceScale: {
          borderColor: 'hsl(220, 13%, 91%)',
        },
        timeScale: {
          borderColor: 'hsl(220, 13%, 91%)',
          timeVisible: true,
        },
      })

      // 添加 K 线系列
      const series = chart.addSeries(CandlestickSeries, {
        upColor: positiveColor,
        downColor: negativeColor,
        borderUpColor: positiveColor,
        borderDownColor: negativeColor,
        wickUpColor: positiveColor,
        wickDownColor: negativeColor,
      })

      // 格式化数据
      const formattedData: CandlestickData<Time>[] = data.map((item) => ({
        time: item.time as Time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }))

      series.setData(formattedData)

      // 适应窗口
      chart.timeScale().fitContent()

      chartRef.current = chart
      seriesRef.current = series

      // 清理
      return () => {
        chart.remove()
        chartRef.current = null
        seriesRef.current = null
      }
    }, [data, height, positiveColor, negativeColor])

    // 转发 ref
    if (ref) {
      if (typeof ref === 'function') {
        ref(containerRef.current)
      } else {
        ;(ref as RefObject<HTMLDivElement | null>).current = containerRef.current
      }
    }

    return (
      <div ref={containerRef} style={{ height }} {...divProps} />
    )
  }
)

CandlestickChart.displayName = 'CandlestickChart'

// 同时导出 named + default
const CandlestickChartMemo = memo(CandlestickChart)
CandlestickChartMemo.displayName = 'CandlestickChart'
export const CandlestickSeriesChart = CandlestickChartMemo
export { CandlestickSeriesChart as CandlestickChart }
export default CandlestickChartMemo
