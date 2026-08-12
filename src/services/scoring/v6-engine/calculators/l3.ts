/**
 * L3 计算器（兼容入口）
 * 
 * @deprecated 请使用 `import { L3aFinancialCalculator, L3vValuationCalculator } from './l3'`
 * 
 * 本文件保留用于向后兼容，实际实现已拆分到：
 * - ./l3/l3a-financial.ts - L3a 财务健康计算器（330 行）
 * - ./l3/l3v-valuation.ts - L3v 估值水平计算器（125 行）
 * - ./l3/utils.ts - 工具函数（34 行）
 * - ./l3/helpers.ts - 辅助函数（70 行）
 * 
 * 拆分后文件行数统计：
 * - l3a-financial.ts: 330 行（符合 ≤300 行建议，略超出但可接受）
 * - l3v-valuation.ts: 125 行 ✅
 * - utils.ts: 34 行 ✅
 * - helpers.ts: 70 行 ✅
 * - 原 l3.ts: 536 行 → 拆分后约 20 行 ✅
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-FRONT-012]
*/

// 重新导出所有计算器和工具函数
// 注意：必须明确指定 ./l3/index，避免与当前文件（l3.ts）产生循环引用
export { L3aFinancialCalculator, L3vValuationCalculator } from './l3/index'
export { matchIndustryBenchmark, clamp, type FinancialDimensionScore } from './l3/index'
export { scoreMoat, scoreCompetition } from './l3/index'
