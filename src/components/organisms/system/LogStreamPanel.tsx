/**
 * @module LogStreamPanel
 * @description 实时监控日志流面板。
 *
 * 职责：
 *   - 订阅 MonitorLogService，实时展示 引擎/Agent/系统/DataFlow 日志
 *   - 按级别（info/warn/error/critical）与来源（engine/agent/system/dataflow）过滤
 *   - 支持暂停/恢复自动刷新、清空日志
 *   - 新日志到达时自动滚动到底部（暂停时保持当前视图）
 *
 * 遵循 AGENTS.md 契约：
 *   - 组件层仅依赖 store/services，不直接调用 dataLayer 或 db
 *   - 禁止使用 any
 *   - 核心分支含 logger.info
 *   - 所有 useEffect cleanup 显式声明
 */

import React, { useEffect, useRef, useState, memo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import {
  getMonitorLogService,
  type MonitorLogFilter,
  type MonitorLogLevel,
  type MonitorLogSource,
} from '@/services/system/monitorLogService'
import { useSystemMonitorStore } from '@/store/systemMonitorStore'
import { COLOR_TOKENS, twText, twBg } from '@/constants/theme.tokens'
import { MONITOR_INTERVALS } from '@/constants/health.constants'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'

// ============================================================
// 常量（零魔法数字）
// ============================================================

/** 日志列表最大高度（px） */
const MAX_HEIGHT_PX = 400
/** 默认最大日志条数 */
const DEFAULT_MAX_ENTRIES = 50
/** 时间戳补零长度（HH/MM/SS） */
const TIMESTAMP_PAD_START = 2
/** 毫秒补零长度（mmm） */
const MS_PAD_START = 3

// ============================================================
// 类型定义
// ============================================================

/** 级别过滤值（含 "全部"） */
type FilterLevel = MonitorLogLevel | 'all'
/** 来源过滤值（含 "全部"） */
type FilterSource = MonitorLogSource | 'all'

interface LogStreamPanelProps {
  /** 最大展示日志条数，默认 50 */
  maxEntries?: number
}

// ============================================================
// 显示映射
// ============================================================

/** 级别过滤器选项 */
const LEVEL_FILTER_OPTIONS: ReadonlyArray<{ value: FilterLevel; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'info', label: '信息' },
  { value: 'warn', label: '警告' },
  { value: 'error', label: '错误' },
  { value: 'critical', label: '严重' },
]

/** 来源过滤器选项 */
const SOURCE_FILTER_OPTIONS: ReadonlyArray<{ value: FilterSource; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'engine', label: '引擎' },
  { value: 'agent', label: '智能体' },
  { value: 'system', label: '系统' },
  { value: 'dataflow', label: '数据流' },
]

/** 日志级别显示映射 */
const LEVEL_DISPLAY: Record<
  MonitorLogLevel,
  { label: string; color: string; bgClass: string }
> = {
  info: { label: '信息', color: COLOR_TOKENS.info.hex, bgClass: `${twBg('blue', 100)} ${twText('blue', 700)}` },
  warn: { label: '警告', color: COLOR_TOKENS.warning.hex, bgClass: `${twBg('amber', 100)} ${twText('amber', 700)}` },
  error: { label: '错误', color: COLOR_TOKENS.danger.hex, bgClass: `${twBg('red', 100)} ${twText('red', 700)}` },
  critical: { label: '严重', color: COLOR_TOKENS.danger.hex, bgClass: `${twBg('red', 200)} ${twText('red', 800)} font-bold` },
}

/** 日志来源显示映射 */
const SOURCE_DISPLAY: Record<MonitorLogSource, { label: string; bgClass: string }> = {
  engine: { label: '引擎', bgClass: `${twBg('indigo', 100)} ${twText('indigo', 700)}` },
  agent: { label: '智能体', bgClass: `${twBg('purple', 100)} ${twText('purple', 700)}` },
  system: { label: '系统', bgClass: `${twBg('teal', 100)} ${twText('teal', 700)}` },
  dataflow: { label: '数据流', bgClass: `${twBg('cyan', 100)} ${twText('cyan', 700)}` },
}

const logger = getLogger()

// ============================================================
// 工具函数
// ============================================================

