/**
 * @module CollectTaskPage
 * @description 采集任务监控页（D-1 框架）。
 *
 * 从 `collectionRuntimeStore` 读取真实任务状态、日志、链路 trace，
 * 提供任务列表、维度健康度、实时日志、时间线、泳道图、链路回放等 Tab。
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  Activity,
  ListChecks,
  ScrollText,
  GitBranch,
  Repeat,
  Eye,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getLogger } from '@/lib/logger'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import type { CollectionReport } from '@/services/data-collector/collectionReportService'
import { CollectionProgressPanel } from '@/components/organisms/collection/CollectionProgressPanel'
import { CollectionReportPanel } from '@/components/organisms/collection/CollectionReportPanel'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms'
import { Button } from '@/components/atoms'
import { Badge } from '@/components/atoms'
import { Skeleton } from '@/components/atoms'
import { Progress } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/molecules'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/atoms'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/atoms'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { useIntelligentScoreStore } from '@/store/intelligentScoreStore'
import LiveLogStream from '@/components/input/LiveLogStream'
import CollectionTimeline from '@/components/input/CollectionTimeline'
import CollectionSwimlane from '@/components/input/CollectionSwimlane'
import TraceReplayPanel from '@/components/input/TraceReplayPanel'
import type { CollectionTaskRuntime } from '@/types/modules/collection.types'

const logger = getLogger()

type DisplayStatus = 'running' | 'success' | 'failed' | 'pending'

const STATUS_BADGE: Record<DisplayStatus, { label: string; variant: 'default' | 'success' | 'destructive' | 'outline' }> = {
  running: { label: '采集中', variant: 'default' },
  success: { label: '已完成', variant: 'success' },
  failed: { label: '失败', variant: 'destructive' },
  pending: { label: '等待中', variant: 'outline' },
}

function normalizeStatus(status: CollectionTaskRuntime['status']): DisplayStatus {
  switch (status) {
    case 'running':
      return 'running'
    case 'completed':
      return 'success'
    case 'error':
    case 'paused':
      return 'failed'
    case 'pending':
    default:
      return 'pending'
  }
}

function DimHealthCard({
  code,
  name,
  total,
  success,
}: {
  code: string
  name: string
  total: number
  success: number
}): React.JSX.Element {
  const rate = total > 0 ? (success / total) * 100 : 0
  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (total === 0) {
    status = 'critical'
  } else if (rate < 60) {
    status = 'critical'
  } else if (rate < 85) {
    status = 'warning'
  }

  const colorKey = status === 'healthy' ? 'success' : status === 'warning' ? 'warning' : 'danger'
  const badgeLabel = status === 'healthy' ? '健康' : status === 'warning' ? '警告' : '异常'

  return (
    <Card
      className="transition-all duration-200 hover:shadow-md"
      style={{ borderLeftColor: COLOR_TOKENS[colorKey].hex, borderLeftWidth: 3 }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            {code} · {name}
          </CardTitle>
          <Badge variant={colorKey === 'success' ? 'success' : colorKey === 'warning' ? 'warning' : 'destructive'}>
            {badgeLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold" style={{ color: COLOR_TOKENS[colorKey].hex }}>
            {rate.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">% 成功</span>
        </div>
        <Progress value={rate} max={100} showMax={false} />
        <p className="text-xs text-muted-foreground">
          {success} / {total} 成功
        </p>
      </CardContent>
    </Card>
  )
}

export default function CollectTaskPage(): React.JSX.Element {
  const [isLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('progress')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const taskStatuses = useCollectionRuntimeStore((s) => s.taskStatuses)
  const logs = useCollectionRuntimeStore((s) => s.logs)
  const traceSpans = useCollectionRuntimeStore((s) => s.traceSpans)
  const stats = useCollectionRuntimeStore((s) => s.stats)
  const clearLogs = useCollectionRuntimeStore((s) => s.clearLogs)
  const dimensions = useSevenDimConfigStore((s) => s.dimensions)
  const scoreHistory = useIntelligentScoreStore((s) => s.history)

  const tasks = useMemo(() => Object.values(taskStatuses), [taskStatuses])
  const spans = useMemo(() => Object.values(traceSpans), [traceSpans])
  const selectedTraces = useMemo(
    () => (selectedTaskId ? spans.filter((s) => s.taskId === selectedTaskId) : spans),
    [selectedTaskId, spans],
  )

  const [collectionReport, setCollectionReport] = useState<CollectionReport>({
    progressItems: [],
    reportItems: [],
    overallProgress: 0,
    hasRunningTask: false,
  })
  useEffect(() => {
    let cancelled = false
    mcpBridge
      .callTool('data-collector', 'build_collection_report', {
        traceSpans,
        taskStatuses,
      })
      .then((result) => {
        if (cancelled || result.isError) return
        const text = result.content[0]?.text
        if (!text) return
        try {
          setCollectionReport(JSON.parse(text) as CollectionReport)
        } catch {
          logger.warn('[CollectTaskPage] 采集报告 JSON 解析失败', { text })
        }
      })
      .catch((err) => {
        logger.warn('[CollectTaskPage] 调用 build_collection_report 失败', {
          error: err instanceof Error ? err.message : String(err),
        })
      })
    return () => {
      cancelled = true
    }
  }, [traceSpans, taskStatuses])

  const { runningCount, successCount, failedCount } = useMemo(() => {
    const running = tasks.filter((t) => t.status === 'running').length
    const success = tasks.filter((t) => t.status === 'completed').length
    const failed = tasks.filter((t) => t.status === 'error' || t.status === 'paused').length
    return { runningCount: running, successCount: success, failedCount: failed }
  }, [tasks])

  const dimHealth = useMemo(() => {
    const map = new Map<string, { total: number; success: number; name: string }>()
    dimensions.forEach((dim) => map.set(dim.code, { total: 0, success: 0, name: dim.name }))
    spans.forEach((span) => {
      const entry = map.get(span.dimensionCode)
      if (!entry) return
      entry.total++
      if (span.result === 'success') entry.success++
    })
    return map
  }, [spans, dimensions])

  // 评分状态分析
  const scoreStats = useMemo(() => {
    const total = scoreHistory.length
    if (total === 0) {
      return {
        total: 0,
        avgScore: 0,
        maxScore: 0,
        minScore: 0,
        scoreDistribution: { high: 0, medium: 0, low: 0 },
        recentTrend: [],
        avgIntervalHours: 0,
        lastScoredAt: null,
        nextEstimateAt: null,
      }
    }

    const scores = scoreHistory
      .map((s) => s.overallScore)
      .filter((s): s is number => s !== null)

    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0
    const minScore = scores.length > 0 ? Math.min(...scores) : 0

    // 评分分布：高分(>=4.0)、中分(2.5-4.0)、低分(<2.5)
    const high = scores.filter((s) => s >= 4.0).length
    const medium = scores.filter((s) => s >= 2.5 && s < 4.0).length
    const low = scores.filter((s) => s < 2.5).length

    // 最近 10 次评分趋势
    const recentTrend = scoreHistory
      .slice(0, 10)
      .reverse()
      .map((s) => ({
        date: new Date(s.scoredAt).toLocaleDateString(),
        score: s.overallScore ?? 0,
      }))

    // 计算平均评分间隔（小时）
    const sortedHistory = [...scoreHistory].sort((a, b) => 
      new Date(b.scoredAt).getTime() - new Date(a.scoredAt).getTime()
    )
    const lastScoredAt = sortedHistory[0]?.scoredAt ?? null
    
    let avgIntervalHours = 0
    if (sortedHistory.length >= 2) {
      const intervals: number[] = []
      for (let i = 0; i < sortedHistory.length - 1; i++) {
        const current = sortedHistory[i]
        const next = sortedHistory[i + 1]
        if (current && next) {
          const diff = new Date(current.scoredAt).getTime() - 
                       new Date(next.scoredAt).getTime()
          intervals.push(diff / (1000 * 60 * 60)) // 转换为小时
        }
      }
      avgIntervalHours = intervals.length > 0 
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length 
        : 0
    }

    // 预估下次评分时间
    const nextEstimateAt = lastScoredAt && avgIntervalHours > 0
      ? new Date(new Date(lastScoredAt).getTime() + avgIntervalHours * 60 * 60 * 1000)
      : null

    return {
      total,
      avgScore,
      maxScore,
      minScore,
      scoreDistribution: { high, medium, low },
      recentTrend,
      avgIntervalHours,
      lastScoredAt,
      nextEstimateAt,
    }
  }, [scoreHistory])

  const handleViewTask = (taskId: string) => {
    setSelectedTaskId(taskId)
    setActiveTab('timeline')
    logger.info('[CollectTaskPage] 查看任务详情', { taskId })
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/input">输入舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>采集任务监控</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">采集任务监控</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              任务列表 · 维度健康度 · 采集日志 · 链路可视化
            </p>
          </div>
          <Badge variant="outline">D-1 框架</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">任务总数</p>
              <p className="mt-1 text-2xl font-bold">{tasks.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">采集中</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.info.hex }}>
                {runningCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">已完成</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.success.hex }}>
                {successCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">失败</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.danger.hex }}>
                {failedCount}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">采集成功率</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.success.hex }}>
                {stats.successRate}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">平均延迟</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.info.hex }}>
                {stats.avgLatency}ms
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">降级次数</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.warning.hex }}>
                {stats.fallbackCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">写入成功率</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.success.hex }}>
                {stats.writeRate}%
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="progress" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              进度汇报
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5">
              <ListChecks className="h-4 w-4" />
              任务列表
            </TabsTrigger>
            <TabsTrigger value="score-analysis" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              评分分析
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5">
              <Activity className="h-4 w-4" />
              维度健康
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <ScrollText className="h-4 w-4" />
              采集日志
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5">
              <GitBranch className="h-4 w-4" />
              时间线
            </TabsTrigger>
            <TabsTrigger value="swimlane" className="gap-1.5">
              <GitBranch className="h-4 w-4" />
              泳道图
            </TabsTrigger>
            <TabsTrigger value="replay" className="gap-1.5">
              <Repeat className="h-4 w-4" />
              回放
            </TabsTrigger>
          </TabsList>

          <TabsContent value="progress">
            <div className="space-y-4">
              <CollectionProgressPanel
                items={collectionReport.progressItems}
                overallProgress={collectionReport.overallProgress}
                hasRunningTask={collectionReport.hasRunningTask}
              />
              <CollectionReportPanel items={collectionReport.reportItems} />
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <CardTitle>采集任务列表</CardTitle>
                <CardDescription>来自 collectionRuntimeStore 的实时任务状态</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : tasks.length === 0 ? (
                  <EmptyState
                    title="暂无采集任务"
                    description="尚未发起任何采集任务，请前往数据测试面板执行"
                    action={{ label: '前往数据测试', onClick: () => { window.location.href = '/input' } }}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>任务ID</TableHead>
                          <TableHead>维度</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>进度</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((task) => {
                          const displayStatus = normalizeStatus(task.status)
                          const statusInfo = STATUS_BADGE[displayStatus]
                          const dimName = dimensions.find((d) => d.code === task.dimensionCode)?.name ?? ''
                          return (
                            <TableRow key={task.taskId}>
                              <TableCell className="font-mono text-xs">{task.taskId}</TableCell>
                              <TableCell>
                                <span className="text-sm">
                                  {task.dimensionCode} · {dimName}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                              </TableCell>
                              <TableCell className="w-32">
                                <div className="flex items-center gap-2">
                                  <Progress value={task.progress} max={100} showMax={false} className="flex-1" />
                                  <span className="text-xs text-muted-foreground">{task.progress}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 px-2"
                                  onClick={() => handleViewTask(task.taskId)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  详情
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="score-analysis">
            <div className="space-y-4">
              {/* 评分统计卡片 - 宋瓷美学风格 */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4" style={{ borderLeftColor: COLOR_TOKENS.info.hex }}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">评分总数</p>
                    <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.info.hex }}>{scoreStats.total}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4" style={{ borderLeftColor: COLOR_TOKENS.emerald.hex }}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">平均分</p>
                    <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.success.hex }}>
                      {scoreStats.avgScore.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-l-4" style={{ borderLeftColor: COLOR_TOKENS.warning.hex }}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">最高分</p>
                    <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.warning.hex }}>
                      {scoreStats.maxScore.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-l-4" style={{ borderLeftColor: COLOR_TOKENS.danger.hex }}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">最低分</p>
                    <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.danger.hex }}>
                      {scoreStats.minScore.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* 评分分布 Widget */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" style={{ color: COLOR_TOKENS.info.hex }} />
                    评分分布
                  </CardTitle>
                  <CardDescription>按分数段统计评分数量</CardDescription>
                </CardHeader>
                <CardContent>
                  {scoreStats.total === 0 ? (
                    <EmptyState title="暂无评分数据" description="完成评分后将显示分布统计" />
                  ) : (
                    <div className="space-y-4">
                      {/* 高分段 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">高分 (≥4.0)</span>
                          <Badge variant="success">{scoreStats.scoreDistribution.high}</Badge>
                        </div>
                        <Progress
                          value={scoreStats.total > 0 ? (scoreStats.scoreDistribution.high / scoreStats.total) * 100 : 0}
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          {scoreStats.total > 0 ? ((scoreStats.scoreDistribution.high / scoreStats.total) * 100).toFixed(1) : 0}%
                        </p>
                      </div>

                      {/* 中分段 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">中分 (2.5-4.0)</span>
                          <Badge variant="warning">{scoreStats.scoreDistribution.medium}</Badge>
                        </div>
                        <Progress
                          value={scoreStats.total > 0 ? (scoreStats.scoreDistribution.medium / scoreStats.total) * 100 : 0}
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          {scoreStats.total > 0 ? ((scoreStats.scoreDistribution.medium / scoreStats.total) * 100).toFixed(1) : 0}%
                        </p>
                      </div>

                      {/* 低分段 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">低分 (&lt;2.5)</span>
                          <Badge variant="destructive">{scoreStats.scoreDistribution.low}</Badge>
                        </div>
                        <Progress
                          value={scoreStats.total > 0 ? (scoreStats.scoreDistribution.low / scoreStats.total) * 100 : 0}
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          {scoreStats.total > 0 ? ((scoreStats.scoreDistribution.low / scoreStats.total) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 评分趋势 Widget */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" style={{ color: COLOR_TOKENS.info.hex }} />
                    评分趋势
                  </CardTitle>
                  <CardDescription>最近 10 次评分变化趋势</CardDescription>
                </CardHeader>
                <CardContent>
                  {scoreStats.recentTrend.length === 0 ? (
                    <EmptyState title="暂无趋势数据" description="完成多次评分后将显示趋势图" />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-end justify-between gap-2 h-32">
                        {scoreStats.recentTrend.map((item, idx) => {
                          const height = (item.score / 5) * 100
                          const isHigh = item.score >= 4.0
                          const isMedium = item.score >= 2.5 && item.score < 4.0
                          const color = isHigh ? COLOR_TOKENS.success.hex : isMedium ? COLOR_TOKENS.warning.hex : COLOR_TOKENS.danger.hex
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className="w-full rounded-t transition-all hover:opacity-80"
                                style={{
                                  height: `${height}%`,
                                  backgroundColor: color,
                                  minHeight: '4px',
                                }}
                                title={`${item.date}: ${item.score.toFixed(2)}`}
                              />
                              <span className="text-xs text-muted-foreground truncate w-full text-center">
                                {item.date.slice(5)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="h-3 w-3 rounded" style={{ backgroundColor: COLOR_TOKENS.success.hex }} />
                          高分
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-3 w-3 rounded" style={{ backgroundColor: COLOR_TOKENS.warning.hex }} />
                          中分
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-3 w-3 rounded" style={{ backgroundColor: COLOR_TOKENS.danger.hex }} />
                          低分
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 评分进度 Widget */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" style={{ color: COLOR_TOKENS.info.hex }} />
                    评分进度
                  </CardTitle>
                  <CardDescription>评分间隔与预估下次评分时间</CardDescription>
                </CardHeader>
                <CardContent>
                  {scoreStats.total === 0 ? (
                    <EmptyState title="暂无进度数据" description="完成评分后将显示进度统计" />
                  ) : (
                    <div className="space-y-4">
                      {/* 评分间隔统计 */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">平均评分间隔</p>
                          <p className="mt-1 text-lg font-bold" style={{ color: COLOR_TOKENS.info.hex }}>
                            {scoreStats.avgIntervalHours.toFixed(1)} 小时
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            约 {Math.round(scoreStats.avgIntervalHours / 24)} 天
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">评分频率</p>
                          <p className="mt-1 text-lg font-bold" style={{ color: COLOR_TOKENS.info.hex }}>
                            {scoreStats.avgIntervalHours > 0 
                              ? (24 / scoreStats.avgIntervalHours).toFixed(1) 
                              : '0'} 次/天
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            基于历史评分间隔计算
                          </p>
                        </div>
                      </div>

                      {/* 时间线 */}
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">上次评分</span>
                          <Badge variant="outline">
                            {scoreStats.lastScoredAt 
                              ? new Date(scoreStats.lastScoredAt).toLocaleString('zh-CN', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">预估下次</span>
                          <Badge variant="default">
                            {scoreStats.nextEstimateAt 
                              ? new Date(scoreStats.nextEstimateAt).toLocaleString('zh-CN', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </Badge>
                        </div>
                        {scoreStats.nextEstimateAt && (
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground">
                              距离下次评分约 {Math.round(
                                (new Date(scoreStats.nextEstimateAt).getTime() - Date.now()) / (1000 * 60 * 60)
                              )} 小时
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 进度条可视化 */}
                      {scoreStats.nextEstimateAt && scoreStats.lastScoredAt && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>上次评分</span>
                            <span>预估下次</span>
                          </div>
                          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                            {(() => {
                              const lastTime = new Date(scoreStats.lastScoredAt).getTime()
                              const nextTime = new Date(scoreStats.nextEstimateAt).getTime()
                              const currentTime = Date.now()
                              const progress = ((currentTime - lastTime) / (nextTime - lastTime)) * 100
                              const clampedProgress = Math.min(Math.max(progress, 0), 100)
                              
                              return (
                                <div 
                                  className="absolute left-0 top-0 h-full transition-all"
                                  style={{ width: `${clampedProgress}%`, backgroundColor: COLOR_TOKENS.info.hex }}
                                />
                              )
                            })()}
                          </div>
                          <p className="text-xs text-center text-muted-foreground">
                            评分周期进度
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="health">
            <Card>
              <CardHeader>
                <CardTitle>维度健康度</CardTitle>
                <CardDescription>基于已完成的 trace 计算成功率</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-36 w-full" />
                    ))}
                  </div>
                ) : dimHealth.size === 0 ? (
                  <EmptyState title="暂无数据" description="未产生任何采集 trace" />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from(dimHealth.entries()).map(([code, data]) => (
                      <DimHealthCard
                        key={code}
                        code={code}
                        name={data.name}
                        total={data.total}
                        success={data.success}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <LiveLogStream logs={logs} onClear={clearLogs} maxHeight="480px" />
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>采集链路时间线</CardTitle>
                    <CardDescription>
                      {selectedTaskId ? `任务 ${selectedTaskId} 的 trace` : '全部 trace'}
                    </CardDescription>
                  </div>
                  {selectedTaskId && (
                    <Button size="sm" variant="outline" onClick={() => setSelectedTaskId(null)}>
                      查看全部
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CollectionTimeline spans={selectedTraces} maxHeight="480px" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="swimlane">
            <Card>
              <CardHeader>
                <CardTitle>采集链路泳道图</CardTitle>
                <CardDescription>各数据源按时间轴展开的甘特式视图</CardDescription>
              </CardHeader>
              <CardContent>
                <CollectionSwimlane spans={selectedTraces} maxHeight="480px" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="replay">
            <TraceReplayPanel spans={selectedTraces} />
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  )
}
