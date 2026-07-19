import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import type { TrendDirection, TrendStrength } from '@/data/types/types.sector'

export interface TrendArrowProps {
  direction: TrendDirection
  strength?: TrendStrength
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const DIRECTION_LABELS: Record<string, string> = {
  up: '上升',
  down: '下降',
  flat: '持平',
  unknown: '未知',
}

const SIZE_CLASSES = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
} as const

const LABEL_CLASSES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
} as const

/**
 * TrendArrow
 */
export function TrendArrow({
  direction,
  strength,
  size = 'md',
  showLabel = true,
  className,
}: TrendArrowProps) {
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus

  const iconColor = direction === 'up'
    ? STOCK_COLOR_TOKENS.up.tailwind
    : direction === 'down'
      ? STOCK_COLOR_TOKENS.down.tailwind
      : 'text-muted-foreground'

  const strengthClass = strength === 'strong' ? 'animate-pulse' : ''

  const label = showLabel ? (
    <span className={cn(LABEL_CLASSES[size], 'font-medium')}>
      {DIRECTION_LABELS[direction]}
    </span>
  ) : null

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Icon className={cn(SIZE_CLASSES[size], iconColor, strengthClass)} />
      {label}
    </div>
  )
}

export default TrendArrow
