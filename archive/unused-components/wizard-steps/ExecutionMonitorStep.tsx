/**
 * @module ExecutionMonitorStep
 * @description 向导步骤4：执行监控
 *
 * 实时展示采集任务执行状态、日志流和维度进度
 */

import { fallback } from '@/lib/safeCoerce'
import React, { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Progress } from '@/components/atoms/Progress'
import { Button } from '@/components/atoms/Button'
import { useCollectionWizardStore } from '@/store/collectionWizardStore'
import { COLOR_TOKENS, COLOR_SHADES, twText, twBorder } from '@/constants/theme.tokens'
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Activity,
  FileText,
  RefreshCw,
  Tag,
  Timer,
} from 'lucide-react'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 阶段标识映射 */
const STAGE_LABELS: Record<string, string> = {
  'task:start': '任务启动',
  'task:config': '配置加载',
  'task:complete': '任务完成',
  'task:pause': '任务暂停',
  'task:resume': '任务恢复',
  'task:abort': '任务中止',
  'source:start': '数据拉取',
  'source:success': '拉取成功',
  'source:fail': '拉取失败',
  'transform': '数据转换',
  'write:start': '写入存储',
  'write:success': '写入成功',
  'write:fail': '写入失败',
  'complete': '维度完成',
  'config:loaded': '模板加载',
}

/**
 * ExecutionMonitorStep
 */
