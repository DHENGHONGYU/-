/**
 * @fileoverview Zod schema barrel re-export（PR-2 运行时校验统一入口）
 *
 * 集中导出所有业务域的 Zod schema，供数据边界校验使用。
 *
 * 使用方式：
 * ```typescript
 * import { executionPlanSchema, stockSchema } from '@/data/schemas'
 *
 * const result = executionPlanSchema.safeParse(input)
 * if (!result.success) {
 *   console.error(result.error.issues)
 * }
 * ```
 *
 * @module data/schemas
 * @updated 2026-07-07 - PR-2：新增 Zod schema 集合
  * @doc []
*/

// ============================================================
// 执行计划域
// ============================================================
export {
  executionPhaseSchema,
  riskSeveritySchema,
  executionDirectionSchema,
  executionResultSchema,
  riskCheckItemSchema,
  executionPlanSchema,
  executionLogSchema,
  missingReportSchema,
} from './schema.execution'

// ============================================================
// 股票基础域
// ============================================================
export {
  dataSourceSchema,
  researchStatusSchema,
  stockDataQualitySchema,
  financialReportSchema,
  stockSchema,
} from './schema.stock'

// ============================================================
// 订单/观察列表域
// ============================================================
export {
  orderDirectionSchema,
  orderStatusSchema,
  accountTypeSchema,
  orderSchema,
  watchlistSchema,
} from './schema.order'

// ============================================================
// 信号域
// ============================================================
export {
  signalSnapshotSchema,
  signalSchema,
  researchLogSchema,
} from './schema.signal'

// ============================================================
// 行情数据域
// ============================================================
export {
  klineBarSchema,
  dailyQuotesSchema,
} from './schema.marketData'

// ============================================================
// 评分域
// ============================================================
export {
  v6RatingSchema,
  layerDetailSchema,
  v6ScoreSchema,
  dimensionScoreSchema,
} from './schema.score'
