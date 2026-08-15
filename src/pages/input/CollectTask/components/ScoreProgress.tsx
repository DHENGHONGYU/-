/**
 * 评分进度 Widget - 评分分析 Tab
 *
 * 显示评分间隔统计、评分频率、上下次评分时间预估、周期进度条。
 *
 * @module CollectTask/components/ScoreProgress
 */

import { Activity } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { ScoreStats } from '../hooks/useCollectionTaskStats'

const HOURS_PER_DAY = 24
const MILLIS_PER_HOUR = 1000 * 60 * 60

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

/**
 * ScoreProgress
 */
export function ScoreProgress({ scoreStats }: { scoreStats: ScoreStats }): React.JSX.Element {
  const { total, avgIntervalHours, lastScoredAt, nextEstimateAt } = scoreStats

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" style={{ color: COLOR_TOKENS.info.hex }} />
            评分进度
          </CardTitle>
          <CardDescription>评分间隔与预估下次评分时间</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState title="暂无进度数据" description="完成评分后将显示进度统计" />
        </CardContent>
      </Card>
    )
  }

  const days = Math.round(avgIntervalHours / HOURS_PER_DAY)
  const frequencyPerDay = avgIntervalHours > 0
    ? (HOURS_PER_DAY / avgIntervalHours).toFixed(1)
    : '0'
  const lastScoredText = lastScoredAt !== null ? formatDate(lastScoredAt) : '—'
  const nextEstimateText = nextEstimateAt !== null ? formatDate(nextEstimateAt) : '—'
  const hoursToNext = nextEstimateAt !== null
    ? Math.round((nextEstimateAt.getTime() - Date.now()) / MILLIS_PER_HOUR)
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" style={{ color: COLOR_TOKENS.info.hex }} />
          评分进度
        </CardTitle>
        <CardDescription>评分间隔与预估下次评分时间</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <IntervalStat
              title="平均评分间隔"
              value={`${avgIntervalHours.toFixed(1)} 小时`}
              hint={`约 ${days} 天`}
            />
            <IntervalStat
              title="评分频率"
              value={`${frequencyPerDay} 次/天`}
              hint="基于历史评分间隔计算"
            />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">上次评分</span>
              <Badge variant="outline">{lastScoredText}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">预估下次</span>
              <Badge variant="default">{nextEstimateText}</Badge>
            </div>
            {hoursToNext !== null && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  距离下次评分约 {hoursToNext} 小时
                </p>
              </div>
            )}
          </div>

          {lastScoredAt !== null && nextEstimateAt !== null && (
            <ProgressBar lastScoredAt={lastScoredAt} nextEstimateAt={nextEstimateAt} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function IntervalStat({ title, value, hint }: { title: string; value: string; hint: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-lg font-bold" style={{ color: COLOR_TOKENS.info.hex }}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function formatDate(value: number | string | Date): string {
  return new Date(value).toLocaleString('zh-CN', DATE_FORMAT_OPTIONS)
}

function ProgressBar({ lastScoredAt, nextEstimateAt }: { lastScoredAt: number | string; nextEstimateAt: Date }): React.JSX.Element {
  const lastTime = new Date(lastScoredAt).getTime()
  const nextTime = nextEstimateAt.getTime()
  const currentTime = Date.now()
  const progress = ((currentTime - lastTime) / (nextTime - lastTime)) * 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>上次评分</span>
        <span>预估下次</span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full transition-[width]"
          style={{ width: `${clampedProgress}%`, backgroundColor: COLOR_TOKENS.info.hex }}
        />
      </div>
      <p className="text-xs text-center text-muted-foreground">评分周期进度</p>
    </div>
  )
}
