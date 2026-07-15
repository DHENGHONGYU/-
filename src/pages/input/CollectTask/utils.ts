/**
 * CollectTaskPage 工具函数
 *
 * - handleCollectionReportResult: 处理采集报告工具调用结果
 * - computeAvgIntervalHours: 计算评分历史平均间隔
 * - pushInterval: 计算相邻记录时间差（小时）
 * - normalizeStatus: 标准化任务状态为显示状态
 *
 * @module CollectTask/utils
 */

import { getLogger } from '@/lib/logger'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import type { CollectionReport } from '@/services/data-collector/collectionReportService'
import type { CollectionTaskRuntime } from '@/types/modules/collection.types'

const logger = getLogger()

/**
 * 评分记录通用类型（兼容 number|string 时间戳）
 */
export interface ScoreRecordLike {
  scoredAt: number | string
}

/**
 * 显示状态类型
 */
export type DisplayStatus = 'running' | 'success' | 'failed' | 'pending'

/**
 * 状态徽章配置
 */
export const STATUS_BADGE: Record<DisplayStatus, { label: string; variant: 'default' | 'success' | 'destructive' | 'outline' }> = {
  running: { label: '采集中', variant: 'default' },
  success: { label: '已完成', variant: 'success' },
  failed: { label: '失败', variant: 'destructive' },
  pending: { label: '等待中', variant: 'outline' },
}

/**
 * 将运行时状态映射为显示状态
 */
export function normalizeStatus(status: CollectionTaskRuntime['status']): DisplayStatus {
  switch (status) {
    case 'running':
      return 'running'
    case 'completed':
      return 'success'
    case 'error':
    case 'paused':
      return 'failed'
    case 'pending':
    default:
      return 'pending'
  }
}

/**
 * 处理采集报告工具调用结果（从 useEffect 回调中抽取，降低组件嵌套深度）
 */
export function handleCollectionReportResult(
  result: Awaited<ReturnType<typeof mcpBridge.callTool>>,
  cancelled: boolean,
  setReport: React.Dispatch<React.SetStateAction<CollectionReport>>,
): void {
  if (cancelled || result.isError === true) return
  const text = result.content[0]?.text
  if (text === undefined || text === '') return
  try {
    setReport(JSON.parse(text) as CollectionReport)
  } catch {
    logger.warn('[CollectTaskPage] 采集报告 JSON 解析失败', { text })
  }
}

/**
 * 计算评分历史平均间隔（小时）
 */
export function computeAvgIntervalHours(scoreHistory: ScoreRecordLike[]): number {
  if (scoreHistory.length < 2) return 0
  const sorted = [...scoreHistory].sort(
    (a, b) => new Date(b.scoredAt).getTime() - new Date(a.scoredAt).getTime(),
  )
  const intervals: number[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]
    const next = sorted[i + 1]
    if (current === undefined || next === undefined) continue
    const diff = new Date(current.scoredAt).getTime() - new Date(next.scoredAt).getTime()
    intervals.push(diff / (1000 * 60 * 60))
  }
  return intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0
}
