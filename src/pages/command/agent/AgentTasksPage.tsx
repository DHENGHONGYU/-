import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import { RefreshCw, AlertCircle, CheckCircle2, XCircle, Clock, X } from 'lucide-react'
import { Card, CardContent } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { useAgentStore } from '@/store/agentStore'
import { agentRuntime } from '@/agents/agentRuntime'
import { getLogger } from '@/lib/logger'
import type { AgentTaskFilter } from '@/types/modules/agent.types'

const logger = getLogger()

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  running: RefreshCw,
  completed: CheckCircle2,
  failed: XCircle,
  timeout: AlertCircle,
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning'> = {
  pending: 'secondary',
  running: 'default',
  completed: 'success',
  failed: 'destructive',
  timeout: 'warning',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  timeout: '超时',
}

const FILTER_TABS = [
  { key: '', label: '全部' },
  { key: 'running', label: '执行中' },
  { key: 'completed', label: '已完成' },
  { key: 'failed', label: '失败' },
  { key: 'timeout', label: '超时' },
]

/**
 * AgentTasksPage
 */
export default function AgentTasksPage(): React.JSX.Element {
  const [statusFilter, setStatusFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const store = useAgentStore()

  useEffect(() => {
    logger.info('[AgentTasksPage] Mounted')
    const filter: AgentTaskFilter = {}
    if (statusFilter) {
      filter.status = statusFilter as AgentTaskFilter['status']
    }
    store.setTaskFilter(filter)

    let interval: ReturnType<typeof setInterval> | undefined
    if (autoRefresh) {
      interval = setInterval(() => {
        store.refreshStats()
      }, 3000)
    }
    return () => {
      if (interval) clearInterval(interval)
      logger.info('[AgentTasksPage] Unmounted')
    }
  }, [statusFilter, autoRefresh, store])

  const allTasks = Array.from(store.tasks.values())
  const filteredTasks = statusFilter
    ? allTasks.filter((t) => t.status === statusFilter)
    : allTasks

  const sortedTasks = [...filteredTasks].sort((a, b) => b.createdAt - a.createdAt)

  const handleCancel = useCallback((taskId: string) => {
    logger.info('[AgentTasksPage] Cancelling task', { taskId })
    agentRuntime.cancelTask(taskId)
    store.refreshStats()
  }, [store])

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">首页</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/command/hub">总控舱</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/command/agents">智能体</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>任务列表</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">任务列表</h1>
          <p className="text-muted-foreground">查看所有智能体任务的执行状态和历史记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? '自动刷新中' : '已暂停'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => store.refreshStats()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={statusFilter === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {sortedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Clock className="h-12 w-12 mb-3 opacity-30" />
              <p>暂无任务记录</p>
              <p className="text-sm mt-1">触发智能体任务后将在此显示</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="p-3 font-medium">任务 ID</th>
                    <th className="p-3 font-medium">智能体</th>
                    <th className="p-3 font-medium">类型</th>
                    <th className="p-3 font-medium">状态</th>
                    <th className="p-3 font-medium">创建时间</th>
                    <th className="p-3 font-medium">耗时</th>
                    <th className="p-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task) => {
                    const StatusIcon = STATUS_ICONS[task.status] ?? Clock
                    return (
                      <tr key={task.id} className="border-b text-sm hover:bg-muted/50">
                        <td className="p-3 font-mono text-xs">{task.id.slice(0, 12)}...</td>
                        <td className="p-3">{task.agentId || task.id.split('-')[0]}</td>
                        <td className="p-3">{task.type}</td>
                        <td className="p-3">
                          <Badge variant={STATUS_VARIANTS[task.status] ?? 'secondary'}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {STATUS_LABELS[task.status] ?? task.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(task.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {task.completedAt && task.startedAt
                            ? `${task.completedAt - task.startedAt}ms`
                            : '-'}
                        </td>
                        <td className="p-3">
                          {task.status === 'running' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(task.id)}
                            >
                              <X className="mr-1 h-3 w-3" />
                              取消
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}