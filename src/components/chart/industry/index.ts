// ============================================================
// 行业分析图表组件统一导出
// ============================================================

export { default as IndustryV4Radar } from './IndustryV4Radar'
export { IndustryV4RadarChart } from './IndustryV4Radar'
export type { IndustryV4RadarProps, IndustryV4RadarDataItem, IndustryV4RadarSeries } from './IndustryV4Radar'

export { default as SubIndicatorBar } from './SubIndicatorBar'
export { SubIndicatorBarChart } from './SubIndicatorBar'
export type { SubIndicatorBarProps, SubIndicatorBarDataItem } from './SubIndicatorBar'

export { default as IndustryHeatmap } from './IndustryHeatmap'
export { IndustryHeatmapChart } from './IndustryHeatmap'
export type { IndustryHeatmapProps, IndustryHeatmapDataItem, HeatmapColorScheme } from './IndustryHeatmap'

export { default as TrendLineChart } from './TrendLineChart'
export { IndustryTrendChart } from './TrendLineChart'
export type { TrendLineChartProps, TrendLineDataPoint, TrendLineSeries, TrendLineReferenceLine } from './TrendLineChart'

export { default as ValuationDistribution } from './ValuationDistribution'
export { ValuationDistributionChart } from './ValuationDistribution'
export { buildHistogram } from './ValuationDistribution'
export type { ValuationDistributionProps, ValuationDistributionBin } from './ValuationDistribution'

export { default as IndustryV4Panel } from './IndustryV4Panel'
export type { IndustryV4PanelProps, V4DimensionName } from './IndustryV4Panel'
