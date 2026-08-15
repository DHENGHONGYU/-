/**
 * SignalQualityDashboardWidget Constants
 * Extracted from SignalQualityDashboardWidget.tsx
 */

import { COLOR_TOKENS, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

/** 趋势图滚动窗口大小（每 20 条信号为一个统计周期） */
export const TREND_WINDOW_SIZE = 20

/** Top 信号类型显示数量 */
export const TOP_SIGNAL_TYPES_LIMIT = 5

/** 最近复盘列表显示数量 */
export const RECENT_REVIEWS_LIMIT = 5

/** 信号方向枚举（与 SignalReviewRecord.direction 对应） */
export type SignalDirection = 'buy' | 'sell' | 'hold' | 'watch'

/** 信号方向图标颜色映射（业务语义色，非涨跌色） */
export const DIRECTION_COLOR: Record<SignalDirection, string> = {
  buy: COLOR_TOKENS.success.tailwind,
  sell: COLOR_TOKENS.danger.tailwind,
  hold: COLOR_TOKENS.info.tailwind,
  watch: STOCK_COLOR_TOKENS.neutral.tailwind,
}

/** 信号方向中文标签 */
export const DIRECTION_LABEL: Record<SignalDirection, string> = {
  buy: '买入',
  sell: '卖出',
  hold: '持有',
  watch: '观察',
}

/** 指标良好阈值（≥ 显示绿色） */
export const METRIC_GOOD_THRESHOLD = 0.7
/** 指标警告阈值（≥ 显示黄色） */
export const METRIC_WARN_THRESHOLD = 0.5
/** Sharpe 比率良好阈值 */
export const SHARPE_GOOD_THRESHOLD = 1
/** Sharpe 比率警告阈值 */
export const SHARPE_WARN_THRESHOLD = 0