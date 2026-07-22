/**
 * 行业分类查表工具
 *
 * @description
 * 提供 O(1) 行业分类查表 + StockDictItem 数据 enrichment。
 * 港股 / 未覆盖 A 股 → getSwIndustry 返回 undefined。
 *
 * @module services/stock/industryLookup
 */

import { SW_INDUSTRY_MAP, type SwIndustry } from './swIndustryMap'
import type { StockDictItem } from './stockDictionary'

/**
 * 按股票代码查申万行业分类
 *
 * @param symbol 股票代码（不含交易所后缀）
 * @returns SwIndustry | undefined（港股 / 未覆盖 A 股返回 undefined）
 */
export function getSwIndustry(symbol: string): SwIndustry | undefined {
  return SW_INDUSTRY_MAP[symbol]
}

/**
 * 为 StockDictItem 附加行业分类数据
 *
 * @param item 原始 StockDictItem
 * @returns 附带了 swL1/swL2/swL3 的 StockDictItem（未命中则原样返回）
 */
export function enrichStockDictItem(item: StockDictItem): StockDictItem {
  const industry = getSwIndustry(item.symbol)
  if (!industry) return item
  return {
    ...item,
    swL1: industry.swL1,
    swL2: industry.swL2,
    swL3: industry.swL3,
  }
}
