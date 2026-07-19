/**
 * 评分统计卡片 - 评分分析 Tab
 *
 * 显示 4 个评分核心指标：评分总数 / 平均分 / 最高分 / 最低分。
 *
 * @module CollectTask/components/ScoreStatsCards
 */

import { Card, CardContent } from '@/components/atoms'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { ScoreStats } from '../hooks/useCollectionTaskStats'

const SCORE_PRECISION = 2

/**
 * ScoreStatsCards
 */
export function ScoreStatsCards({ scoreStats }: { scoreStats: ScoreStats }): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <ScoreStatCard
        label="评分总数"
        value={scoreStats.total}
        accentColor={COLOR_TOKENS.info.hex}
      />
      <ScoreStatCard
        label="平均分"
        value={scoreStats.avgScore.toFixed(SCORE_PRECISION)}
        accentColor={COLOR_TOKENS.success.hex}
      />
      <ScoreStatCard
        label="最高分"
        value={scoreStats.maxScore.toFixed(SCORE_PRECISION)}
        accentColor={COLOR_TOKENS.warning.hex}
      />
      <ScoreStatCard
        label="最低分"
        value={scoreStats.minScore.toFixed(SCORE_PRECISION)}
        accentColor={COLOR_TOKENS.danger.hex}
      />
    </div>
  )
}

interface ScoreStatCardProps {
  label: string
  value: number | string
  accentColor: string
}

function ScoreStatCard({ label, value, accentColor }: ScoreStatCardProps): React.JSX.Element {
  return (
    <Card className="border-l-4" style={{ borderLeftColor: accentColor }}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold" style={{ color: accentColor }}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
