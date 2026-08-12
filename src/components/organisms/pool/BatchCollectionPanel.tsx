import React from 'react'
import { twText, twBg, twBorder, DARK } from '@/constants/theme.tokens'
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
        ? cn(twBorder('red', 300), twBg('red', '50/60'), DARK.borderRed800, DARK.bgRed950_20)
        : cn(twBorder('emerald', 200), twBg('emerald', '50/50'), DARK.borderEmerald800, DARK.bgEmerald950_20),
    )}>
      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        {isBroken ? (
          <span className={cn('text-sm', twText('red', 600))}>⚠</span>
        ) : (
          <div className={cn('h-3 w-3 animate-spin rounded-full border-2', twBorder('emerald', 300), 'border-t-emerald-600')} />
        )}
        <span className={cn('text-sm font-medium', isBroken ? twText('red', 700) : twText('emerald', 700), isBroken ? DARK.textRed300 : DARK.textEmerald300)}>
          {isBroken ? '采集断连，已停止进度更新' : '批量采集进行中'}
        </span>
        <div className={cn('flex-1 h-3 overflow-hidden rounded-full', isBroken ? twBg('red', 100) : twBg('emerald', 100), isBroken ? DARK.bgRed950_50 : DARK.bgEmerald950_50)}>
          <div
            className={cn('h-full rounded-full transition-all duration-700 ease-out', isBroken ? twBg('red', 400) : twBg('emerald', 500))}
            style={{ width: `${overallPercent}%` }}
          />
        </div>
        <span className={cn('text-lg font-bold tabular-nums', isBroken ? twText('red', 700) : twText('emerald', 700), isBroken ? DARK.textRed300 : DARK.textEmerald300)}>
          {overallPercent}%
        </span>
      </div>
      <p className={cn('mt-1 text-xs', twText('stone', 500))}>
        已完成 {totalCompleted} / {totalDims} 个维度 · 共 {symbols.length} 只标的
      </p>
      
      {refreshError && (
        <div className={cn('mt-2 rounded-md border px-2 py-1.5 text-[11px]', twBorder('red', 200), DARK.borderRed900, DARK.bgNeutral900_60, twText('red', 700), DARK.textRed300)}>
          <span className="font-medium">断连原因：</span>
          <span className="font-mono break-all">{refreshError}</span>
        </div>
      )}

      <div className={cn('mt-3 space-y-1.5 rounded-md border p-3', twBorder('emerald', 100), DARK.bgNeutral900Half, DARK.borderEmerald900)}>
        {details.map((d) => (
          <div key={d.symbol} className="flex items-center gap-2 text-xs">
            <span className={cn('w-24 shrink-0 truncate font-mono', twText('stone', 600), DARK.textNeutral300)} title={d.name}>
              {d.symbol}
            </span>
            <span className={cn('w-16 shrink-0 truncate', twText('stone', 500))} title={d.name}>
              {d.name}
            </span>
            <div className="flex flex-1 items-center gap-1">
              {d.dimStatuses.map((dim, i) => {
                const dotClass =
                  dim.status === 'success' ? twBg('emerald', 500) :
                  dim.status === 'partial' ? twBg('amber', 500) :
                  dim.status === 'fail' ? twBg('red', 500) :
                  cn(twBg('stone', 300), DARK.bgNeutral600)
                return (
                  <div
                    key={i}
                    className={cn('h-2 w-2 rounded-full transition-colors duration-300', dotClass)}
                    title={`${dim.name}：${dim.status === 'success' ? '已完成' : dim.status === 'partial' ? '部分' : dim.status === 'fail' ? '失败' : '待采集'}`}
                  />
                )
              })}
            </div>
            <div className={cn('flex items-center gap-1.5', 'w-20 shrink-0 justify-end')}>
              <div className={cn('h-1.5 w-12 overflow-hidden rounded-full', twBg('stone', 200), DARK.bgNeutral700)}>
                <div
                  className={cn('h-full rounded-full transition-all duration-500', twBg('emerald', 500))}
                  style={{ width: `${d.percent}%` }}
                />
              </div>
              <span className={cn('tabular-nums', twText('stone', 600), DARK.textNeutral300)}>
                {d.completedDims}/{d.totalDims}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
