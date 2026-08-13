/**
 * @fileoverview 个股采集进度展示组件
 *
 * 展示单只股票的七维度采集完成状态、进度条、质量评级。
 * 支持批次级信息展示：当最新采集批次完全失败时，回溯展示历史成功批次数据，
 * 并标注"历史数据"提示，避免失败批次覆盖成功记录导致用户误判。
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
import { cn } from '@/lib/utils'
import { eventBus } from '@/lib/eventBus'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import { PROGRESS_REFRESH_EVENT } from '@/pages/analysis/hooks/usePoolBoardCollect'

export interface CollectionProgressProps {
  symbol: string
  compact?: boolean
}

type DimStatus = 'success' | 'partial' | 'fail' | 'none'

/** 维度状态语义色 — 全部使用 CSS 变量，主题感知 */
const STATUS_CONFIG: { [K in DimStatus]: { label: string; color: string; dot: string } } = {
  success: { label: '已完成', color: 'text-success', dot: 'bg-success' },
  partial: { label: '部分', color: 'text-warning', dot: 'bg-warning' },
  fail: { label: '失败', color: 'text-destructive', dot: 'bg-destructive' },
  none: { label: '未采集', color: 'text-muted-foreground', dot: 'bg-muted-foreground/40' },
}

/** 质量评级语义色 */
const RATING_CONFIG: { [K in ProgressType['qualityRating']]: { label: string; color: string; bg: string } } = {
  excellent: { label: '优秀', color: 'text-success', bg: 'bg-success/10' },
  good: { label: '良好', color: 'text-info', bg: 'bg-info/10' },
  fair: { label: '一般', color: 'text-warning', bg: 'bg-warning/10' },
  poor: { label: '较差', color: 'text-destructive', bg: 'bg-destructive/10' },
}

function formatTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ProgressBar({ percent, rating, isHistorical }: { percent: number; rating: string; isHistorical: boolean }): React.JSX.Element {
  const barColor =
    rating === 'excellent' ? (isHistorical ? 'bg-success/70' : 'bg-success') :
    rating === 'good' ? (isHistorical ? 'bg-info/70' : 'bg-info') :
    rating === 'fair' ? (isHistorical ? 'bg-warning/70' : 'bg-warning') :
    (isHistorical ? 'bg-destructive/60' : 'bg-destructive/80')

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all duration-500', barColor)}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

function DimensionDot({ dim }: { dim: DimensionProgress }): React.JSX.Element {
  const cfg = STATUS_CONFIG[dim.status]

  return (
    <div className="flex items-center gap-1" title={`${dim.name}：${cfg.label}${dim.durationMs ? ` (${dim.durationMs}ms)` : ''}`}>
      <div className={cn('h-2.5 w-2.5 rounded-full', cfg.dot)} />
      <span className="text-[10px] text-muted-foreground">{dim.name}</span>
    </div>
  )
}

function BatchInfoStrip({ progress }: { progress: ProgressType }): React.JSX.Element | null {
  if (!progress.lastBatch) return null

  const { lastBatch, isFromHistoricalBatch } = progress
  const hasFailures = lastBatch.failCount > 0

  if (!hasFailures && !isFromHistoricalBatch) return null

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-1 text-[10px]',
        isFromHistoricalBatch
          ? 'border-warning/30 bg-warning/10 text-warning'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      {isFromHistoricalBatch ? (
        <>
          <span className="font-medium">⚠ 最新批次失败</span>
          <span className="opacity-70">
            显示历史成功数据（{lastBatch.successCount}/{lastBatch.totalCount}）
          </span>
        </>
      ) : (
        <>
          <span className="font-medium">⚠ 部分维度失败</span>
          <span className="opacity-70">
            成功 {lastBatch.successCount} · 失败 {lastBatch.failCount}
          </span>
        </>
      )}
    </div>
  )
}

