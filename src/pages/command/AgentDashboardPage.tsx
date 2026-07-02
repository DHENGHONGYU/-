/**
 * @module AgentDashboardPage
 * @description Agent 性能追踪页面（总控舱）。
 *   - 聚合 AgentHealthCard 网格、AgentTaskList 与 LogStreamPanel。
 *   - 通过 useSystemMonitorStore 读取 Agent 健康快照、指标汇总与任务历史。
 *   - 挂载时启动监控轮询并记录 Agent 健康日志；卸载时仅停止本页启动的监控。
 *
 * 遵循 AGENTS.md 契约：
 *   - 页面层仅依赖 store/services，不直接调用 dataLayer 或 db
 *   - 禁止使用 any
 *   - 所有 useEffect cleanup 显式声明
 *   - 核心分支含 logger.info
 *   - 颜色值引用 COLOR_TOKENS，禁止硬编码 HEX 或数字颜色类
 */

import React, { useEffect, useState } from 'react'
import AgentHealthCard from '@/components/system/AgentHealthCard'
import AgentTaskList from '@/components/system/AgentTaskList'
import LogStreamPanel from '@/components/system/LogStreamPanel'
import { useSystemMonitorStore } from '@/store/systemMonitorStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { getMonitorLogService } from '@/services/system/monitorLogService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 常量（零硬编码锚点）
// ============================================================

/** 时间戳补零长度（HH/MM/SS） */
const TIMESTAMP_PAD_START = 2
/** 百分比换算因子（0-1 → 0-100） */
const PERCENTAGE_MULTIPLIER = 100
/** 失败率百分比保留小数位 */
const FAILURE_RATE_DECIMALS = 1
/** 失败率预警阈值（0-1）——达到此值显示琥珀色 */
const FAILURE_RATE_WARNING_THRESHOLD = 0.15
/** 失败率异常阈值（0-1）——达到此值显示红色 */
const FAILURE_RATE_CRITICAL_THRESHOLD = 0.30
/** 任务列表最大显示行数 */
const TASK_LIST_MAX_ROWS = 20
/** 未更新占位文案 */
const NOT_UPDATED_TEXT = '尚未更新'

/** 统计卡片通用样式（边框/背景引用主题令牌，避免硬编码颜色类） */
const STAT_CARD_CLASS = `rounded-lg border p-3 ${COLOR_TOKENS.border.tailwind} ${COLOR_TOKENS.bgSlate50.tailwind}`
/** 空态/加载态占位容器样式 */
const EMPTY_STATE_CLASS = `flex items-center justify-center rounded-lg border p-10 text-sm text-muted-foreground ${COLOR_TOKENS.border.tailwind}`

// ============================================================
// 纯函数工具
// ============================================================

/**
 * 格式化最后更新时间戳为 "最后更新: HH:MM:SS"；无时间戳时返回占位文案。
 */
function formatLastUpdated(lastUpdated: number): string {
  if (!lastUpdated) return NOT_UPDATED_TEXT
  const date = new Date(lastUpdated)
  const hh = String(date.getHours()).padStart(TIMESTAMP_PAD_START, '0')
  const mm = String(date.getMinutes()).padStart(TIMESTAMP_PAD_START, '0')
  const ss = String(date.getSeconds()).padStart(TIMESTAMP_PAD_START, '0')
  return `最后更新: ${hh}:${mm}:${ss}`
}

/**
 * 根据失败率阈值解析语义颜色（绿 < 15%，琥珀 < 30%，红 >= 30%）。
 */
function resolveFailureRateColor(failureRate: number): string {
  if (failureRate >= FAILURE_RATE_CRITICAL_THRESHOLD) {
    return COLOR_TOKENS.danger.hex
  }
  if (failureRate >= FAILURE_RATE_WARNING_THRESHOLD) {
    return COLOR_TOKENS.warning.hex
  }
  return COLOR_TOKENS.success.hex
}

// ============================================================
// 组件
// ============================================================

