/**
 * FullMarketStockService - A+H 股全市场股票搜索服务
 *
 * @description
 * 核心股票搜索引擎，支持两层搜索策略：
 *    Layer 1（主方案）：本地静态字典匹配（离线，<1ms 响应）
 *    Layer 2（回退）  ：腾讯 Smartbox API 在线补充（网络可达时）
 *
 * 匹配优先级：精确匹配 > 代码前缀匹配 > 名称前缀匹配 > 名称模糊包含
 *
 * @module services/stock/FullMarketStockService
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-027, V9-DOC-BACK-023, V9-DOC-BACK-021, V9-DOC-BACK-033]
*/

import STOCK_DICT, { type StockDictItem } from './stockDictionary'
import { searchViaSmartbox } from './stockSearchClient'

export interface MarketStockResult {
  symbol: string
  name: string
  market: string
  /** 匹配来源：'dict'（本地字典）| 'smartbox'（API 回退） */
  source: 'dict' | 'smartbox'
}

/**
 * 在本地字典中搜索匹配的股票
 */
function searchLocalDict(query: string): StockDictItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const exact: StockDictItem[] = []
  const prefix: StockDictItem[] = []
  const namePrefix: StockDictItem[] = []
  const fuzzy: StockDictItem[] = []

  for (const stock of STOCK_DICT) {
    const symbolLower = stock.symbol.toLowerCase()
    const nameLower = stock.name.toLowerCase()

    // 精确匹配
    if (symbolLower === q || nameLower === q) {
      exact.push(stock)
      continue
    }

    // 代码前缀匹配
    if (symbolLower.startsWith(q)) {
      prefix.push(stock)
      continue
    }

    // 名称前缀匹配
    if (nameLower.startsWith(q)) {
      namePrefix.push(stock)
      continue
    }

    // 名称模糊包含
    if (nameLower.includes(q)) {
      fuzzy.push(stock)
    }
  }

  return [...exact, ...prefix, ...namePrefix, ...fuzzy]
}

/**
 * A+H 股全市场搜索（本地字典主搜索 + Smartbox API 回退）
 *
 * @param query 搜索关键词
 * @param existingSymbols 已导入的股票代码集合（用于标记"已录入"）
 * @param maxResults 最大返回条数
 * @returns 匹配结果，按优先级排列
 */
export async function searchFullMarket(
  query: string,
  existingSymbols: Set<string> = new Set(),
  maxResults = 20,
): Promise<MarketStockResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  // ---- Layer 1：本地字典搜索 ----
  const dictResults = searchLocalDict(trimmed)

  // 将本地结果转换为统一格式
  const localResults: MarketStockResult[] = dictResults.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    market: s.market,
    source: 'dict' as const,
  }))

  // 本地结果足够时（>= maxResults * 0.6），不调 API
  if (localResults.length >= Math.ceil(maxResults * 0.6)) {
    // 根据已导入状态重新排序（已导入的排前面）
    return reorderByExisting(localResults, existingSymbols, maxResults)
  }

  // ---- Layer 2：Smartbox API 回退 ----
  let apiResults: MarketStockResult[] = []
  try {
    const smartboxItems = await searchViaSmartbox(trimmed, maxResults)
    apiResults = smartboxItems.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      market: item.market,
      source: 'smartbox' as const,
    }))
  } catch {
    // API 不可达时仅返回本地结果
    return localResults.slice(0, maxResults)
  }

  // ---- 合并去重 ----
  const seenSymbols = new Set<string>()
  const merged: MarketStockResult[] = []

  // 按 source 权重排序：dict > smartbox；同一 source 内保持原有顺序
  const allResults = [...localResults, ...apiResults]

  for (const item of allResults) {
    if (!seenSymbols.has(item.symbol)) {
      seenSymbols.add(item.symbol)
      merged.push(item)
    }
  }

  return reorderByExisting(merged, existingSymbols, maxResults)
}

/**
 * 将已导入的标的排在前面，并控制返回数量
 */
function reorderByExisting(
  results: MarketStockResult[],
  existingSymbols: Set<string>,
  maxResults: number,
): MarketStockResult[] {
  const existing: MarketStockResult[] = []
  const notExisting: MarketStockResult[] = []

  for (const item of results) {
    if (existingSymbols.has(item.symbol)) {
      existing.push(item)
    } else {
      notExisting.push(item)
    }
  }

  return [...existing, ...notExisting].slice(0, maxResults)
}
