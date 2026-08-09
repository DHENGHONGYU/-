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
import { twText, twBg, twBorder, DARK } from '@/constants/theme.tokens'
import { cn } from '@/lib/utils'
import { eventBus } from '@/lib/eventBus'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import { PROGRESS_REFRESH_EVENT } from '@/pages/analysis/PoolBoardPage'

export interface CollectionProgressProps {
  symbol: string
  compact?: boolean
}

type DimStatus = 'success' | 'partial' | 'fail' | 'none'

const STATUS_CONFIG: { [K in DimStatus]: { label: string; color: string; darkColor: string; dot: string } } = {
  success: { label: '已完成', color: twText('emerald', 600), darkColor: DARK.textEmerald400, dot: twBg('emerald', 500) },
  partial: { label: '部分', color: twText('amber', 600), darkColor: DARK.textAmber300, dot: twBg('amber', 500) },
  fail: { label: '失败', color: twText('red', 600), darkColor: DARK.textRed400, dot: twBg('red', 500) },
  none: { label: '未采集', color: twText('stone', 400), darkColor: DARK.textNeutral500, dot: twBg('stone', 300) },
}

const RATING_CONFIG: { [K in ProgressType['qualityRating']]: { label: string; color: string; bg: string; darkBg: string } } = {
  excellent: { label: '优秀', color: twText('emerald', 700), bg: twBg('emerald', 50), darkBg: DARK.bgEmerald950_30 },
  good: { label: '良好', color: twText('blue', 700), bg: twBg('blue', 50), darkBg: DARK.bgBlue950_30 },
  fair: { label: '一般', color: twText('amber', 700), bg: twBg('amber', 50), darkBg: DARK.bgAmber950_30 },
  poor: { label: '较差', color: twText('red', 700), bg: twBg('red', 50), darkBg: DARK.bgRed950_30 },
}

function formatTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ProgressBar({ percent, rating, isHistorical }: { percent: number; rating: string; isHistorical: boolean }): React.JSX.Element {
  const barColor =
    rating === 'excellent' ? (isHistorical ? twBg('emerald', 400) : twBg('emerald', 500)) :
    rating === 'good' ? (isHistorical ? twBg('blue', 400) : twBg('blue', 500)) :
    rating === 'fair' ? (isHistorical ? twBg('amber', 400) : twBg('amber', 500)) :
    (isHistorical ? twBg('red', 300) : twBg('red', 400))

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
  const cfg = STATUS_CONFIG[dim.status]

  return (
    <div className="flex items-center gap-1" title={`${dim.name}：${cfg.label}${dim.durationMs ? ` (${dim.durationMs}ms)` : ''}`}>
      <div className={cn('h-2.5 w-2.5 rounded-full', cfg.dot)} />
      <span className={cn('text-[10px]', twText('stone', 500))}>{dim.name}</span>
    </div>
  )
}

