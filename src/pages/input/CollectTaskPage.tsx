/**
 * @module CollectTaskPage
 * @description 采集任务监控页（D-1 框架）。
 *
 * 三 Tab 布局：
 * - 任务列表：表格展示任务ID/维度/状态/进度/耗时/操作
 * - 评分卡片：网格布局展示各维度健康度卡片
 * - 采集日志：滚动日志列表
 *
 * 当前为 Mock 数据展示，不接入真实 API。
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Activity, ListChecks, ScrollText, RefreshCw, Play, Eye } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getLogger } from '@/lib/logger'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/Breadcrumb'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

type TaskStatus = 'running' | 'success' | 'failed' | 'pending'

interface CollectTask {
  id: string
  dimension: string
  dimensionName: string
  status: TaskStatus
  progress: number
  durationMs: number
  symbolCount: number
}

interface DimHealthCard {
  code: string
  name: string
  score: number
  max: number
  status: 'healthy' | 'warning' | 'critical'
  lastUpdate: string
}

interface CollectLog {
  id: string
  time: string
  level: 'info' | 'warn' | 'error'
  dimension: string
  message: string
}

// ============================================================
// Mock 数据
// ============================================================

const MOCK_TASKS: CollectTask[] = [
  { id: 'TASK-20260701-001', dimension: '01', dimensionName: '基本信息', status: 'success', progress: 100, durationMs: 12800, symbolCount: 40 },
  { id: 'TASK-20260701-002', dimension: '02', dimensionName: 'K线数据', status: 'running', progress: 65, durationMs: 8400, symbolCount: 40 },
  { id: 'TASK-20260701-003', dimension: '03', dimensionName: '筹码分布', status: 'pending', progress: 0, durationMs: 0, symbolCount: 40 },
  { id: 'TASK-20260630-004', dimension: '05', dimensionName: '热点新闻', status: 'failed', progress: 42, durationMs: 5600, symbolCount: 40 },
  { id: 'TASK-20260630-005', dimension: '08', dimensionName: '研报中心', status: 'success', progress: 100, durationMs: 21300, symbolCount: 40 },
]

const MOCK_HEALTH: DimHealthCard[] = [
  { code: '01', name: '基本信息', score: 4.8, max: 5, status: 'healthy', lastUpdate: '2026-07-01 09:15' },
  { code: '02', name: 'K线数据', score: 4.5, max: 5, status: 'healthy', lastUpdate: '2026-07-01 09:20' },
  { code: '03', name: '筹码分布', score: 3.2, max: 5, status: 'warning', lastUpdate: '2026-06-30 18:00' },
  { code: '04', name: '重大事项', score: 4.0, max: 5, status: 'healthy', lastUpdate: '2026-07-01 08:30' },
  { code: '05', name: '热点新闻', score: 1.8, max: 5, status: 'critical', lastUpdate: '2026-06-30 22:10' },
  { code: '06', name: '行业竞品', score: 3.6, max: 5, status: 'warning', lastUpdate: '2026-06-30 12:00' },
  { code: '07', name: '关联指数', score: 4.2, max: 5, status: 'healthy', lastUpdate: '2026-06-30 12:00' },
  { code: '08', name: '研报中心', score: 4.7, max: 5, status: 'healthy', lastUpdate: '2026-07-01 09:00' },
]

const MOCK_LOGS: CollectLog[] = [
  { id: 'L1', time: '09:20:15', level: 'info', dimension: '02', message: 'K线数据采集开始，共 40 只标的' },
  { id: 'L2', time: '09:20:32', level: 'info', dimension: '02', message: '已完成 26/40，进度 65%' },
  { id: 'L3', time: '09:15:02', level: 'info', dimension: '01', message: '基本信息采集完成，耗时 12.8s' },
  { id: 'L4', time: '09:14:58', level: 'warn', dimension: '01', message: '600519.SH 字段 roe 为空，使用默认值' },
  { id: 'L5', time: '08:30:44', level: 'error', dimension: '05', message: '热点新闻接口超时，重试 3 次后失败' },
  { id: 'L6', time: '08:30:10', level: 'info', dimension: '05', message: '热点新闻采集开始' },
  { id: 'L7', time: '08:25:00', level: 'info', dimension: '08', message: '研报中心采集完成，共 38 条' },
]

// ============================================================
// 状态映射
// ============================================================

const STATUS_BADGE: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> = {
  running: { label: '采集中', variant: 'default' },
  success: { label: '已完成', variant: 'success' },
  failed: { label: '失败', variant: 'destructive' },
  pending: { label: '等待中', variant: 'outline' },
}

const HEALTH_BADGE: Record<DimHealthCard['status'], { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  healthy: { label: '健康', variant: 'success' },
  warning: { label: '警告', variant: 'warning' },
  critical: { label: '异常', variant: 'destructive' },
}

/** 维度健康状态对应颜色 token（引用 constants，不硬编码） */
const HEALTH_COLOR_TOKEN: Record<DimHealthCard['status'], keyof typeof COLOR_TOKENS> = {
  healthy: 'success',
  warning: 'warning',
  critical: 'danger',
}

