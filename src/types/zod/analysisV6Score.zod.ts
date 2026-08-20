/**
 * @fileoverview 分析舱 · V6 评分 DTO Zod Schema（AnalysisV6Score）
 *
 * 对应 TS 类型: {@link @/types/modules/score.types.ts → ScoreTrendPoint/Data / DimensionComparison* / ScoreComparisonTimelineItem}
 * 设计原则: 1. 分数 number ∈ [0, 100]（评分域边界）；delta 允许 [-100, 100]
 *         2. enum 使用 z.enum（对 ScoreTrendPeriod / ScoreTrendEntityType / ScoreComparisonMode 双射）
 *         3. recommendation 对象结构使用 zod 内联 或 Z_RECOMMENDATION 提取复用
 *
 * 纯新增窄化扩展 (方案 A): 对 src/types/modules/score.types.ts 零侵入
 */

import { z } from 'zod'

// ---------- 1. 枚举 (与 TS type 双射) ----------
export const Z_SCORE_TREND_PERIOD = z.enum(['week', 'month', 'quarter'])
export const Z_SCORE_TREND_ENTITY_TYPE = z.enum(['industry', 'stock'])
export const Z_SCORE_COMPARISON_MODE = z.enum(['same-stock-versions', 'cross-stock-latest'])

// ---------- 2. 数字边界 ----------
const Z_SCORE_0_100 = z.number().finite().min(0, '评分不得 < 0').max(100, '评分不得 > 100')
const Z_DELTA_NEG_100_POS_100 = z.number().finite().min(-100).max(100)
const Z_WEIGHT_0_1 = z.number().finite().min(0).max(1)
const Z_NATURAL_NUMBER = z.number().int().finite().nonnegative()

// ---------- 3. 嵌套类型（与 TS interface 双射） ----------
export const Z_RECOMMENDATION = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  color: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'color 必须为 hex #RGB 或 #RRGGBB'),
}).strict()

export const Z_SCORE_TREND_POINT = z.object({
  period: z.string().min(1, 'period 不得为空（例 2026-W27）'),
  composite: Z_SCORE_0_100,
  count: Z_NATURAL_NUMBER.min(1, '样本数必须 ≥ 1'),
  dimensions: z.record(z.string().min(1), Z_SCORE_0_100),
}).strict()

export const Z_SCORE_TREND_DATA = z.object({
  entityId: z.string().min(1),
  entityType: Z_SCORE_TREND_ENTITY_TYPE,
  period: Z_SCORE_TREND_PERIOD,
  points: z.array(Z_SCORE_TREND_POINT).min(1),
}).strict()

export const Z_DIMENSION_COMPARISON_ITEM = z.object({
  code: z.string().min(1, '维度 code 必填'),
  leftScore: Z_SCORE_0_100,
  rightScore: Z_SCORE_0_100,
  delta: Z_DELTA_NEG_100_POS_100,
  leftWeight: Z_WEIGHT_0_1,
  rightWeight: Z_WEIGHT_0_1,
  leftReason: z.string(),
  rightReason: z.string(),
}).strict()

// 评分比对左右侧公用 sub-schema
const Z_SCORE_COMPARISON_SIDE = z.object({
  symbol: z.string().regex(/^\d{6}(?:\.[A-Z]{1,2})?$/),
  stockName: z.string().min(1),
  version: z.number().int().finite().positive(),
  scoreDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'scoreDate 必须 YYYY-MM-DD'),
  composite: Z_SCORE_0_100,
  l3v: z.number().finite().min(0),
  recommendation: Z_RECOMMENDATION,
  modelUsed: z.string().min(1),
}).strict()

export const Z_SCORE_COMPARISON_RESULT = z.object({
  mode: Z_SCORE_COMPARISON_MODE,
  left: Z_SCORE_COMPARISON_SIDE,
  right: Z_SCORE_COMPARISON_SIDE,
  compositeDelta: Z_DELTA_NEG_100_POS_100,
  l3vDelta: z.number().finite(),
  dimensions: z.array(Z_DIMENSION_COMPARISON_ITEM).min(1, '至少需要 1 个维度对比'),
  ratingChanged: z.boolean(),
  addedDimensions: z.array(z.string().min(1)),
  removedDimensions: z.array(z.string().min(1)),
  topRisingDimensions: z.array(Z_DIMENSION_COMPARISON_ITEM),
  topFallingDimensions: z.array(Z_DIMENSION_COMPARISON_ITEM),
}).strict()

export const Z_SCORE_COMPARISON_TIMELINE_ITEM = z.object({
  version: z.number().int().positive().finite(),
  scoreDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  composite: Z_SCORE_0_100,
  changeFromPrev: Z_DELTA_NEG_100_POS_100.nullable(),
}).strict()

// ---------- 4. 顶层 DTO: Analysis V6 Score 输出 ----------
export const Z_ANALYSIS_V6_SCORE_DTO = z.object({
  reportId: z.string().uuid(),
  generatedAt: z.string().datetime({ offset: true }),
  /** 评分趋势快照（1 只股票 / 1 行业） */
  trendSnapshot: Z_SCORE_TREND_DATA.nullable().optional(),
  /** 与上版本 / 同行业对手比对结果 */
  comparison: Z_SCORE_COMPARISON_RESULT.nullable().optional(),
  /** 版本比对时间轴 */
  timeline: z.array(Z_SCORE_COMPARISON_TIMELINE_ITEM).default([]),
}).strict()

// ---------- 5. TS 类型反推 ----------
export type ScoreTrendPointZod = z.infer<typeof Z_SCORE_TREND_POINT>
export type ScoreTrendDataZod = z.infer<typeof Z_SCORE_TREND_DATA>
export type DimensionComparisonItemZod = z.infer<typeof Z_DIMENSION_COMPARISON_ITEM>
export type ScoreComparisonResultZod = z.infer<typeof Z_SCORE_COMPARISON_RESULT>
export type ScoreComparisonTimelineItemZod = z.infer<typeof Z_SCORE_COMPARISON_TIMELINE_ITEM>
export type AnalysisV6ScoreDto = z.infer<typeof Z_ANALYSIS_V6_SCORE_DTO>
