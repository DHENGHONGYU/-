/**
 * @module TraceReplayPanel
 * @description 采集链路历史回放组件。
 *
 * 选择一条 trace 后，按时间顺序逐步播放各阶段，
 * 展示当前阶段信息、进度条与总耗时。
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Progress } from '@/components/atoms/Progress'
import { Select, SelectItem } from '@/components/atoms/Select'
import { COLOR_TOKENS, getColorBgClass } from '@/constants/theme.tokens'
import type {
  CollectionTraceSpan,
  CollectionLifecycleStage,
} from '@/types/modules/collection.types'

interface TraceReplayPanelProps {
  spans: CollectionTraceSpan[]
}

const REPLAY_STEP_MS = 600

const SPEED_OPTIONS = [
  { value: '0.5', label: '0.5x' },
  { value: '1', label: '1x' },
  { value: '1.5', label: '1.5x' },
  { value: '2', label: '2x' },
] as const

type ReplaySpeed = (typeof SPEED_OPTIONS)[number]['value']

const STAGE_LABELS: Record<CollectionLifecycleStage, string> = {
  triggered: '触发',
  'source:start': '源尝试',
  'source:success': '源成功',
  'source:fail': '源失败',
  fallback: '降级',
  retry: '重试',
  transform: '数据适配',
  'write:start': '写入开始',
  'write:success': '写入成功',
  'write:fail': '写入失败',
  complete: '完成',
  'task:status': '任务状态',
}

function stageColor(stage: CollectionLifecycleStage, error?: string): keyof typeof COLOR_TOKENS {
  if (error) return 'danger'
  switch (stage) {
    case 'source:success':
    case 'write:success':
      return 'success'
    case 'source:fail':
    case 'write:fail':
      return 'danger'
    case 'fallback':
      return 'warning'
    case 'complete':
      return 'info'
    case 'transform':
      return 'cyan'
    default:
      return 'info'
  }
}

function getColorFgClass(key: keyof typeof COLOR_TOKENS): string {
  switch (key) {
    case 'success':
      return 'text-success-foreground'
    case 'danger':
      return 'text-destructive-foreground'
    case 'warning':
      return 'text-warning-foreground'
    case 'info':
      return 'text-info-foreground'
    default:
      return 'text-white'
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false })
}

/**
 * TraceReplayPanel
 */
export default function TraceReplayPanel({ spans }: TraceReplayPanelProps): React.JSX.Element {
  const options = useMemo(
    () =>
      spans.map((span) => ({
        value: span.traceId,
        label: `${span.symbol} · ${span.dimensionCode} · ${formatTime(span.startedAt)}`,
      })),
    [spans],
  )

  const [selectedTraceId, setSelectedTraceId] = useState<string>(
    spans[0]?.traceId ?? '',
  )
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(0)
  const [speed, setSpeed] = useState<ReplaySpeed>('1')

  const selectedSpan = useMemo(
    () => spans.find((s) => s.traceId === selectedTraceId) ?? spans[0],
    [spans, selectedTraceId],
  )

  const stages = useMemo(() => selectedSpan?.stages ?? [], [selectedSpan?.stages])
  const currentStage = stages[index]
  const progress = useMemo(() => {
    if (!selectedSpan || stages.length === 0) return 0
    if (index >= stages.length - 1) return 100
    const currentStageTime = stages[index]?.timestamp ?? selectedSpan.startedAt
    const endTime = selectedSpan.completedAt ?? selectedSpan.startedAt + selectedSpan.totalDurationMs
    return Math.min(
      100,
      ((currentStageTime - selectedSpan.startedAt) / (endTime - selectedSpan.startedAt)) * 100,
    )
  }, [index, selectedSpan, stages])

  const handleStart = useCallback(() => {
    setIndex(0)
    setPlaying(true)
  }, [])

  const handleReset = useCallback(() => {
    setPlaying(false)
    setIndex(0)
  }, [])

  const handlePause = useCallback(() => {
    setPlaying(false)
  }, [])

  useEffect(() => {
    if (!playing) return
    if (index >= stages.length - 1) {
      setPlaying(false)
      return
    }
    const stepMs = Math.max(100, REPLAY_STEP_MS / Number(speed))
    const timer = window.setTimeout(() => {
      setIndex((prev) => prev + 1)
    }, stepMs)
    return () => window.clearTimeout(timer)
  }, [playing, index, stages.length, speed])

  useEffect(() => {
    setIndex(0)
    setPlaying(false)
  }, [selectedTraceId])

  if (spans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">链路回放</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">暂无 trace 可回放</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">链路回放</CardTitle>
          <Select
            value={selectedTraceId}
            onValueChange={(value) => setSelectedTraceId(value)}
            className="h-8 w-64 text-xs"
          >
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedSpan && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{selectedSpan.symbol}</span>
                <Badge variant="outline">{selectedSpan.dimensionCode}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                <span>{formatDuration(selectedSpan.totalDurationMs)}</span>
                <span className="mx-1">·</span>
                <span>{selectedSpan.fallbackCount} 次降级</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>回放进度</span>
                <span>
                  {index + 1} / {stages.length}
                </span>
              </div>
              <Progress value={progress} max={100} showMax={false} />
            </div>

            {currentStage && (
              <div className="rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge className={`${getColorBgClass(stageColor(currentStage.stage, currentStage.error))} ${getColorFgClass(stageColor(currentStage.stage, currentStage.error))}`}>
                    {STAGE_LABELS[currentStage.stage]}
                  </Badge>
                  {currentStage.sourceId && (
                    <Badge variant="secondary" className="text-[10px]">
                      {currentStage.sourceId}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{formatTime(currentStage.timestamp)}</span>
                </div>
                <p className="mt-2 text-sm">{currentStage.message}</p>
                {currentStage.error && (
                  <p className={`mt-1 text-xs ${COLOR_TOKENS.danger.tailwind}`}>
                    {currentStage.error}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              {!playing ? (
                <Button size="sm" onClick={handleStart}>
                  开始回放
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={handlePause}>
                  暂停
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleReset}>
                重置
              </Button>
              <Select
                value={speed}
                onValueChange={(value) => setSpeed(value as ReplaySpeed)}
                className="h-8 w-20 text-xs"
              >
                {SPEED_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
