/**
 * @module CollectionTimeline
 * @description 单次采集链路时间线可视化组件。
 *
 * 展示触发 → 数据源尝试 → 降级 → 数据适配 → 写入 → 完成的各阶段。
 */

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type {
  CollectionTraceSpan,
  CollectionStageRecord,
  CollectionLifecycleStage,
} from '@/types/modules/collection.types'

interface CollectionTimelineProps {
  spans: CollectionTraceSpan[]
  maxHeight?: string
}

const STAGE_LABELS: Record<CollectionLifecycleStage, string> = {
  triggered: '触发',
  'source:start': '源尝试',
  'source:success': '源成功',
  'source:fail': '源失败',
  fallback: '降级',
  transform: '数据适配',
  'write:start': '写入开始',
  'write:success': '写入成功',
  'write:fail': '写入失败',
  complete: '完成',
  'task:status': '任务状态',
}

function stageColor(stage: CollectionLifecycleStage, error?: string) {
  if (error) return COLOR_TOKENS.danger
  switch (stage) {
    case 'source:success':
    case 'write:success':
      return COLOR_TOKENS.success
    case 'source:fail':
    case 'write:fail':
      return COLOR_TOKENS.danger
    case 'fallback':
      return COLOR_TOKENS.warning
    case 'complete':
      return COLOR_TOKENS.info
    default:
      return COLOR_TOKENS.info
  }
}

function resultColorClass(result: CollectionTraceSpan['result']): string {
  switch (result) {
    case 'success':
      return COLOR_TOKENS.success.bgClass
    case 'partial':
      return COLOR_TOKENS.warning.bgClass
    default:
      return COLOR_TOKENS.danger.bgClass
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false })
}

function TraceCard({ span }: { span: CollectionTraceSpan }): React.JSX.Element {
  const groupedStages = useMemo(() => {
    const groups: CollectionStageRecord[][] = []
    let current: CollectionStageRecord[] = []
    for (const stage of span.stages) {
      current.push(stage)
      if (
        stage.stage === 'source:success' ||
        stage.stage === 'source:fail' ||
        stage.stage === 'write:success' ||
        stage.stage === 'write:fail' ||
        stage.stage === 'complete'
      ) {
        groups.push(current)
        current = []
      }
    }
    if (current.length > 0) groups.push(current)
    return groups
  }, [span.stages])

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{span.symbol}</span>
          <Badge variant="outline">{span.dimensionCode}</Badge>
          <Badge className={`text-white ${resultColorClass(span.result)}`}>
            {span.result === 'success' ? '成功' : span.result === 'partial' ? '部分' : '失败'}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          <span>{formatDuration(span.totalDurationMs)}</span>
          <span className="mx-1">·</span>
          <span>{span.fallbackCount} 次降级</span>
          <span className="mx-1">·</span>
          <span>{formatTime(span.startedAt)}</span>
        </div>
      </div>

      <div className="relative pl-4">
        <div className="absolute left-1.5 top-0 h-full w-px bg-border" />
        {groupedStages.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-2 last:mb-0">
            {group.map((stage, stageIndex) => {
              const color = stageColor(stage.stage, stage.error)
              return (
                <div key={stageIndex} className="relative flex items-start gap-2 py-1">
                  <span
                    className={`absolute -left-2.5 mt-1.5 h-2 w-2 rounded-full ring-2 ring-background ${color.bgClass}`}
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-xs font-medium ${color.tailwind}`}>
                        {STAGE_LABELS[stage.stage]}
                      </span>
                      {stage.sourceId && (
                        <Badge variant="secondary" className="text-[10px]">
                          {stage.sourceId}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{stage.message}</p>
                    {stage.error && (
                      <p className={`text-xs ${COLOR_TOKENS.danger.tailwind}`}>
                        {stage.error}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatTime(stage.timestamp)}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CollectionTimeline({
  spans,
  maxHeight = '320px',
}: CollectionTimelineProps): React.JSX.Element {
  const orderedSpans = useMemo(
    () => [...spans].sort((a, b) => b.startedAt - a.startedAt),
    [spans],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">采集链路时间线</CardTitle>
      </CardHeader>
      <CardContent>
        {orderedSpans.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">暂无采集链路记录</p>
        ) : (
          <div className="space-y-3 overflow-auto pr-1" style={{ maxHeight }}>
            {orderedSpans.map((span) => (
              <TraceCard key={span.traceId} span={span} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