export function CollectionProgress({
  symbol,
  compact = false,
}: CollectionProgressProps): React.JSX.Element {
  const [progress, setProgress] = useState<ProgressType | null>(null)
  const [loading, setLoading] = useState(false)
  const [collecting, setCollecting] = useState(false)

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

    const offComplete = eventBus.on(COLLECTION_EVENTS.COMPLETE, (event: unknown) => {
      const payload = event as { symbol?: string } | undefined
      if (payload?.symbol === symbol) {
        setCollecting(false)
        void load()
      }
    })

    const offTriggered = eventBus.on(COLLECTION_EVENTS.TRIGGERED, (event: unknown) => {
      const payload = event as { symbol?: string } | undefined
      if (payload?.symbol === symbol) {
        setCollecting(true)
        void load()
      }
    })

    const offGlobalRefresh = eventBus.on(PROGRESS_REFRESH_EVENT, () => {
      void load()
    })

    return () => {
      cancelled = true
      offComplete()
      offTriggered()
      offGlobalRefresh()
    }
  }, [symbol])

  if (loading && !progress) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <div className="h-3 w-3 animate-spin rounded-full border border-border border-t-primary" />
        <span>{collecting ? '采集中…' : '加载中'}</span>
      </div>
    )
  }

  if (!progress) {
    return <span className="text-xs text-muted-foreground">暂无数据</span>
  }

  const ratingCfg = RATING_CONFIG[progress.qualityRating]
  const isHistorical = progress.isFromHistoricalBatch

  const allNone = progress.dimensions.every((d) => d.status === 'none')

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar percent={progress.completionPercent} rating={progress.qualityRating} isHistorical={isHistorical} />
          </div>
          {collecting ? (
            <div className="h-3 w-3 animate-spin rounded-full border border-border border-t-primary" />
          ) : (
            <span className="text-xs font-medium tabular-nums text-foreground">
              {allNone ? '—' : `${progress.completionPercent}%`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={cn('rounded px-1 py-0.5 font-medium', ratingCfg.color, ratingCfg.bg)}>
            {collecting ? '采集中' : (allNone ? '未采集' : ratingCfg.label)}
          </span>
          {!allNone && !collecting && (
            <span className="text-muted-foreground">
              {progress.completedCount}/{progress.totalDimensions} 维度
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <BatchInfoStrip progress={progress} />

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar
            percent={progress.completionPercent}
            rating={progress.qualityRating}
            isHistorical={isHistorical}
          />
        </div>
        {collecting ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
        ) : (
          <span className="text-sm font-bold tabular-nums text-foreground">
            {allNone ? '—' : `${progress.completionPercent}%`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className={cn('rounded-md px-2 py-1 font-medium', ratingCfg.color, ratingCfg.bg)}>
          {collecting ? '采集中' : (allNone ? '未采集' : ratingCfg.label)}
        </span>
        {!allNone && !collecting && (
          <span className="text-muted-foreground">
            已完成 <strong className="text-foreground">{progress.completedCount}</strong> / {progress.totalDimensions} 维度
          </span>
        )}
        {progress.lastBatch && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {formatTime(progress.lastBatch.startedAt)}
          </span>
        )}
      </div>
      {!allNone && (
        <div className="grid grid-cols-2 gap-1.5 rounded-md border border-divider bg-surface-2 p-2">
          {progress.dimensions.map((dim) => {
            const cfg = STATUS_CONFIG[dim.status]
            return (
              <div key={dim.code} className="flex items-center gap-1.5">
                <DimensionDot dim={dim} />
                <span className={cn('text-[10px]', cfg.color)}>{cfg.label}</span>
              </div>
            )
          })}
        </div>
      )}
      {allNone && collecting && (
        <div className="grid grid-cols-2 gap-1.5 rounded-md border border-divider bg-surface-2 p-2">
          {progress.dimensions.map((dim) => {
            const cfg = STATUS_CONFIG.none
            return (
              <div key={dim.code} className="flex items-center gap-1.5">
                <div className={cn('h-2.5 w-2.5 animate-pulse rounded-full', cfg.dot)} />
                <span className="text-[10px] text-muted-foreground">{dim.name}</span>
                <span className={cn('text-[10px]', cfg.color)}>待采集</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
