import { cn } from '@/lib/utils'
import { Badge } from '@/components/atoms'
import { STOCK_COLOR_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'
import type { RotationSignalType } from '@/data/types/types.sector'

export interface SignalBadgeProps {
  signal: RotationSignalType
  signalStrength?: number
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

const SIGNAL_LABELS: Record<string, string> = {
  strong_buy: '强烈推荐',
  buy: '推荐',
  hold: '持有',
  reduce: '谨慎',
  strong_reduce: '回避',
  observe: '观察',
}

const SIGNAL_COLORS: Record<string, string> = {
  strong_buy: STOCK_COLOR_TOKENS.up.bgClass,
  buy: COLOR_TOKENS.success.bgClass,
  hold: 'bg-muted',
  reduce: COLOR_TOKENS.warning.bgClass,
  strong_reduce: STOCK_COLOR_TOKENS.down.bgClass,
  observe: 'bg-muted/50',
}

const SIGNAL_TEXT_COLORS: Record<string, string> = {
  strong_buy: 'text-white',
  buy: 'text-white',
  hold: 'text-foreground',
  reduce: 'text-white',
  strong_reduce: 'text-white',
  observe: 'text-foreground',
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1',
}

/**
 * SignalBadge
 */
export function SignalBadge({
  signal,
  signalStrength,
  size = 'md',
  showIcon = false,
  className,
}: SignalBadgeProps) {
  const label = SIGNAL_LABELS[signal]
  const bgColor = SIGNAL_COLORS[signal]
  const textColor = SIGNAL_TEXT_COLORS[signal]

  const strengthIndicator = signalStrength != null && showIcon
    ? Array.from({ length: signalStrength }, (_, i) => (
        <span key={i} className="w-1 h-1 rounded-full bg-current opacity-70" />
      ))
    : null

  return (
    <Badge
      variant="default"
      className={cn(
        bgColor,
        textColor,
        SIZE_CLASSES[size],
        'font-medium flex items-center gap-1',
        className,
      )}
    >
      {strengthIndicator}
      {label}
    </Badge>
  )
}

export default SignalBadge
