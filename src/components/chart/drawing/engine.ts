/**
 * 画线工具渲染引擎
 *
 * 使用 lightweight-charts v5 的 LineSeries 渲染画线工具：
 * - 趋势线：两点连线，支持双向延伸
 * - 水平线：指定价格的水平虚线
 * - 射线：从起点沿角度延伸
 *
 * 支持：
 * - 实时绘制（鼠标两次点击）
 * - 选中态高亮（金色）
 * - 标签显示
 *
 * 对标 TradingView 画线工具交互体验。
 *
 * @module components/chart/drawing/engine
 * @created 2026-08-15
 */

import {
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import {
  LINE_STYLE_MAP,
  generateDrawingId,
  type Drawing,
  type TrendLine,
  type HorizontalLine,
  type RayLine,
  type DrawingToolType,
  type DrawingManagerState,
  type DrawingToolConfig,
  DEFAULT_DRAWING_CONFIG,
} from './types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 画线渲染信息 */
interface DrawingRenderInfo {
  drawing: Drawing
  series: ISeriesApi<'Line'>
}

/** 画线工具管理器 */
export class DrawingManager {
  private chart: IChartApi
  private config: DrawingToolConfig
  private state: DrawingManagerState = {
    drawings: [],
    activeTool: null,
    pendingDrawing: null,
    visible: true,
  }

  /** 当前渲染的画线 */
  private renderInfos: DrawingRenderInfo[] = []

  /** 当前拖拽中的起点 */
  private dragStart: { time: Time; price: number } | null = null

  /** 点击事件处理器 */
  private clickHandler: ((param: Parameters<Parameters<IChartApi['subscribeClick']>[0]>[0]) => void) | null = null

  /** 主图 K 线系列引用（替代已移除的 chart.series() API，用于十字光标取价） */
  private mainSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | ISeriesApi<'Line'> | null

  constructor(
    chart: IChartApi,
    config: Partial<DrawingToolConfig> = {},
    options: { mainSeries?: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | ISeriesApi<'Line'> } = {},
  ) {
    this.chart = chart
    this.config = { ...DEFAULT_DRAWING_CONFIG, ...config }
    this.mainSeries = options.mainSeries ?? null
  }

  /** 获取当前状态 */
  getState(): Readonly<DrawingManagerState> {
    return this.state
  }

  /** 获取所有画线 */
  getDrawings(): readonly Drawing[] {
    return this.state.drawings
  }

  /** 激活画线工具 */
  activateTool(tool: DrawingToolType): void {
    this.deactivateTool()
    this.state.activeTool = tool
    this.bindEvents()
    logger.info('[Drawing] 激活画线工具', { tool })
  }

  /** 停用画线工具 */
  deactivateTool(): void {
    this.state.activeTool = null
    this.state.pendingDrawing = null
    this.dragStart = null
    this.unbindEvents()
    logger.info('[Drawing] 停用画线工具')
  }

  /** 添加画线 */
  addDrawing(drawing: Drawing): void {
    this.state.drawings.push(drawing)
    this.renderDrawing(drawing)
    logger.info('[Drawing] 添加画线', { id: drawing.id, type: drawing.type })
  }

  /** 删除画线 */
  removeDrawing(id: string): void {
    const idx = this.state.drawings.findIndex(d => d.id === id)
    if (idx >= 0) {
      this.state.drawings.splice(idx, 1)
    }
    const ri = this.renderInfos.find(r => r.drawing.id === id)
    if (ri) {
      this.chart.removeSeries(ri.series)
      this.renderInfos = this.renderInfos.filter(r => r.drawing.id !== id)
    }
    logger.info('[Drawing] 删除画线', { id })
  }

  /** 清除所有画线 */
  clearAll(): void {
    for (const ri of this.renderInfos) {
      this.chart.removeSeries(ri.series)
    }
    this.renderInfos = []
    this.state.drawings = []
    logger.info('[Drawing] 清除所有画线')
  }

  /** 设置可见性 */
  setVisible(visible: boolean): void {
    this.state.visible = visible
    for (const ri of this.renderInfos) {
      ri.series.applyOptions({ visible })
    }
  }

  /** 渲染单条画线 */
  private renderDrawing(drawing: Drawing): void {
    let series: ISeriesApi<'Line'>

    switch (drawing.type) {
      case 'trendLine':
        series = this.renderTrendLine(drawing)
        break
      case 'horizontalLine':
        series = this.renderHorizontalLine(drawing)
        break
      case 'rayLine':
        series = this.renderRayLine(drawing)
        break
    }

    this.renderInfos.push({ drawing, series })
  }

  /** 渲染趋势线 */
  private renderTrendLine(line: TrendLine): ISeriesApi<'Line'> {
    const lineSeries = this.chart.addSeries(LineSeries, {
      color: line.color,
      lineWidth: line.lineWidth as 1 | 2 | 3 | 4,
      lineStyle: LINE_STYLE_MAP[line.lineStyle] as 0 | 1 | 2 | 3 | 4,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const points = this.calculateTrendLinePoints(line)
    lineSeries.setData(points)
    return lineSeries
  }

  /** 计算趋势线上的点 */
  private calculateTrendLinePoints(
    line: TrendLine,
  ): Array<{ time: Time; value: number }> {
    const t1 = typeof line.point1.time === 'number'
      ? line.point1.time
      : new Date(line.point1.time as string).getTime() / 1000
    const t2 = typeof line.point2.time === 'number'
      ? line.point2.time
      : new Date(line.point2.time as string).getTime() / 1000

    const priceDiff = line.point2.price - line.point1.price
    const timeDiff = t2 - t1

    if (timeDiff === 0) {
      return [line.point1, line.point2].map(p => ({
        time: p.time,
        value: p.price,
      }))
    }

    const slope = priceDiff / timeDiff
    const points: Array<{ time: Time; value: number }> = []

    // 起点
    points.push({ time: line.point1.time, value: line.point1.price })
    // 终点
    points.push({ time: line.point2.time, value: line.point2.price })

    // 向左延伸
    if (line.extendLeft) {
      const extTime = t1 - timeDiff * 0.5
      const extPrice = line.point1.price - slope * timeDiff * 0.5
      points.unshift({
        time: Math.floor(extTime) as UTCTimestamp,
        value: Number(extPrice.toFixed(3)),
      })
    }

    // 向右延伸
    if (line.extendRight) {
      const extTime = t2 + timeDiff * 0.5
      const extPrice = line.point2.price + slope * timeDiff * 0.5
      points.push({
        time: Math.floor(extTime) as UTCTimestamp,
        value: Number(extPrice.toFixed(3)),
      })
    }

    return points
  }

  /** 渲染水平线 */
  private renderHorizontalLine(line: HorizontalLine): ISeriesApi<'Line'> {
    const lineSeries = this.chart.addSeries(LineSeries, {
      color: line.color,
      lineWidth: line.lineWidth as 1 | 2 | 3 | 4,
      lineStyle: LINE_STYLE_MAP[line.lineStyle] as 0 | 1 | 2 | 3 | 4,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const timeScale = this.chart.timeScale()
    const visibleRange = timeScale.getVisibleRange()

    const data: Array<{ time: Time; value: number }> = []
    if (line.startTime && line.endTime) {
      data.push(
        { time: line.startTime, value: line.price },
        { time: line.endTime, value: line.price },
      )
    } else if (visibleRange) {
      data.push(
        { time: visibleRange.from as Time, value: line.price },
        { time: visibleRange.to as Time, value: line.price },
      )
    }

    if (data.length > 0) {
      lineSeries.setData(data)
    }
    return lineSeries
  }

  /** 渲染射线 */
  private renderRayLine(line: RayLine): ISeriesApi<'Line'> {
    const lineSeries = this.chart.addSeries(LineSeries, {
      color: line.color,
      lineWidth: line.lineWidth as 1 | 2 | 3 | 4,
      lineStyle: LINE_STYLE_MAP[line.lineStyle] as 0 | 1 | 2 | 3 | 4,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const t0 = typeof line.point.time === 'number'
      ? line.point.time
      : new Date(line.point.time as string).getTime() / 1000

    const timeScale = this.chart.timeScale()
    const visibleRange = timeScale.getVisibleRange()
    const endTime = (visibleRange?.to ?? (t0 + 86400 * 30)) as Time

    const tEnd = typeof endTime === 'number' ? endTime : 0
    const priceEnd = line.point.price + Math.tan(line.angle) * (tEnd - t0) / 86400

    lineSeries.setData([
      { time: line.point.time, value: line.point.price },
      { time: endTime, value: Number(priceEnd.toFixed(3)) },
    ])
    return lineSeries
  }

  /** 绑定鼠标事件 */
  private bindEvents(): void {
    this.unbindEvents()

    this.clickHandler = (param) => {
      if (!this.state.activeTool) return
      if (!param.point || !param.time) return

      const price = this.getPriceAtTime(param.time)
      if (price == null) return

      this.handleClick(param.time, price)
    }

    this.chart.subscribeClick(this.clickHandler)
  }

  /** 处理点击 */
  private handleClick(time: Time, price: number): void {
    const tool = this.state.activeTool!

    if (tool === 'horizontalLine') {
      const line: HorizontalLine = {
        id: generateDrawingId(),
        type: 'horizontalLine',
        color: this.config.defaultColor,
        lineWidth: this.config.defaultLineWidth,
        lineStyle: this.config.defaultLineStyle,
        showLabel: true,
        label: price.toFixed(2),
        extend: false,
        opacity: this.config.defaultOpacity,
        createdAt: Date.now(),
        price,
      }
      this.addDrawing(line)
      return
    }

    if (tool === 'trendLine') {
      if (!this.dragStart) {
        this.dragStart = { time, price }
      } else {
        const line: TrendLine = {
          id: generateDrawingId(),
          type: 'trendLine',
          color: this.config.defaultColor,
          lineWidth: this.config.defaultLineWidth,
          lineStyle: this.config.defaultLineStyle,
          showLabel: true,
          extend: true,
          extendRight: true,
          extendLeft: false,
          opacity: this.config.defaultOpacity,
          createdAt: Date.now(),
          point1: this.dragStart,
          point2: { time, price },
        }
        this.addDrawing(line)
        this.dragStart = null
      }
    }
  }

  /** 根据十字光标位置获取价格 */
  private getPriceAtTime(time: Time): number | null {
    try {
      // lightweight-charts v5 已移除 chart.series() API，改为优先使用构造时注入的主系列引用
      const series = this.mainSeries
      if (!series) return null
      const data = series.data() as Array<{ time: Time; close: number }>
      const item = data.find(d => {
        if (typeof d.time === 'number' && typeof time === 'number') {
          return d.time === time
        }
        return String(d.time) === String(time)
      })
      return item?.close ?? null
    } catch {
      return null
    }
  }

  /** 解绑事件 */
  private unbindEvents(): void {
    if (this.clickHandler) {
      this.chart.unsubscribeClick(this.clickHandler)
      this.clickHandler = null
    }
  }

  /** 销毁 */
  destroy(): void {
    this.deactivateTool()
    this.clearAll()
  }
}