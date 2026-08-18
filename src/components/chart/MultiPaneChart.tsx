import {
  forwardRef,
  memo,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import {
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import { CHART_PALETTE_PRO, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import { KDJ_COLORS } from './indicators/kdj'
import { MACD_COLORS } from './indicators/macd'
import { RSI_COLORS } from './indicators/rsi'
import type { KDJResult } from './indicators/kdj'
import type { MACDResult } from './indicators/macd'
import type { RSIResult } from './indicators/rsi'
import { getLogger } from '@/lib/logger'
import type { TooltipData, ChartTooltipProps, MultiPaneChartProps } from './multiPaneChart.types'
import { PERIOD_OPTIONS, ADJUST_OPTIONS } from './multiPaneChart.config'
import {
  buildTooltipValuesHtml,
  createMainChartPane,
  createMacdChartPane,
  createKdjChartPane,
  createRsiChartPane,
  createCrosshairHandler,
  syncTimeScales,
} from './multiPaneChart.utils'

const logger = getLogger()

/** 独立的 Tooltip 组件（使用 React.memo 优化） */
const ChartTooltip = memo<ChartTooltipProps>(({ data, positiveColor, negativeColor }) => {
  if ((data?.visible ?? false) !== true) return null
  const d = data!

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 6,
        minWidth: 150,
        padding: '8px 10px',
        borderRadius: '8px',
        background: 'rgba(19,23,34,0.88)',
        backdropFilter: 'blur(6px)',
        border: `1px solid ${CHART_PALETTE_PRO.grid}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        fontSize: '0.74rem',
        fontFeatureSettings: 'tnum',
        color: CHART_PALETTE_PRO.axis,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4, color: CHART_PALETTE_PRO.contrast }}>
        {d.time}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }}>
        <span style={{ color: CHART_PALETTE_PRO.axis }}>开</span>
        <span style={{ textAlign: 'right' }}>{d.open.toFixed(2)}</span>
        <span style={{ color: CHART_PALETTE_PRO.axis }}>高</span>
        <span style={{ textAlign: 'right' }}>{d.high.toFixed(2)}</span>
        <span style={{ color: CHART_PALETTE_PRO.axis }}>低</span>
        <span style={{ textAlign: 'right' }}>{d.low.toFixed(2)}</span>
        <span style={{ color: CHART_PALETTE_PRO.axis }}>收</span>
        <span style={{ textAlign: 'right', fontWeight: 600, color: d.close >= d.open ? positiveColor : negativeColor }}>
          {d.close.toFixed(2)}
        </span>
        {d.volume !== undefined && (
          <>
            <span style={{ color: CHART_PALETTE_PRO.axis }}>量</span>
            <span style={{ textAlign: 'right' }}>{d.volume.toLocaleString('zh-CN')}</span>
          </>
        )}
        {d.macd && (
          <>
            <span style={{ color: MACD_COLORS.dif }}>DIF</span>
            <span style={{ textAlign: 'right' }}>{d.macd.dif.toFixed(3)}</span>
            <span style={{ color: MACD_COLORS.dea }}>DEA</span>
            <span style={{ textAlign: 'right' }}>{d.macd.dea.toFixed(3)}</span>
            <span style={{ color: d.macd.histogram >= 0 ? STOCK_COLOR_TOKENS.up.hex : STOCK_COLOR_TOKENS.down.hex }}>MACD</span>
            <span style={{ textAlign: 'right' }}>{d.macd.histogram.toFixed(3)}</span>
          </>
        )}
        {d.kdj && (
          <>
            <span style={{ color: KDJ_COLORS.k }}>K</span>
            <span style={{ textAlign: 'right' }}>{d.kdj.k.toFixed(2)}</span>
            <span style={{ color: KDJ_COLORS.d }}>D</span>
            <span style={{ textAlign: 'right' }}>{d.kdj.d.toFixed(2)}</span>
            <span style={{ color: KDJ_COLORS.j }}>J</span>
            <span style={{ textAlign: 'right' }}>{d.kdj.j.toFixed(2)}</span>
          </>
        )}
        {d.rsi !== undefined && (() => {
          const rsiColor = d.rsi >= 70 ? RSI_COLORS.overbought : d.rsi <= 30 ? RSI_COLORS.oversold : RSI_COLORS.line
          return (
            <>
              <span style={{ color: rsiColor }}>RSI</span>
              <span style={{ textAlign: 'right', fontWeight: 600, color: rsiColor }}>{d.rsi.toFixed(1)}</span>
            </>
          )
        })()}
      </div>
    </div>
  )
})

ChartTooltip.displayName = 'ChartTooltip'

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
      showRSI = false,
      macdParams,
      kdjParams,
      rsiParams,
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
    const rsiChartRef = useRef<IChartApi | null>(null)

    const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
    const mainMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
    const maSeriesRefs = useRef<Array<ISeriesApi<'Line'> | null>>([])

    const macdResultRef = useRef<MACDResult | null>(null)
    const kdjResultRef = useRef<KDJResult | null>(null)
    const rsiResultRef = useRef<RSIResult | null>(null)

    const positiveColor = upColor ?? CHART_PALETTE_PRO.upColor
    const negativeColor = downColor ?? CHART_PALETTE_PRO.downColor

    // 使用 ref 存储 tooltip 数据，避免 React 重渲染
    const tooltipRef = useRef<TooltipData | null>(null)
    const tooltipElementRef = useRef<HTMLDivElement | null>(null)

    // 直接操作 DOM 更新 tooltip，不触发 React re-render
    const updateTooltip = useCallback((data: TooltipData | null) => {
      tooltipRef.current = data
      const el = tooltipElementRef.current
      if (!el) return

      if ((data?.visible ?? false) !== true) {
        el.style.display = 'none'
        return
      }

      const d = data!
      el.style.display = 'block'
      // 更新内容
      const timeEl = el.querySelector('[data-tooltip-time]')
      if (timeEl) timeEl.textContent = d.time

      const valuesEl = el.querySelector('[data-tooltip-values]')
      if (valuesEl) {
        valuesEl.innerHTML = buildTooltipValuesHtml(d, positiveColor, negativeColor)
      }
    }, [positiveColor, negativeColor])

    const isDailyPeriod = period === 'daily' || period === 'weekly' || period === 'monthly'

    // 计算各 pane 高度
    const toolbarHeight = showToolbar ? 40 : 0
    const availableHeight = height - toolbarHeight
    const subPaneCount = (showMACD ? 1 : 0) + (showKDJ ? 1 : 0) + (showRSI ? 1 : 0)
    const mainPaneRatio = subPaneCount > 0 ? 0.55 : 1
    const subPaneRatio = subPaneCount > 0 ? (1 - mainPaneRatio) / subPaneCount : 0
    const mainPaneHeight = Math.floor(availableHeight * mainPaneRatio)
    const subPaneHeight = Math.floor(availableHeight * subPaneRatio)

    useEffect(() => {
      if (!containerRef.current) return

      logger.info('[MultiPaneChart] 初始化多窗格图表', {
        showMACD,
        showKDJ,
        dataLength: data.length,
      })

      // ===== 主 K 线图 =====
      const mainPane = createMainChartPane(
        containerRef.current, mainPaneHeight, data, positiveColor, negativeColor,
      )
      const { mainChart, mainSeries } = mainPane
      maSeriesRefs.current = mainPane.maSeriesList

      // ===== MACD 副图 =====
      let macdChart: IChartApi | null = null
      const macdSeriesList: Array<ISeriesApi<'Line' | 'Histogram'> | null> = []

      if (showMACD) {
        logger.info('[MultiPaneChart] 创建 MACD 副图窗格', {
          dataLength: data.length,
          macdParams,
        })

        const macdPane = createMacdChartPane(containerRef.current, subPaneHeight, data, macdParams)
        macdChart = macdPane.macdChart
        macdResultRef.current = macdPane.macdResult
        macdSeriesList.push(...macdPane.macdSeriesList)

        logger.info('[MultiPaneChart] MACD 副图创建完成', {
          difCount: macdPane.macdResult.dif.filter(d => d !== null).length,
          deaCount: macdPane.macdResult.dea.filter(d => d !== null).length,
          histogramCount: macdPane.macdResult.histogram.filter(d => d !== null).length,
        })
      }

      // ===== KDJ 副图 =====
      let kdjChart: IChartApi | null = null
      const kdjSeriesList: Array<ISeriesApi<'Line'> | null> = []

      if (showKDJ) {
        logger.info('[MultiPaneChart] 创建 KDJ 副图窗格', {
          dataLength: data.length,
          kdjParams,
        })

        const kdjPane = createKdjChartPane(containerRef.current, subPaneHeight, data, kdjParams)
        kdjChart = kdjPane.kdjChart
        kdjResultRef.current = kdjPane.kdjResult
        kdjSeriesList.push(...kdjPane.kdjSeriesList)

        logger.info('[MultiPaneChart] KDJ 副图创建完成', {
          kCount: kdjPane.kdjResult.k.filter(d => d !== null).length,
          dCount: kdjPane.kdjResult.d.filter(d => d !== null).length,
          jCount: kdjPane.kdjResult.j.filter(d => d !== null).length,
        })
      }

      // ===== RSI 副图 =====
      let rsiChart: IChartApi | null = null
      const rsiSeriesList: Array<ISeriesApi<'Line'> | null> = []

      if (showRSI) {
        logger.info('[MultiPaneChart] 创建 RSI 副图窗格', {
          dataLength: data.length,
          rsiParams,
        })

        const rsiPane = createRsiChartPane(containerRef.current, subPaneHeight, data, rsiParams)
        rsiChart = rsiPane.rsiChart
        rsiResultRef.current = rsiPane.rsiResult
        rsiSeriesList.push(...rsiPane.rsiSeriesList)

        logger.info('[MultiPaneChart] RSI 副图创建完成', {
          rsiCount: rsiPane.rsiResult.rsi.filter(d => d !== null).length,
          last: rsiPane.rsiResult.rsi.filter(d => d !== null).pop()?.value,
        })
      }

      // ===== 十字光标联动（带节流） =====
      const dataIndex = new Map(data.map((d, i) => [String(d.time), i]))

      const onMainCrosshair = createCrosshairHandler({
        mainSeries,
        data,
        dataIndex,
        showMACD,
        showKDJ,
        showRSI,
        macdResultRef,
        kdjResultRef,
        rsiResultRef,
        macdChart,
        kdjChart,
        rsiChart,
        macdSeriesList,
        kdjSeriesList,
        rsiSeriesList,
        updateTooltip,
      })

      mainChart.subscribeCrosshairMove(onMainCrosshair)

      // ===== TimeScale 同步 =====
      syncTimeScales(mainChart, macdChart, kdjChart, rsiChart)

      mainChart.timeScale().fitContent()
      if (macdChart) macdChart.timeScale().fitContent()
      if (kdjChart) kdjChart.timeScale().fitContent()
      if (rsiChart) rsiChart.timeScale().fitContent()

      // ── 高 DPI 自适应：监听容器尺寸变化 ──
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect
          if (w <= 0 || h <= 0) continue
          mainChart.applyOptions({ width: w, height: mainPaneHeight })
          if (macdChart) macdChart.applyOptions({ width: w, height: subPaneHeight })
          if (kdjChart) kdjChart.applyOptions({ width: w, height: subPaneHeight })
          if (rsiChart) rsiChart.applyOptions({ width: w, height: subPaneHeight })
        }
      })
      resizeObserver.observe(containerRef.current)

      mainChartRef.current = mainChart
      mainSeriesRef.current = mainSeries
      macdChartRef.current = macdChart
      kdjChartRef.current = kdjChart
      rsiChartRef.current = rsiChart

      logger.info('[MultiPaneChart] 多窗格图表初始化完成', {
        mainPaneHeight,
        subPaneHeight,
        macdEnabled: showMACD,
        kdjEnabled: showKDJ,
        rsiEnabled: showRSI,
      })

      return () => {
        resizeObserver.disconnect()
        mainChart.remove()
        if (macdChart) macdChart.remove()
        if (kdjChart) kdjChart.remove()
        if (rsiChart) rsiChart.remove()
        mainChartRef.current = null
        mainSeriesRef.current = null
        macdChartRef.current = null
        kdjChartRef.current = null
        rsiChartRef.current = null
        maSeriesRefs.current = []
        macdResultRef.current = null
        kdjResultRef.current = null
        rsiResultRef.current = null
      }
    }, [data, positiveColor, negativeColor, showMACD, showKDJ, showRSI, macdParams, kdjParams, rsiParams])

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

      mainMarkersRef.current ??= createSeriesMarkers(mainSeriesRef.current, [])

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
      <div {...divProps} role="img" aria-label="多面板技术图表">
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
            <div style={{ display: 'flex', gap: '2px', background: CHART_PALETTE_PRO.bgLight, borderRadius: '6px', padding: '2px' }}>
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
                      ? 'rgba(255,255,255,0.1)'
                      : 'transparent',
                    color: period === opt.value
                      ? CHART_PALETTE_PRO.contrast
                      : CHART_PALETTE_PRO.axis,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {isDailyPeriod && (
              <div style={{ display: 'flex', gap: '2px', background: CHART_PALETTE_PRO.bgLight, borderRadius: '6px', padding: '2px' }}>
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
                        ? 'rgba(255,255,255,0.1)'
                        : 'transparent',
                      color: adjust === opt.value
                        ? CHART_PALETTE_PRO.contrast
                        : CHART_PALETTE_PRO.axis,
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
          <div
            ref={tooltipElementRef}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 6,
              minWidth: 150,
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(19,23,34,0.88)',
              backdropFilter: 'blur(6px)',
              border: `1px solid ${CHART_PALETTE_PRO.grid}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              fontSize: '0.74rem',
              fontFeatureSettings: 'tnum',
              color: CHART_PALETTE_PRO.axis,
              pointerEvents: 'none',
              display: 'none',
            }}
          >
            <div data-tooltip-time style={{ fontWeight: 600, marginBottom: 4, color: CHART_PALETTE_PRO.contrast }} />
            <div data-tooltip-values style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }} />
          </div>
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
export type { TooltipData, MultiPaneChartProps } from './multiPaneChart.types'

export default MultiPaneChartMemo