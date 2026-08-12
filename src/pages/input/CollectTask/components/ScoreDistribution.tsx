/**
 * 评分分布 Widget - 评分分析 Tab
 *
 * 按分数段统计评分数量：高(>=4.0) / 中(2.5-4.0) / 低(<2.5)。
 *
 * @module CollectTask/components/ScoreDistribution
 */

import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Progress } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { ScoreStats } from '../hooks/useCollectionTaskStats'

interface ScoreBucket {
  label: string
  count: number
  variant: 'success' | 'warning' | 'destructive'
  color: string
}

/**
 * ScoreDistribution
 */
export function ScoreDistribution({ scoreStats }: { scoreStats: ScoreStats }): React.JSX.Element {
  const { total, scoreDistribution } = scoreStats

  const buckets: ScoreBucket[] = [
    { label: '高分 (≥4.0)', count: scoreDistribution.high, variant: 'success', color: COLOR_TOKENS.success.hex },
    { label: '中分 (2.5-4.0)', count: scoreDistribution.medium, variant: 'warning', color: COLOR_TOKENS.warning.hex },
    { label: '低分 (<2.5)', count: scoreDistribution.low, variant: 'destructive', color: COLOR_TOKENS.danger.hex },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" style={{ color: COLOR_TOKENS.info.hex }} />
          评分分布
        </CardTitle>
        <CardDescription>按分数段统计评分数量</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState title="暂无评分数据" description="完成评分后将显示分布统计" />
        ) : (
          <div className="space-y-4">
            {buckets.map((bucket) => (
              <BucketProgress key={bucket.label} bucket={bucket} total={total} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BucketProgress({ bucket, total }: { bucket: ScoreBucket; total: number }): React.JSX.Element {
  const percent = total > 0 ? (bucket.count / total) * 100 : 0
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{bucket.label}</span>
        <Badge variant={bucket.variant}>{bucket.count}</Badge>
      </div>
      <Progress value={percent} className="h-2" />
      <p className="text-xs text-muted-foreground">{percent.toFixed(1)}%</p>
    </div>
  )
}
