import React from 'react'
import { cn } from '@/lib/utils'
import type { CollectionProgress as ProgressType } from '@/services/pool/collectionProgressService'

interface BatchProgressDetail {
  symbol: string
  name: string
  percent: number
  completedDims: number
  totalDims: number
  dimStatuses: { name: string; status: string }[]
}

interface Props {
  collecting: boolean
  symbols: { symbol: string; name: string }[]
  progressMap: Map<string, ProgressType> | null
  refreshError: string | null
}

export function BatchCollectionPanel({
  collecting,
  symbols,
  progressMap,
  refreshError,
}: Props): React.JSX.Element | null {
  if (!collecting) return null

  let totalCompleted = 0
  let totalDims = 0
  const details: BatchProgressDetail[] = []

  for (const item of symbols) {
    const p = progressMap?.get(item.symbol)
    const completedDims = p?.completedCount ?? 0
    const totalD = p?.totalDimensions ?? 7
    totalCompleted += completedDims
    totalDims += totalD
    details.push({
      symbol: item.symbol,
      name: item.name,
      percent: p?.completionPercent ?? 0,
      completedDims,
      totalDims: totalD,
      dimStatuses: p?.dimensions?.map((d) => ({ name: d.name, status: d.status })) ?? [],
    })
  }

  const overallPercent = totalDims > 0 ? Math.round((totalCompleted / totalDims) * 100) : 0
  const isBroken = !!refreshError

  return (
    <div className={cn(
      'rounded-lg border-2 p-4',
      isBroken
        ? 'border-destructive/40 bg-destructive/5'
        : 'border-success/30 bg-success/5',
    )}>
      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        {isBroken ? (
          <span className="text-sm text-destructive">⚠</span>
        ) : (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-success/40 border-t-success" />
        )}
        <span className={cn('text-sm font-medium', isBroken ? 'text-destructive' : 'text-success')}>
          {isBroken ? '采集断连，已停止进度更新' : '批量采集进行中'}
        </span>
        <div className={cn('flex-1 h-3 overflow-hidden rounded-full', isBroken ? 'bg-destructive/15' : 'bg-success/15')}>
          <div
            className={cn('h-full rounded-full transition-[width] duration-700 ease-out', isBroken ? 'bg-destructive/60' : 'bg-success')}
            style={{ width: `${overallPercent}%` }}
          />
        </div>
        <span className={cn('text-lg font-bold tabular-nums', isBroken ? 'text-destructive' : 'text-success')}>
          {overallPercent}%
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        已完成 {totalCompleted} / {totalDims} 个维度 · 共 {symbols.length} 只标的
      </p>

      {refreshError && (
        <div className="mt-2 rounded-md border border-destructive/30 bg-muted/60 px-2 py-1.5 text-[11px] text-destructive">
          <span className="font-medium">断连原因：</span>
          <span className="font-mono break-all">{refreshError}</span>
        </div>
      )}

      <div className="mt-3 space-y-1.5 rounded-md border border-success/20 bg-surface-2/50 p-3">
        {details.map((d) => (
          <div key={d.symbol} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 truncate font-mono text-muted-foreground" title={d.name}>
              {d.symbol}
            </span>
            <span className="w-16 shrink-0 truncate text-muted-foreground" title={d.name}>
              {d.name}
            </span>
            <div className="flex flex-1 items-center gap-1">
              {d.dimStatuses.map((dim, i) => {
                const dotClass =
                  dim.status === 'success' ? 'bg-success' :
                  dim.status === 'partial' ? 'bg-warning' :
                  dim.status === 'fail' ? 'bg-destructive' :
                  'bg-muted-foreground/40'
                return (
                  <div
                    key={i}
                    className={cn('h-2 w-2 rounded-full transition-colors duration-300', dotClass)}
                    title={`${dim.name}：${dim.status === 'success' ? '已完成' : dim.status === 'partial' ? '部分' : dim.status === 'fail' ? '失败' : '待采集'}`}
                  />
                )
              })}
            </div>
            <div className="flex items-center gap-1.5 w-20 shrink-0 justify-end">
              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-[width] duration-500"
                  style={{ width: `${d.percent}%` }}
                />
              </div>
              <span className="tabular-nums text-muted-foreground">
                {d.completedDims}/{d.totalDims}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