function AgentDashboardPage(): React.JSX.Element {
  // 系统监控 Store：Agent 健康快照、指标汇总与刷新
  const agentHealthSnapshots = useSystemMonitorStore((s) => s.agentHealthSnapshots)
  const agentMetrics = useSystemMonitorStore((s) => s.agentMetrics)
  const isLoading = useSystemMonitorStore((s) => s.isLoading)
  const lastUpdated = useSystemMonitorStore((s) => s.lastUpdated)
  const refreshSnapshot = useSystemMonitorStore((s) => s.refreshSnapshot)
  const startMonitoring = useSystemMonitorStore((s) => s.startMonitoring)
  const stopMonitoring = useSystemMonitorStore((s) => s.stopMonitoring)

  // 手动刷新进行中标记（驱动按钮 loading 态）
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // 挂载时：若未在监控中则启动并刷新；卸载时仅停止本页启动的监控
  useEffect(() => {
    logger.info('[AgentDashboardPage] mounted', {
      isMonitoring: useSystemMonitorStore.getState().isMonitoring,
    })

    // 本地标记：仅当本页启动监控时，卸载才停止，避免误停其他页面的轮询
    let startedHere = false

    const performInitialRefresh = (): void => {
      useSystemMonitorStore.getState().refreshSnapshot()
      const snapshots = useSystemMonitorStore.getState().agentHealthSnapshots
      getMonitorLogService().logAgentHealth(snapshots)
      logger.info('[AgentDashboardPage] initial agent health logged', {
        agentCount: snapshots.length,
      })
    }
    void performInitialRefresh()

    if (!useSystemMonitorStore.getState().isMonitoring) {
      startMonitoring()
      startedHere = true
    }

    return () => {
      if (startedHere) {
        stopMonitoring()
        logger.info('[AgentDashboardPage] unmounted, monitoring stopped')
      }
    }
  }, [startMonitoring, stopMonitoring])

  /**
   * 手动刷新：拉取快照并记录 Agent 健康日志。
   * 通过 getState() 读取最新快照，避免闭包陈旧。
   */
  const handleRefresh = (): void => {
    setIsRefreshing(true)
    try {
      refreshSnapshot()
      const snapshots = useSystemMonitorStore.getState().agentHealthSnapshots
      getMonitorLogService().logAgentHealth(snapshots)
      logger.info('[AgentDashboardPage] manual refresh completed', {
        agentCount: snapshots.length,
        totalTasks: useSystemMonitorStore.getState().agentMetrics?.totalTasks ?? 0,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // 指标汇总派生值（agentMetrics 可能为 null，统一兜底为 0）
  const totalAgents = agentMetrics?.totalAgents ?? 0
  const healthyCount = agentMetrics?.healthyCount ?? 0
  const warningCount = agentMetrics?.warningCount ?? 0
  const criticalCount = agentMetrics?.criticalCount ?? 0
  const totalTasks = agentMetrics?.totalTasks ?? 0
  const avgFailureRate = agentMetrics?.avgFailureRate ?? 0
  const failureRatePercent = (
    avgFailureRate * PERCENTAGE_MULTIPLIER
  ).toFixed(FAILURE_RATE_DECIMALS)

  // 加载态：正在加载且尚无健康数据
  const showLoadingState = isLoading && agentHealthSnapshots.length === 0
  const showEmptyState = !showLoadingState && agentHealthSnapshots.length === 0

  return (
    <div className="space-y-4 p-4">
      {/* 页面头部 + 指标汇总 */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>智能体性能追踪</CardTitle>
              <p className="text-sm text-muted-foreground">
                监控所有注册智能体的健康状态、任务执行和性能指标
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatLastUpdated(lastUpdated)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRefresh()}
                isLoading={isRefreshing}
              >
                立即刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 指标汇总：4 项统计 */}
          <div className="grid grid-cols-4 gap-3">
            <div className={STAT_CARD_CLASS}>
              <p className="text-xs text-muted-foreground">智能体总数</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{totalAgents}</p>
            </div>

            <div className={STAT_CARD_CLASS}>
              <p className="text-xs text-muted-foreground">健康/预警/异常</p>
              <div className="mt-1 flex items-center gap-1">
                <Badge variant="success">{healthyCount}</Badge>
                <Badge variant="warning">{warningCount}</Badge>
                <Badge variant="destructive">{criticalCount}</Badge>
              </div>
            </div>

            <div className={STAT_CARD_CLASS}>
              <p className="text-xs text-muted-foreground">总任务数</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{totalTasks}</p>
            </div>

            <div className={STAT_CARD_CLASS}>
              <p className="text-xs text-muted-foreground">平均失败率</p>
              <p
                className="mt-1 text-lg font-semibold tabular-nums"
                style={{ color: resolveFailureRateColor(avgFailureRate) }}
              >
                {failureRatePercent}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent 健康卡片网格 */}
      {showLoadingState ? (
        <div className={EMPTY_STATE_CLASS}>加载中...</div>
      ) : showEmptyState ? (
        <div className={EMPTY_STATE_CLASS}>暂无智能体健康数据</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {agentHealthSnapshots.map((agent) => (
            <AgentHealthCard key={agent.agentId} agent={agent} />
          ))}
        </div>
      )}

      {/* Agent 任务队列 */}
      <AgentTaskList maxRows={TASK_LIST_MAX_ROWS} />

      {/* 实时监控日志流 */}
      <LogStreamPanel />
    </div>
  )
}

export default AgentDashboardPage