/**
 * 格式化时间戳为 HH:MM:SS.mmm
 * 使用 Date 方法（getHours/getMinutes/getSeconds/getMilliseconds）
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const hh = String(date.getHours()).padStart(TIMESTAMP_PAD_START, '0')
  const mm = String(date.getMinutes()).padStart(TIMESTAMP_PAD_START, '0')
  const ss = String(date.getSeconds()).padStart(TIMESTAMP_PAD_START, '0')
  const ms = String(date.getMilliseconds()).padStart(MS_PAD_START, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

// ============================================================
// 组件
// ============================================================

function LogStreamPanelBase({
  maxEntries = DEFAULT_MAX_ENTRIES,
}: LogStreamPanelProps): React.JSX.Element {
  const monitorLogs = useSystemMonitorStore((s) => s.monitorLogs)
  const fetchMonitorLogs = useSystemMonitorStore((s) => s.fetchMonitorLogs)
  const clearMonitorLogs = useSystemMonitorStore((s) => s.clearMonitorLogs)

  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all')
  const [filterSource, setFilterSource] = useState<FilterSource>('all')
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // 订阅 + 轮询：挂载时获取初始日志、订阅变更、启动轮询；暂停时停止轮询
  useEffect(() => {
    const fetchFilteredLogs = (): void => {
      const filter: MonitorLogFilter = {
        level: filterLevel === 'all' ? undefined : filterLevel,
        source: filterSource === 'all' ? undefined : filterSource,
        limit: maxEntries,
      }
      fetchMonitorLogs(filter)
    }

    // 获取初始日志
    fetchFilteredLogs()
    logger.info('[LogStreamPanel] initialized', {
      filterLevel,
      filterSource,
      maxEntries,
      isPaused,
    })

    // 订阅日志变更通知（仅用于触发刷新，数据通过 Store 获取）
    const service = getMonitorLogService()
    const unsubscribe = service.subscribe(() => {
      if (!isPaused) {
        fetchFilteredLogs()
      }
    })

    // 轮询定时器（暂停时不启动）
    let timer: ReturnType<typeof setInterval> | null = null
    if (!isPaused) {
      timer = setInterval(() => {
        fetchFilteredLogs()
      }, MONITOR_INTERVALS.LOG_STREAM)
    }

    // 清理：取消订阅并清除定时器
    return () => {
      unsubscribe()
      if (timer !== null) {
        clearInterval(timer)
      }
    }
  }, [filterLevel, filterSource, isPaused, maxEntries, fetchMonitorLogs])

  // 自动滚动到底部（暂停时保持当前视图）
  useEffect(() => {
    if (isPaused) return
    const container = logContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [monitorLogs, isPaused])

  // 暂停/恢复切换
  const handleTogglePause = (): void => {
    setIsPaused((prev) => {
      logger.info('[LogStreamPanel] pause toggled', { next: !prev })
      return !prev
    })
  }

  // 清空日志
  const handleClear = (): void => {
    clearMonitorLogs()
    logger.info('[LogStreamPanel] clearLogs() triggered')
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>监控日志流</CardTitle>
          <Badge variant="secondary">{monitorLogs.length} 条</Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* 级别过滤 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">级别</span>
            {LEVEL_FILTER_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={filterLevel === opt.value ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilterLevel(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* 来源过滤 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">来源</span>
            {SOURCE_FILTER_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={filterSource === opt.value ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilterSource(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* 操作按钮 */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={isPaused ? 'success' : 'outline'}
              size="sm"
              onClick={handleTogglePause}
            >
              {isPaused ? '恢复' : '暂停'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              清空
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div
          ref={logContainerRef}
          className={`overflow-y-auto rounded-md border border-border ${twBg('slate', 50)}/50 p-2`}
          style={{ maxHeight: `${MAX_HEIGHT_PX}px` }}
        >
          {monitorLogs.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              暂无日志
            </div>
          ) : (
            <div className="space-y-1">
              {monitorLogs.map((entry) => {
                const levelMeta = LEVEL_DISPLAY[entry.level]
                const sourceMeta = SOURCE_DISPLAY[entry.source]
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 rounded px-2 py-1 font-mono text-xs hover:bg-accent/40"
                  >
                    <span className="shrink-0 text-muted-foreground">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                    <Badge
                      variant="default"
                      className={cn('shrink-0', levelMeta.bgClass)}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: levelMeta.color }}
                      />
                      {levelMeta.label}
                    </Badge>
                    <Badge
                      variant="default"
                      className={cn('shrink-0', sourceMeta.bgClass)}
                    >
                      {sourceMeta.label}
                    </Badge>
                    <span className={`break-all ${twText('slate', 700)}`}>{entry.message}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const LogStreamPanel = memo(LogStreamPanelBase)
LogStreamPanel.displayName = 'LogStreamPanel'

export default LogStreamPanel
