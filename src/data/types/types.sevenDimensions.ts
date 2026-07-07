/**
 * @fileoverview 七维数据架构与统一股票视图类型（L1 七维数据业务域）
 *
 * V6 Pro 迁移：七维数据架构 + 统一股票数据视图
 *
 * DataDimensionType 和 DataDimensionMeta 的权威源在 @/config/dataDimensions，
 * 此处 re-export 保持 API 兼容性（PR-2 常量一致性修正）。
 *
 * @module data/types/types.sevenDimensions
 * @updated 2026-07-07 - PR-2：DataDimensionType/DataDimensionMeta 改为从 config re-export
 */

// DataDimensionType 和 DataDimensionMeta 权威源在 config 层
export type { DataDimensionType, DataDimensionMeta } from '@/config/dataDimensions'

/** 单维度采集状态 */
export interface DimensionStatus {
  status: 'pending' | 'collecting' | 'completed' | 'failed'
  records: number
  updatedAt: string
  hash?: string
}

/** 单股票元数据 */
export interface StockMeta {
  code: string
  name: string
  market: 'SH' | 'SZ' | 'BJ'
  industry: string
  addedAt: string
  lastCollectTime: string | null
  dimensions: Record<string, DimensionStatus>
}

/** 全局 meta.json 结构 */
export interface GlobalMeta {
  version: string
  schemaVersion: string
  createdAt: string
  lastUpdated: string
  stocks: StockMeta[]
  statistics: {
    totalStocks: number
    totalRecords: number
    totalNews: number
    totalEvents: number
    storageSizeMB: number
  }
}

/** 统一股票数据视图（聚合所有维度） */
export interface UnifiedStockData {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  volume: number
  amount: number
  open: number
  high: number
  low: number
  prevClose: number
  turnover: number | null
  marketCap: number | null
  pe: number | null
  pb: number | null
  roe: number | null
  grossMargin: number | null
  netMargin: number | null
  revenueGrowth: number | null
  profitGrowth: number | null
  debtRatio: number | null
  eps: number | null
  ma5: number | null
  ma10: number | null
  ma20: number | null
  macd: number | null
  rsi6: number | null
  rsi12: number | null
  rsi24: number | null
  k: number | null
  d: number | null
  j: number | null
  bollUpper: number | null
  bollMid: number | null
  bollLower: number | null
  atr: number | null
  maSignal: 'golden_cross' | 'death_cross' | 'neutral' | null
  rsiSignal: 'overbought' | 'oversold' | 'neutral' | null
  macdSignal: 'bullish' | 'bearish' | 'neutral' | null
  sentimentScore: number | null
  sentimentConfidence: number | null
  sectorName: string | null
  sectorRank: number | null
  sectorStrength: number | null
  trendScore: number | null
  valueScore: number | null
  fundScore: number | null
  sentimentFactorScore: number | null
  totalScore: number | null
  signalType: 'strong_buy' | 'buy' | 'hold' | 'watch' | null
  signalReason: string | null
  var95: number | null
  maxDrawdown: number | null
  timestamp: string
  dataSource: string
}