function BatchInfoStrip({ progress }: { progress: ProgressType }): React.JSX.Element | null {
  if (!progress.lastBatch) return null

  const { lastBatch, isFromHistoricalBatch } = progress
  const hasFailures = lastBatch.failCount > 0

  // 最新批次有失败但也有成功 → 显示混合状态
  // 最新批次完全失败 → 显示历史回溯警告
  if (!hasFailures && !isFromHistoricalBatch) return null

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-1 text-[10px]',
        isFromHistoricalBatch
          ? cn(twBorder('amber', 200), twBg('amber', 50), twText('amber', 700), DARK.borderAmber800, DARK.bgAmber950_30, DARK.textAmber300)
          : cn(twBorder('red', 200), twBg('red', 50), twText('red', 700), DARK.borderRed800, DARK.bgRed950_30, DARK.textRed300),
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

    // 单个 symbol 维度完成时：精确匹配 symbol 后刷新
    // COMPLETE 事件在每个维度采集完成时触发，带 symbol 字段
    const offComplete = eventBus.on(COLLECTION_EVENTS.COMPLETE, (event: unknown) => {
      const payload = event as { symbol?: string } | undefined
      if (payload?.symbol === symbol) {
        setCollecting(false)
        void load()
      }
    })

    // 单个 symbol 采集触发时：显示"采集中"状态
    const offTriggered = eventBus.on(COLLECTION_EVENTS.TRIGGERED, (event: unknown) => {
      const payload = event as { symbol?: string } | undefined
      if (payload?.symbol === symbol) {
        setCollecting(true)
        void load()
      }
    })

    // 批量采集全局刷新事件：PoolBoardPage 定时 3 秒触发
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
      <div className={cn('flex items-center gap-1 text-xs', twText('stone', 400))}>
        <div className={cn('h-3 w-3 animate-spin rounded-full border', twBorder('stone', 300), 'border-t-emerald-500')} />
        <span>{collecting ? '采集中…' : '加载中'}</span>
      </div>
    )
  }

  if (!progress) {
    return <span className={cn('text-xs', twText('stone', 400))}>暂无数据</span>
  }

  const ratingCfg = RATING_CONFIG[progress.qualityRating]
  const isHistorical = progress.isFromHistoricalBatch

  // 所有维度都为 none 时显示"未采集"
  const allNone = progress.dimensions.every((d) => d.status === 'none')

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar percent={progress.completionPercent} rating={progress.qualityRating} isHistorical={isHistorical} />
          </div>
          {collecting ? (
            <div className={cn('h-3 w-3 animate-spin rounded-full border', twBorder('stone', 300), 'border-t-emerald-500')} />
          ) : (
            <span className={cn('text-xs font-medium tabular-nums', twText('stone', 700), DARK.textNeutral200)}>
              {allNone ? '—' : `${progress.completionPercent}%`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={cn('rounded px-1 py-0.5 font-medium', ratingCfg.color, ratingCfg.bg, ratingCfg.darkBg)}>
            {collecting ? '采集中' : (allNone ? '未采集' : ratingCfg.label)}
          </span>
          {!allNone && !collecting && (
            <span className={twText('stone', 500)}>
              {progress.completedCount}/{progress.totalDimensions} 维度
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* 批次信息条：失败批次时显示警告 */}
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
          <div className={cn('h-4 w-4 animate-spin rounded-full border-2', twBorder('stone', 300), 'border-t-emerald-500')} />
        ) : (
          <span className={cn('text-sm font-bold tabular-nums', twText('stone', 800), DARK.textNeutral100)}>
            {allNone ? '—' : `${progress.completionPercent}%`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className={cn('rounded-md px-2 py-1 font-medium', ratingCfg.color, ratingCfg.bg, ratingCfg.darkBg)}>
          {collecting ? '采集中' : (allNone ? '未采集' : ratingCfg.label)}
        </span>
        {!allNone && !collecting && (
          <span className={twText('stone', 600)}>
            已完成 <strong className={twText('stone', 800)}>{progress.completedCount}</strong> / {progress.totalDimensions} 维度
          </span>
        )}
        {progress.lastBatch && (
          <span className={cn('ml-auto text-[10px]', twText('stone', 400))}>
            {formatTime(progress.lastBatch.startedAt)}
          </span>
        )}
      </div>
      {!allNone && (
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
      )}
      {/* 采集中且所有维度都未完成时，显示维度列表（待采集状态） */}
      {allNone && collecting && (
        <div className={cn('grid grid-cols-2 gap-1.5 rounded-md border p-2', twBorder('stone', 100), twBg('stone', 50), DARK.borderNeutral800, DARK.bgNeutral900)}>
          {progress.dimensions.map((dim) => {
            const cfg = STATUS_CONFIG.none
            return (
              <div key={dim.code} className="flex items-center gap-1.5">
                <div className={cn('h-2.5 w-2.5 animate-pulse rounded-full', cfg.dot)} />
                <span className={cn('text-[10px]', twText('stone', 500))}>{dim.name}</span>
                <span className={cn('text-[10px]', cfg.color, cfg.darkColor)}>待采集</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
