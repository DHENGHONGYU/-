/**
 * @module dataSourceConfig.config
 * @description 数据源配置步骤的常量配置
 */

/**
 * @fileoverview AVAILABLE_DIMENSIONS Organism层组件（Organism层组件）
 * @module components/organisms/input/wizard-steps/dataSourceConfig.config
 */

export const AVAILABLE_DIMENSIONS = [
  { code: 'quote', name: '行情数据', description: '日线、分时、K线' },
  { code: 'financial', name: '财务数据', description: '三大报表、关键指标' },
  { code: 'news', name: '新闻舆情', description: '财经新闻、情感分析' },
  { code: 'sector', name: '板块行业', description: '行业景气、轮动评分' },
] as const

/** 频率标签映射 */
export const FREQUENCY_LABELS: Record<string, string> = {
  realtime: '实时',
  hourly: '每小时',
  daily: '每日',
  custom: '自定义',
}

/** 优先级标签映射 */
export const PRIORITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

/** 优先级颜色映射 */
export const PRIORITY_COLORS: Record<string, { text: string; bg: string }> = {
  high: { text: 'text-destructive', bg: 'bg-destructive/10' },
  medium: { text: 'text-warning', bg: 'bg-warning/10' },
  low: { text: 'text-success', bg: 'bg-success/10' },
}

export const DEFAULT_PRIORITY_STYLE = { text: 'text-warning', bg: 'bg-warning/10' }
