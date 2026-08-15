/**
 * SignalQualityDashboardWidget Types
 * Extracted from SignalQualityDashboardWidget.tsx
 */

import type { WidgetConfig } from '@/types/modules/widget.types'
import type { SignalDirection } from './SignalQualityDashboardWidget.constants'

export interface SignalQualityDashboardWidgetProps {
  config: WidgetConfig
}

/** 方向统计行数据（来自 getDirectionStats 派生查询） */
export interface DirectionStatRow {
  direction: SignalDirection
  count: number
  accuracy: number
  avgReturn: number
  winRate: number
}

/** 信号类型统计行数据（来自 topSignalTypes 派生查询） */
export interface SignalTypeStatRow {
  type: string
  count: number
  accuracy: number
  avgReturn: number
}

export interface MetricCardProps {
  readonly label: string
  readonly value: string
  readonly colorClass: string
}

export interface PnLCardProps {
  readonly label: string
  readonly value: number
}