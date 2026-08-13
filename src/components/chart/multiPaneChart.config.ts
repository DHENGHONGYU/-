import { CHART_PALETTE } from '@/constants/theme.tokens'
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

/** 均线配置 */
export const MA_OPTIONS: Array<{ period: number; color: string }> = [
  { period: 5, color: CHART_PALETTE.series1 },
  { period: 10, color: CHART_PALETTE.series2 },
  { period: 20, color: CHART_PALETTE.series3 },
  { period: 60, color: CHART_PALETTE.series4 },
]

/** 十字光标节流间隔（ms），对应 60fps */
export const THROTTLE_MS = 16