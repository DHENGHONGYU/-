/**
 * 港股恒生行业分类(HSICS)映射表
 *
 * @description
 * 提供港股 stock_code → {swL1} 的 O(1) 查表能力（仅取恒生一级行业）。
 * 数据来源于理杏仁(Lixinger)开放 API 的恒生行业分类(HSICS)标准：
 * 11 个板块（一级行业）。
 * 港股 symbol 不带交易所后缀（如 '00001'），与 stockDictionary 中 market:'HK' 的条目一致。
 *
 * 更新方式：
 * ```bash
 * LIXINGER_TOKEN=xxx npm run build:hk-industry
 * ```
 *
 * @module services/stock/hkIndustryMap
 */

export interface HkIndustry {
  swL1: string
}

export const HK_INDUSTRY_MAP: Record<string, HkIndustry> = {}
