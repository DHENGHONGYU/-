/**
 * L3 计算器工具函数
 * 
 * 提供行业基准匹配、评分截断等通用工具
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-FRONT-012]
*/

import type { IndustryBenchmark } from '../../config'
import { INDUSTRY_BENCHMARKS } from '../../config'

/** 匹配行业基准 */
export function matchIndustryBenchmark(sector: string | undefined): IndustryBenchmark | null {
  if (!sector) return null
  const lower = sector.toLowerCase()
  for (const bm of INDUSTRY_BENCHMARKS) {
    if (bm.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return bm
    }
  }
  return null
}

/** 截断到 0-5 范围 */
export function clamp(score: number): number {
  return Math.max(0, Math.min(5, score))
}

/** 财务多维度评分接口 */
export interface FinancialDimensionScore {
  revenue: number
  netProfitYoY: number
  profitability: number
  grossMargin: number
  rdRatio: number
  cashFlow: number
  orders: number
}
