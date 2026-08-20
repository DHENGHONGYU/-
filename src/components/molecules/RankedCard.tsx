import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/atoms'
import { Badge } from '@/components/atoms'
import { SignalBadge } from './SignalBadge'
import { ScoreGauge } from './ScoreGauge'
import { StockPriceChangeBadge } from '@/components/atoms/StockPriceChangeBadge'
import type { RotationSignalType } from '@/data/types/types.sector'

export interface RankedCardProps {
  rank: number
  name: string
  code?: string
  mainMetric: {
    value: number | null
    label: string
    unit?: string
    change?: number
  }
  secondaryMetric?: {
    value: number | null
    label: string
    unit?: string
  }
  signal?: RotationSignalType
  signalStrength?: number
  score?: number | null
  onClick?: () => void
  className?: string
}

const RANK_COLORS: Record<number, string> = {
  1: 'bg-amber-500 text-warning-foreground text-lg font-bold',
  2: 'bg-muted text-muted-foreground',
  3: 'bg-muted text-muted-foreground',
  4: 'border border-border text-muted-foreground',
  5: 'border border-border text-muted-foreground',
}

/**
 * RankedCard
 */
export function RankedCard({
  rank,
  name,
  code,
  mainMetric,
  secondaryMetric,
  signal,
  signalStrength,
  score,
  onClick,
  className,
}: RankedCardProps) {
  const rankColor = RANK_COLORS[rank] ?? 'border border-border text-muted-foreground'
  const isOutline = rank >= 4 || !RANK_COLORS[rank]
  const rankSize = rank === 1
    ? 'w-8 h-8'
    : 'w-7 h-7'

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        onClick && 'active:scale-[0.98]',
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <Badge variant={isOutline ? 'outline' : 'default'} className={cn(rankColor, rankSize, 'flex items-center justify-center p-0 text-sm font-bold')}>
          {rank}
        </Badge>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{name}</span>
            {(code ?? '') !== '' && <span className="text-xs text-muted">{code}</span>}
          </div>

          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-semibold">
                {mainMetric.value != null ? mainMetric.value.toFixed(2) : '--'}
              </span>
              {(mainMetric.unit ?? '') !== '' && <span className="text-xs text-muted">{mainMetric.unit}</span>}
            </div>

            {mainMetric.change != null && (
              <StockPriceChangeBadge change={mainMetric.change} />
            )}

            {signal && (
              <SignalBadge signal={signal} signalStrength={signalStrength} size="sm" />
            )}
          </div>

          {secondaryMetric && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted">{secondaryMetric.label}:</span>
              <span className="text-xs font-medium">
                {secondaryMetric.value != null
                  ? secondaryMetric.value.toFixed(2)
                  : '--'}
                {(secondaryMetric.unit ?? '') !== '' && ` ${secondaryMetric.unit}`}
              </span>
            </div>
          )}

          {score != null && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted">评分:</span>
              <ScoreGauge score={score} size="sm" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default RankedCard