function formatDuration(ms: number): string {
  if (ms === 0) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ============================================================
// 主页面
// ============================================================

export default function CollectTaskPage(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true)
  const [tasks] = useState<CollectTask[]>(MOCK_TASKS)
  const [healthCards] = useState<DimHealthCard[]>(MOCK_HEALTH)
  const [logs] = useState<CollectLog[]>(MOCK_LOGS)

  useEffect(() => {
    logger.info('[CollectTaskPage] 挂载，加载 Mock 数据')
    const timer = window.setTimeout(() => {
      try {
        setIsLoading(false)
      } catch (err) {
        logger.error('[CollectTaskPage] 加载失败', { err })
        setIsLoading(false)
      }
    }, 400)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  const runningCount = tasks.filter((t) => t.status === 'running').length
  const successCount = tasks.filter((t) => t.status === 'success').length
  const failedCount = tasks.filter((t) => t.status === 'failed').length

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        {/* 面包屑 */}
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

        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">采集任务监控</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              任务列表 · 维度健康度 · 采集日志
            </p>
          </div>
          <Badge variant="outline">D-1 框架 · Mock</Badge>
        </div>

        {/* 概览统计 */}
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
              <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.info.hex }}>{runningCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">已完成</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.success.hex }}>{successCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">失败</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.danger.hex }}>{failedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* 三 Tab 布局 */}
        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks" className="gap-1.5">
              <ListChecks className="h-4 w-4" />
              任务列表
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5">
              <Activity className="h-4 w-4" />
              评分卡片
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <ScrollText className="h-4 w-4" />
              采集日志
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: 任务列表 */}
          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>采集任务列表</CardTitle>
                    <CardDescription>展示最近采集任务的状态与进度</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <RefreshCw className="h-4 w-4" />
                    刷新
                  </Button>
                </div>
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
                    description="尚未发起任何采集任务，请前往七维采集配置页执行采集"
                    action={{ label: '前往采集配置', onClick: () => { window.location.href = '/input/seven-dim' } }}
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
                          <TableHead>耗时</TableHead>
                          <TableHead>标的数</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((task) => {
                          const statusInfo = STATUS_BADGE[task.status]
                          return (
                            <TableRow key={task.id}>
                              <TableCell className="font-mono text-xs">{task.id}</TableCell>
                              <TableCell>
                                <span className="text-sm">{task.dimension}·{task.dimensionName}</span>
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
                              <TableCell className="text-sm text-muted-foreground">{formatDuration(task.durationMs)}</TableCell>
                              <TableCell className="text-sm">{task.symbolCount}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2">
                                    <Eye className="h-3.5 w-3.5" />
                                    详情
                                  </Button>
                                  {task.status === 'failed' && (
                                    <Button variant="outline" size="sm" className="h-7 gap-1 px-2">
                                      <Play className="h-3.5 w-3.5" />
                                      重试
                                    </Button>
                                  )}
                                </div>
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

          {/* Tab 2: 评分卡片 */}
          <TabsContent value="health">
            <Card>
              <CardHeader>
                <CardTitle>维度健康度评分</CardTitle>
                <CardDescription>各采集维度数据质量与时效性评分</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-36 w-full" />
                    ))}
                  </div>
                ) : healthCards.length === 0 ? (
                  <EmptyState title="暂无评分数据" description="尚未生成维度健康度评分" />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {healthCards.map((card) => {
                      const healthInfo = HEALTH_BADGE[card.status]
                      const colorToken = COLOR_TOKENS[HEALTH_COLOR_TOKEN[card.status]]
                      return (
                        <Card
                          key={card.code}
                          className="transition-all duration-200 hover:shadow-md"
                          style={{ borderLeftColor: colorToken.hex, borderLeftWidth: 3 }}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">{card.code}·{card.name}</CardTitle>
                              <Badge variant={healthInfo.variant}>{healthInfo.label}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold" style={{ color: colorToken.hex }}>
                                {card.score.toFixed(1)}
                              </span>
                              <span className="text-xs text-muted-foreground">/ {card.max}</span>
                            </div>
                            <Progress value={card.score} max={card.max} showMax={false} />
                            <p className="text-xs text-muted-foreground">最近更新：{card.lastUpdate}</p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: 采集日志 */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>采集日志</CardTitle>
                    <CardDescription>实时滚动展示采集过程日志</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <RefreshCw className="h-4 w-4" />
                    刷新
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : logs.length === 0 ? (
                  <EmptyState title="暂无日志" description="采集启动后将在此展示实时日志" />
                ) : (
                  <div className="max-h-[480px] space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
                    {logs.map((log) => {
                      const levelColor =
                        log.level === 'error'
                          ? COLOR_TOKENS.danger.hex
                          : log.level === 'warn'
                            ? COLOR_TOKENS.warning.hex
                            : COLOR_TOKENS.info.hex
                      return (
                        <div key={log.id} className="flex items-start gap-2 py-0.5">
                          <span className="shrink-0 text-muted-foreground">{log.time}</span>
                          <span
                            className="shrink-0 font-semibold uppercase"
                            style={{ color: levelColor }}
                          >
                            [{log.level}]
                          </span>
                          <span className="shrink-0 text-muted-foreground">[{log.dimension}]</span>
                          <span className="min-w-0 break-words text-foreground">{log.message}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  )
}
