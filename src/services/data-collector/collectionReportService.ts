/**
 * @module collectionReportService
 * @description 采集进度与汇报数据聚合服务。
 *
 * 从 `collectionRuntimeStore` 的 traceSpans / taskStatuses 出发，
 * 按 `collectConfig.DEFAULT_DIMENSIONS` 中的维度 code 聚合为：
 * - 进度条数据（状态 + 百分比）
 * - 汇报数据（已采集条数、时间范围、最近采集时间、失败记录）
 *
 * 本服务不依赖 UI 层，返回纯数据，供页面组件消费。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import type {
  CollectionTraceSpan,
  CollectionTaskRuntime,
  DimensionConfig,
} from '@/types/modules/collection.types'
import { DEFAULT_DIMENSIONS } from '@/config/collectConfig'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 维度采集进度状态 */
export type CollectionProgressStatus = 'pending' | 'running' | 'completed' | 'error' | 'not_ready'

/** 单维度进度项 */
export interface CollectionProgressItem {
  code: string
  name: string
  status: CollectionProgressStatus
  progress: number
  total: number
  success: number
  failed: number
}

/** 失败记录 */
export interface CollectionFailureRecord {
  symbol: string
  error: string
  timestamp: number
}

/** 单维度汇报项 */
export interface CollectionReportItem {
  code: string
  name: string
  collectedCount: number
  expectedCount: number
  successRate: number
  startedAt: number | null
  completedAt: number | null
  lastCollectedAt: number | null
  failures: CollectionFailureRecord[]
}

/** 聚合结果 */
export interface CollectionReport {
  progressItems: CollectionProgressItem[]
  reportItems: CollectionReportItem[]
  overallProgress: number
  hasRunningTask: boolean
}

/**
 * 判断失败 trace 是否属于“维度暂无真实采集链路”的占位失败。
 */
function isUnsupportedPlaceholder(span: CollectionTraceSpan): boolean {
  return (
    span.result === 'fail' &&
    span.stages.some(
      (stage) =>
        stage.stage === 'complete' &&
        (stage.message.includes('暂不支持') || stage.message.includes('unsupported')),
    )
  )
}

function formatDimensionName(code: string, name: string): string {
  return `${name}（${code}）`
}

function averageProgress(tasks: CollectionTaskRuntime[]): number {
  if (tasks.length === 0) return 0
  const total = tasks.reduce((sum, t) => sum + t.progress, 0)
  return Math.round(total / tasks.length)
}

function deriveStatus(
  tasks: CollectionTaskRuntime[],
  spans: CollectionTraceSpan[],
): CollectionProgressStatus {
  if (tasks.some((t) => t.status === 'running')) return 'running'
  if (tasks.some((t) => t.status === 'error')) return 'error'
  if (tasks.some((t) => t.status === 'completed')) return 'completed'
  if (tasks.some((t) => t.status === 'paused')) return 'pending'
  if (spans.length > 0) {
    const unsupported = spans.every(isUnsupportedPlaceholder)
    return unsupported ? 'not_ready' : 'completed'
  }
  return 'not_ready'
}

function buildProgressItem(
  dimension: DimensionConfig,
  tasks: CollectionTaskRuntime[],
  spans: CollectionTraceSpan[],
): CollectionProgressItem {
  const status = deriveStatus(tasks, spans)
  const success = spans.filter((s) => s.result === 'success').length
  const failed = spans.filter((s) => s.result === 'fail').length
  const total = tasks.length > 0 ? tasks.length : spans.length

  let progress = 0
  if (status === 'running') {
    progress = averageProgress(tasks)
  } else if (status === 'completed') {
    progress = total > 0 ? Math.round((success / total) * 100) : 100
  } else if (status === 'error') {
    progress = total > 0 ? Math.round((success / total) * 100) : 0
  }

  return {
    code: dimension.code,
    name: formatDimensionName(dimension.code, dimension.name),
    status,
    progress,
    total,
    success,
    failed,
  }
}

function buildReportItem(
  dimension: DimensionConfig,
  spans: CollectionTraceSpan[],
): CollectionReportItem {
  const successSpans = spans.filter((s) => s.result === 'success')
  const failSpans = spans.filter((s) => s.result === 'fail')
  const collectedCount = successSpans.length
  const expectedCount = spans.length
  const successRate = expectedCount > 0 ? Math.round((collectedCount / expectedCount) * 100) : 0

  const startedAt =
    spans.length > 0 ? Math.min(...spans.map((s) => s.startedAt)) : null
  const completedAt =
    spans.length > 0
      ? Math.max(...spans.map((s) => s.completedAt ?? s.startedAt))
      : null
  const lastCollectedAt = completedAt

  const failures: CollectionFailureRecord[] = failSpans
    .filter((s) => s.error != null)
    .map((s) => ({
      symbol: s.symbol,
      error: s.error ?? '未知错误',
      timestamp: s.completedAt ?? s.startedAt,
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)

  return {
    code: dimension.code,
    name: formatDimensionName(dimension.code, dimension.name),
    collectedCount,
    expectedCount,
    successRate,
    startedAt,
    completedAt,
    lastCollectedAt,
    failures,
  }
}

/**
 * 聚合采集运行时状态，生成进度与汇报数据。
 */
export function buildCollectionReport(
  traceSpans: Record<string, CollectionTraceSpan>,
  taskStatuses: Record<string, CollectionTaskRuntime>,
): CollectionReport {
  const allSpans = Object.values(traceSpans)
  const allTasks = Object.values(taskStatuses)
  const progressItems: CollectionProgressItem[] = []
  const reportItems: CollectionReportItem[] = []

  for (const dimension of DEFAULT_DIMENSIONS) {
    const dimensionTasks = allTasks.filter((t) => t.dimensionCode === dimension.code)
    const dimensionSpans = allSpans.filter((s) => s.dimensionCode === dimension.code)

    progressItems.push(buildProgressItem(dimension, dimensionTasks, dimensionSpans))
    reportItems.push(buildReportItem(dimension, dimensionSpans))
  }

  const hasRunningTask = progressItems.some((item) => item.status === 'running')
  const overallProgress =
    progressItems.length > 0
      ? Math.round(progressItems.reduce((sum, item) => sum + item.progress, 0) / progressItems.length)
      : 0

  logger.info('[collectionReportService] 聚合完成', {
    dimensions: progressItems.length,
    hasRunningTask,
    overallProgress,
  })

  return {
    progressItems,
    reportItems,
    overallProgress,
    hasRunningTask,
  }
}

/**
 * 格式化时间戳为可读字符串。
 */
export function formatCollectionTime(timestamp: number | null): string {
  if (timestamp == null) return '—'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 格式化时间范围为可读字符串。
 */
export function formatCollectionTimeRange(
  startedAt: number | null,
  completedAt: number | null,
): string {
  if (startedAt == null && completedAt == null) return '—'
  if (completedAt == null || startedAt === completedAt) return formatCollectionTime(startedAt)
  return `${formatCollectionTime(startedAt)} ~ ${formatCollectionTime(completedAt)}`
}
