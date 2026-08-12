/**
 * @module screening.types
 * @description 多因子选股筛选器类型定义（DA-007 四步集成合约：第 1 步）。
/** 可筛选因子  * @doc [V9-DOC-DATA-022, V9-DOC-DATA-011, V9-DOC-DATA-009, V9-DOC-BACK-004, V9-DOC-ARCH-007]
*/
export type ScreeningFactor =
  | 'pe'
  | 'pb'
  | 'roe'
  | 'marketCap'
  | 'revenueGrowth'
  | 'profitGrowth'

/** 筛选操作符 */
export type ScreeningOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'between'

/** 条件组内部逻辑 */
export type ScreeningLogic = 'and' | 'or'

/** 单条筛选条件 */
export interface ScreeningCriterion {
  /** 条件唯一标识 */
  id: string
  /** 筛选因子 */
  factor: ScreeningFactor
  /** 操作符 */
  operator: ScreeningOperator
  /** 主值 */
  value: number
  /** between 操作符的第二个边界值 */
  value2?: number
}

/** 条件组：内部支持且/或 */
export interface ScreeningConditionGroup {
  id: string
  logic: ScreeningLogic
  criteria: ScreeningCriterion[]
}

/** 用户保存的筛选模板 */
export interface ScreeningTemplate {
  id: string
  name: string
  description?: string
  groups: ScreeningConditionGroup[]
  createdAt: number
  updatedAt: number
}

/** 可被筛选的股票数据视图 */
export interface ScreenableStockData {
  symbol: string
  name: string
  sector: string | null
  pe: number | null
  pb: number | null
  roe: number | null
  marketCap: number | null
  revenueGrowth: number | null
  profitGrowth: number | null
}

/** 筛选结果项 */
export interface ScreeningResultItem extends ScreenableStockData {
  /** 命中的条件组 ID 列表 */
  matchedGroups: string[]
}

/** 一次筛选运行的完整结果 */
export interface ScreeningRunResult {
  items: ScreeningResultItem[]
  total: number
  elapsedMs: number
}

/** 因子元数据 */
export interface ScreeningFactorMeta {
  factor: ScreeningFactor
  label: string
  unit: string
  step: number
  defaultOperator: ScreeningOperator
  defaultValue: number
}
