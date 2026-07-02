/**
 * @module backtest.types
 * @description 策略回测模块类型定义（DA-006 导出扩展）。
 * 补充回测导出所需的持仓快照、净值序列与导出配置类型，
 * 与 src/store/backtestStore.ts 中已有的 BacktestResult / BacktestTrade 互补。
 */

/** 回测持仓快照 */
export interface BacktestPosition {
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
}

/** 单日净值记录 */
export interface BacktestDailyValue {
  date: string
  totalValue: number
  cash: number
}

/** 回测导出支持的格式 */
export type BacktestExportFormat = 'pdf' | 'excel'

/** 回测报告元数据 */
export interface BacktestReportMeta {
  strategy: string
  startDate: string
  endDate: string
  initialCapital: number
  generatedAt: string
}

/** Excel 多 Sheet 数据结构 */
export interface BacktestExcelSheets {
  summary: Array<Record<string, string | number>>
  positions: Array<Record<string, string | number>>
  trades: Array<Record<string, string | number>>
  dailyValues: Array<Record<string, string | number>>
}

/** 导出服务配置 */
export interface BacktestExportConfig {
  format: BacktestExportFormat
  filename?: string
}

/** 导出结果 */
export interface BacktestExportResult {
  success: boolean
  filename: string
  blob?: Blob
  error?: string
}
