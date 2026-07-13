/**
 * @module backtest.types
 * @description 策略回测模块类型定义（DA-006 导出扩展）。
 * 补充回测导出所需的持仓快照、净值序列与导出配置类型，
 * 与 src/store/backtestStore.ts 中已有的 BacktestResult / BacktestTrade 互补。
/** 回测策略类型 */
export type BacktestStrategy = 'hot_sector' | 'value_pit' | 'composite'

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

/** 回测交易记录 */
export interface BacktestTrade {
  symbol: string
  direction: 'buy' | 'sell'
  price: number
  quantity: number
  date: string
  pnl: number
  pnlPct: number
  reason: string
}

/** 回测结果 */
export interface BacktestResult {
  totalReturn: number
  annualizedReturn: number
  maxDrawdown: number
  sharpeRatio: number
  winRate: number
  tradeCount: number
  profitTrades: number
  lossTrades: number
  avgProfit: number
  avgLoss: number
  pnlCurve: number[]
  trades: BacktestTrade[]
  /** 最终持仓快照（导出用，由 BacktestEngine 计算） */
  positions?: BacktestPosition[]
  /** 每日净值序列（导出用，由 BacktestEngine 计算） */
  dailyValues?: BacktestDailyValue[]
}

/** 回测配置 */
export interface BacktestConfig {
  strategy: BacktestStrategy
  startDate: string
  endDate: string
  initialCapital: number
}

/** 回测历史记录项 */
export interface BacktestHistoryRecord {
  /** 唯一标识 */
  id: string
  /** 回测配置（快照） */
  config: BacktestConfig
  /** 回测结果 */
  result: BacktestResult
  /** 创建时间戳 */
  createdAt: number
}

/** 回测历史记录查询参数 */
export interface BacktestHistoryQuery {
  /** 按策略过滤 */
  strategy?: BacktestStrategy
  /** 最早时间 */
  fromDate?: number
  /** 最晚时间 */
  toDate?: number
  /** 最大条数 */
  limit?: number
}