export function ExecutionMonitorStep(): React.JSX.Element {
  const taskStatus = useCollectionWizardStore((s) => s.taskStatus)
  const dimensionProgress = useCollectionWizardStore((s) => s.dimensionProgress)
  const logs = useCollectionWizardStore((s) => s.logs)
  const startTask = useCollectionWizardStore((s) => s.startTask)
  const pauseTask = useCollectionWizardStore((s) => s.pauseTask)
  const resumeTask = useCollectionWizardStore((s) => s.resumeTask)
  const stopTask = useCollectionWizardStore((s) => s.stopTask)
  const taskName = useCollectionWizardStore((s) => s.taskName)
  const taskId = useCollectionWizardStore((s) => s.taskId)

  const logContainerRef = useRef<HTMLDivElement>(null)

  // 自动滚动到最新日志
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  const handleStart = async (): Promise<void> => {
    logger.info('[ExecutionMonitorStep] 启动任务')
    await startTask()
  }

  const handlePause = (): void => {
    logger.info('[ExecutionMonitorStep] 暂停任务')
    pauseTask()
  }

  const handleResume = (): void => {
    logger.info('[ExecutionMonitorStep] 恢复任务')
    resumeTask()
  }

  const handleStop = (): void => {
    logger.info('[ExecutionMonitorStep] 停止任务')
    stopTask()
  }

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case 'pending':
        return <Clock className={cn('w-4 h-4', COLOR_SHADES.gray[400])} />
      case 'running':
        return <RefreshCw className={cn('w-4 h-4 animate-spin', COLOR_TOKENS.info.tailwind)} />
      case 'completed':
        return <CheckCircle2 className={cn('w-4 h-4', COLOR_TOKENS.success.tailwind)} />
      case 'failed':
        return <XCircle className={cn('w-4 h-4', COLOR_TOKENS.danger.tailwind)} />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string): React.ReactNode => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'outline' }> = {
      idle: { label: '待启动', variant: 'outline' },
      running: { label: '运行中', variant: 'default' },
      paused: { label: '已暂停', variant: 'outline' },
      completed: { label: '已完成', variant: 'success' },
      failed: { label: '失败', variant: 'destructive' },
    }
    const config = statusMap[status] ?? { label: status, variant: 'outline' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getLogIcon = (level: string): React.ReactNode => {
    switch (level) {
      case 'info':
        return <FileText className={cn('w-3 h-3', COLOR_TOKENS.info.tailwind)} />
      case 'warn':
        return <AlertCircle className={cn('w-3 h-3', COLOR_TOKENS.warning.tailwind)} />
      case 'error':
        return <XCircle className={cn('w-3 h-3', COLOR_TOKENS.danger.tailwind)} />
      case 'success':
        return <CheckCircle2 className={cn('w-3 h-3', COLOR_TOKENS.success.tailwind)} />
      default:
        return null
    }
  }

  const getLogColor = (level: string): string => {
    switch (level) {
      case 'info':
        return COLOR_TOKENS.textPrimary.tailwind
      case 'warn':
        return twText('yellow', 600)
      case 'error':
        return twText('red', 600)
      case 'success':
        return twText('green', 600)
      default:
        return COLOR_TOKENS.textMuted.tailwind
    }
  }

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const completedDimensions = dimensionProgress.filter((d) => d.status === 'completed').length
  const totalDimensions = dimensionProgress.length
  const overallProgress = totalDimensions > 0
    ? dimensionProgress.reduce((sum, d) => sum + d.progress, 0) / totalDimensions
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">执行监控</h3>
        <p className={cn('text-sm', COLOR_TOKENS.textMuted.tailwind)}>
          实时追踪采集任务执行状态和进度
        </p>
      </div>

      {/* 任务状态概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              任务状态
            </div>
            {getStatusBadge(taskStatus)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className={cn('text-sm', COLOR_TOKENS.textMuted.tailwind)}>任务名称</div>
              <div className="font-medium mt-1">{taskName ?? taskId ?? fallback.unknown}</div>
            </div>
            <div>
              <div className={cn('text-sm', COLOR_TOKENS.textMuted.tailwind)}>维度进度</div>
              <div className="font-medium mt-1">
                {completedDimensions} / {totalDimensions}
              </div>
            </div>
            <div>
              <div className={cn('text-sm', COLOR_TOKENS.textMuted.tailwind)}>总体进度</div>
              <div className="font-medium mt-1">{overallProgress.toFixed(1)}%</div>
            </div>
          </div>

          <Progress value={overallProgress} max={100} showMax={false} />

          {/* 任务控制按钮 */}
          <div className="flex items-center gap-2 pt-2">
            {taskStatus === 'idle' && (
              <Button onClick={handleStart} size="sm">
                <Play className="w-4 h-4 mr-1" />
                启动任务
              </Button>
            )}
            {taskStatus === 'running' && (
              <>
                <Button variant="outline" onClick={handlePause} size="sm">
                  <Pause className="w-4 h-4 mr-1" />
                  暂停
                </Button>
                <Button variant="danger" onClick={handleStop} size="sm">
                  <Square className="w-4 h-4 mr-1" />
                  停止
                </Button>
              </>
            )}
            {taskStatus === 'paused' && (
              <>
                <Button onClick={handleResume} size="sm">
                  <Play className="w-4 h-4 mr-1" />
                  恢复
                </Button>
                <Button variant="danger" onClick={handleStop} size="sm">
                  <Square className="w-4 h-4 mr-1" />
                  停止
                </Button>
              </>
            )}
            {(taskStatus === 'completed' || taskStatus === 'failed') && (
              <Button variant="outline" onClick={handleStart} size="sm">
                <RefreshCw className="w-4 h-4 mr-1" />
                重新执行
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 维度进度追踪 */}
      {dimensionProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">维度采集进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dimensionProgress.map((dim) => (
              <div key={dim.dimensionCode} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(dim.status)}
                    <span className="font-medium">{dim.dimensionName}</span>
                    <Badge variant="outline" className="text-xs">
                      {dim.dimensionCode}
                    </Badge>
                  </div>
                  <span className={cn('text-sm', COLOR_TOKENS.textMuted.tailwind)}>
                    {dim.progress.toFixed(0)}%
                  </span>
                </div>
                <Progress value={dim.progress} max={100} showMax={false} />
                {dim.message && (
                  <p className={cn('text-xs', COLOR_TOKENS.textMuted.tailwind)}>
                    {dim.message}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 实时日志流 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              执行日志
            </div>
            <Badge variant="outline">{logs.length} 条</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={logContainerRef}
            className={cn('h-64 overflow-y-auto rounded-md border p-3 font-mono text-xs space-y-1', COLOR_SHADES.gray[50])}
          >
            {logs.length === 0 ? (
              <div className={cn('flex items-center justify-center h-full', COLOR_TOKENS.textMuted.tailwind)}>
                暂无日志，启动任务后将显示实时日志
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 py-0.5">
                  <span className={COLOR_TOKENS.textMuted.tailwind}>
                    {formatTimestamp(log.timestamp)}
                  </span>
                  {getLogIcon(log.level)}
                  <span className={getLogColor(log.level)}>{log.message}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    {log.stage && (
                      <Badge variant="outline" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {STAGE_LABELS[log.stage] ?? log.stage}
                      </Badge>
                    )}
                    {log.durationMs !== undefined && (
                      <span className={cn('text-xs', COLOR_TOKENS.textMuted.tailwind)}>
                        <Timer className="w-3 h-3 inline mr-1" />
                        {log.durationMs}ms
                      </span>
                    )}
                    {log.dimensionCode && (
                      <Badge variant="outline" className="text-xs">
                        {log.dimensionCode}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 完成提示 */}
      {taskStatus === 'completed' && (
        <Card className={COLOR_TOKENS.success.bgClass}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 mt-0.5 text-white" />
              <div>
                <div className="font-medium text-white">采集任务已完成</div>
                <div className="text-sm text-white/90 mt-1">
                  所有维度数据采集成功，数据已写入系统
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 失败提示 */}
      {taskStatus === 'failed' && (
        <Card className={cn(twBorder('red', 500), 'border-2')}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <XCircle className={cn('w-5 h-5 mt-0.5', COLOR_TOKENS.danger.tailwind)} />
              <div>
                <div className={cn('font-medium', twText('red', 600))}>采集任务失败</div>
                <div className={cn('text-sm mt-1', COLOR_TOKENS.textMuted.tailwind)}>
                  部分维度数据采集失败，请检查日志或重试
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
