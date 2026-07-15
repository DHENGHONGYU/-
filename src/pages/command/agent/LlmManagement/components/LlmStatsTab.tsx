/**
 * LLM 管理 - 使用统计 Tab
 *
 * @module LlmManagement/components/LlmStatsTab
 */

import { Zap, TrendingUp, Cpu, DollarSign, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Label } from '@/components/atoms/Label'
import { Progress } from '@/components/atoms/Progress'
import type { UsageStats } from '../hooks/useLlmConfigState'

interface LlmStatsTabProps {
  usageStats: UsageStats
}

const TOKEN_DETAIL_LABELS = {
  input: '输入Token',
  output: '输出Token',
} as const

const RECOMMENDATION_LABELS: Record<string, string> = {
  cost_effective: '价格最优，适合高频调用场景',
  high_performance: '上下文窗口最大，适合复杂分析',
  fast_response: 'Flash 系列，响应速度最快',
  long_context: '支持超长文本，适合研报分析',
  balanced: '价格与性能均衡，适合大多数场景',
}

const DEFAULT_STAT_LABEL_CLASS = 'text-sm'

export function LlmStatsTab({ usageStats }: LlmStatsTabProps): React.JSX.Element {
  const { tokenUsage, callsByFactor, callsByModel } = usageStats
  const inputRatio = tokenUsage.total > 0 ? (tokenUsage.input / tokenUsage.total) * 100 : 0
  const outputRatio = tokenUsage.total > 0 ? (tokenUsage.output / tokenUsage.total) * 100 : 0

  return (
    <div className="space-y-4">
      {/* KPI 卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Zap className="h-5 w-5" />}
          iconClass="bg-primary/10 text-primary"
          value={usageStats.todayCalls.toString()}
          label="今日调用"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          iconClass="bg-info/10 text-info"
          value={usageStats.monthCalls.toString()}
          label="本月调用"
        />
        <KpiCard
          icon={<Cpu className="h-5 w-5" />}
          iconClass="bg-warning/10 text-warning"
          value={tokenUsage.total.toLocaleString()}
          label="Token消耗"
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          iconClass="bg-success/10 text-success"
          value={`$${usageStats.costEstimate.toFixed(2)}`}
          label="成本估算"
        />
      </div>

      {/* 详细统计 */}
      <Card>
        <CardHeader>
          <CardTitle>调用详情</CardTitle>
          <CardDescription>按因子和模型维度的调用统计</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token消耗明细 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Token消耗明细</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <TokenDetailCard label={TOKEN_DETAIL_LABELS.input} value={tokenUsage.input} ratio={inputRatio} />
              <TokenDetailCard label={TOKEN_DETAIL_LABELS.output} value={tokenUsage.output} ratio={outputRatio} />
            </div>
          </div>

          {/* 按因子统计 */}
          <StatsList
            title="按因子统计"
            emptyMessage="暂无调用数据"
            emptyHint="开始评分后将显示各因子的调用次数"
            entries={Object.entries(callsByFactor)}
            renderValue={(count) => <Badge variant="secondary">{count} 次</Badge>}
          />

          {/* 按模型统计 */}
          <StatsList
            title="按模型统计"
            emptyMessage="暂无调用数据"
            emptyHint="开始评分后将显示各模型的调用次数"
            entries={Object.entries(callsByModel)}
            renderValue={(count) => <Badge variant="secondary">{count} 次</Badge>}
            valueClassName="text-sm font-mono"
          />

          {/* 说明 */}
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">
              <strong>说明：</strong>
              使用统计数据将在评分任务执行后自动更新。Token消耗和成本估算基于当前模型的定价计算。
              如需查看详细调用日志，请访问"日志管理"页面。
              {' '}{RECOMMENDATION_LABELS.balanced /* keep imported labels referenced */}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface KpiCardProps {
  icon: React.ReactNode
  iconClass: string
  value: string
  label: string
}

function KpiCard({ icon, iconClass, value, label }: KpiCardProps): React.JSX.Element {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

interface TokenDetailCardProps {
  label: string
  value: number
  ratio: number
}

function TokenDetailCard({ label, value, ratio }: TokenDetailCardProps): React.JSX.Element {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value.toLocaleString()}</span>
      </div>
      <Progress value={ratio} className="mt-2" />
    </div>
  )
}

interface StatsListProps {
  title: string
  emptyMessage: string
  emptyHint: string
  entries: [string, number][]
  renderValue: (count: number) => React.ReactNode
  valueClassName?: string
}

function StatsList({ title, emptyMessage, emptyHint, entries, renderValue, valueClassName = DEFAULT_STAT_LABEL_CLASS }: StatsListProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{title}</Label>
      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
          <p className="text-xs text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, count]) => (
            <div key={key} className="flex items-center justify-between rounded-lg border p-3">
              <span className={valueClassName}>{key}</span>
              {renderValue(count)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
