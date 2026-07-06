/**
 * @module score.types
 * @description 评分模块类型定义
 */

/** 评分趋势周期 */
export type ScoreTrendPeriod = 'week' | 'month' | 'quarter'

/** 评分趋势实体类型 */
export type ScoreTrendEntityType = 'industry' | 'stock'

/** 评分趋势数据点 */
export interface ScoreTrendPoint {
  /** 周期标签，如 2026-W27 / 2026-07 / 2026-Q3 */
  period: string
  /** 综合评分平均值 */
  composite: number
  /** 参与聚合的样本数 */
  count: number
  /** 各维度平均分 */
  dimensions: Record<string, number>
}

/** 评分趋势数据 */
export interface ScoreTrendData {
  entityId: string
  entityType: ScoreTrendEntityType
  period: ScoreTrendPeriod
  points: ScoreTrendPoint[]
}
