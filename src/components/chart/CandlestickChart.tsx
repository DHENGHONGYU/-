import {
  forwardRef,
  memo,
  useEffect,
  useRef,
  useCallback,
  type ComponentPropsWithoutRef,
} from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type MouseEventHandler,
} from 'lightweight-charts'
import { CHART_PALETTE, THEME_TOKENS } from '@/constants/theme.tokens'
import type { ChartMarker } from '@/types/modules/buySellPoint.types'
import type { KlinePeriod, KlineAdjust } from '@/services/fetcher/fetcherTypes'
import { computeKDJ, KDJ_COLORS, type KDJParams } from './indicators/kdj'
import { computeMACD, MACD_COLORS, type MACDParams, type MACDResult } from './indicators/macd'
import type { CandlestickChartData } from './types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export type { CandlestickChartData }

/** 将 lightweight-charts Time 类型安全转为字符串 */
function timeToString(time: Time): string {
  if (typeof time === 'string') return time
  if (typeof time === 'number') return String(time)
  return `${time.year}-${time.month}-${time.day}`
}

/** 周期选项配置 */
const PERIOD_OPTIONS: Array<{ value: KlinePeriod; label: string; group: 'intraday' | 'daily' }> = [
  { value: '1min', label: '1分', group: 'intraday' },
  { value: '5min', label: '5分', group: 'intraday' },
  { value: '15min', label: '15分', group: 'intraday' },
  { value: '30min', label: '30分', group: 'intraday' },
  { value: '60min', label: '60分', group: 'intraday' },
  { value: 'daily', label: '日线', group: 'daily' },
  { value: 'weekly', label: '周线', group: 'daily' },
  { value: 'monthly', label: '月线', group: 'daily' },
]

/** 复权选项配置 */
const ADJUST_OPTIONS: Array<{ value: KlineAdjust; label: string }> = [
  { value: 'qfq', label: '前复权' },
  { value: 'hfq', label: '后复权' },
  { value: '', label: '不复权' },
]

/** 均线配置（周期 / 颜色 / 是否默认显示） */
const MA_OPTIONS: Array<{ period: number; color: string }> = [
  { period: 5, color: CHART_PALETTE.series1 },
  { period: 10, color: CHART_PALETTE.series2 },
  { period: 20, color: CHART_PALETTE.series3 },
  { period: 60, color: CHART_PALETTE.series4 },
]

/** 计算简单移动平均线（前 period 个数据点不足时返回 undefined） */
function computeMA(data: CandlestickChartData[], period: number): Array<LineData<Time> | null> {
  return data.map((item, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j += 1) sum += data[j]!.close
    return { time: item.time as Time, value: sum / period }
  })
}

