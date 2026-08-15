/**
 * 画线工具类型定义
 *
 * 支持三种画线工具：
 * - TrendLine: 趋势线（两点连线，可延伸）
 * - HorizontalLine: 水平线（支撑/阻力标记）
 * - RayLine: 射线（从起点向一个方向延伸）
 *
 * 对标 TradingView 画线工具集，使用 lightweight-charts 的
 * IPrimitive 接口实现。
 *
 * @module components/chart/drawing/types
 * @created 2026-08-15
 */

import type { Time } from 'lightweight-charts'

/** 画线工具类型 */
export type DrawingToolType = 'trendLine' | 'horizontalLine' | 'rayLine'

/** 线条样式 */
export type LineDashStyle = 'solid' | 'dashed' | 'dotted' | 'largeDashed' | 'sparseDotted'

/** 画线工具基础属性 */
export interface DrawingBase {
  /** 唯一标识 */
  id: string
  /** 工具类型 */
  type: DrawingToolType
  /** 线条颜色 */
  color: string
  /** 线宽 */
  lineWidth: number
  /** 线条样式 */
  lineStyle: LineDashStyle
  /** 是否显示标签 */
  showLabel: boolean
  /** 标签文字 */
  label?: string
  /** 是否可延伸 */
  extend: boolean
  /** 透明度 0-1 */
  opacity: number
  /** 创建时间戳 */
  createdAt: number
}

/** 趋势线（两点连线） */
export interface TrendLine extends DrawingBase {
  type: 'trendLine'
  /** 起点 */
  point1: { time: Time; price: number }
  /** 终点 */
  point2: { time: Time; price: number }
  /** 向右延伸（默认 true） */
  extendRight: boolean
  /** 向左延伸（默认 false） */
  extendLeft: boolean
}

/** 水平线 */
export interface HorizontalLine extends DrawingBase {
  type: 'horizontalLine'
  /** 价格水平 */
  price: number
  /** 起始时间（可选，不指定则全屏） */
  startTime?: Time
  /** 结束时间（可选） */
  endTime?: Time
}

/** 射线 */
export interface RayLine extends DrawingBase {
  type: 'rayLine'
  /** 起点 */
  point: { time: Time; price: number }
  /** 角度（弧度） */
  angle: number
}

/** 所有画线工具的联合类型 */
export type Drawing = TrendLine | HorizontalLine | RayLine

/** 画线工具管理器状态 */
export interface DrawingManagerState {
  /** 所有画线 */
  drawings: Drawing[]
  /** 当前激活的工具 */
  activeTool: DrawingToolType | null
  /** 当前正在绘制的画线（未完成） */
  pendingDrawing: Drawing | null
  /** 是否显示画线工具 */
  visible: boolean
}

/** 画线工具配置 */
export interface DrawingToolConfig {
  /** 默认颜色 */
  defaultColor: string
  /** 默认线宽 */
  defaultLineWidth: number
  /** 默认线条样式 */
  defaultLineStyle: LineDashStyle
  /** 默认透明度 */
  defaultOpacity: number
  /** 选择态颜色 */
  selectedColor: string
  /** 吸附容差（像素） */
  snapTolerance: number
}

/** 默认画线工具配置 */
export const DEFAULT_DRAWING_CONFIG: DrawingToolConfig = {
  defaultColor: '#60a5fa',
  defaultLineWidth: 1,
  defaultLineStyle: 'solid',
  defaultOpacity: 0.8,
  selectedColor: '#fbbf24',
  snapTolerance: 5,
}

/** 画线工具颜色预设 */
export const DRAWING_COLOR_PRESETS = [
  '#60a5fa', // 浅蓝
  '#fbbf24', // 金色
  '#f87171', // 浅红
  '#4ade80', // 浅绿
  '#a78bfa', // 紫色
  '#fb923c', // 橙色
  '#e879f9', // 品红
  '#2dd4bf', // 青色
] as const

/** 线条样式映射（lightweight-charts LineStyle） */
export const LINE_STYLE_MAP: Record<LineDashStyle, number> = {
  solid: 0,
  dotted: 1,
  dashed: 2,
  largeDashed: 3,
  sparseDotted: 4,
}

/** 生成唯一 ID */
export function generateDrawingId(): string {
  return `draw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}