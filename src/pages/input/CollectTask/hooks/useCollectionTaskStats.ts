/**
 * CollectTaskPage 状态聚合 Hook
 *
 * 集中处理：
 * - 任务列表聚合（taskStatuses → tasks）
 * - Trace 列表聚合（traceSpans → spans → selectedTraces）
 * - 任务状态统计（running/success/failed）
 * - 维度健康度（按 dimensionCode 聚合）
 * - 评分统计（avg/max/min/distribution/trend/progress）
 *
 * @module CollectTask/hooks/useCollectionTaskStats
 */

import { useMemo, useState, useEffect } from 'react'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import { getLogger } from '@/lib/logger'
import type { CollectionReport } from '@/services/data-collector/collectionReportService'
import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { useIntelligentScoreStore } from '@/store/intelligentScoreStore'
import type { CollectionTaskRuntime, CollectionTraceSpan, CollectionLog } from '@/types/modules/collection.types'
import { computeAvgIntervalHours, handleCollectionReportResult } from '../utils'

const logger = getLogger()

const INITIAL_COLLECTION_REPORT: CollectionReport = {
  progressItems: [],
  reportItems: [],
  overallProgress: 0,
  hasRunningTask: false,
}

/**
 * 评分历史记录类型（来自 useIntelligentScoreStore）
 */
export interface IntelligentScoreHistoryItem {
  scoredAt: number | string
  overallScore: number | null
  [key: string]: unknown
}

export interface DimHealth {
  total: number
  success: number
  name: string
}

export interface ScoreStats {
  total: number
  avgScore: number
  maxScore: number
  minScore: number
  scoreDistribution: { high: number; medium: number; low: number }
  recentTrend: Array<{ date: string; score: number }>
  avgIntervalHours: number
  lastScoredAt: number | string | null
  nextEstimateAt: Date | null
}

export interface TaskStats {
  runningCount: number
  successCount: number
  failedCount: number
}

export interface CollectionTaskState {
  // 任务数据
  taskStatuses: Record<string, CollectionTaskRuntime>
  tasks: CollectionTaskRuntime[]
  // Trace
  traceSpans: Record<string, CollectionTraceSpan>
  spans: CollectionTraceSpan[]
  selectedTraces: CollectionTraceSpan[]
  // 任务状态统计
  taskStats: TaskStats
  // 数据新鲜度（最近一次成功采集的时间戳，null = 无成功记录）
  lastSuccessAt: number | null
  // 维度健康度
  dimHealth: Map<string, DimHealth>
  // 评分统计
  scoreStats: ScoreStats
  // 采集报告
  collectionReport: CollectionReport
}

export interface CollectionTaskActions {
  setActiveTab: (tab: string) => void
  setSelectedTaskId: (id: string | null) => void
  handleViewTask: (taskId: string) => void
  activeTab: string
  selectedTaskId: string | null
  clearLogs: () => void
  logs: CollectionLog[]
}

/**
 * useCollectionTaskStats
 */
