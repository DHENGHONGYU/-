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
import { CHART_PALETTE_PRO, STOCK_COLOR_TOKENS, CHART_INDICATOR_COLORS } from '@/constants/theme.tokens'
import type { CandlestickChartProps, TooltipData } from './candlestickChart.types'
import {
  PERIOD_OPTIONS,
  ADJUST_OPTIONS,
  MA_OPTIONS,
  EMA_OVERLAY_OPTIONS,
  OVERLAY_OPTIONS,
  toolbarContainerStyle,
  buttonGroupStyle,
  getToolbarButtonStyle,
  maLegendContainerStyle,
  maLegendItemStyle,
  maLegendColorBarStyle,
  tooltipContainerStyle,
  tooltipTimeStyle,
  tooltipValuesStyle,
  PRICE_PULSE_KEYFRAMES,
} from './candlestickChart.config'
import {
  computeMA,
  toCandlestickData,
  toSeriesMarkers,
  buildTimeIndex,
  formatTooltipValuesHTML,
  renderSubChartSeries,
  renderEMAOverlay,
  renderBollingerOverlay,
  renderRSISubChart,
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
      rsiParams,
      overlay = 'none',
      emaParams,
      bollingerParams,
      period = 'daily',
      adjust = 'qfq',
      onPeriodChange,
      onAdjustChange,
      onSubChartChange: _onSubChartChange,
      onOverlayChange,
      ...divProps
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
    const subChartRefs = useRef<Array<ISeriesApi<'Histogram' | 'Line'> | null>>([])
    const overlayRefs = useRef<Array<ISeriesApi<'Line' | 'Area'> | null>>([])
    const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
    const maRefs = useRef<Array<ISeriesApi<'Line'> | null>>([])
    const tooltipRef = useRef<HTMLDivElement>(null)
    const tooltipDataRef = useRef<TooltipData | null>(null)
    const pricePulseRef = useRef<HTMLDivElement>(null)

    // A-share 红涨绿跌（买入红色、卖出绿色）
    const positiveColor = upColor ?? STOCK_COLOR_TOKENS.up.hex
    const negativeColor = downColor ?? STOCK_COLOR_TOKENS.down.hex

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

    // 注入脉冲动画 keyframes
    useEffect(() => {
      const styleId = 'v9-price-pulse-styles'
      if (document.getElementById(styleId)) return
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = PRICE_PULSE_KEYFRAMES
      document.head.appendChild(style)
    }, [])

    useEffect(() => {
      if (!containerRef.current) return

      const chartHeight = showToolbar ? height - 40 : height
      const hasSubChart = effectiveSubChart !== 'none'
      const subChartHeight = hasSubChart ? Math.floor(chartHeight * 0.2) : 0
      const priceHeight = chartHeight - subChartHeight

      const chart = createChart(containerRef.current, {
        height: priceHeight,
        layout: {
          background: { color: CHART_PALETTE_PRO.bg },
          textColor: CHART_PALETTE_PRO.axis,
        },
        grid: {
          vertLines: { color: CHART_PALETTE_PRO.grid, style: 1 },
          horzLines: { color: CHART_PALETTE_PRO.grid, style: 1 },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: CHART_PALETTE_PRO.grid,
            width: 1,
            style: 1,
            labelBackgroundColor: CHART_PALETTE_PRO.bg,
          },
          horzLine: {
            color: CHART_PALETTE_PRO.grid,
            width: 1,
            style: 1,
            labelBackgroundColor: CHART_PALETTE_PRO.bg,
          },
        },
        rightPriceScale: {
          borderColor: CHART_PALETTE_PRO.grid,
          scaleMargins: { top: 0.05, bottom: 0.05 },
        },
        timeScale: {
          borderColor: CHART_PALETTE_PRO.grid,
          timeVisible: true,
          secondsVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        handleScroll: {
          vertTouchDrag: false,
        },
      })

      // 专业级 K 线样式：更宽的实体、更细的影线
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
      let subChartSeriesList: Array<ISeriesApi<'Histogram' | 'Line'> | null> = []
      if (effectiveSubChart === 'rsi') {
        subChartSeriesList = renderRSISubChart(chart, data, rsiParams)
      } else {
        subChartSeriesList = renderSubChartSeries(
          chart,
          data,
          effectiveSubChart,
          macdParams,
          kdjParams,
          positiveColor,
          negativeColor,
        )
      }
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

      // EMA 叠加层
      if (overlay === 'ema' || overlay === 'all') {
        const emaSeriesList = renderEMAOverlay(chart, data, emaParams)
        overlayRefs.current = [...overlayRefs.current, ...emaSeriesList]
      }

      // Bollinger Bands 叠加层
      if (overlay === 'bollinger' || overlay === 'all') {
        const bollSeriesList = renderBollingerOverlay(chart, data, bollingerParams)
        overlayRefs.current = [...overlayRefs.current, ...bollSeriesList]
      }

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

      // ── 高 DPI 自适应：监听容器尺寸变化 ──
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect
          if (w > 0 && h > 0) {
            chart.applyOptions({
              width: w,
              height: hasSubChart ? h - subChartHeight : h,
            })
          }
        }
      })
      resizeObserver.observe(containerRef.current)

      chartRef.current = chart
      seriesRef.current = series

      // 价格变动脉冲动画
      if (data.length >= 2 && pricePulseRef.current) {
        const last = data[data.length - 1]!
        const prev = data[data.length - 2]!
        const isUp = last.close >= prev.close
        const pulseEl = pricePulseRef.current
        pulseEl.style.animation = 'none'
        void pulseEl.offsetWidth // 强制回流
        pulseEl.style.animation = `v9-price-pulse-${isUp ? 'up' : 'down'} 0.6s ease-out`
        pulseEl.style.color = isUp ? positiveColor : negativeColor
      }

      return () => {
        resizeObserver.disconnect()
        chart.remove()
        chartRef.current = null
        seriesRef.current = null
        subChartRefs.current = []
        overlayRefs.current = []
        markersRef.current = null
        maRefs.current = []
      }
    }, [data, height, showToolbar, positiveColor, negativeColor, effectiveSubChart, macdParams, kdjParams, rsiParams, overlay, emaParams, bollingerParams, updateTooltip])

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

    // 图例构建
    const legendItems = [
      ...MA_OPTIONS.map(({ period: p, color }) => ({ label: `MA${p}`, color })),
      ...(overlay === 'ema' || overlay === 'all'
        ? EMA_OVERLAY_OPTIONS.map(({ period: p, color }) => ({ label: `EMA${p}`, color }))
        : []),
      ...(overlay === 'bollinger' || overlay === 'all'
        ? [{ label: 'BOLL', color: CHART_INDICATOR_COLORS.blue }]
        : []),
    ]

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

            {/* 叠加指标切换 */}
            {onOverlayChange && (
              <div style={buttonGroupStyle}>
                {OVERLAY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onOverlayChange(opt.value as typeof overlay)}
                    style={getToolbarButtonStyle(overlay === opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          {/* 均线 + EMA + BOLL 图例 */}
          {legendItems.length > 0 && (
            <div style={maLegendContainerStyle}>
              {legendItems.map(({ label, color }) => (
                <span key={label} style={maLegendItemStyle}>
                  <span style={{ ...maLegendColorBarStyle, background: color }} />
                  {label}
                </span>
              ))}
            </div>
          )}

          <div ref={containerRef} style={{ height: showToolbar ? height - 40 : height }} />

          {/* 最新价格脉冲指示器 */}
          {data.length > 0 && (
            <div
              ref={pricePulseRef}
              style={{
                position: 'absolute',
                bottom: 6,
                right: 8,
                zIndex: 5,
                fontSize: '0.78rem',
                fontWeight: 700,
                fontFeatureSettings: 'tnum',
                fontFamily: 'monospace',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(19,23,34,0.7)',
                backdropFilter: 'blur(4px)',
                color: data[data.length - 1]!.close >= data[data.length - 1]!.open
                  ? positiveColor
                  : negativeColor,
                transition: 'color 0.3s ease',
              }}
            >
              ¥{data[data.length - 1]!.close.toFixed(2)}
            </div>
          )}

          {/* OHLCV + RSI 十字光标浮层 */}
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