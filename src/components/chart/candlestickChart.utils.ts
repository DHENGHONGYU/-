/**
 * CandlestickChart 工具函数
 * 从 CandlestickChart.tsx 提取，包含数据转换、格式化、MA 计算、副图渲染、十字光标处理
 */
import type {
  Time,
  LineData,
  CandlestickData,
  HistogramData,
  SeriesMarker,
  IChartApi,
  ISeriesApi,
  MouseEventHandler,
} from 'lightweight-charts'
import {
  HistogramSeries,
  LineSeries,
  AreaSeries,
} from 'lightweight-charts'
import { CHART_PALETTE_PRO } from '@/constants/theme.tokens'
import type { ChartMarker } from '@/types/modules/buySellPoint.types'
import { computeKDJ, KDJ_COLORS, type KDJParams } from './indicators/kdj'
import { computeMACD, MACD_COLORS, type MACDParams } from './indicators/macd'
import { computeRSI, RSI_COLORS, type RSIParams } from './indicators/rsi'
import { computeMultiEMA, EMA_COLORS, type EMAParams } from './indicators/ema'
import { computeBollinger, BOLL_COLORS, type BollingerParams } from './indicators/bollinger'
import type { CandlestickChartData } from './types'
import type { TooltipData, SubChartType } from './candlestickChart.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 将 lightweight-charts Time 类型安全转为字符串 */
export function timeToString(time: Time): string {
  if (typeof time === 'string') return time
  if (typeof time === 'number') return String(time)
  return `${time.year}-${time.month}-${time.day}`
}

/** 计算简单移动平均线（前 period 个数据点不足时返回 null） */
export function computeMA(data: CandlestickChartData[], period: number): Array<LineData<Time> | null> {
  return data.map((item, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j += 1) sum += data[j]!.close
    return { time: item.time as Time, value: sum / period }
  })
}

/** 将 CandlestickChartData 转换为 lightweight-charts CandlestickData */
export function toCandlestickData(data: CandlestickChartData[]): CandlestickData<Time>[] {
  return data.map((item) => ({
    time: item.time,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
  }))
}

/** 将 CandlestickChartData 转换为成交量 HistogramData */
export function toVolumeData(
  data: CandlestickChartData[],
  positiveColor: string,
  negativeColor: string,
): HistogramData<Time>[] {
  return data
    .filter((item) => item.volume !== undefined && item.volume > 0)
    .map((item) => ({
      time: item.time,
      value: item.volume!,
      color: item.close >= item.open
        ? `${positiveColor}60`
        : `${negativeColor}60`,
    }))
}

/** 将 ChartMarker 转换为 lightweight-charts SeriesMarker */
export function toSeriesMarkers(markers: ChartMarker[]): SeriesMarker<Time>[] {
  return markers.map((m) => ({
    time: m.time,
    position: m.position,
    shape: m.shape,
    color: m.color,
    text: m.text,
    size: m.size,
  }))
}

/** 构建 time -> index 映射 */
export function buildTimeIndex(data: CandlestickChartData[]): Map<string, number> {
  return new Map(data.map((d, i) => [String(d.time), i]))
}

/** 格式化 tooltip values 区域 HTML */
export function formatTooltipValuesHTML(
  data: TooltipData,
  positiveColor: string,
  negativeColor: string,
): string {
  const isUp = data.close >= data.open
  let html = `
    <span style="color: ${CHART_PALETTE_PRO.axis}">开</span>
    <span style="text-align: right">${data.open.toFixed(2)}</span>
    <span style="color: ${CHART_PALETTE_PRO.axis}">高</span>
    <span style="text-align: right">${data.high.toFixed(2)}</span>
    <span style="color: ${CHART_PALETTE_PRO.axis}">低</span>
    <span style="text-align: right">${data.low.toFixed(2)}</span>
    <span style="color: ${CHART_PALETTE_PRO.axis}">收</span>
    <span style="text-align: right; font-weight: 600; color: ${isUp ? positiveColor : negativeColor}">${data.close.toFixed(2)}</span>
  `

  // 涨跌幅
  if (data.changePct !== undefined) {
    const pctColor = data.changePct >= 0 ? positiveColor : negativeColor
    const pctSign = data.changePct >= 0 ? '+' : ''
    html += `
      <span style="color: ${CHART_PALETTE_PRO.axis}">涨幅</span>
      <span style="text-align: right; font-weight: 600; color: ${pctColor}">${pctSign}${data.changePct.toFixed(2)}%</span>
    `
  }

  if (data.volume !== undefined) {
    html += `
      <span style="color: ${CHART_PALETTE_PRO.axis}">量</span>
      <span style="text-align: right">${data.volume.toLocaleString('zh-CN')}</span>
    `
  }

  if (data.rsi !== undefined) {
    html += `
      <span style="color: ${RSI_COLORS.line}">RSI</span>
      <span style="text-align: right; font-weight: 500; color: ${RSI_COLORS.line}">${data.rsi.toFixed(1)}</span>
    `
  }

  return html
}

