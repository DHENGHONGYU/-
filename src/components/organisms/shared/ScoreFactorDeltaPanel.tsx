import { Badge } from '@/components/atoms/Badge'
import { twText, twBg, twBorder } from '@/constants/theme.tokens'

interface Dimension {
  name: string
  score: number | null
  rationale: string
}

export interface ScoreWithDimensions {
  overallScore: number | null
  dimensionScores: Dimension[]
}

export interface ScoreFactorDeltaPanelProps {
  current: ScoreWithDimensions
  previous: ScoreWithDimensions | undefined
}

function formatDelta(value: number): string {
  if (value > 0) return `+${value.toFixed(2)}`
  return value.toFixed(2)
}

/**
 * ScoreFactorDeltaPanel
 * @param previous }
 */
export function ScoreFactorDeltaPanel({ current, previous }: ScoreFactorDeltaPanelProps): React.JSX.Element | null {
  if (!previous) {
    return (
      <div className="rounded-md border p-3 text-sm text-muted-foreground">
        暂无上一版本记录，无法进行纵向比对。重新评分后将自动生成版本日志。
      </div>
    )
  }

  const deltas = current.dimensionScores
    .map((dimension) => {
      const previousDimension = previous.dimensionScores.find((d) => d.name === dimension.name)
      if (dimension.score === null || previousDimension?.score === null || previousDimension?.score === undefined) {
        return null
      }
      return {
        name: dimension.name,
        delta: dimension.score - previousDimension.score,
        current: dimension.score,
        previous: previousDimension.score,
        currentRationale: dimension.rationale,
        previousRationale: previousDimension.rationale,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  const topPositive = [...deltas].filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3)
  const topNegative = [...deltas].filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3)
  const maxAbs = deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">综合分变化</span>
        {current.overallScore !== null && previous.overallScore !== null ? (
          <Badge variant={current.overallScore >= previous.overallScore ? 'default' : 'destructive'}>
            {formatDelta(current.overallScore - previous.overallScore)}
          </Badge>
        ) : (
          <Badge variant="outline">N/A</Badge>
        )}
        {maxAbs && (
          <span className="text-xs text-muted-foreground">
            最大变化因子：{maxAbs.name} {formatDelta(maxAbs.delta)}
          </span>
        )}
      </div>

      {topPositive.length > 0 && (
        <div className={`rounded-md border ${twBorder('emerald', 500)}/30 ${twBg('emerald', 500)}/10 p-3`}>
          <p className={`mb-2 text-sm font-medium ${twText('emerald', 700)}`}>上升因子 Top {topPositive.length}</p>
          <ul className="space-y-2 text-sm">
            {topPositive.map((item) => (
              <li key={item.name}>
                <div className="flex items-center justify-between">
                  <span>{item.name}</span>
                  <span className={`font-medium ${twText('emerald', 700)}`}>
                    {item.previous.toFixed(1)} → {item.current.toFixed(1)} ({formatDelta(item.delta)})
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{item.currentRationale}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topNegative.length > 0 && (
        <div className={`rounded-md border ${twBorder('rose', 500)}/30 ${twBg('rose', 500)}/10 p-3`}>
          <p className={`mb-2 text-sm font-medium ${twText('rose', 700)}`}>下降因子 Top {topNegative.length}</p>
          <ul className="space-y-2 text-sm">
            {topNegative.map((item) => (
              <li key={item.name}>
                <div className="flex items-center justify-between">
                  <span>{item.name}</span>
                  <span className={`font-medium ${twText('rose', 700)}`}>
                    {item.previous.toFixed(1)} → {item.current.toFixed(1)} ({formatDelta(item.delta)})
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{item.currentRationale}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topPositive.length === 0 && topNegative.length === 0 && (
        <p className="text-sm text-muted-foreground">本次评分各因子与上一版本无有效变化。</p>
      )}
    </div>
  )
}
