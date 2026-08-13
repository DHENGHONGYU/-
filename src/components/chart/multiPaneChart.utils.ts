import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  type MouseEventHandler,
} from 'lightweight-charts'
import { CHART_PALETTE, COLOR_TOKENS } from '@/constants/theme.tokens'
import { computeMACD, MACD_COLORS, type MACDParams } from './indicators/macd'
import { computeKDJ, KDJ_COLORS, type KDJParams } from './indicators/kdj'
import { MA_OPTIONS, THROTTLE_MS } from './multiPaneChart.config'
import type {
  TooltipData,
  MainChartPaneResult,
  MacdChartPaneResult,
  KdjChartPaneResult,
  CrosshairHandlerOptions,
} from './multiPaneChart.types'
import type { CandlestickChartData } from './types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 计算简单移动平均线 */
export function computeMA(data: CandlestickChartData[], period: number): Array<LineData<Time> | null> {
  return data.map((item, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j += 1) sum += data[j]!.close
    return { time: item.time as Time, value: sum / period }
  })
}

/** 将 lightweight-charts Time 类型安全转为字符串 */
export function timeToString(time: Time): string {
  if (typeof time === 'string') return time
  if (typeof time === 'number') return String(time)
  return `${time.year}-${time.month}-${time.day}`
}

/** 格式化 K 线数据为 lightweight-charts 所需格式 */
export function formatCandlestickData(data: CandlestickChartData[]): CandlestickData<Time>[] {
  return data.map((item) => ({
    time: item.time,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
  }))
}

/** 构建 tooltip 数值区域 HTML */
export function buildTooltipValuesHtml(
  d: TooltipData,
  positiveColor: string,
  negativeColor: string,
): string {
  let html = `
        <span style="color: ${CHART_PALETTE.series3}">开</span>
        <span style="text-align: right">${d.open.toFixed(2)}</span>
        <span style="color: ${CHART_PALETTE.series3}">高</span>
        <span style="text-align: right">${d.high.toFixed(2)}</span>
        <span style="color: ${CHART_PALETTE.series3}">低</span>
        <span style="text-align: right">${d.low.toFixed(2)}</span>
        <span style="color: ${CHART_PALETTE.series3}">收</span>
        <span style="text-align: right; font-weight: 600; color: ${d.close >= d.open ? positiveColor : negativeColor}">${d.close.toFixed(2)}</span>
      `

  if (d.volume !== undefined) {
    html += `
            <span style="color: ${CHART_PALETTE.series3}">量</span>
            <span style="text-align: right">${d.volume.toLocaleString('zh-CN')}</span>
          `
  }

  if (d.macd) {
    html += `
            <span style="color: ${MACD_COLORS.dif}">DIF</span>
            <span style="text-align: right">${d.macd.dif.toFixed(3)}</span>
            <span style="color: ${MACD_COLORS.dea}">DEA</span>
            <span style="text-align: right">${d.macd.dea.toFixed(3)}</span>
            <span style="color: ${d.macd.histogram >= 0 ? COLOR_TOKENS.up.hex : COLOR_TOKENS.down.hex}">MACD</span>
            <span style="text-align: right">${d.macd.histogram.toFixed(3)}</span>
          `
  }

  if (d.kdj) {
    html += `
            <span style="color: ${KDJ_COLORS.k}">K</span>
            <span style="text-align: right">${d.kdj.k.toFixed(2)}</span>
            <span style="color: ${KDJ_COLORS.d}">D</span>
            <span style="text-align: right">${d.kdj.d.toFixed(2)}</span>
            <span style="color: ${KDJ_COLORS.j}">J</span>
            <span style="text-align: right">${d.kdj.j.toFixed(2)}</span>
          `
  }

  return html
}

/** 创建主 K 线图窗格 */
export function createMainChartPane(
  container: HTMLElement,
  height: number,
  data: CandlestickChartData[],
  positiveColor: string,
  negativeColor: string,
): MainChartPaneResult {
  const mainContainer = document.createElement('div')
  mainContainer.style.height = `${height}px`
  container.appendChild(mainContainer)

  const mainChart = createChart(mainContainer, {
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

  mainSeries.setData(formatCandlestickData(data))

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

  return { mainChart, mainSeries, maSeriesList }
}

/** 创建 MACD 副图窗格 */
export function createMacdChartPane(
  container: HTMLElement,
  height: number,
  data: CandlestickChartData[],
  macdParams?: MACDParams,
): MacdChartPaneResult {
  const macdContainer = document.createElement('div')
  macdContainer.style.height = `${height}px`
  container.appendChild(macdContainer)

  const macdChart = createChart(macdContainer, {
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
      secondsVisible: false,
      visible: false,
    },
  })

  const macdResult = computeMACD(data, macdParams)

  const macdSeriesList: Array<ISeriesApi<'Line' | 'Histogram'> | null> = []

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

  return { macdChart, macdResult, macdSeriesList }
}

/** 创建 KDJ 副图窗格 */
export function createKdjChartPane(
  container: HTMLElement,
  height: number,
  data: CandlestickChartData[],
  kdjParams?: KDJParams,
): KdjChartPaneResult {
  const kdjContainer = document.createElement('div')
  kdjContainer.style.height = `${height}px`
  container.appendChild(kdjContainer)

  const kdjChart = createChart(kdjContainer, {
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
      secondsVisible: false,
      visible: false,
    },
  })

  const kdjResult = computeKDJ(data, kdjParams)

  const kdjSeriesList: Array<ISeriesApi<'Line'> | null> = []

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

  return { kdjChart, kdjResult, kdjSeriesList }
}

/** 创建十字光标联动处理器（带节流） */
export function createCrosshairHandler(options: CrosshairHandlerOptions): MouseEventHandler<Time> {
  const {
    mainSeries,
    data,
    dataIndex,
    showMACD,
    showKDJ,
    macdResultRef,
    kdjResultRef,
    macdChart,
    kdjChart,
    macdSeriesList,
    kdjSeriesList,
    updateTooltip,
  } = options

  let lastCrosshairTime = 0

  return (param) => {
    const now = performance.now()
    const elapsed = now - lastCrosshairTime

    // 标准节流：只执行间隔外的第一次调用，间隔内的调用被丢弃
    if (elapsed < THROTTLE_MS) {
      return
    }

    lastCrosshairTime = now

    if (param.time == null || param.point == null) {
      updateTooltip(null)
      if (macdChart) macdChart.clearCrosshairPosition()
      if (kdjChart) kdjChart.clearCrosshairPosition()
      return
    }

    const bar = param.seriesData.get(mainSeries) as CandlestickData<Time> | undefined
    if (!bar) {
      updateTooltip(null)
      return
    }

    const idx = dataIndex.get(timeToString(bar.time))
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

    logger.info('[MultiPaneChart] 十字光标联动', {
      time: timeToString(bar.time),
      macd: macd ? '✓' : '✗',
      kdj: kdj ? '✓' : '✗',
    })

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
}

/** 同步多个图表的时间轴 */
export function syncTimeScales(
  mainChart: IChartApi,
  macdChart: IChartApi | null,
  kdjChart: IChartApi | null,
): void {
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
}