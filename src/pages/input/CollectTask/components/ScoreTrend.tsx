/**
 * 评分趋势 Widget - 评分分析 Tab
 *
 * 显示最近 10 次评分的柱状趋势图与高/中/低分图例。
 *
 * @module CollectTask/components/ScoreTrend
 */

import { Activity } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { ScoreStats } from '../hooks/useCollectionTaskStats'

const SCORE_HIGH_THRESHOLD = 4.0
const SCORE_MEDIUM_THRESHOLD = 2.5
const MAX_SCORE_FOR_VISUAL = 5

/**
 * ScoreTrend
 */
export function ScoreTrend({ scoreStats }: { scoreStats: ScoreStats }): React.JSX.Element {
  const { recentTrend } = scoreStats

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" style={{ color: COLOR_TOKENS.info.hex }} />
          评分趋势
        </CardTitle>
        <CardDescription>最近 10 次评分变化趋势</CardDescription>
      </CardHeader>
      <CardContent>
        {recentTrend.length === 0 ? (
          <EmptyState title="暂无趋势数据" description="完成多次评分后将显示趋势图" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-2 h-32">
              {recentTrend.map((item, idx) => (
                <ScoreBar key={idx} score={item.score} date={item.date} />
              ))}
            </div>
            <TrendLegend />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ScoreBar({ score, date }: { score: number; date: string }): React.JSX.Element {
  const height = (score / MAX_SCORE_FOR_VISUAL) * 100
  const isHigh = score >= SCORE_HIGH_THRESHOLD
  const isMedium = score >= SCORE_MEDIUM_THRESHOLD && score < SCORE_HIGH_THRESHOLD
  const color = isHigh
    ? COLOR_TOKENS.success.hex
    : isMedium
      ? COLOR_TOKENS.warning.hex
      : COLOR_TOKENS.danger.hex
  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      <div
        className="w-full rounded-t transition-all hover:opacity-80"
        style={{ height: `${height}%`, backgroundColor: color, minHeight: '4px' }}
        title={`${date}: ${score.toFixed(2)}`}
      />
      <span className="text-xs text-muted-foreground truncate w-full text-center">
        {date.slice(5)}
      </span>
    </div>
  )
}

function TrendLegend(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
      <LegendItem color={COLOR_TOKENS.success.hex} label="高分" />
      <LegendItem color={COLOR_TOKENS.warning.hex} label="中分" />
      <LegendItem color={COLOR_TOKENS.danger.hex} label="低分" />
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1">
      <span className="h-3 w-3 rounded" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
