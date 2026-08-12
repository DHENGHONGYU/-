/**
 * @module multiFactorScreeningConfig
 * @description 多因子筛选器业务配置：因子定义、操作符、存储 key、UI 常量。
 * @remarks 所有数值/文案均来自本配置，组件中禁止硬编码。
  * @doc [V9-DOC-BACK-004, V9-DOC-DATA-009, V9-DOC-DATA-022, V9-DOC-DATA-011, V9-DOC-ARCH-007]
*/

import type {
  ScreeningFactorMeta,
  ScreeningLogic,
  ScreeningOperator,
} from '@/types/modules/screening.types'

export interface ScreeningOperatorOption {
  value: ScreeningOperator
  label: string
}

export const MULTI_FACTOR_SCREENING_FACTORS: ScreeningFactorMeta[] = [
  { factor: 'pe', label: '市盈率 PE', unit: '倍', step: 0.1, defaultOperator: 'lt', defaultValue: 20 },
  { factor: 'pb', label: '市净率 PB', unit: '倍', step: 0.1, defaultOperator: 'lt', defaultValue: 2 },
  { factor: 'roe', label: '净资产收益率 ROE', unit: '%', step: 0.1, defaultOperator: 'gt', defaultValue: 10 },
  { factor: 'marketCap', label: '总市值', unit: '亿', step: 1, defaultOperator: 'gt', defaultValue: 100 },
  { factor: 'revenueGrowth', label: '营收增速', unit: '%', step: 0.1, defaultOperator: 'gt', defaultValue: 15 },
  { factor: 'profitGrowth', label: '净利润增速', unit: '%', step: 0.1, defaultOperator: 'gt', defaultValue: 15 },
]

export const MULTI_FACTOR_SCREENING_OPERATORS: ScreeningOperatorOption[] = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'eq', label: '=' },
  { value: 'between', label: '区间' },
]

export const MULTI_FACTOR_SCREENING_LOGICS: { value: ScreeningLogic; label: string }[] = [
  { value: 'and', label: '且' },
  { value: 'or', label: '或' },
]

/** localStorage 存储 key */
export const MULTI_FACTOR_SCREENING_STORAGE_KEY = 'templates'

/** 模板名称长度限制 */
export const MULTI_FACTOR_SCREENING_TEMPLATE_NAME_MAX_LENGTH = 50

/** 默认条件组逻辑 */
export const MULTI_FACTOR_SCREENING_DEFAULT_LOGIC: ScreeningLogic = 'and'

/** CSV 文件名时间戳格式长度（仅用于 Date.now() 字符串） */
export const MULTI_FACTOR_SCREENING_CSV_FILENAME_PREFIX = 'multi_factor_screening'
