/**
 * 行业分类查表工具
 *
 * @description
 * 提供 O(1) 行业分类查表 + StockDictItem 数据 enrichment。
 * 港股 / 未覆盖 A 股 → getSwIndustry / getHkIndustry 返回 undefined。
 *
 * 数据回填策略（方案 B：补表 + 加载时 merge）：
 *   - 申万补表 swIndustryMap.ts（A 股三级）/ 港股补表 hkIndustryMap.ts（港股一级）
 *     作为 symbol → 行业 的补表，等效「字典即 DATABASE」。
 *   - 在字典被读取时（getEnrichedStockDict）一次性 merge 进 StockDictItem.swL*，
 *     已含字段则跳过（保留兼容），缓存后供全模块复用，diff 可控且不破坏 8331 条常量。
 *   - 同行业数由 countByIndustry 运行时统计（遍历字典 filter），不预存字段。
 *
 * @module services/stock/industryLookup
 */

import { SW_INDUSTRY_MAP, type SwIndustry } from './swIndustryMap'
import { HK_INDUSTRY_MAP, type HkIndustry } from './hkIndustryMap'
import STOCK_DICT, { type StockDictItem } from './stockDictionary'

/** 未匹配行业时的兜底展示文案 */
export const UNKNOWN_INDUSTRY_LABEL = '行业未知'

/**
 * 按股票代码查申万行业分类（A 股）
 *
 * @param symbol 股票代码（如 '600000'，与 stockDictionary 裸代码一致）
 * @returns SwIndustry | undefined（港股 / 未覆盖 A 股返回 undefined）
 */
export function getSwIndustry(symbol: string): SwIndustry | undefined {
  return SW_INDUSTRY_MAP[symbol]
}

/**
 * 按股票代码查港股恒生行业分类（HSICS）
 *
 * @param symbol 港股代码（如 '00001'，不带交易所后缀）
 * @returns HkIndustry | undefined（A 股 / 未覆盖港股返回 undefined）
 */
export function getHkIndustry(symbol: string): HkIndustry | undefined {
  return HK_INDUSTRY_MAP[symbol]
}

/**
 * 统一行业查表：按 market 路由到申万(A股) 或 恒生(HK) 映射表
 *
 * @param item 原始 StockDictItem
 * @returns SwIndustry | HkIndustry | undefined
 */
export function getIndustry(item: StockDictItem): SwIndustry | HkIndustry | undefined {
  if (item.market === 'HK') return getHkIndustry(item.symbol)
  return getSwIndustry(item.symbol)
}

/**
 * 为 StockDictItem 附加行业分类数据
 *
 * A 股附加申万三级（swL1/swL2/swL3）；港股仅附加恒生一级（swL1）。
 * 未命中则原样返回。
 *
 * 兼容性：若 item 已含任一行业字段（说明之前已 enrichment 过），直接原样返回，
 * 避免覆盖既有数据（如调用方已手动注入）。
 *
 * @param item 原始 StockDictItem
 * @returns 附带行业分类的 StockDictItem
 */
export function enrichStockDictItem(item: StockDictItem): StockDictItem {
  // 兼容：已含行业字段则跳过整段 enrichment
  if (item.swL1 || item.swL2 || item.swL3) return item

  if (item.market === 'HK') {
    const hk = getHkIndustry(item.symbol)
    return hk ? { ...item, swL1: hk.swL1 } : item
  }
  const sw = getSwIndustry(item.symbol)
  return sw ? { ...item, swL1: sw.swL1, swL2: sw.swL2, swL3: sw.swL3 } : item
}

/**
 * 模块级缓存：字典加载点 merge 的结果（仅首次读取时计算一次）
 */
let _enrichedDictCache: StockDictItem[] | null = null

/**
 * 获取「行业回填后」的股票字典（字典加载点 merge 注入点）
 *
 * 在字典首次被读取时，将申万/恒生补表 merge 进每个 StockDictItem 的 swL* 字段，
 * 并以模块级缓存复用，等效「字典即 DATABASE」。后续任意消费方（搜索、详情、统计）
 * 直接读取即已携带行业分类，无需重复 enrichment。
 *
 * @returns 已回填行业分类的 StockDictItem 数组（缓存复用）
 */
export function getEnrichedStockDict(): StockDictItem[] {
  if (_enrichedDictCache === null) {
    _enrichedDictCache = STOCK_DICT.map(enrichStockDictItem)
  }
  return _enrichedDictCache
}

/**
 * 构造行业路径文案（A 股三级 / 港股一级，用 ' / ' 连接）
 *
 * 空字段会被 filter(Boolean) 丢弃，因此港股（仅 swL1）只输出一级。
 *
 * @param item 含 swL1/swL2/swL3 的对象（StockDictItem 或 StockSearchResult 等）
 * @returns 形如 '食品饮料 / 白酒Ⅱ / 白酒Ⅲ' 或 '资讯科技业' 的路径字符串
 */
export function buildIndustryPath(item: Pick<StockDictItem, 'swL1' | 'swL2' | 'swL3'>): string {
  return [item.swL1, item.swL2, item.swL3].filter(Boolean).join(' / ')
}

/**
 * 运行时统计同行业股票数量
 *
 * 按市场路由：
 *   - A 股：以申万三级（swL3）为同行业判定键
 *   - 港股：以恒生一级（swL1）为同行业判定键
 * 遍历 getEnrichedStockDict() 实时 filter 计数，不预存字段。
 *
 * 边界处理：
 *   - code 在字典中不存在 → 返回 0
 *   - 目标股票未匹配行业（swL3/swL1 为空）→ 返回 0
 *
 * @param code 股票代码（与 stockDictionary 裸代码一致）
 * @returns 同行业股票数量（含自身）
 */
export function countByIndustry(code: string): number {
  const dict = getEnrichedStockDict()
  const target = dict.find((d) => d.symbol === code)
  if (!target) return 0

  if (target.market === 'HK') {
    if (!target.swL1) return 0
    return dict.filter((d) => d.market === 'HK' && d.swL1 === target.swL1).length
  }

  if (!target.swL3) return 0
  return dict.filter((d) => d.swL3 === target.swL3).length
}
