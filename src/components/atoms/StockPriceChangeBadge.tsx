/**
 * @fileoverview StockPriceChangeBadge - 组件（Atom层组件）
 * @module components/atoms/StockPriceChangeBadge
 */

import { cn } from '@/lib/utils'

export interface StockPriceChangeBadgeProps {
  /** 涨跌幅（百分比，如 3.5 表示 +3.5%） */
  change: number
  className?: string
}

/**
 * StockPriceChangeBadge — 股价涨跌徽章
 *
 * 根据 change 正负显示涨/跌颜色 + 箭头 + 百分比。
 * 使用语义令牌（text-success / text-destructive），明暗模式一致。
 */
export function StockPriceChangeBadge({ change, className }: StockPriceChangeBadgeProps) {
  const isUp = change >= 0
  const arrow = isUp ? '▲' : '▼'
  const colorClass = isUp ? 'text-success' : 'text-destructive'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        colorClass,
        className,
      )}
    >
      <span aria-hidden>{arrow}</span>
      <span>
        {isUp ? '+' : ''}
        {change.toFixed(2)}%
      </span>
    </span>
  )
}
