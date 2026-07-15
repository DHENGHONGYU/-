/**
 * 采集任务监控 - 顶部统计卡片
 *
 * 8 卡片布局：4 任务统计（总数/采集中/已完成/失败）+ 4 性能统计（成功率/平均延迟/降级次数/写入率）
 *
 * @module CollectTask/components/CollectTaskStatsCards
 */

import { Card, CardContent } from '@/components/atoms'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { TaskStats } from '../hooks/useCollectionTaskStats'

interface CollectTaskStatsCardsProps {
  taskStats: TaskStats
  // 性能统计（来自 collectionRuntimeStore.stats）
  successRate: number
  avgLatency: number
  fallbackCount: number
  writeRate: number
}

export function CollectTaskStatsCards({
  taskStats,
  successRate,
  avgLatency,
  fallbackCount,
  writeRate,
}: CollectTaskStatsCardsProps): React.JSX.Element {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="任务总数" value={taskStats.runningCount + taskStats.successCount + taskStats.failedCount} />
        <StatCard label="采集中" value={taskStats.runningCount} color={COLOR_TOKENS.info.hex} />
        <StatCard label="已完成" value={taskStats.successCount} color={COLOR_TOKENS.success.hex} />
        <StatCard label="失败" value={taskStats.failedCount} color={COLOR_TOKENS.danger.hex} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="采集成功率" value={`${successRate}%`} color={COLOR_TOKENS.success.hex} />
        <StatCard label="平均延迟" value={`${avgLatency}ms`} color={COLOR_TOKENS.info.hex} />
        <StatCard label="降级次数" value={fallbackCount} color={COLOR_TOKENS.warning.hex} />
        <StatCard label="写入成功率" value={`${writeRate}%`} color={COLOR_TOKENS.success.hex} />
      </div>
    </>
  )
}

interface StatCardProps {
  label: string
  value: number | string
  color?: string
}

function StatCard({ label, value, color }: StatCardProps): React.JSX.Element {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold" style={color !== undefined ? { color } : undefined}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
