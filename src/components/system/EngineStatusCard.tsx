/**
 * @module EngineStatusCard
 * @description 引擎状态监控卡片。
 *   - 读取 engineStore（started / startedAt / stats / layerStatuses / healthSummary）
 *   - 读取 systemMonitorStore（refreshSnapshot / isLoading）
 *   - 展示引擎运行状态、DataFlow 连接、Agent 运行时统计与 V6 引擎层权重
 */

import React, { useEffect, useState, memo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { useEngineStore } from '@/store/engineStore'
import { useSystemMonitorStore } from '@/store/systemMonitorStore'
import {
  HEALTH_STATUS,
  HEALTH_STATUS_MAP,
  V6_ENGINE_LAYERS,
  type HealthStatus,
} from '@/constants/health.constants'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'

const logger = getLogger()

// ============================================================
// 常量（零硬编码锚点）
// ============================================================

/** 本地运行时长刷新间隔（毫秒） */
const REFRESH_INTERVAL_MS = 1000
/** 顶部统计卡片网格列数 */
const STAT_GRID_COLS = 4
/** Agent 运行时统计网格列数 */
const AGENT_STAT_COLS = 4
/** 权重进度条最大值（百分比制） */
const WEIGHT_PROGRESS_MAX = 100
/** 毫秒与秒换算因子 */
const MS_PER_SECOND = 1000
/** 每分钟秒数 */
const SECONDS_PER_MINUTE = 60
/** 每小时秒数 */
const SECONDS_PER_HOUR = 3600

/** 统计卡片通用样式（边框/背景引用主题令牌，避免硬编码颜色类） */
const STAT_CARD_CLASS = cn(
  'rounded-lg border p-3',
  COLOR_TOKENS.border.tailwind,
  COLOR_TOKENS.bgSlate50.tailwind,
)

/** 网格列模板（基于常量动态生成，避免 Tailwind 动态类名失效） */
const STAT_GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: `repeat(${STAT_GRID_COLS}, minmax(0, 1fr))`,
}
const AGENT_GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: `repeat(${AGENT_STAT_COLS}, minmax(0, 1fr))`,
}

// ============================================================
// 纯函数工具
// ============================================================

/**
 * 将 healthSummary.overallStatus（小写）映射为 HEALTH_STATUS 常量（大写）
 * 以便复用 HEALTH_STATUS_MAP 的语义化颜色与标签
 */
function mapOverallStatus(status: string | undefined): HealthStatus {
  switch (status) {
    case 'healthy':
      return HEALTH_STATUS.HEALTHY
    case 'warning':
      return HEALTH_STATUS.WARNING
    case 'critical':
      return HEALTH_STATUS.CRITICAL
    case 'unknown':
      return HEALTH_STATUS.UNKNOWN
    default:
      return HEALTH_STATUS.UNKNOWN
  }
}

/** 将运行时长格式化为 "Xh Ym Zs" */
function formatUptime(started: boolean, startedAt: number, now: number): string {
  if (!started || !startedAt) return '0h 0m 0s'
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / MS_PER_SECOND))
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR)
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE
  return `${hours}h ${minutes}m ${seconds}s`
}

// ============================================================
// 组件
// ============================================================

