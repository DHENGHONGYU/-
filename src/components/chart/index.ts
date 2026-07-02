// ============================================================
// 图表组件统一导出
// ============================================================

// 组件导出（named + default 双导出，兼容各种导入方式）
export { default as LineChart } from './LineChart'
export { default as BarChart } from './BarChart'
export { default as AreaChart } from './AreaChart'
export { default as ScoreRadar } from './ScoreRadar'
export { default as CandlestickChart } from './CandlestickChart'
export { default as FactorHeatmap } from './FactorHeatmap'

// 命名的组件导出（部分组件同时有 named export）
export { LineChart as LineChartComponent } from './LineChart'
export { BarChart as BarChartComponent } from './BarChart'
export { AreaChart as AreaChartComponent } from './AreaChart'
export { ScoreRadarChart } from './ScoreRadar'
export { CandlestickSeriesChart } from './CandlestickChart'
export { FactorHeatmapChart } from './FactorHeatmap'

// 类型导出
export type { ScoreRadarData, ScoreRadarProps } from './ScoreRadar'
export type { CandlestickChartData, CandlestickChartProps } from './CandlestickChart'
export type { FactorHeatmapData, FactorHeatmapProps } from './FactorHeatmap'
