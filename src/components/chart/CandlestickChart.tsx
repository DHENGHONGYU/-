import {
  forwardRef,
  memo,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  type ISeriesMarkersPluginApi,
} from 'lightweight-charts'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import type { CandlestickChartProps, TooltipData } from './candlestickChart.types'
import {
  PERIOD_OPTIONS,
  ADJUST_OPTIONS,
  MA_OPTIONS,
  toolbarContainerStyle,
  buttonGroupStyle,
  getToolbarButtonStyle,
  maLegendContainerStyle,
  maLegendItemStyle,
  maLegendColorBarStyle,
  tooltipContainerStyle,
  tooltipTimeStyle,
  tooltipValuesStyle,
} from './candlestickChart.config'
import {
  computeMA,
  toCandlestickData,
  toSeriesMarkers,
  buildTimeIndex,
  formatTooltipValuesHTML,
  renderSubChartSeries,
  createCrosshairHandler,
} from './candlestickChart.utils'

// 类型再导出，保持向后兼容
export type { CandlestickChartData, CandlestickChartProps, SubChartType } from './candlestickChart.types'

const CandlestickChart = forwardRef<HTMLDivElement, CandlestickChartProps>(
  (
    {
      data,
      height = 400,
      upColor,
      downColor,
      markers,
      showToolbar = false,
      subChart = 'none',
      showVolume = false,
      macdParams,
      kdjParams,
      period = 'daily',
      adjust = 'qfq',
      onPeriodChange,
      onAdjustChange,
      onSubChartChange: _onSubChartChange,
      ...divProps
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
    const subChartRefs = useRef<Array<ISeriesApi<'Histogram' | 'Line'> | null>>([])
    const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
    const maRefs = useRef<Array<ISeriesApi<'Line'> | null>>([])
    const tooltipRef = useRef<HTMLDivElement>(null)
    const tooltipDataRef = useRef<TooltipData | null>(null)

    const positiveColor = upColor ?? CHART_PALETTE.upColor
    const negativeColor = downColor ?? CHART_PALETTE.downColor

    const updateTooltip = useCallback((data: TooltipData | null) => {
      tooltipDataRef.current = data
      const el = tooltipRef.current
      if (!el) return

      if (!data?.visible) {
        el.style.display = 'none'
        return
      }

      el.style.display = 'block'
      const timeEl = el.querySelector('[data-tooltip-time]')
      if (timeEl) timeEl.textContent = data.time

      const valuesEl = el.querySelector('[data-tooltip-values]')
      if (valuesEl) {
        valuesEl.innerHTML = formatTooltipValuesHTML(data, positiveColor, negativeColor)
      }
    }, [positiveColor, negativeColor])

    const isDailyPeriod = period === 'daily' || period === 'weekly' || period === 'monthly'

    // 向后兼容：如果传入了 showVolume=true 但没有指定 subChart，则使用 volume
    const effectiveSubChart = subChart !== 'none' ? subChart : (showVolume ? 'volume' : subChart)

    useEffect(() => {
      if (!containerRef.current) return

      const chartHeight = showToolbar ? height - 40 : height
      const volumeHeight = effectiveSubChart === 'volume' ? Math.floor(chartHeight * 0.2) : 0
      const priceHeight = chartHeight - volumeHeight

      const chart = createChart(containerRef.current, {
        height: priceHeight,
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
          secondsVisible: false,
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

      series.setData(toCandlestickData(data))

      // 副图渲染
      const subChartSeriesList = renderSubChartSeries(
        chart,
        data,
        effectiveSubChart,
        macdParams,
        kdjParams,
        positiveColor,
        negativeColor,
      )
      subChartRefs.current = subChartSeriesList

      const markersPlugin = createSeriesMarkers(series, [])
      markersRef.current = markersPlugin

      // 均线叠加层（MA5/10/20/60）
      const dataIndex = buildTimeIndex(data)
      const maSeriesList: Array<ISeriesApi<'Line'> | null> = MA_OPTIONS.map(({ period, color }) => {
        const maSeries = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          lineStyle: 0,
        })
        const maData = computeMA(data, period)
        maSeries.setData(maData.filter((d): d is LineData<Time> => d !== null))
        return maSeries
      })
      maRefs.current = maSeriesList

      // OHLCV + 副图指标十字光标浮层（带节流）
      const onCrosshair = createCrosshairHandler(
        series,
        data,
        dataIndex,
        subChartSeriesList,
        effectiveSubChart,
        updateTooltip,
      )
      chart.subscribeCrosshairMove(onCrosshair)

      chart.timeScale().fitContent()

      chartRef.current = chart
      seriesRef.current = series

      return () => {
        chart.remove()
        chartRef.current = null
        seriesRef.current = null
        subChartRefs.current = []
        markersRef.current = null
        maRefs.current = []
      }
    }, [data, height, showToolbar, positiveColor, negativeColor, effectiveSubChart, macdParams, kdjParams, updateTooltip])

    useEffect(() => {
      if (!markersRef.current) return

      if (!markers || markers.length === 0) {
        markersRef.current.setMarkers([])
        return
      }

      markersRef.current.setMarkers(toSeriesMarkers(markers))
    }, [markers])

    if (ref) {
      if (typeof ref === 'function') {
        ref(containerRef.current)
      } else {
        ;(ref as { current: HTMLDivElement | null }).current = containerRef.current
      }
    }

    return (
      <div {...divProps}>
        {showToolbar && (
          <div style={toolbarContainerStyle}>
            {/* 周期切换按钮组 */}
            <div style={buttonGroupStyle}>
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onPeriodChange?.(opt.value)}
                  style={getToolbarButtonStyle(period === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 复权方式选择（仅日级周期可用） */}
            {isDailyPeriod && (
              <div style={buttonGroupStyle}>
                {ADJUST_OPTIONS.map((opt) => (
                  <button
                    key={opt.value || 'none'}
                    onClick={() => onAdjustChange?.(opt.value)}
                    style={getToolbarButtonStyle(adjust === opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          {/* 均线图例（MA5/10/20/60） */}
          <div style={maLegendContainerStyle}>
            {MA_OPTIONS.map(({ period, color }) => (
              <span key={period} style={maLegendItemStyle}>
                <span style={{ ...maLegendColorBarStyle, background: color }} />
                MA{period}
              </span>
            ))}
          </div>

          <div ref={containerRef} style={{ height: showToolbar ? height - 40 : height }} />

          {/* OHLCV 十字光标浮层 */}
          <div ref={tooltipRef} style={tooltipContainerStyle}>
            <div data-tooltip-time style={tooltipTimeStyle} />
            <div data-tooltip-values style={tooltipValuesStyle} />
          </div>
        </div>
      </div>
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