/**
 * 渲染副图系列（成交量 / MACD / KDJ）
 * 返回创建的系列列表，供外部 ref 持有和十字光标读取
 */
export function renderSubChartSeries(
  chart: IChartApi,
  data: CandlestickChartData[],
  subChartType: SubChartType,
  macdParams: MACDParams | undefined,
  kdjParams: KDJParams | undefined,
  positiveColor: string,
  negativeColor: string,
): Array<ISeriesApi<'Histogram' | 'Line'> | null> {
  const seriesList: Array<ISeriesApi<'Histogram' | 'Line'> | null> = []

  if (subChartType === 'volume') {
    // 成交量副图
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    })

    const volumeData = toVolumeData(data, positiveColor, negativeColor)

    volumeSeries.setData(volumeData)
    seriesList.push(volumeSeries)

    logger.info('[CandlestickChart] 成交量副图渲染完成', {
      dataCount: volumeData.length,
    })
  } else if (subChartType === 'macd') {
    // MACD 副图
    logger.info('[CandlestickChart] 开始渲染 MACD 副图', {
      dataLength: data.length,
      macdParams,
    })

    const macdResult = computeMACD(data, macdParams)

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
    seriesList.push(difSeries)

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
    seriesList.push(deaSeries)

    // MACD 柱状图
    const histogramSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'macd',
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    })
    histogramSeries.setData(macdResult.histogram.filter((d): d is HistogramData<Time> => d !== null))
    seriesList.push(histogramSeries)

    // 配置 MACD 副图区域
    chart.priceScale('macd').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0 },
    })

    logger.info('[CandlestickChart] MACD 副图渲染完成', {
      difCount: macdResult.dif.filter(d => d !== null).length,
      deaCount: macdResult.dea.filter(d => d !== null).length,
      histogramCount: macdResult.histogram.filter(d => d !== null).length,
    })
  } else if (subChartType === 'kdj') {
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
    seriesList.push(kSeries)

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
    seriesList.push(dSeries)

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
    seriesList.push(jSeries)

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

  return seriesList
}

/**
 * 渲染 EMA 叠加指标（EMA12/26/50）
 * 返回创建的系列列表，供外部 ref 持有
 */
