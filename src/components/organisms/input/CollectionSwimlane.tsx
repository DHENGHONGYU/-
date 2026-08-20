/**
 * @module CollectionSwimlane
 * @description 采集链路泳道图（甘特式）。
 *
 * 将单次采集 trace 中各数据源尝试、降级、写入等阶段按时间轴展开，
 * 每个数据源一条泳道，直观展示切换与耗时。
 */

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { getColorHex, getColorBgClass } from '@/constants/theme.tokens'
import type { ColorTokenKey } from '@/constants/theme.tokens'
import { DATA_SOURCE_ENDPOINT_MAP } from '@/config/dataSourceRegistry'
import type {
  CollectionTraceSpan,
  CollectionStageRecord,
  CollectionLifecycleStage,
  QuoteDataSourceId,
} from '@/types/modules/collection.types'

interface CollectionSwimlaneProps {
  spans: CollectionTraceSpan[]
  maxHeight?: string
}

const SOURCE_COLOR_ORDER: ColorTokenKey[] = [
  'info',
  'success',
  'warning',
  'danger',
  'purple',
  'cyan',
  'orange',
  'pink',
  'teal',
  'indigo',
]

function stageColor(stage: CollectionLifecycleStage, error?: string): ColorTokenKey {
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

function getColorFgClass(key: ColorTokenKey): string {
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

function stageLabel(stage: CollectionLifecycleStage): string {
  switch (stage) {
    case 'triggered':
      return '触发'
    case 'source:start':
      return '尝试'
    case 'source:success':
      return '成功'
    case 'source:fail':
      return '失败'
    case 'fallback':
      return '降级'
    case 'transform':
      return '适配'
    case 'write:start':
      return '写入开始'
    case 'write:success':
      return '写入成功'
    case 'write:fail':
      return '写入失败'
    case 'complete':
      return '完成'
    case 'task:status':
      return '任务状态'
    default:
      return stage
  }
}

function sourceName(sourceId?: QuoteDataSourceId): string {
  if (!sourceId) return '未知源'
  return DATA_SOURCE_ENDPOINT_MAP[sourceId]?.name ?? sourceId
}

function SwimlaneRow({ span }: { span: CollectionTraceSpan }): React.JSX.Element {
  const start = span.startedAt
  const end = span.completedAt ?? start + span.totalDurationMs
  const totalMs = Math.max(end - start, 1)

  const { lanes, sourceColorMap } = useMemo(() => {
    const sources = new Set<QuoteDataSourceId | undefined>()
    span.stages.forEach((stage) => sources.add(stage.sourceId))
    sources.add(span.finalSource)
    const sourceList = Array.from(sources).filter(Boolean) as QuoteDataSourceId[]
    const colorMap = new Map<QuoteDataSourceId, ColorTokenKey>()
    sourceList.forEach((src, index) => {
      const color = SOURCE_COLOR_ORDER[index % SOURCE_COLOR_ORDER.length] ?? 'info'
      colorMap.set(src, color)
    })

    const lanesMap = new Map<QuoteDataSourceId | 'global', CollectionStageRecord[]>()
    lanesMap.set('global', [])
    sourceList.forEach((src) => lanesMap.set(src, []))

    span.stages.forEach((stage) => {
      const key = stage.sourceId ?? 'global'
      if (!lanesMap.has(key)) lanesMap.set(key, [])
      lanesMap.get(key)!.push(stage)
    })

    return { lanes: lanesMap, sourceColorMap: colorMap }
  }, [span])

  const laneKeys = Array.from(lanes.keys())

  const getStagePosition = (
    stage: CollectionStageRecord,
    nextStage?: CollectionStageRecord,
  ): { left: number; width: number } => {
    const left = ((stage.timestamp - start) / totalMs) * 100
    const nextTimestamp = nextStage?.timestamp ?? end
    const width = Math.max(((nextTimestamp - stage.timestamp) / totalMs) * 100, 1)
    return { left: Math.max(0, left), width: Math.min(100, width) }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{span.symbol}</span>
          <Badge variant="outline">{span.dimensionCode}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          <span>{(span.totalDurationMs / 1000).toFixed(2)}s</span>
          <span className="mx-1">·</span>
          <span>{span.fallbackCount} 次降级</span>
        </div>
      </div>

      {laneKeys
        .filter((key) => (lanes.get(key) ?? []).length > 0)
        .map((key) => {
          const stageList = lanes.get(key) ?? []
          const label = key === 'global' ? '全局事件' : sourceName(key)
          const sourceColor = key === 'global' ? 'neutral' : (sourceColorMap.get(key) ?? 'info')
          return (
          <div key={key} className="grid grid-cols-[80px_1fr] items-center gap-2">
            <div className="flex items-center gap-1.5 truncate text-xs">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: getColorHex(sourceColor) }}
              />
              <span className="truncate">{label}</span>
            </div>
            <div className="relative h-6 rounded bg-muted">
              {stageList.map((stage, index) => {
                const next = stageList[index + 1]
                const { left, width } = getStagePosition(stage, next)
                const colorKey = stageColor(stage.stage, stage.error)
                return (
                  <div
                    key={index}
                    className={`absolute top-1 h-4 rounded text-[9px] leading-4 ${getColorBgClass(colorKey)} ${getColorFgClass(colorKey)}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${stageLabel(stage.stage)}${stage.sourceId ? ` (${stage.sourceId})` : ''}: ${stage.message}`}
                  >
                    {width > 12 && stageLabel(stage.stage)}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * CollectionSwimlane
 */
export default function CollectionSwimlane({
  spans,
  maxHeight = '360px',
}: CollectionSwimlaneProps): React.JSX.Element {
  const orderedSpans = useMemo(
    () => [...spans].sort((a, b) => b.startedAt - a.startedAt),
    [spans],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">采集链路泳道图</CardTitle>
      </CardHeader>
      <CardContent>
        {orderedSpans.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">暂无采集链路</p>
        ) : (
          <div className="space-y-3 overflow-auto pr-1" style={{ maxHeight }}>
            {orderedSpans.map((span) => (
              <SwimlaneRow key={span.traceId} span={span} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
