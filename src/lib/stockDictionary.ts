/**
 * @fileoverview 股票字典查询防腐层
 * 从 domain 层 re-export，供 pages/components 使用
 * lib 层禁止直接依赖 services，通过 domain 中转
 */

export { findStockBySymbol } from '@/domain/stock/stockDictionary'
export type { StockDictItem } from '@/domain/stock/stockDictionary'