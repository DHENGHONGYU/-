import {
  forwardRef,
  memo,
  useEffect,
  useRef,
  useState,
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

/** 均线配置 */
const MA_OPTIONS: Array<{ period: number; color: string }> = [
  { period: 5, color: CHART_PALETTE.series1 },
  { period: 10, color: CHART_PALETTE.series2 },
  { period: 20, color: CHART_PALETTE.series3 },
  { period: 60, color: CHART_PALETTE.series4 },
]

/** 计算简单移动平均线 */
function computeMA(data: CandlestickChartData[], period: number): Array<LineData<Time> | null> {
  return data.map((item, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j += 1) sum += data[j]!.close
    return { time: item.time as Time, value: sum / period }
  })
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
  /** MACD 参数 */
  macdParams?: MACDParams
  /** KDJ 参数 */
  kdjParams?: KDJParams
  period?: KlinePeriod
  adjust?: KlineAdjust
  onPeriodChange?: (period: KlinePeriod) => void
  onAdjustChange?: (adjust: KlineAdjust) => void
}

const MultiPaneChart = forwardRef<HTMLDivElement, MultiPaneChartProps>(
  (
    {
      data,
      height = 600,
      upColor,
      downColor,
      markers,
      showToolbar = false,
      showMACD = false,
      showKDJ = false,
      macdParams,
      kdjParams,
      period = 'daily',
      adjust = 'qfq',
      onPeriodChange,
      onAdjustChange,
      ...divProps
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const mainChartRef = useRef<IChartApi | null>(null)
    const macdChartRef = useRef<IChartApi | null>(null)
    const kdjChartRef = useRef<IChartApi | null>(null)
    
    const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
    const mainMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
    const maSeriesRefs = useRef<Array<ISeriesApi<'Line'> | null>>([])
    
    const macdResultRef = useRef<MACDResult | null>(null)
    const kdjResultRef = useRef<ReturnType<typeof computeKDJ> | null>(null)
    
    const [tooltip, setTooltip] = useState<{
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
    const isDailyPeriod = period === 'daily' || period === 'weekly' || period === 'monthly'

    // 计算各 pane 高度
    const toolbarHeight = showToolbar ? 40 : 0
    const availableHeight = height - toolbarHeight
    const mainPaneHeight = Math.floor(availableHeight * 0.5)
    const subPaneHeight = Math.floor(availableHeight * 0.25)

    useEffect(() => {
      if (!containerRef.current) return

      if (process.env.NODE_ENV === 'development') {
        console.log('[MultiPaneChart] 初始化多窗格图表', {
          showMACD,
          showKDJ,
          dataLength: data.length,
        })
      }

      // ===== 主 K 线图 =====
      const mainContainer = document.createElement('div')
      mainContainer.style.height = `${mainPaneHeight}px`
      containerRef.current.appendChild(mainContainer)

      const mainChart = createChart(mainContainer, {
        height: mainPaneHeight,
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

      const mainSeries = mainChart.addSeries(CandlestickSeries, {
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
      mainSeries.setData(formattedData)

      // 均线
      const maSeriesList: Array<ISeriesApi<'Line'> | null> = MA_OPTIONS.map(({ period, color }) => {
        const maSeries = mainChart.addSeries(LineSeries, {
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
      maSeriesRefs.current = maSeriesList

      // ===== MACD 副图 =====
      let macdChart: IChartApi | null = null
      let macdSeriesList: Array<ISeriesApi<'Line' | 'Histogram'> | null> = []
      
      if (showMACD) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[MultiPaneChart] 创建 MACD 副图窗格', {
            dataLength: data.length,
            macdParams,
          })
        }

        const macdContainer = document.createElement('div')
        macdContainer.style.height = `${subPaneHeight}px`
        containerRef.current.appendChild(macdContainer)

        macdChart = createChart(macdContainer, {
          height: subPaneHeight,
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
            visible: false, // 隐藏时间轴，与主图同步
          },
        })

        const macdResult = computeMACD(data, macdParams)
        macdResultRef.current = macdResult

        // DIF 线
        const difSeries = macdChart.addSeries(LineSeries, {
          color: MACD_COLORS.dif,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        difSeries.setData(macdResult.dif.filter((d): d is LineData<Time> => d !== null))
        macdSeriesList.push(difSeries)

        // DEA 线
        const deaSeries = macdChart.addSeries(LineSeries, {
          color: MACD_COLORS.dea,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        deaSeries.setData(macdResult.dea.filter((d): d is LineData<Time> => d !== null))
        macdSeriesList.push(deaSeries)

        // MACD 柱状
        const histogramSeries = macdChart.addSeries(HistogramSeries, {
          priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
        })
        histogramSeries.setData(macdResult.histogram.filter((d): d is HistogramData<Time> => d !== null))
        macdSeriesList.push(histogramSeries)

        if (process.env.NODE_ENV === 'development') {
          console.log('[MultiPaneChart] MACD 副图创建完成', {
            difCount: macdResult.dif.filter(d => d !== null).length,
            deaCount: macdResult.dea.filter(d => d !== null).length,
            histogramCount: macdResult.histogram.filter(d => d !== null).length,
          })
        }
      }

      // ===== KDJ 副图 =====
      let kdjChart: IChartApi | null = null
      let kdjSeriesList: Array<ISeriesApi<'Line'> | null> = []
      
      if (showKDJ) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[MultiPaneChart] 创建 KDJ 副图窗格', {
            dataLength: data.length,
            kdjParams,
          })
        }

        const kdjContainer = document.createElement('div')
        kdjContainer.style.height = `${subPaneHeight}px`
        containerRef.current.appendChild(kdjContainer)

        kdjChart = createChart(kdjContainer, {
          height: subPaneHeight,
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
            visible: false,
          },
        })

        const kdjResult = computeKDJ(data, kdjParams)
        kdjResultRef.current = kdjResult

        // K 线
        const kSeries = kdjChart.addSeries(LineSeries, {
          color: KDJ_COLORS.k,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        kSeries.setData(kdjResult.k.filter((d): d is LineData<Time> => d !== null))
        kdjSeriesList.push(kSeries)

        // D 线
        const dSeries = kdjChart.addSeries(LineSeries, {
          color: KDJ_COLORS.d,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        dSeries.setData(kdjResult.d.filter((d): d is LineData<Time> => d !== null))
        kdjSeriesList.push(dSeries)

        // J 线
        const jSeries = kdjChart.addSeries(LineSeries, {
          color: KDJ_COLORS.j,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        jSeries.setData(kdjResult.j.filter((d): d is LineData<Time> => d !== null))
        kdjSeriesList.push(jSeries)

        if (process.env.NODE_ENV === 'development') {
          console.log('[MultiPaneChart] KDJ 副图创建完成', {
            kCount: kdjResult.k.filter(d => d !== null).length,
            dCount: kdjResult.d.filter(d => d !== null).length,
            jCount: kdjResult.j.filter(d => d !== null).length,
          })
        }
      }

      // ===== 十字光标联动（带节流） =====
      const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))
      let lastCrosshairTime = 0
      const THROTTLE_MS = 16 // 60fps
      
      const processCrosshair = (param: Parameters<MouseEventHandler<Time>>[0]) => {
        if (!param.time || !param.point) {
          setTooltip((t) => (t ? { ...t, visible: false } : null))
          if (macdChart) macdChart.clearCrosshairPosition()
          if (kdjChart) kdjChart.clearCrosshairPosition()
          return
        }

        const bar = param.seriesData.get(mainSeries) as CandlestickData<Time> | undefined
        if (!bar) {
          setTooltip((t) => (t ? { ...t, visible: false } : null))
          return
        }

        const idx = dataIndex.get(String(bar.time))
        const volume = idx !== undefined ? data[idx]?.volume : undefined

        // 获取 MACD 数据
        let macd: { dif: number; dea: number; histogram: number } | undefined
        if (showMACD && macdResultRef.current && idx !== undefined) {
          const macdData = macdResultRef.current
          const difPoint = macdData.dif[idx]
          const deaPoint = macdData.dea[idx]
          const histPoint = macdData.histogram[idx]
          if (difPoint && deaPoint && histPoint) {
            macd = {
              dif: difPoint.value,
              dea: deaPoint.value,
              histogram: histPoint.value,
            }
          }
          
          // 同步 MACD 副图十字光标
          if (macdChart && macdSeriesList.length > 0 && difPoint) {
            macdChart.setCrosshairPosition(difPoint.value, bar.time, macdSeriesList[0]!)
          }
        }

        // 获取 KDJ 数据
        let kdj: { k: number; d: number; j: number } | undefined
        if (showKDJ && kdjResultRef.current && idx !== undefined) {
          const kdjData = kdjResultRef.current
          const kPoint = kdjData.k[idx]
          const dPoint = kdjData.d[idx]
          const jPoint = kdjData.j[idx]
          if (kPoint && dPoint && jPoint) {
            kdj = {
              k: kPoint.value,
              d: dPoint.value,
              j: jPoint.value,
            }
          }
          
          // 同步 KDJ 副图十字光标
          if (kdjChart && kdjSeriesList.length > 0 && kPoint) {
            kdjChart.setCrosshairPosition(kPoint.value, bar.time, kdjSeriesList[0]!)
          }
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[MultiPaneChart] 十字光标联动', {
            time: String(bar.time),
            macd: macd ? '✓' : '✗',
            kdj: kdj ? '✓' : '✗',
          })
        }

        setTooltip({
          time: String(bar.time),
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
      
      const onMainCrosshair: MouseEventHandler<Time> = (param) => {
        const now = performance.now()
        const elapsed = now - lastCrosshairTime
        
        if (elapsed >= THROTTLE_MS) {
          // 超过节流间隔，立即执行
          lastCrosshairTime = now
          processCrosshair(param)
        } else {
          // 未超过节流间隔，延迟执行
          setTimeout(() => {
            lastCrosshairTime = performance.now()
            processCrosshair(param)
          }, THROTTLE_MS - elapsed)
        }
      }

      mainChart.subscribeCrosshairMove(onMainCrosshair)

      // ===== TimeScale 同步 =====
      mainChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (!range) return
        if (macdChart) {
          macdChart.timeScale().setVisibleRange(range)
        }
        if (kdjChart) {
          kdjChart.timeScale().setVisibleRange(range)
        }
      })

      if (macdChart) {
        macdChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
          if (!range) return
          mainChart.timeScale().setVisibleRange(range)
          if (kdjChart) {
            kdjChart.timeScale().setVisibleRange(range)
          }
        })
      }

      if (kdjChart) {
        kdjChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
          if (!range) return
          mainChart.timeScale().setVisibleRange(range)
          if (macdChart) {
            macdChart.timeScale().setVisibleRange(range)
          }
        })
      }

      mainChart.timeScale().fitContent()
      if (macdChart) macdChart.timeScale().fitContent()
      if (kdjChart) kdjChart.timeScale().fitContent()

      mainChartRef.current = mainChart
      mainSeriesRef.current = mainSeries
      macdChartRef.current = macdChart
      kdjChartRef.current = kdjChart

      if (process.env.NODE_ENV === 'development') {
        console.log('[MultiPaneChart] 多窗格图表初始化完成', {
          mainPaneHeight,
          subPaneHeight,
          macdEnabled: showMACD,
          kdjEnabled: showKDJ,
        })
      }

      return () => {
        mainChart.remove()
        if (macdChart) macdChart.remove()
        if (kdjChart) kdjChart.remove()
        mainChartRef.current = null
        mainSeriesRef.current = null
        macdChartRef.current = null
        kdjChartRef.current = null
        maSeriesRefs.current = []
        macdResultRef.current = null
        kdjResultRef.current = null
      }
    }, [data, positiveColor, negativeColor, showMACD, showKDJ, macdParams, kdjParams])

    // Markers
    useEffect(() => {
      if (!mainSeriesRef.current) return

      if (!markers || markers.length === 0) {
        if (mainMarkersRef.current) {
          mainMarkersRef.current.setMarkers([])
        } else {
          mainMarkersRef.current = createSeriesMarkers(mainSeriesRef.current, [])
        }
        return
      }

      if (!mainMarkersRef.current) {
        mainMarkersRef.current = createSeriesMarkers(mainSeriesRef.current, [])
      }

      const chartMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
        time: m.time,
        position: m.position,
        shape: m.shape,
        color: m.color,
        text: m.text,
        size: m.size,
      }))
      mainMarkersRef.current.setMarkers(chartMarkers)
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

        <div ref={containerRef} style={{ position: 'relative' }}>
          {tooltip?.visible && (
            <div
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
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, color: THEME_TOKENS.color.chartContrastRaw }}>
                {tooltip.time}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }}>
                <span style={{ color: CHART_PALETTE.series3 }}>开</span>
                <span style={{ textAlign: 'right' }}>{tooltip.open.toFixed(2)}</span>
                <span style={{ color: CHART_PALETTE.series3 }}>高</span>
                <span style={{ textAlign: 'right' }}>{tooltip.high.toFixed(2)}</span>
                <span style={{ color: CHART_PALETTE.series3 }}>低</span>
                <span style={{ textAlign: 'right' }}>{tooltip.low.toFixed(2)}</span>
                <span style={{ color: CHART_PALETTE.series3 }}>收</span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: tooltip.close >= tooltip.open ? positiveColor : negativeColor }}>
                  {tooltip.close.toFixed(2)}
                </span>
                {tooltip.volume !== undefined && (
                  <>
                    <span style={{ color: CHART_PALETTE.series3 }}>量</span>
                    <span style={{ textAlign: 'right' }}>{tooltip.volume.toLocaleString('zh-CN')}</span>
                  </>
                )}
                {tooltip.macd && (
                  <>
                    <span style={{ color: MACD_COLORS.dif }}>DIF</span>
                    <span style={{ textAlign: 'right' }}>{tooltip.macd.dif.toFixed(3)}</span>
                    <span style={{ color: MACD_COLORS.dea }}>DEA</span>
                    <span style={{ textAlign: 'right' }}>{tooltip.macd.dea.toFixed(3)}</span>
                    <span style={{ color: tooltip.macd.histogram >= 0 ? '#ef4444' : '#22c55e' }}>MACD</span>
                    <span style={{ textAlign: 'right' }}>{tooltip.macd.histogram.toFixed(3)}</span>
                  </>
                )}
                {tooltip.kdj && (
                  <>
                    <span style={{ color: KDJ_COLORS.k }}>K</span>
                    <span style={{ textAlign: 'right' }}>{tooltip.kdj.k.toFixed(2)}</span>
                    <span style={{ color: KDJ_COLORS.d }}>D</span>
                    <span style={{ textAlign: 'right' }}>{tooltip.kdj.d.toFixed(2)}</span>
                    <span style={{ color: KDJ_COLORS.j }}>J</span>
                    <span style={{ textAlign: 'right' }}>{tooltip.kdj.j.toFixed(2)}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
)

MultiPaneChart.displayName = 'MultiPaneChart'

const MultiPaneChartMemo = memo(MultiPaneChart)
MultiPaneChartMemo.displayName = 'MultiPaneChart'

export const MultiPaneChartComponent = MultiPaneChartMemo
export { MultiPaneChartComponent as MultiPaneChart }
export default MultiPaneChartMemo
