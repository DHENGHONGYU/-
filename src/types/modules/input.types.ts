/**
 * @module input.types
 * @description 输入舱模块类型定义
/** Mock 股票数据（离线搜索降级数据源）  * @doc [V9-DOC-QA-066]
*/
export interface MockStock {
  symbol: string
  name: string
  industry: string
  pe?: number
  pb?: number
  marketCap?: number
  swL1?: string
  swL2?: string
  swL3?: string
}

/** 股票搜索结果 */
export type StockSearchResult = MockStock