export function useCollectionTaskStats(): CollectionTaskState & CollectionTaskActions {
  const [activeTab, setActiveTab] = useState('progress')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const taskStatuses = useCollectionRuntimeStore((s) => s.taskStatuses)
  const logs = useCollectionRuntimeStore((s) => s.logs)
  const traceSpans = useCollectionRuntimeStore((s) => s.traceSpans)
  const clearLogs = useCollectionRuntimeStore((s) => s.clearLogs)
  const dimensions = useSevenDimConfigStore((s) => s.dimensions)
  const scoreHistory = useIntelligentScoreStore((s) => s.history) as unknown as IntelligentScoreHistoryItem[]

  const tasks = useMemo(() => Object.values(taskStatuses), [taskStatuses])
  const spans = useMemo(() => Object.values(traceSpans), [traceSpans])
  const selectedTraces = useMemo(
    () => (selectedTaskId !== null ? spans.filter((s) => s.taskId === selectedTaskId) : spans),
    [selectedTaskId, spans],
  )

  const [collectionReport, setCollectionReport] = useState<CollectionReport>(INITIAL_COLLECTION_REPORT)
  useEffect(() => {
    let cancelled = false
    mcpBridge
      .callTool('data-collector', 'build_collection_report', {
        traceSpans,
        taskStatuses,
      })
      .then((result) => { handleCollectionReportResult(result, cancelled, setCollectionReport) })
      .catch((err: unknown) => {
        logger.warn('[CollectTaskPage] 调用 build_collection_report 失败', {
          error: err instanceof Error ? err.message : String(err),
        })
      })
    return () => {
      cancelled = true
    }
  }, [traceSpans, taskStatuses])

  // 任务状态统计
  const taskStats: TaskStats = useMemo(() => {
    const running = tasks.filter((t) => t.status === 'running').length
    const success = tasks.filter((t) => t.status === 'completed').length
    const failed = tasks.filter((t) => t.status === 'error' || t.status === 'paused').length
    return { runningCount: running, successCount: success, failedCount: failed }
  }, [tasks])

  // 数据新鲜度：最近一次成功采集时间
  const lastSuccessAt = useMemo(() => {
    const successSpans = spans.filter((s) => s.result === 'success' && s.completedAt)
    if (successSpans.length === 0) return null
    return Math.max(...successSpans.map((s) => s.completedAt!))
  }, [spans])

  // 维度健康度
  const dimHealth: Map<string, DimHealth> = useMemo(() => {
    const map = new Map<string, DimHealth>()
    dimensions.forEach((dim) => map.set(dim.code, { total: 0, success: 0, name: dim.name }))
    spans.forEach((span) => {
      const entry = map.get(span.dimensionCode)
      if (entry === undefined) return
      entry.total++
      if (span.result === 'success') entry.success++
    })
    return map
  }, [spans, dimensions])

  // 评分统计
  const scoreStats: ScoreStats = useMemo(() => {
    const total = scoreHistory.length
    if (total === 0) {
      return {
        total: 0,
        avgScore: 0,
        maxScore: 0,
        minScore: 0,
        scoreDistribution: { high: 0, medium: 0, low: 0 },
        recentTrend: [],
        avgIntervalHours: 0,
        lastScoredAt: null,
        nextEstimateAt: null,
      }
    }

    const scores = scoreHistory
      .map((s) => s.overallScore)
      .filter((s): s is number => s !== null)

    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0
    const minScore = scores.length > 0 ? Math.min(...scores) : 0

    // 评分分布：高分(>=4.0)、中分(2.5-4.0)、低分(<2.5)
    const high = scores.filter((s) => s >= 4.0).length
    const medium = scores.filter((s) => s >= 2.5 && s < 4.0).length
    const low = scores.filter((s) => s < 2.5).length

    // 最近 10 次评分趋势
    const recentTrend = scoreHistory
      .slice(0, 10)
      .reverse()
      .map((s) => ({
        date: new Date(s.scoredAt).toLocaleDateString(),
        score: s.overallScore ?? 0,
      }))

    // 计算平均评分间隔（小时）
    const sortedHistory = [...scoreHistory].sort((a, b) =>
      new Date(b.scoredAt).getTime() - new Date(a.scoredAt).getTime(),
    )
    const lastScoredAt = sortedHistory[0]?.scoredAt ?? null

    const avgIntervalHours = computeAvgIntervalHours(scoreHistory)

    // 预估下次评分时间
    const nextEstimateAt = lastScoredAt !== null && avgIntervalHours > 0
      ? new Date(new Date(lastScoredAt).getTime() + avgIntervalHours * 60 * 60 * 1000)
      : null

    return {
      total,
      avgScore,
      maxScore,
      minScore,
      scoreDistribution: { high, medium, low },
      recentTrend,
      avgIntervalHours,
      lastScoredAt,
      nextEstimateAt,
    }
  }, [scoreHistory])

  const handleViewTask = (taskId: string) => {
    setSelectedTaskId(taskId)
    setActiveTab('timeline')
    logger.info('[CollectTaskPage] 查看任务详情', { taskId })
  }

  return {
    taskStatuses,
    tasks,
    traceSpans,
    spans,
    selectedTraces,
    taskStats,
    lastSuccessAt,
    dimHealth,
    scoreStats,
    collectionReport,
    activeTab,
    setActiveTab,
    selectedTaskId,
    setSelectedTaskId,
    handleViewTask,
    clearLogs,
    logs,
  }
}
