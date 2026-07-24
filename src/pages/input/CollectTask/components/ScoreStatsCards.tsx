/**
 * 评分统计卡片 - 评分分析 Tab
 *
 * 显示 4 个评分核心指标：评分总数 / 平均分 / 最高分 / 最低分。
 *
 * @module CollectTask/components/ScoreStatsCards
 */

import { MetricCard } from '@/components/molecules'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { ScoreStats } from '../hooks/useCollectionTaskStats'

const SCORE_PRECISION = 2

/**
 * ScoreStatsCards
 */
export function ScoreStatsCards({ scoreStats }: { scoreStats: ScoreStats }): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard title="评分总数" value={scoreStats.total} color={COLOR_TOKENS.info.hex} border />
      <MetricCard
        title="平均分"
        value={scoreStats.avgScore.toFixed(SCORE_PRECISION)}
        color={COLOR_TOKENS.success.hex}
        border
      />
      <MetricCard
        title="最高分"
        value={scoreStats.maxScore.toFixed(SCORE_PRECISION)}
        color={COLOR_TOKENS.warning.hex}
        border
      />
      <MetricCard
        title="最低分"
        value={scoreStats.minScore.toFixed(SCORE_PRECISION)}
        color={COLOR_TOKENS.danger.hex}
        border
      />
    </div>
  )
}
