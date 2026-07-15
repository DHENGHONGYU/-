/**
 * 评分分析 Tab 容器
 *
 * 组合：ScoreStatsCards + ScoreDistribution + ScoreTrend + ScoreProgress
 *
 * @module CollectTask/components/ScoreAnalysisTab
 */

import type { ScoreStats } from '../hooks/useCollectionTaskStats'
import { ScoreStatsCards } from './ScoreStatsCards'
import { ScoreDistribution } from './ScoreDistribution'
import { ScoreTrend } from './ScoreTrend'
import { ScoreProgress } from './ScoreProgress'

export function ScoreAnalysisTab({ scoreStats }: { scoreStats: ScoreStats }): React.JSX.Element {
  return (
    <div className="space-y-4">
      <ScoreStatsCards scoreStats={scoreStats} />
      <ScoreDistribution scoreStats={scoreStats} />
      <ScoreTrend scoreStats={scoreStats} />
      <ScoreProgress scoreStats={scoreStats} />
    </div>
  )
}
