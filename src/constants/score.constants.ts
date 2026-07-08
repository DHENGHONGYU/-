/**
 * 评分模块通用常量
 *
 * 所有 UI 标签、配置阈值集中管理，避免组件层硬编码。
 */

import type { ScoreTrendPeriod } from '@/types/modules/score.types'

export const SCORE_TREND_PERIOD_OPTIONS: { value: ScoreTrendPeriod; label: string }[] = [
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季' },
]

export const INTELLIGENT_SCORE_EXPLANATION_CONFIG = {
  /** 关键因子高亮阈值（≥该值视为强势维度） */
  highlightThreshold: 4,
  /** 展示的关键因子数量 */
  topFactorCount: 3,
  /** 思维链默认折叠 */
  chainCollapsed: true,
  /** 雷达图维度上限 */
  maxRadarDimensions: 8,
} as const

export const INTELLIGENT_SCORE_EXPLANATION_LABELS = {
  title: '智能评分解释',
  radarTitle: '维度雷达',
  heatmapTitle: '因子热力图',
  keyFactorsTitle: '关键因子',
  chainTitle: '思维链',
  expandChain: '展开思维链',
  collapseChain: '收起思维链',
  emptyTitle: '暂无评分解释',
  emptyDescription: '运行智能评分后查看维度与推理依据',
} as const

export const TREND_CHART_CONFIG = {
  height: 256,
  strokeWidth: 2,
  areaOpacity: 0.2,
} as const

export const TREND_CHART_LABELS = {
  title: '评分趋势',
  volatility: '波动',
  sampleCount: '样本数',
  emptyTitle: '暂无趋势数据',
  emptyDescription: '切换周期或稍后重试',
} as const

export const SCORE_HISTORY_LABELS = {
  title: '评分历史回溯',
  newer: '新版本',
  older: '旧版本',
  compositeDelta: '综合分变化',
  l3vDelta: 'L3V 变化',
  ratingChange: '评级变化',
  layerChange: '维度变化',
  emptyTitle: '历史版本不足',
  emptyDescription: '至少需要两次评分记录才能进行版本对比',
} as const
