/**
 * L3 计算器模块导出
 * 
 * 包含：
 * - L3a 财务健康计算器
 * - L3v 估值水平计算器
 * - 工具函数（行业基准匹配、评分截断等）
 * - 辅助函数（护城河评分、竞争格局评分）
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-FRONT-012]
*/

export { L3aFinancialCalculator } from './l3a-financial'
export { L3vValuationCalculator } from './l3v-valuation'
export { matchIndustryBenchmark, clamp, type FinancialDimensionScore } from './utils'
export { scoreMoat, scoreCompetition } from './helpers'