function EngineStatusCard(): React.JSX.Element {
  const started = useEngineStore((s) => s.started)
  const startedAt = useEngineStore((s) => s.startedAt)
  const stats = useEngineStore((s) => s.stats)
  const layerStatuses = useEngineStore((s) => s.layerStatuses)
  const healthSummary = useEngineStore((s) => s.healthSummary)

  const refreshSnapshot = useSystemMonitorStore((s) => s.refreshSnapshot)
  const systemMonitorIsLoading = useSystemMonitorStore((s) => s.isLoading)

  // 本地时钟：每秒触发一次重绘以刷新运行时长
  const [now, setNow] = useState<number>(() => Date.now())

  // 挂载时拉取一次系统监控快照 + 启动本地运行时长定时器
  useEffect(() => {
    logger.info('[EngineStatusCard] mounted, refreshing system snapshot')
    void refreshSnapshot()

    const timer = setInterval(() => {
      setNow(Date.now())
    }, REFRESH_INTERVAL_MS)

    return () => {
      clearInterval(timer)
      logger.info('[EngineStatusCard] unmounted, timer cleared')
    }
  }, [refreshSnapshot])

  const overallStatus = mapOverallStatus(healthSummary?.overallStatus)
  const statusMeta = HEALTH_STATUS_MAP[overallStatus]
  const uptime = formatUptime(started, startedAt, now)

  // 加载态：系统监控正在加载且尚无健康摘要数据时展示占位文本
  const showLoading = systemMonitorIsLoading && !healthSummary

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">引擎状态监控</CardTitle>
        <Badge
          variant="outline"
          className={cn('border-transparent font-semibold text-white', statusMeta.bgClass)}
        >
          {overallStatus}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {showLoading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : (
          <>
            {/* 顶部统计卡片 */}
            <div className="grid gap-3" style={STAT_GRID_STYLE}>
              {/* 引擎状态 */}
              <div className={STAT_CARD_CLASS}>
                <p className="text-xs text-muted-foreground">引擎状态</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: started
                        ? COLOR_TOKENS.success.hex
                        : COLOR_TOKENS.danger.hex,
                    }}
                  />
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: started ? COLOR_TOKENS.success.hex : COLOR_TOKENS.danger.hex,
                    }}
                  >
                    {started ? '运行中' : '已停止'}
                  </span>
                </div>
              </div>

              {/* 运行时长 */}
              <div className={STAT_CARD_CLASS}>
                <p className="text-xs text-muted-foreground">运行时长</p>
                <p className="mt-1 text-sm font-medium tabular-nums">{uptime}</p>
              </div>

              {/* 数据流 */}
              <div className={STAT_CARD_CLASS}>
                <p className="text-xs text-muted-foreground">数据流</p>
                <div className="mt-1">
                  <Badge variant={stats.dataflow.connected ? 'success' : 'outline'}>
                    {stats.dataflow.connected ? '已连接' : '未连接'}
                  </Badge>
                </div>
              </div>

              {/* 活跃通道 */}
              <div className={STAT_CARD_CLASS}>
                <p className="text-xs text-muted-foreground">活跃通道</p>
                <p className="mt-1 text-sm font-medium tabular-nums">
                  {stats.dataflow.channels}
                </p>
              </div>
            </div>

            {/* 智能体运行时统计 */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">智能体运行时</p>
              <div className="grid gap-3" style={AGENT_GRID_STYLE}>
                <div className={STAT_CARD_CLASS}>
                  <p className="text-xs text-muted-foreground">智能体总数</p>
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {stats.agents.totalAgents}
                  </p>
                </div>
                <div className={STAT_CARD_CLASS}>
                  <p className="text-xs text-muted-foreground">运行中</p>
                  <p
                    className="mt-1 text-sm font-medium tabular-nums"
                    style={{ color: COLOR_TOKENS.info.hex }}
                  >
                    {stats.agents.runningTasks}
                  </p>
                </div>
                <div className={STAT_CARD_CLASS}>
                  <p className="text-xs text-muted-foreground">已完成</p>
                  <p
                    className="mt-1 text-sm font-medium tabular-nums"
                    style={{ color: COLOR_TOKENS.success.hex }}
                  >
                    {stats.agents.completedTasks}
                  </p>
                </div>
                <div className={STAT_CARD_CLASS}>
                  <p className="text-xs text-muted-foreground">失败</p>
                  <p
                    className="mt-1 text-sm font-medium tabular-nums"
                    style={
                      stats.agents.failedTasks > 0
                        ? { color: COLOR_TOKENS.danger.hex }
                        : undefined
                    }
                  >
                    {stats.agents.failedTasks}
                  </p>
                </div>
              </div>
            </div>

            {/* V6 引擎层 */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                V6 引擎层（共 {V6_ENGINE_LAYERS.length} 层）
              </p>
              <div className="space-y-2">
                {layerStatuses.map((layer) => {
                  const weightPercent = layer.weight * WEIGHT_PROGRESS_MAX
                  const isActive = layer.executionCount > 0
                  return (
                    <div
                      key={layer.layerId}
                      className={cn('rounded-lg border p-3', COLOR_TOKENS.border.tailwind)}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{layer.layerName}</p>
                          <p className="text-xs text-muted-foreground">ID: {layer.layerId}</p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          {layer.deterministic ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'border-transparent text-white',
                                COLOR_TOKENS.success.bgClass,
                              )}
                            >
                              确定性
                            </Badge>
                          ) : layer.llmEnhanceable ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'border-transparent text-white',
                                COLOR_TOKENS.purple.bgClass,
                              )}
                            >
                              大模型增强
                            </Badge>
                          ) : null}
                          <Badge variant={isActive ? 'success' : 'secondary'}>
                            {isActive ? '活跃' : '空闲'}
                          </Badge>
                        </div>
                      </div>
                      <Progress
                        value={weightPercent}
                        max={WEIGHT_PROGRESS_MAX}
                        showMax={false}
                        label={`权重 ${weightPercent.toFixed(0)}%`}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

EngineStatusCard.displayName = 'EngineStatusCard'

export default memo(EngineStatusCard)
