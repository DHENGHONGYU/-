import { cn } from '@/lib/utils'
import { Progress } from '@/components/atoms'
import { COLOR_TOKENS, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

export interface ScoreGaugeProps {
  score: number | null
  maxScore?: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  labelFormat?: (score: number) => string
  className?: string
}

const getScoreColor = (score: number): string => {
  if (score >= 4.5) return STOCK_COLOR_TOKENS.up.bgClass
  if (score >= 3.5) return COLOR_TOKENS.success.bgClass
  if (score >= 2.5) return 'bg-muted'
  if (score >= 1.0) return COLOR_TOKENS.warning.bgClass
  return COLOR_TOKENS.danger.bgClass
}

const SIZE_CLASSES = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
} as const

const LABEL_CLASSES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
} as const

/**
 * ScoreGauge
 */
export function ScoreGauge({
  score,
  maxScore = 5,
  size = 'md',
  showLabel = true,
  labelFormat = (s) => `${s.toFixed(1)}`,
  className,
}: ScoreGaugeProps) {
  if (score === null) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Progress value={0} className={cn(SIZE_CLASSES[size], 'bg-muted')} />
        {showLabel && <span className={cn(LABEL_CLASSES[size], 'text-muted')}>--</span>}
      </div>
    )
  }

  const percentage = (score / maxScore) * 100
  const color = getScoreColor(score)
  const label = showLabel ? (
    <span className={cn(LABEL_CLASSES[size], 'font-medium')}>
      {labelFormat(score)}
    </span>
  ) : null

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('relative h-full rounded-full overflow-hidden bg-muted', SIZE_CLASSES[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {label}
    </div>
  )
}

export default ScoreGauge
