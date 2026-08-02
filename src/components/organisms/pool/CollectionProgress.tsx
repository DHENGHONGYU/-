/**
 * @fileoverview 个股采集进度展示组件
 *
 * 展示单只股票的七维度采集完成状态、进度条、质量评级。
 *
 * @module components/organisms/pool/CollectionProgress
 * @created 2026-07-19
 */

import React, { useEffect, useState } from 'react'
import {
  getCollectionProgress,
  type CollectionProgress as ProgressType,
  type DimensionProgress,
} from '@/services/pool/collectionProgressService'
import { twText, twBg, twBorder, DARK } from '@/constants/theme.tokens'
import { cn } from '@/lib/utils'
import { eventBus } from '@/lib/eventBus'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'

export interface CollectionProgressProps {
  symbol: string
  compact?: boolean
}

type DimStatus = 'success' | 'partial' | 'fail' | 'none'
type QualityRating = 'excellent' | 'good' | 'fair' | 'poor'

const STATUS_CONFIG: { [K in DimStatus]: { label: string; color: string; darkColor: string } } = {
  success: { label: '已完成', color: 'text-emerald-600', darkColor: 'dark:text-emerald-400' },
  partial: { label: '部分', color: 'text-amber-600', darkColor: 'dark:text-amber-300' },
  fail: { label: '失败', color: 'text-red-600', darkColor: 'dark:text-red-400' },
  none: { label: '未采集', color: 'text-stone-400', darkColor: 'dark:text-neutral-500' },
}

const RATING_CONFIG: { [K in QualityRating]: { label: string; color: string; bg: string; darkBg: string } } = {
  excellent: { label: '优秀', color: 'text-emerald-700', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-950/30' },
  good: { label: '良好', color: 'text-blue-700', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-950/30' },
  fair: { label: '一般', color: 'text-amber-700', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-950/30' },
  poor: { label: '较差', color: 'text-red-700', bg: 'bg-red-50', darkBg: 'dark:bg-red-950/30' },
}

function ProgressBar({ percent, rating }: { percent: number; rating: string }): React.JSX.Element {
  const barColor =
    rating === 'excellent' ? 'bg-emerald-500' :
    rating === 'good' ? 'bg-blue-500' :
    rating === 'fair' ? 'bg-amber-500' : 'bg-red-400'

  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full', twBg('stone', 200), DARK.bgNeutral700)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', barColor)}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

function DimensionDot({ dim }: { dim: DimensionProgress }): React.JSX.Element {
  const dotColor =
    dim.status === 'success' ? 'bg-emerald-500' :
    dim.status === 'partial' ? 'bg-amber-500' :
    dim.status === 'fail' ? 'bg-red-500' : 'bg-stone-300'

  return (
    <div className="flex items-center gap-1" title={`${dim.name}：${STATUS_CONFIG[dim.status].label}`}>
      <div className={cn('h-2.5 w-2.5 rounded-full', dotColor)} />
      <span className={cn('text-[10px]', twText('stone', 500))}>{dim.name}</span>
    </div>
  )
}

export function CollectionProgress({
  symbol,
  compact = false,
}: CollectionProgressProps): React.JSX.Element {
  const [progress, setProgress] = useState<ProgressType | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      const result = await getCollectionProgress(symbol)
      if (!cancelled) {
        setProgress(result)
        setLoading(false)
      }
    }

    void load()

    const off = eventBus.on(COLLECTION_EVENTS.COMPLETE, (event: unknown) => {
      const payload = event as { symbol?: string } | undefined
      if (payload?.symbol === symbol) {
        void load()
      }
    })

    return () => {
      cancelled = true
      off()
    }
  }, [symbol])

  if (loading) {
    return (
      <div className={cn('flex items-center gap-1 text-xs', twText('stone', 400))}>
        <div className={cn('h-3 w-3 animate-spin rounded-full border', twBorder('stone', 300), 'border-t-emerald-500')} />
        <span>采集中</span>
      </div>
    )
  }

  if (!progress) {
    return <span className={cn('text-xs', twText('stone', 400))}>暂无数据</span>
  }

  const ratingCfg = RATING_CONFIG[progress.qualityRating]

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar percent={progress.completionPercent} rating={progress.qualityRating} />
          </div>
          <span className={cn('text-xs font-medium tabular-nums', twText('stone', 700), DARK.textNeutral200)}>
            {progress.completionPercent}%
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={cn('rounded px-1 py-0.5 font-medium', ratingCfg.color, ratingCfg.bg, ratingCfg.darkBg)}>
            {ratingCfg.label}
          </span>
          <span className={twText('stone', 500)}>
            {progress.completedCount}/{progress.totalDimensions} 维度
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar percent={progress.completionPercent} rating={progress.qualityRating} />
        </div>
        <span className={cn('text-sm font-bold tabular-nums', twText('stone', 800), DARK.textNeutral100)}>
          {progress.completionPercent}%
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className={cn('rounded-md px-2 py-1 font-medium', ratingCfg.color, ratingCfg.bg, ratingCfg.darkBg)}>
          {ratingCfg.label}
        </span>
        <span className={twText('stone', 600)}>
          已完成 <strong className={twText('stone', 800)}>{progress.completedCount}</strong> / {progress.totalDimensions} 维度
        </span>
      </div>
      <div className={cn('grid grid-cols-2 gap-1.5 rounded-md border p-2', twBorder('stone', 100), twBg('stone', 50), DARK.borderNeutral800, DARK.bgNeutral900)}>
        {progress.dimensions.map((dim) => {
          const cfg = STATUS_CONFIG[dim.status]
          return (
            <div key={dim.code} className="flex items-center gap-1.5">
              <DimensionDot dim={dim} />
              <span className={cn('text-[10px]', cfg.color, cfg.darkColor)}>{cfg.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
