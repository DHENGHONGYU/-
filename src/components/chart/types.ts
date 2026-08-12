/**
 * 图表共享类型定义
 */

/** K线数据基础结构 */
export interface CandlestickChartData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}
