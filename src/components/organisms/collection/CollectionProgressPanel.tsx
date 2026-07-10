/**
 * @module CollectionProgressPanel
 * @description 采集进度面板：展示各维度采集进度、状态与总体进度。
 *
 * @remarks 当前为占位实现，仅满足类型与基础渲染；后续可替换为完整进度看板。
 */

import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import type { CollectionProgressItem } from '@/services/data-collector/collectionReportService'
import { COLOR_TOKENS, COLOR_SHADES } from '@/constants/theme.tokens'

export interface CollectionProgressPanelProps {
  items: CollectionProgressItem[]
  overallProgress: number
  hasRunningTask: boolean
}

const STATUS_LABEL: Record<CollectionProgressItem['status'], string> = {
  pending: '等待中',
  running: '采集中',
  completed: '已完成',
  error: '失败',
  not_ready: '未就绪',
}

const STATUS_VARIANT: Record<CollectionProgressItem['status'], string> = {
  pending: COLOR_SHADES.gray[500],
  running: COLOR_TOKENS.info.tailwind,
  completed: COLOR_TOKENS.success.tailwind,
  error: COLOR_TOKENS.danger.tailwind,
  not_ready: COLOR_SHADES.gray[500],
}

/**
 * CollectionProgressPanel
 */
export function CollectionProgressPanel({
  items,
  overallProgress,
  hasRunningTask,
}: CollectionProgressPanelProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">总体进度</span>
        <div className="flex items-center gap-2">
          {hasRunningTask && (
            <Badge variant="outline" className={COLOR_TOKENS.info.tailwind}>
              采集中
            </Badge>
          )}
          <span className={`text-sm ${COLOR_SHADES.gray[500]}`}>{overallProgress.toFixed(1)}%</span>
        </div>
      </div>
      <Progress value={overallProgress} max={100} className="h-2" />

      <div className="space-y-2">
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
              <Badge variant="outline" className={`text-xs ${STATUS_VARIANT[item.status]}`}>
                {STATUS_LABEL[item.status]}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className={COLOR_SHADES.gray[500]}>
                  成功 {item.success} / 失败 {item.failed} / 总计 {item.total}
                </span>
                <span className={COLOR_SHADES.gray[500]}>{item.progress.toFixed(1)}%</span>
              </div>
              <Progress value={item.progress} max={100} className="h-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CollectionProgressPanel
