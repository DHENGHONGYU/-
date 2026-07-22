/**
 * 申万宏源 3 级行业分类映射表
 *
 * @description
 * 提供 A 股 stock_code → {swL1, swL2, swL3} 的 O(1) 查表能力。
 * 港股不在该映射中出现，enrich 时未命中返回 undefined。
 *
 * 更新方式：
 * ```bash
 * npm run build:sw-industry
 * ```
 *
 * @module services/stock/swIndustryMap
 */

export interface SwIndustry {
  swL1: string
  swL2: string
  swL3: string
}

/**
 * A 股申万行业分类映射（stock_code → SwIndustry）
 * 由 scripts/generate-sw-industry.py 自动生成
 */
export const SW_INDUSTRY_MAP: Record<string, SwIndustry> = {}
