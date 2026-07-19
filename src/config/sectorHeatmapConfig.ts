/**
 * @module sectorHeatmapConfig
 * @description 板块轮动热力图配置：时间窗口、着色指标、布局与颜色强度参数。
 * @remarks 所有数值均来自常量，组件中禁止硬编码。
  * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
*/

import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

/** 时间窗口选项 */
export type SectorHeatmapTimeWindow = 'day' | 'week' | 'month'

/** 着色指标选项 */
export type SectorHeatmapMetric = 'changePercent' | 'turnover' | 'fundFlow'

export interface SectorHeatmapWindowOption {
  value: SectorHeatmapTimeWindow
  label: string
}

export interface SectorHeatmapMetricOption {
  value: SectorHeatmapMetric
  label: string
  unit: string
}

/** 时间窗口配置 */
export const SECTOR_HEATMAP_TIME_WINDOWS: SectorHeatmapWindowOption[] = [
  { value: 'day', label: '日线' },
  { value: 'week', label: '周线' },
  { value: 'month', label: '月线' },
]

/** 着色指标配置 */
export const SECTOR_HEATMAP_METRICS: SectorHeatmapMetricOption[] = [
  { value: 'changePercent', label: '涨跌幅', unit: '%' },
  { value: 'turnover', label: '换手率', unit: '%' },
  { value: 'fundFlow', label: '资金流向', unit: '%' },
]

/** 热力图网格列数 */
export const SECTOR_HEATMAP_COLUMNS = 5

/** 排行榜展示条数 */
export const SECTOR_HEATMAP_RANK_LIMIT = 5

/** 颜色强度基准值（绝对值达到基准时 opacity=1） */
export const SECTOR_HEATMAP_INTENSITY_REFERENCE: Record<SectorHeatmapMetric, number> = {
  changePercent: 5,
  turnover: 3,
  fundFlow: 1,
}

/** 各指标颜色映射 */
export const SECTOR_HEATMAP_COLORS: Record<
  SectorHeatmapMetric,
  { positive: string; negative: string; neutral: string }
> = {
  changePercent: {
    positive: STOCK_COLOR_TOKENS.up.hex,
    negative: STOCK_COLOR_TOKENS.down.hex,
    neutral: STOCK_COLOR_TOKENS.neutral.hex,
  },
  turnover: {
    positive: STOCK_COLOR_TOKENS.neutral.hex,
    negative: STOCK_COLOR_TOKENS.neutral.hex,
    neutral: STOCK_COLOR_TOKENS.neutral.hex,
  },
  fundFlow: {
    positive: STOCK_COLOR_TOKENS.up.hex,
    negative: STOCK_COLOR_TOKENS.down.hex,
    neutral: STOCK_COLOR_TOKENS.neutral.hex,
  },
}

/** 透明度边界 */
export const SECTOR_HEATMAP_OPACITY = {
  min: 0.12,
  max: 1,
  textThreshold: 0.5,
} as const

/** 字体颜色 */
export const SECTOR_HEATMAP_TEXT_COLORS = {
  onDark: '#ffffff',
  onLight: '#1f2937',
} as const
