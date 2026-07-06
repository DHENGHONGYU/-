/**
 * @module input.types
 * @description 输入舱模块类型定义
 */

/** Mock 股票数据（离线搜索降级数据源） */
export interface MockStock {
  symbol: string
  name: string
  industry: string
  pe?: number
  pb?: number
  marketCap?: number
}

/** 股票搜索结果 */
export type StockSearchResult = MockStock
