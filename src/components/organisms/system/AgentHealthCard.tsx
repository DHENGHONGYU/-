/**
 * @module AgentHealthCard
 * @description AI Agent 健康状态卡片：展示单个 Agent 的失败率、平均执行时间、
 * 任务量与心跳年龄。优先消费 systemMonitorStore 中的实时快照；当 Store 暂无
 * 该 Agent 时回退到 props 传入的快照（便于独立使用 / 测试）。
 */

import React, { useEffect, memo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Progress } from '@/components/atoms/Progress'
import { useSystemMonitorStore } from '@/store/systemMonitorStore'
import { HEALTH_STATUS, HEALTH_STATUS_MAP } from '@/constants/health.constants'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { AgentHealthSnapshot } from '@/types/modules/agent.types'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'

// ============================================================
// 常量（零硬编码锚点）
// ============================================================

/** 心跳显示刷新间隔（毫秒） */
const HEARTBEAT_REFRESH_MS = 5000
/** 失败率预警阈值（0-1）——低于此值显示绿色 */
const FAILURE_RATE_WARNING_THRESHOLD = 0.15
/** 失败率异常阈值（0-1）——达到此值显示红色 */
const FAILURE_RATE_CRITICAL_THRESHOLD = 0.30
/** 平均执行时间进度条最大值（毫秒） */
const EXECUTION_TIME_MAX_MS = 10000
/** 毫秒与秒换算基数 */
const MS_PER_SECOND = 1000

const logger = getLogger()

// ============================================================
// 状态 → Badge 配置
// @remarks agent.status 为小写枚举，文案 / 变体遵循组件规格；
// warning / critical / unknown 复用 HEALTH_STATUS_MAP 语义标签。
// ============================================================

type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>['variant']>

const STATUS_BADGE_CONFIG: Record<
  AgentHealthSnapshot['status'],
  { variant: BadgeVariant; text: string }
> = {
  healthy: { variant: 'success', text: '健康' },
  warning: { variant: 'warning', text: HEALTH_STATUS_MAP[HEALTH_STATUS.WARNING].label },
  critical: { variant: 'destructive', text: HEALTH_STATUS_MAP[HEALTH_STATUS.CRITICAL].label },
  unknown: { variant: 'secondary', text: HEALTH_STATUS_MAP[HEALTH_STATUS.UNKNOWN].label },
}

// ============================================================
// 纯格式化函数
// ============================================================

/** 失败率（0-1）→ "12.3%" */
function formatFailureRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

/** 执行时间（ms）→ "350ms" 或 "1.2s"（>1000ms 时折算为秒） */
function formatExecutionTime(ms: number): string {
  if (ms > MS_PER_SECOND) {
    return `${(ms / MS_PER_SECOND).toFixed(1)}s`
  }
  return `${ms}ms`
}

/** 心跳时间戳 → "12s前"，无心跳（0）时返回 "无心跳" */
function formatHeartbeatAge(lastHeartbeat: number, now: number): string {
  if (lastHeartbeat === 0) return '无心跳'
  return `${Math.floor((now - lastHeartbeat) / MS_PER_SECOND)}s前`
}

// ============================================================
// Props
// ============================================================

export interface AgentHealthCardProps {
  /** 单个 Agent 健康快照 */
  agent: AgentHealthSnapshot
}

// ============================================================
// 组件
// ============================================================

function AgentHealthCardImpl({ agent }: AgentHealthCardProps): React.JSX.Element {
  // 优先消费 Store 实时快照（按 agentId 匹配）；Store 暂无时回退到 props 快照
  const liveSnapshot = useSystemMonitorStore(
    (s) => s.agentHealthSnapshots.find((a) => a.agentId === agent.agentId),
  )
  const snapshot = liveSnapshot ?? agent

  // 心跳显示每 HEARTBEAT_REFRESH_MS 刷新一次（触发重算心跳年龄）
  const [, setHeartbeatTick] = useState(0)
  useEffect(() => {
    logger.debug('[AgentHealthCard] heartbeat monitor started', {
      agentId: snapshot.agentId,
    })
    const timer = setInterval(() => {
      setHeartbeatTick((t) => t + 1)
    }, HEARTBEAT_REFRESH_MS)
    return () => {
      clearInterval(timer)
      logger.debug('[AgentHealthCard] heartbeat monitor stopped', {
        agentId: snapshot.agentId,
      })
    }
  }, [snapshot.agentId])

  // Record 已在类型层保证穷尽覆盖（status 新增值将触发编译错误），直接取值即可
  const statusConfig = STATUS_BADGE_CONFIG[snapshot.status]

  const failureRateText = formatFailureRate(snapshot.failureRate)
  // 失败率进度条颜色：绿 < 15%，黄 < 30%，红 >= 30%（颜色值取自 COLOR_TOKENS）
  const failureBarColor =
    snapshot.failureRate < FAILURE_RATE_WARNING_THRESHOLD
      ? COLOR_TOKENS.success.hex
      : snapshot.failureRate < FAILURE_RATE_CRITICAL_THRESHOLD
        ? COLOR_TOKENS.warning.hex
        : COLOR_TOKENS.danger.hex

  const executionTimeText = formatExecutionTime(snapshot.avgExecutionTime)
  const heartbeatText = formatHeartbeatAge(snapshot.lastHeartbeat, Date.now())

  return (
    <Card className="w-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{snapshot.agentName}</CardTitle>
        <Badge variant={statusConfig.variant}>{statusConfig.text}</Badge>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {/* 失败率 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">失败率</span>
              <span className="font-medium">{failureRateText}</span>
            </div>
            <Progress
              value={snapshot.failureRate * 100}
              max={100}
              showMax={false}
              className="[&>div>div]:bg-[var(--agent-bar-color)]"
              style={{ '--agent-bar-color': failureBarColor } as React.CSSProperties}
            />
          </div>

          {/* 平均执行时间 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">平均执行时间</span>
              <span className="font-medium">{executionTimeText}</span>
            </div>
            <Progress
              value={snapshot.avgExecutionTime}
              max={EXECUTION_TIME_MAX_MS}
              showMax={false}
            />
          </div>

          {/* 总任务数 */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">总任务数</div>
            <div className="text-lg font-semibold">{snapshot.totalTasks}</div>
          </div>

          {/* 连续失败（>0 时标红） */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">连续失败</div>
            <div
              className={cn(
                'text-lg font-semibold',
                snapshot.consecutiveFailures > 0 && COLOR_TOKENS.danger.tailwind,
              )}
            >
              {snapshot.consecutiveFailures}
            </div>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <div className="flex gap-3">
            <span>最大并发: {snapshot.maxConcurrent}</span>
            <span>超时: {snapshot.defaultTimeout}ms</span>
          </div>
          <span>最后心跳: {heartbeatText}</span>
        </div>
      </CardContent>
    </Card>
  )
}

const AgentHealthCard = memo(AgentHealthCardImpl)
AgentHealthCard.displayName = 'AgentHealthCard'

export default AgentHealthCard
