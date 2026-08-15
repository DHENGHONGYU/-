/**
 * 图表共享配置
 *
 * 消除 candlestickChart.config.ts 和 multiPaneChart.config.ts 之间的重复常量。
 * 所有周期选项、复权选项、均线配置在此统一定义。
 *
 * @module components/chart/shared.config
 * @created 2026-08-15
 */

import { CHART_PALETTE_PRO } from '@/constants/theme.tokens'
import type { KlinePeriod, KlineAdjust } from '@/services/fetcher/fetcherTypes'

/** 周期选项配置 */
export const PERIOD_OPTIONS: Array<{ value: KlinePeriod; label: string; group: 'intraday' | 'daily' }> = [
  { value: '1min', label: '1分', group: 'intraday' },
  { value: '5min', label: '5分', group: 'intraday' },
  { value: '15min', label: '15分', group: 'intraday' },
  { value: '30min', label: '30分', group: 'intraday' },
  { value: '60min', label: '60分', group: 'intraday' },
  { value: 'daily', label: '日线', group: 'daily' },
  { value: 'weekly', label: '周线', group: 'daily' },
  { value: 'monthly', label: '月线', group: 'daily' },
]

/** 复权选项配置 */
export const ADJUST_OPTIONS: Array<{ value: KlineAdjust; label: string }> = [
  { value: 'qfq', label: '前复权' },
  { value: 'hfq', label: '后复权' },
  { value: '', label: '不复权' },
]

/** 均线配置（周期 / 颜色） */
export const MA_OPTIONS: Array<{ period: number; color: string }> = [
  { period: 5, color: CHART_PALETTE_PRO.series1 },
  { period: 10, color: CHART_PALETTE_PRO.series2 },
  { period: 20, color: CHART_PALETTE_PRO.series3 },
  { period: 60, color: CHART_PALETTE_PRO.series4 },
]

/** 十字光标节流间隔（ms），对应 60fps */
export const THROTTLE_MS = 16