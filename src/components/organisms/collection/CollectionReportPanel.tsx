/**
 * @module CollectionReportPanel
 * @description 采集报告面板：展示各维度采集结果统计与失败明细。
 *
 * @remarks 当前为占位实现，仅满足类型与基础渲染；后续可替换为完整表格/图表。
 */

import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import type { CollectionReportItem } from '@/services/data-collector/collectionReportService'
import { COLOR_TOKENS, COLOR_SHADES, twText } from '@/constants/theme.tokens'

export interface CollectionReportPanelProps {
  items: CollectionReportItem[]
}

function formatTime(timestamp: number | null): string {
  if (timestamp === null) return '—'
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * CollectionReportPanel
 */
export function CollectionReportPanel({ items }: CollectionReportPanelProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className={`text-sm ${COLOR_SHADES.gray[500]} py-4 text-center`}>
        暂无采集报告数据
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.code}
          className="rounded-lg border p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{item.name}</span>
              <span className={`text-xs ${COLOR_SHADES.gray[400]}`}>{item.code}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {item.successRate.toFixed(1)}%
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className={COLOR_SHADES.gray[500]}>
                已采集 {item.collectedCount} / {item.expectedCount}
              </span>
              <span className={COLOR_SHADES.gray[500]}>
                {item.failures.length > 0 ? (
                  <span className={twText('red', 500)}>{item.failures.length} 次失败</span>
                ) : (
                  <span className={COLOR_TOKENS.success.tailwind}>无失败</span>
                )}
              </span>
            </div>
            <Progress
              value={item.expectedCount > 0 ? (item.collectedCount / item.expectedCount) * 100 : 0}
              max={100}
              className="h-2"
            />
          </div>
          <div className={`flex gap-4 text-xs ${COLOR_SHADES.gray[400]}`}>
            <span>开始: {formatTime(item.startedAt)}</span>
            <span>完成: {formatTime(item.completedAt)}</span>
            <span>最近采集: {formatTime(item.lastCollectedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default CollectionReportPanel
