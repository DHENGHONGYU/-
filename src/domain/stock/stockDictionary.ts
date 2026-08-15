/**
 * @fileoverview 股票字典领域服务
 * 领域层防腐封装，供 lib/services/pages 跨层复用
 * 避免 lib 直接依赖 services 层
 */

export { findStockBySymbol, toExchangeSymbol } from '@/services/stock/stockDictionary'
export type { StockDictItem } from '@/services/stock/stockDictionary'