/**
 * @module score.types
 * @description 评分模块类型定义
/** 评分趋势周期  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-BACK-005, V9-DOC-BACK-010, V9-DOC-PROJ-003]
*/
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

/** 评分比对模式 */
export type ScoreComparisonMode =
  /** 同股票不同版本比对 */
  | 'same-stock-versions'
  /** 不同股票最新版本比对 */
  | 'cross-stock-latest'

/** 维度比对项 */
export interface DimensionComparisonItem {
  /** 维度代码 */
  code: string
  /** 左侧得分 */
  leftScore: number
  /** 右侧得分 */
  rightScore: number
  /** 变化量（右 - 左） */
  delta: number
  /** 左侧权重 */
  leftWeight: number
  /** 右侧权重 */
  rightWeight: number
  /** 左侧理由 */
  leftReason: string
  /** 右侧理由 */
  rightReason: string
}

/** 评分比对结果 */
export interface ScoreComparisonResult {
  /** 比对模式 */
  mode: ScoreComparisonMode
  /** 左侧版本信息 */
  left: {
    symbol: string
    stockName: string
    version: number
    scoreDate: string
    composite: number
    l3v: number
    recommendation: { key: string; label: string; color: string }
    modelUsed: string
  }
  /** 右侧版本信息 */
  right: {
    symbol: string
    stockName: string
    version: number
    scoreDate: string
    composite: number
    l3v: number
    recommendation: { key: string; label: string; color: string }
    modelUsed: string
  }
  /** 综合分变化（右 - 左） */
  compositeDelta: number
  /** L3V 变化（右 - 左） */
  l3vDelta: number
  /** 各维度比对结果 */
  dimensions: DimensionComparisonItem[]
  /** 评级是否变化 */
  ratingChanged: boolean
  /** 新增维度（右侧有左侧没有） */
  addedDimensions: string[]
  /** 移除维度（左侧有右侧没有） */
  removedDimensions: string[]
  /** 上升幅度最大的维度 Top N */
  topRisingDimensions: DimensionComparisonItem[]
  /** 下降幅度最大的维度 Top N */
  topFallingDimensions: DimensionComparisonItem[]
}

/** 比对看板时间轴项 */
export interface ScoreComparisonTimelineItem {
  version: number
  scoreDate: string
  composite: number
  changeFromPrev: number | null
}
