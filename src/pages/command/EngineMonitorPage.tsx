/**
 * @module EngineMonitorPage
 * @description 引擎状态监控页面（总控舱）。
 *   - 聚合 EngineStatusCard 与 LogStreamPanel，提供引擎运行状态、DataFlow 连接
 *     与 Agent 任务执行情况的实时监控。
 *   - 通过 useSystemMonitorStore 控制监控轮询的生命周期（启动/停止）。
 *   - 通过 useEngineStore 读取引擎运行状态用于头部展示与日志上下文。
 *   - 刷新时通过 MonitorLogService 记录系统监控快照。
 *
 * 遵循 AGENTS.md 契约：
 *   - 页面层仅依赖 store/services，不直接调用 dataLayer 或 db
 *   - 禁止使用 any
 *   - 所有 useEffect cleanup 显式声明
 *   - 核心分支含 logger.info
 *   - 颜色值引用 COLOR_TOKENS / HEALTH_STATUS_MAP，禁止硬编码 HEX 或数字颜色类
 */

import React, { useEffect, useRef } from 'react'
import EngineStatusCard from '@/components/system/EngineStatusCard'
import LogStreamPanel from '@/components/system/LogStreamPanel'
import { useSystemMonitorStore } from '@/store/systemMonitorStore'
import { useEngineStore } from '@/store/engineStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { HEALTH_STATUS, HEALTH_STATUS_MAP } from '@/constants/health.constants'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { getMonitorLogService } from '@/services/system/monitorLogService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 常量（零硬编码锚点）
// ============================================================

/** 时间戳补零长度（HH/MM/SS） */
const TIMESTAMP_PAD_START = 2
/** 未更新占位文案 */
const NOT_UPDATED_TEXT = '尚未更新'

// ============================================================
// 纯函数工具
// ============================================================

/**
 * 将 healthSummary.overallStatus（小写枚举）映射为 HEALTH_STATUS 常量键，
 * 以便复用 HEALTH_STATUS_MAP 的语义化标签与颜色。
 */
function resolveHealthKey(overallStatus: string | undefined) {
  switch (overallStatus) {
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

// ============================================================
// 组件
// ============================================================

function EngineMonitorPage(): React.JSX.Element {
  // 系统监控 Store：监控生命周期与刷新
  const isMonitoring = useSystemMonitorStore((s) => s.isMonitoring)
  const isLoading = useSystemMonitorStore((s) => s.isLoading)
  const lastUpdated = useSystemMonitorStore((s) => s.lastUpdated)
  const refreshSnapshot = useSystemMonitorStore((s) => s.refreshSnapshot)
  const startMonitoring = useSystemMonitorStore((s) => s.startMonitoring)
  const stopMonitoring = useSystemMonitorStore((s) => s.stopMonitoring)

  // 引擎 Store：运行状态与健康摘要（用于头部展示与日志上下文）
  const started = useEngineStore((s) => s.started)
  const stats = useEngineStore((s) => s.stats)
  const healthSummary = useEngineStore((s) => s.healthSummary)

  /**
   * 标记监控是否由本页启动。
   * 卸载时仅清理本页启动的监控，避免停止由其他页面启动的轮询。
   * 使用 ref 而非 state，避免卸载 cleanup 中的闭包陈旧问题。
   */
  const startedByThisPageRef = useRef<boolean>(false)

  // 挂载时：若未在监控中则启动；卸载时仅停止本页启动的监控
  useEffect(() => {
    logger.info('[EngineMonitorPage] mounted', {
      isMonitoring: useSystemMonitorStore.getState().isMonitoring,
      engineStarted: useEngineStore.getState().started,
    })

    if (!useSystemMonitorStore.getState().isMonitoring) {
      startMonitoring()
      startedByThisPageRef.current = true
    }

    return () => {
      if (startedByThisPageRef.current) {
        stopMonitoring()
        startedByThisPageRef.current = false
        logger.info('[EngineMonitorPage] unmounted, monitoring stopped')
      }
    }
  }, [startMonitoring, stopMonitoring])

  /**
   * 手动刷新：拉取系统监控快照并记录到 MonitorLogService。
   * 通过 getState() 读取最新快照，避免闭包陈旧。
   */
  const handleRefresh = (): void => {
    refreshSnapshot()
    const systemSnapshot = useSystemMonitorStore.getState().snapshot
    if (systemSnapshot) {
      getMonitorLogService().logSystemSnapshot(systemSnapshot)
    }
    logger.info('[EngineMonitorPage] manual refresh completed', {
      engineStarted: started,
      dataflowConnected: stats.dataflow.connected,
      overallStatus: healthSummary?.overallStatus ?? 'unknown',
    })
  }

  /** 切换监控开关，同步更新本页启动标记 */
  const toggleMonitoring = (): void => {
    if (isMonitoring) {
      stopMonitoring()
      startedByThisPageRef.current = false
    } else {
      startMonitoring()
      startedByThisPageRef.current = true
    }
  }

  const healthKey = resolveHealthKey(healthSummary?.overallStatus)
  const healthMeta = HEALTH_STATUS_MAP[healthKey]

  return (
    <div className="space-y-4 p-4">
      {/* 页面头部：标题 + 监控开关 + 刷新 */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>引擎状态监控</CardTitle>
              <p className="text-sm text-muted-foreground">
                实时监控 V6 评分引擎运行状态、数据流连接和智能体任务执行情况
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {/* 引擎健康状态（语义颜色取自 HEALTH_STATUS_MAP） */}
              <Badge
                variant="outline"
                className={`border-transparent text-white ${healthMeta.bgClass}`}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: healthMeta.color }}
                />
                {healthMeta.label}
              </Badge>

              {/* 监控开关状态 */}
              <Badge variant={isMonitoring ? 'success' : 'secondary'}>
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: isMonitoring
                      ? COLOR_TOKENS.success.hex
                      : COLOR_TOKENS.neutral.hex,
                  }}
                />
                {isMonitoring ? '监控中' : '已停止'}
              </Badge>

              <Button
                variant={isMonitoring ? 'outline' : 'primary'}
                size="sm"
                onClick={toggleMonitoring}
              >
                {isMonitoring ? '停止监控' : '启动监控'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRefresh()}
                isLoading={isLoading}
              >
                立即刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatLastUpdated(lastUpdated)}
          </p>
        </CardContent>
      </Card>

      {/* 引擎状态卡片（内部自管理 engineStore / systemMonitorStore 读取） */}
      <EngineStatusCard />

      {/* 实时监控日志流（默认 props） */}
      <LogStreamPanel />
    </div>
  )
}

export default EngineMonitorPage