/** 副图类型定义 */
export type SubChartType = 'none' | 'volume' | 'macd' | 'kdj'

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
}

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
    const tooltipDataRef = useRef<{
      time: string
      open: number
      high: number
      low: number
      close: number
      volume?: number
      macd?: { dif: number; dea: number; histogram: number }
      kdj?: { k: number; d: number; j: number }
      visible: boolean
    } | null>(null)

    const positiveColor = upColor ?? CHART_PALETTE.upColor
    const negativeColor = downColor ?? CHART_PALETTE.downColor

    const updateTooltip = useCallback((data: typeof tooltipDataRef.current) => {
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
        let html = `
          <span style="color: ${CHART_PALETTE.series3}">开</span>
          <span style="text-align: right">${data.open.toFixed(2)}</span>
          <span style="color: ${CHART_PALETTE.series3}">高</span>
          <span style="text-align: right">${data.high.toFixed(2)}</span>
          <span style="color: ${CHART_PALETTE.series3}">低</span>
          <span style="text-align: right">${data.low.toFixed(2)}</span>
          <span style="color: ${CHART_PALETTE.series3}">收</span>
          <span style="text-align: right; font-weight: 600; color: ${data.close >= data.open ? positiveColor : negativeColor}">${data.close.toFixed(2)}</span>
        `

        if (data.volume !== undefined) {
          html += `
            <span style="color: ${CHART_PALETTE.series3}">量</span>
            <span style="text-align: right">${data.volume.toLocaleString('zh-CN')}</span>
          `
        }

        valuesEl.innerHTML = html
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

      const formattedData: CandlestickData<Time>[] = data.map((item) => ({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }))

      series.setData(formattedData)

      // 副图渲染
      const subChartSeriesList: Array<ISeriesApi<'Histogram' | 'Line'> | null> = []
      let macdResult: MACDResult | null = null

      if (effectiveSubChart === 'volume') {
        // 成交量副图
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        })
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.75, bottom: 0 },
        })

        const volumeData: HistogramData<Time>[] = data
          .filter((item) => item.volume !== undefined && item.volume > 0)
          .map((item) => ({
            time: item.time,
            value: item.volume!,
            color: item.close >= item.open
              ? `${positiveColor}60`
              : `${negativeColor}60`,
          }))

        volumeSeries.setData(volumeData)
        subChartSeriesList.push(volumeSeries)

        logger.info('[CandlestickChart] 成交量副图渲染完成', {
          dataCount: volumeData.length,
        })
      } else if (effectiveSubChart === 'macd') {
        // MACD 副图
        logger.info('[CandlestickChart] 开始渲染 MACD 副图', {
          dataLength: data.length,
          macdParams,
        })

        macdResult = computeMACD(data, macdParams)

        // DIF 线（快线）
        const difSeries = chart.addSeries(LineSeries, {
          priceScaleId: 'macd',
          color: MACD_COLORS.dif,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        difSeries.setData(macdResult.dif.filter((d): d is LineData<Time> => d !== null))
        subChartSeriesList.push(difSeries)

        // DEA 线（信号线）
        const deaSeries = chart.addSeries(LineSeries, {
          priceScaleId: 'macd',
          color: MACD_COLORS.dea,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        deaSeries.setData(macdResult.dea.filter((d): d is LineData<Time> => d !== null))
        subChartSeriesList.push(deaSeries)

        // MACD 柱状图
        const histogramSeries = chart.addSeries(HistogramSeries, {
          priceScaleId: 'macd',
          priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
        })
        histogramSeries.setData(macdResult.histogram.filter((d): d is HistogramData<Time> => d !== null))
        subChartSeriesList.push(histogramSeries)

        // 配置 MACD 副图区域
        chart.priceScale('macd').applyOptions({
          scaleMargins: { top: 0.1, bottom: 0 },
        })

        logger.info('[CandlestickChart] MACD 副图渲染完成', {
          difCount: macdResult.dif.filter(d => d !== null).length,
          deaCount: macdResult.dea.filter(d => d !== null).length,
          histogramCount: macdResult.histogram.filter(d => d !== null).length,
        })
      } else if (effectiveSubChart === 'kdj') {
        // KDJ 副图
        logger.info('[CandlestickChart] 开始渲染 KDJ 副图', {
          dataLength: data.length,
          kdjParams,
        })

        const kdjResult = computeKDJ(data, kdjParams)

        // K 线
        const kSeries = chart.addSeries(LineSeries, {
          priceScaleId: 'kdj',
          color: KDJ_COLORS.k,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        kSeries.setData(kdjResult.k.filter((d): d is LineData<Time> => d !== null))
        subChartSeriesList.push(kSeries)

        // D 线
        const dSeries = chart.addSeries(LineSeries, {
          priceScaleId: 'kdj',
          color: KDJ_COLORS.d,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        dSeries.setData(kdjResult.d.filter((d): d is LineData<Time> => d !== null))
        subChartSeriesList.push(dSeries)

        // J 线
        const jSeries = chart.addSeries(LineSeries, {
          priceScaleId: 'kdj',
          color: KDJ_COLORS.j,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        jSeries.setData(kdjResult.j.filter((d): d is LineData<Time> => d !== null))
        subChartSeriesList.push(jSeries)

        // 配置 KDJ 副图区域
        chart.priceScale('kdj').applyOptions({
          scaleMargins: { top: 0.1, bottom: 0 },
        })

        logger.info('[CandlestickChart] KDJ 副图渲染完成', {
          kCount: kdjResult.k.filter(d => d !== null).length,
          dCount: kdjResult.d.filter(d => d !== null).length,
          jCount: kdjResult.j.filter(d => d !== null).length,
        })
      }

      subChartRefs.current = subChartSeriesList

      const markersPlugin = createSeriesMarkers(series, [])
      markersRef.current = markersPlugin

      // 均线叠加层（MA5/10/20/60）
      const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
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
      let lastCrosshairTime = 0
      const THROTTLE_MS = 16 // 60fps
      
      const processCrosshair = (param: Parameters<MouseEventHandler<Time>>[0]) => {
        if (!param.time || !param.point) {
          updateTooltip(null)
          return
        }
        const bar = param.seriesData.get(series) as CandlestickData<Time> | undefined
        if (!bar) {
          updateTooltip(null)
          return
        }
        const idx = dataIndex.get(timeToString(bar.time))
        const volume = idx !== undefined ? data[idx]?.volume : undefined

        // 获取 MACD 数据（如果副图是 MACD）
        let macd: { dif: number; dea: number; histogram: number } | undefined
        if (effectiveSubChart === 'macd' && subChartSeriesList.length >= 3) {
          const difData = param.seriesData.get(subChartSeriesList[0]!) as LineData<Time> | undefined
          const deaData = param.seriesData.get(subChartSeriesList[1]!) as LineData<Time> | undefined
          const histData = param.seriesData.get(subChartSeriesList[2]!) as HistogramData<Time> | undefined
          if (difData && deaData && histData) {
            macd = {
              dif: difData.value,
              dea: deaData.value,
              histogram: histData.value,
            }
            logger.info('[CandlestickChart] 十字光标 MACD 数据', {
              time: timeToString(bar.time),
              macd,
            })
          }
        }

        // 获取 KDJ 数据（如果副图是 KDJ）
        let kdj: { k: number; d: number; j: number } | undefined
        if (effectiveSubChart === 'kdj' && subChartSeriesList.length >= 3) {
          const kData = param.seriesData.get(subChartSeriesList[0]!) as LineData<Time> | undefined
          const dData = param.seriesData.get(subChartSeriesList[1]!) as LineData<Time> | undefined
          const jData = param.seriesData.get(subChartSeriesList[2]!) as LineData<Time> | undefined
          if (kData && dData && jData) {
            kdj = {
              k: kData.value,
              d: dData.value,
              j: jData.value,
            }
            logger.info('[CandlestickChart] 十字光标 KDJ 数据', {
              time: timeToString(bar.time),
              kdj,
            })
          }
        }

        updateTooltip({
          time: timeToString(bar.time),
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume,
          macd,
          kdj,
          visible: true,
        })
      }
      
      const onCrosshair: MouseEventHandler<Time> = (param) => {
        const now = performance.now()
        const elapsed = now - lastCrosshairTime
        
        // 标准节流：只执行间隔外的第一次调用，间隔内的调用被丢弃
        if (elapsed < THROTTLE_MS) {
          return
        }
        
        lastCrosshairTime = now
        processCrosshair(param)
      }
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
    }, [data, height, positiveColor, negativeColor, effectiveSubChart, macdParams, kdjParams])

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
      <div {...divProps}>
        {showToolbar && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 0',
              flexWrap: 'wrap',
            }}
          >
            {/* 周期切换按钮组 */}
            <div style={{ display: 'flex', gap: '2px', background: `var(--bg2, ${THEME_TOKENS.color.chartCanvasDarkRaw})`, borderRadius: '6px', padding: '2px' }}>
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onPeriodChange?.(opt.value)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: period === opt.value
                      ? `${CHART_PALETTE.accent ?? THEME_TOKENS.color.infoRaw}`
                      : 'transparent',
                    color: period === opt.value
                      ? THEME_TOKENS.color.chartContrastRaw
                      : `var(--muted, ${THEME_TOKENS.color.chartMutedRaw})`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 复权方式选择（仅日级周期可用） */}
            {isDailyPeriod && (
              <div style={{ display: 'flex', gap: '2px', background: `var(--bg2, ${THEME_TOKENS.color.chartCanvasDarkRaw})`, borderRadius: '6px', padding: '2px' }}>
                {ADJUST_OPTIONS.map((opt) => (
                  <button
                    key={opt.value || 'none'}
                    onClick={() => onAdjustChange?.(opt.value)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: adjust === opt.value
                        ? `${CHART_PALETTE.accent ?? THEME_TOKENS.color.infoRaw}`
                        : 'transparent',
                      color: adjust === opt.value
                        ? THEME_TOKENS.color.chartContrastRaw
                        : `var(--muted, ${THEME_TOKENS.color.chartMutedRaw})`,
                      transition: 'all 0.15s ease',
                    }}
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
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 8,
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(4px)',
              fontSize: '0.72rem',
              fontWeight: 500,
              color: `var(--muted, ${THEME_TOKENS.color.chartMutedRaw})`,
              pointerEvents: 'none',
            }}
          >
            {MA_OPTIONS.map(({ period, color }) => (
              <span key={period} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 2, borderRadius: 1, background: color, display: 'inline-block' }} />
                MA{period}
              </span>
            ))}
          </div>

          <div ref={containerRef} style={{ height: showToolbar ? height - 40 : height }} />

          {/* OHLCV 十字光标浮层 */}
          <div
            ref={tooltipRef}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 6,
              minWidth: 150,
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(15,23,42,0.88)',
              backdropFilter: 'blur(6px)',
              border: `1px solid ${CHART_PALETTE.gridLight}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              fontSize: '0.74rem',
              fontFeatureSettings: 'tnum',
              color: `var(--muted, ${THEME_TOKENS.color.chartMutedRaw})`,
              pointerEvents: 'none',
              display: 'none',
            }}
          >
            <div data-tooltip-time style={{ fontWeight: 600, marginBottom: 4, color: THEME_TOKENS.color.chartContrastRaw }} />
            <div data-tooltip-values style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }} />
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
