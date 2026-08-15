/**
 * SignalQualityDashboardWidget Utilities
 * Extracted from SignalQualityDashboardWidget.tsx
 */

import { COLOR_TOKENS, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import {
  METRIC_GOOD_THRESHOLD,
  METRIC_WARN_THRESHOLD,
  SHARPE_GOOD_THRESHOLD,
  SHARPE_WARN_THRESHOLD,
} from './SignalQualityDashboardWidget.constants'

/** 格式化百分比（0-1 → "65.0%"） */
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

/** 格式化百分比（0-100 → "65.0%"），用于已为百分比的值 */
export function formatPercentFrom100(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  return `${value.toFixed(1)}%`
}

/** 格式化数字（保留 2 位小数） */
export function formatDecimal(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  return value.toFixed(2)
}

/** 格式化时间戳为本地时间 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 根据准确率返回徽章颜色 */
export function getAccuracyBadgeClass(accuracy: number | undefined | null): string {
  if (accuracy === undefined || accuracy === null) return STOCK_COLOR_TOKENS.neutral.tailwind
  if (accuracy >= METRIC_GOOD_THRESHOLD) return COLOR_TOKENS.success.tailwind
  if (accuracy >= METRIC_WARN_THRESHOLD) return COLOR_TOKENS.warning.tailwind
  return COLOR_TOKENS.danger.tailwind
}

/** 根据 Sharpe 比率返回徽章颜色 */
export function getSharpeBadgeClass(sharpe: number | undefined | null): string {
  if (sharpe === undefined || sharpe === null) return STOCK_COLOR_TOKENS.neutral.tailwind
  if (sharpe >= SHARPE_GOOD_THRESHOLD) return COLOR_TOKENS.success.tailwind
  if (sharpe >= SHARPE_WARN_THRESHOLD) return COLOR_TOKENS.warning.tailwind
  return COLOR_TOKENS.danger.tailwind
}