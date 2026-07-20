/**
 * 采集任务监控 - 顶部统计卡片
 *
 * 9 卡片布局：4 任务统计（总数/采集中/已完成/失败）+ 4 性能统计（成功率/平均延迟/降级次数/写入率）+ 1 数据新鲜度
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
  /** 真实数据源成功率（排除 mock，防假绿灯） */
  realSuccessRate: number
  avgLatency: number
  fallbackCount: number
  writeRate: number
  // 数据新鲜度（最近一次成功采集的时间戳，null = 无成功记录）
  lastSuccessAt: number | null
}

/** 将时间戳格式化为相对时间（如"5分钟前"） */
function formatFreshness(ts: number | null): string {
  if (ts === null) return '暂无'
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

/**
 * CollectTaskStatsCards
 */
export function CollectTaskStatsCards({
  taskStats,
  successRate,
  realSuccessRate,
  avgLatency,
  fallbackCount,
  writeRate,
  lastSuccessAt,
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
        <StatCard label="成功率(含Mock)" value={`${successRate}%`} color={COLOR_TOKENS.success.hex} />
        <StatCard label="平均延迟" value={`${avgLatency}ms`} color={COLOR_TOKENS.info.hex} />
        <StatCard label="降级次数" value={fallbackCount} color={COLOR_TOKENS.warning.hex} />
        <StatCard label="写入成功率" value={`${writeRate}%`} color={COLOR_TOKENS.success.hex} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="数据新鲜度" value={formatFreshness(lastSuccessAt)} color={COLOR_TOKENS.info.hex} />
        <StatCard
          label="真实成功率(不含Mock)"
          value={`${realSuccessRate}%`}
          color={realSuccessRate >= 80 ? COLOR_TOKENS.success.hex : COLOR_TOKENS.danger.hex}
        />
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