export function renderEMAOverlay(
  chart: IChartApi,
  data: CandlestickChartData[],
  _emaParams: EMAParams = {},
): Array<ISeriesApi<'Line'> | null> {
  const periods = [12, 26, 50]
  const emaResults = computeMultiEMA(data, periods)
  const emaSeriesList: Array<ISeriesApi<'Line'> | null> = []

  for (const result of emaResults) {
    const color = EMA_COLORS[result.period] ?? CHART_PALETTE_PRO.series1
    const emaSeries = chart.addSeries(LineSeries, {
      color,
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    emaSeries.setData(result.ema.filter((d): d is LineData<Time> => d !== null))
    emaSeriesList.push(emaSeries)
  }

  logger.info('[EMA Overlay] 渲染完成', {
    periods,
    seriesCount: emaSeriesList.length,
  })

  return emaSeriesList
}

/**
 * 渲染 Bollinger Bands 叠加指标
 * 返回创建的系列列表，供外部 ref 持有
 */
export function renderBollingerOverlay(
  chart: IChartApi,
  data: CandlestickChartData[],
  bollingerParams: BollingerParams = {},
): Array<ISeriesApi<'Line' | 'Area'> | null> {
  const bollResult = computeBollinger(data, bollingerParams)
  const bollSeriesList: Array<ISeriesApi<'Line' | 'Area'> | null> = []

  // 填充区域（上下轨之间）
  const areaSeries = chart.addSeries(AreaSeries, {
    lineWidth: 1,
    topColor: BOLL_COLORS.fill,
    bottomColor: BOLL_COLORS.fill,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  })
  // 填充区域数据：使用上轨数据 + 下轨作为基线
  const areaData = bollResult.upper
    .filter((d): d is LineData<Time> => d !== null)
    .map((d) => ({
      time: d.time,
      value: d.value,
    }))
  areaSeries.setData(areaData)
  bollSeriesList.push(areaSeries)

  // 上轨
  const upperSeries = chart.addSeries(LineSeries, {
    color: BOLL_COLORS.upper,
    lineWidth: 1,
    lineStyle: 0,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  })
  upperSeries.setData(bollResult.upper.filter((d): d is LineData<Time> => d !== null))
  bollSeriesList.push(upperSeries)

  // 中轨（虚线）
  const middleSeries = chart.addSeries(LineSeries, {
    color: BOLL_COLORS.middle,
    lineWidth: 1,
    lineStyle: 2, // 虚线
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  })
  middleSeries.setData(bollResult.middle.filter((d): d is LineData<Time> => d !== null))
  bollSeriesList.push(middleSeries)

  // 下轨
  const lowerSeries = chart.addSeries(LineSeries, {
    color: BOLL_COLORS.lower,
    lineWidth: 1,
    lineStyle: 0,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  })
  lowerSeries.setData(bollResult.lower.filter((d): d is LineData<Time> => d !== null))
  bollSeriesList.push(lowerSeries)

  logger.info('[BOLL Overlay] 渲染完成', {
    seriesCount: bollSeriesList.length,
  })

  return bollSeriesList
}

/**
 * 渲染 RSI 副图
 * 返回创建的系列列表，供外部 ref 持有和十字光标读取
 */
export function renderRSISubChart(
  chart: IChartApi,
  data: CandlestickChartData[],
  rsiParams: RSIParams = {},
): Array<ISeriesApi<'Line'> | null> {
  const rsiResult = computeRSI(data, rsiParams)
  const seriesList: Array<ISeriesApi<'Line'> | null> = []

  // RSI 线
  const rsiSeries = chart.addSeries(LineSeries, {
    priceScaleId: 'rsi',
    color: RSI_COLORS.line,
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  })
  rsiSeries.setData(rsiResult.rsi.filter((d): d is LineData<Time> => d !== null))
  seriesList.push(rsiSeries)

  // 配置 RSI 副图区域
  chart.priceScale('rsi').applyOptions({
    scaleMargins: { top: 0.1, bottom: 0 },
  })

  // 超买/超卖水平线
  const overboughtLine = chart.addSeries(LineSeries, {
    priceScaleId: 'rsi',
    color: RSI_COLORS.overbought,
    lineWidth: 1,
    lineStyle: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  })
  overboughtLine.setData(data.map((d) => ({ time: d.time, value: 70 })))
  seriesList.push(overboughtLine)

  const oversoldLine = chart.addSeries(LineSeries, {
    priceScaleId: 'rsi',
    color: RSI_COLORS.oversold,
    lineWidth: 1,
    lineStyle: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  })
  oversoldLine.setData(data.map((d) => ({ time: d.time, value: 30 })))
  seriesList.push(oversoldLine)

  logger.info('[RSI SubChart] 渲染完成', {
    seriesCount: seriesList.length,
  })

  return seriesList
}

/**
 * 创建十字光标移动处理器（带节流）
 * 读取主图 OHLCV 数据及副图指标数据，更新 tooltip
 */
export function createCrosshairHandler(
  series: ISeriesApi<'Candlestick'>,
  data: CandlestickChartData[],
  dataIndex: Map<string, number>,
  subChartSeriesList: Array<ISeriesApi<'Histogram' | 'Line'> | null>,
  effectiveSubChart: SubChartType,
  updateTooltip: (data: TooltipData | null) => void,
): MouseEventHandler<Time> {
  let lastCrosshairTime = 0
  const THROTTLE_MS = 16 // 60fps

  const processCrosshair = (param: Parameters<MouseEventHandler<Time>>[0]) => {
    if (param.time == null || param.point == null) {
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

    // 涨跌幅计算
    let changePct: number | undefined
    if (idx !== undefined && idx > 0) {
      const prevClose = data[idx - 1]?.close
      if (prevClose && prevClose !== 0) {
        changePct = ((bar.close - prevClose) / prevClose) * 100
      }
    }

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
      }
    }

    // 获取 RSI 数据（如果副图是 RSI）
    let rsi: number | undefined
    if (effectiveSubChart === 'rsi' && subChartSeriesList.length >= 1) {
      const rsiData = param.seriesData.get(subChartSeriesList[0]!) as LineData<Time> | undefined
      if (rsiData) {
        rsi = rsiData.value
      }
    }

    updateTooltip({
      time: timeToString(bar.time),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume,
      changePct,
      macd,
      kdj,
      rsi,
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

  return onCrosshair
}
