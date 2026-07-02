/**
 * @module AgentTaskList
 * @description Agent 任务队列表格：展示最近任务的 ID、Agent、类型、状态、耗时与创建时间。
 * 优先消费 systemMonitorStore 中的实时快照（recentTasks），支持按状态筛选、
 * 按 createdAt 降序排序，并以 MONITOR_INTERVALS.TASK_QUEUE 间隔轮询刷新。
 */

import React, { useEffect, useState, memo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useSystemMonitorStore } from '@/store/systemMonitorStore'
import { useAgentStore } from '@/store/agentStore'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { MONITOR_INTERVALS } from '@/constants/health.constants'
import type { AgentTaskHistoryEntry } from '@/types/modules/agent.types'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'

// ============================================================
// 常量（零硬编码锚点）
// ============================================================

/** 任务队列轮询间隔（毫秒）—— 取自监控常量，禁止硬编码 */
const POLL_INTERVAL_MS = MONITOR_INTERVALS.TASK_QUEUE
/** 默认最大显示行数 */
const DEFAULT_MAX_ROWS = 15
/** 任务 ID 截断长度 */
const TASK_ID_MAX_LENGTH = 20
/** Agent ID 截断长度 */
const AGENT_ID_MAX_LENGTH = 15
/** 毫秒与秒换算基数 */
const MS_PER_SECOND = 1000

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 任务状态筛选值 */
type FilterStatus = 'all' | 'running' | 'completed' | 'failed' | 'timeout'

/** 任务状态枚举（与 AgentTaskHistoryEntry.status 对齐） */
type TaskStatus = AgentTaskHistoryEntry['status']

/** Badge 变体类型（从组件 Props 推导，避免硬编码字符串联合） */
type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>['variant']>

// ============================================================
// 状态 → Badge 配置
// @remarks status 为穷举联合，新增值将触发编译错误（Record 强制完整覆盖）。
// ============================================================

interface StatusBadgeConfig {
  variant: BadgeVariant
  text: string
  /** 额外 className（如运行中的脉冲动画） */
  className?: string
}

const STATUS_BADGE_CONFIG: Record<TaskStatus, StatusBadgeConfig> = {
  pending: { variant: 'secondary', text: '待处理' },
  running: { variant: 'default', text: '运行中', className: 'animate-pulse' },
  completed: { variant: 'success', text: '已完成' },
  failed: { variant: 'destructive', text: '失败' },
  timeout: { variant: 'warning', text: '超时' },
}

// ============================================================
// 状态筛选按钮配置
// ============================================================

const FILTER_CONFIG: Array<{ value: FilterStatus; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '运行中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'timeout', label: '超时' },
]

// ============================================================
// 纯格式化函数
// ============================================================

/**
 * 格式化耗时：undefined → "-"；>1000ms → "X.Xs"；否则 → "Xms"
 */
function formatDuration(ms?: number): string {
  if (ms === undefined) return '-'
  if (ms > MS_PER_SECOND) {
    return `${(ms / MS_PER_SECOND).toFixed(1)}s`
  }
  return `${ms}ms`
}

/**
 * 格式化时间戳为 HH:MM:SS
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

/**
 * 截断文本：超出 maxLength 时追加省略号
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

// ============================================================
// Props
// ============================================================

export interface AgentTaskListProps {
  /** 最大显示行数，默认 15 */
  maxRows?: number
}

// ============================================================
// 组件
// ============================================================

function AgentTaskListImpl({ maxRows = DEFAULT_MAX_ROWS }: AgentTaskListProps): React.JSX.Element {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  // 消费 systemMonitorStore 实时快照
  const recentTasks = useSystemMonitorStore((s) => s.recentTasks)
  const isLoading = useSystemMonitorStore((s) => s.isLoading)
  const isMonitoring = useSystemMonitorStore((s) => s.isMonitoring)
  const refreshSnapshot = useSystemMonitorStore((s) => s.refreshSnapshot)

  // 消费 agentStore 注册列表（用于挂载日志上下文）
  const registeredAgentCount = useAgentStore((s) => s.registeredAgents.length)

  // 挂载时启动轮询：若未在监控中则立即刷新一次，随后按 TASK_QUEUE 间隔轮询
  useEffect(() => {
    logger.info('[AgentTaskList] mounted, starting task queue polling', {
      pollInterval: POLL_INTERVAL_MS,
      registeredAgents: registeredAgentCount,
      isMonitoring,
    })

    if (!isMonitoring) {
      void refreshSnapshot()
    }

    const timer = setInterval(() => {
      void refreshSnapshot()
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(timer)
      logger.info('[AgentTaskList] unmounted, polling stopped')
    }
  }, [isMonitoring, refreshSnapshot, registeredAgentCount])

  // 筛选 → 排序（createdAt 降序）→ 限制行数
  // @remarks filter() 返回新数组，'all' 分支显式拷贝以避免 sort() 原地修改 Store 数组
  const sourceTasks =
    filterStatus === 'all'
      ? recentTasks
      : recentTasks.filter((task) => task.status === filterStatus)
  const displayedTasks = [...sourceTasks]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, maxRows)

  return (
    <Card className="w-full">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">任务队列</CardTitle>
            <Badge variant="secondary">{recentTasks.length}</Badge>
          </div>
        </div>

        {/* 状态筛选按钮组 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_CONFIG.map((filter) => {
            const isActive = filterStatus === filter.value
            return (
              <Button
                key={filter.value}
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus(filter.value)}
              >
                {filter.label}
              </Button>
            )
          })}
        </div>
      </CardHeader>

      <CardContent>
        {/* 加载态：正在加载且无数据 */}
        {isLoading && displayedTasks.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : displayedTasks.length === 0 ? (
          /* 空态：无任务 */
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            暂无任务
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={cn(
                    'border-b text-left text-xs text-muted-foreground',
                    COLOR_TOKENS.neutral.tailwind,
                  )}
                >
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">任务ID</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">智能体</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">类型</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">状态</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">耗时</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {displayedTasks.map((task) => {
                  const statusConfig = STATUS_BADGE_CONFIG[task.status]
                  return (
                    <tr
                      key={task.taskId}
                      className="border-b transition-colors last:border-0 hover:bg-accent/40"
                    >
                      <td
                        className="max-w-[180px] truncate py-2 pr-3 font-mono text-xs"
                        title={task.taskId}
                      >
                        {truncate(task.taskId, TASK_ID_MAX_LENGTH)}
                      </td>
                      <td
                        className="max-w-[140px] truncate py-2 pr-3 font-mono text-xs"
                        title={task.agentId}
                      >
                        {truncate(task.agentId, AGENT_ID_MAX_LENGTH)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3">{task.type}</td>
                      <td className="whitespace-nowrap py-2 pr-3">
                        <Badge variant={statusConfig.variant} className={statusConfig.className}>
                          {statusConfig.text}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                        {formatDuration(task.durationMs)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-muted-foreground">
                        {formatTime(task.createdAt)}
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
  )
}

const AgentTaskList = memo(AgentTaskListImpl)
AgentTaskList.displayName = 'AgentTaskList'

export default AgentTaskList
