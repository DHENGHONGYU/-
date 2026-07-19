/**
 * 评分分析 Tab 容器
 *
 * 组合：ScoreStatsCards + ScoreDistribution + ScoreTrend + ScoreProgress
 * v2 增强：空状态引导 + 采集质量概览（无评分数据时展示采集 KPI 替代）
 *
 * @module CollectTask/components/ScoreAnalysisTab
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { ScoreStats } from '../hooks/useCollectionTaskStats'
import { ScoreStatsCards } from './ScoreStatsCards'
import { ScoreDistribution } from './ScoreDistribution'
import { ScoreTrend } from './ScoreTrend'
import { ScoreProgress } from './ScoreProgress'

interface ScoreAnalysisTabProps {
  scoreStats: ScoreStats
  // 采集质量概览（无评分数据时展示）
  collectSuccessRate?: number
  writeRate?: number
  avgLatency?: number
  taskTotal?: number
  lastSuccessAt?: number | null
}

/**
 * ScoreAnalysisTab
 */
export function ScoreAnalysisTab({
  scoreStats,
  collectSuccessRate,
  writeRate,
  avgLatency,
  taskTotal,
  lastSuccessAt,
}: ScoreAnalysisTabProps): React.JSX.Element {
  // 空状态：无评分数据时展示采集质量概览 + 引导
  if (scoreStats.total === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">评分分析</CardTitle>
          </CardHeader>
          <CardContent className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 0 1 8 0v2M9 7h6m-6 4h6m-9 8h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z" />
              </svg>
            </div>
            <p className="text-sm font-medium">暂无评分数据</p>
            <p className="mt-1 text-xs text-muted-foreground">
              完成数据采集后，前往分析舱进行个股评分，评分结果将在此展示
            </p>
          </CardContent>
        </Card>

        {/* 采集质量概览（替代评分数据） */}
        {(collectSuccessRate !== undefined || taskTotal !== undefined) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">采集质量概览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <QualityMetric
                  label="采集成功率"
                  value={collectSuccessRate !== undefined ? `${collectSuccessRate}%` : '—'}
                  color={COLOR_TOKENS.success.hex}
                />
                <QualityMetric
                  label="写入成功率"
                  value={writeRate !== undefined ? `${writeRate}%` : '—'}
                  color={COLOR_TOKENS.success.hex}
                />
                <QualityMetric
                  label="平均延迟"
                  value={avgLatency !== undefined ? `${avgLatency}ms` : '—'}
                  color={COLOR_TOKENS.info.hex}
                />
                <QualityMetric
                  label="任务总数"
                  value={taskTotal !== undefined ? String(taskTotal) : '—'}
                  color={COLOR_TOKENS.info.hex}
                />
              </div>
              {lastSuccessAt && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">数据新鲜度</Badge>
                  <span>最近采集: {new Date(lastSuccessAt).toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ScoreStatsCards scoreStats={scoreStats} />
      <ScoreDistribution scoreStats={scoreStats} />
      <ScoreTrend scoreStats={scoreStats} />
      <ScoreProgress scoreStats={scoreStats} />
    </div>
  )
}

function QualityMetric({ label, value, color }: { label: string; value: string; color: string }): React.JSX.Element {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold" style={{ color }}>{value}</p>
    </div>
  )
}
