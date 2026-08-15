/**
 * SignalQualityDashboardWidget Sub-components
 * Extracted from SignalQualityDashboardWidget.tsx
 */

import { memo } from 'react'
import { getStockColorClass } from '@/constants/theme.tokens'
import type { MetricCardProps, PnLCardProps } from './SignalQualityDashboardWidget.types'

/** 核心指标卡（accuracy/winRate/sharpe/maxDrawdown） */
export const MetricCard = memo(function MetricCard({ label, value, colorClass }: MetricCardProps) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${colorClass}`}>{value}</p>
    </div>
  )
})

/** 盈亏卡片（使用 STOCK_COLOR_TOKENS，A 股红涨绿跌例外规则） */
export const PnLCard = memo(function PnLCard({ label, value }: PnLCardProps) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${getStockColorClass(value)}`}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
      </p>
    </div>
  )
})