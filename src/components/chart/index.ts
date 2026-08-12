/**
 * @doc [V9-DOC-FRONT-046]
 */
// ============================================================
// 图表组件统一导出
// ============================================================

// 组件导出（named + default 双导出，兼容各种导入方式）
export { default as LineChart } from './LineChart'
export { default as BarChart } from './BarChart'
export { default as AreaChart } from './AreaChart'
export { default as ScoreRadar } from './ScoreRadar'
export { GaugeChart, GaugeRing } from './GaugeChart'
export { default as FactorHeatmap } from './FactorHeatmap'

// K线图组件（v2.9.6 新增买卖点标注能力）
export { CandlestickSeriesChart, CandlestickChart } from './CandlestickChart'
export type { CandlestickChartData, CandlestickChartProps } from './CandlestickChart'

// 行业分析图表组件（v2.9.5 新增）
export {
  IndustryV4Radar,
  IndustryV4RadarChart,
  SubIndicatorBar,
  SubIndicatorBarChart,
  IndustryHeatmap,
  IndustryHeatmapChart,
  ValuationDistribution,
  ValuationDistributionChart,
  buildHistogram,
} from './industry'
/**
 * @internal 行业分析预留组件，已从对外导出移除（registry 内部用）：
 *   TrendLineChart · IndustryTrendChart · IndustryV4Panel
 * 接入产品路由/Widget 后重新开放 export，禁止直接 <JSX> 静态直引。
 */

// 筹码分布图组件
export { default as ChipDistributionChart } from './ChipDistributionChart'
export type { ChipDistributionChartProps, ChipTradePoint } from './ChipDistributionChart'

// 命名的组件导出（部分组件同时有 named export）
export { LineChart as LineChartComponent } from './LineChart'
export { BarChart as BarChartComponent } from './BarChart'
export { AreaChart as AreaChartComponent } from './AreaChart'
export { ScoreRadarChart } from './ScoreRadar'

// 类型导出
export type { ScoreRadarData, ScoreRadarProps } from './ScoreRadar'
export type { GaugeChartProps } from './GaugeChart'

// 行业分析图表类型导出（v2.9.5 新增）
export type {
  IndustryV4RadarProps,
  IndustryV4RadarDataItem,
  IndustryV4RadarSeries,
  SubIndicatorBarProps,
  SubIndicatorBarDataItem,
  IndustryHeatmapProps,
  IndustryHeatmapDataItem,
  HeatmapColorScheme,
  ValuationDistributionProps,
  ValuationDistributionBin,
} from './industry'
/**
 * @internal 行业分析预留类型（随组件一并从对外导出移除）：
 *   TrendLineChartProps · TrendLineDataPoint · TrendLineSeries · TrendLineReferenceLine · IndustryV4PanelProps
 * 产品规划确认接入方式后，与组件同时恢复类型导出。
 */
