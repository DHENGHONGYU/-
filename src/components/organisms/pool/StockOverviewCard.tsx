import React from 'react'
import { CollectionProgress } from '@/components/organisms/pool/CollectionProgress'
import { StockNewsStats } from '@/components/organisms/pool/StockNewsStats'
import { twText, twBg, twBorder, DARK } from '@/constants/theme.tokens'
import { cn } from '@/lib/utils'
import type { PoolItem } from '@/types/modules/pool.types'

const STATUS_LABELS: Record<string, string> = {
  candidate: '候选',
  screened: '初筛',
  deepDive: '深研',
  watching: '跟踪',
  archived: '归档',
}

const STATUS_COLORS: Record<string, string> = {
  candidate: cn(twBg('stone', 100), twText('stone', 700), DARK.bgNeutral800, DARK.textNeutral300),
  screened: cn(twBg('blue', 100), twText('blue', 700), DARK.bgBlue950_30, DARK.textBlue400),
  deepDive: cn(twBg('purple', 100), twText('purple', 700), DARK.bgPurple950_30, DARK.textPurple400),
  watching: cn(twBg('amber', 100), twText('amber', 700), DARK.bgAmber950_30, DARK.textAmber300),
  archived: cn(twBg('stone', 200), twText('stone', 500), DARK.bgNeutral800, DARK.textNeutral500),
}

function formatMarketCap(cap?: number): string {
  if (cap === undefined || cap === null) return '—'
  if (cap >= 10_000) return `${(cap / 10_000).toFixed(1)}万亿`
  if (cap >= 1) return `${cap.toFixed(0)}亿`
  return `${(cap * 10_000).toFixed(0)}万`
}

export function StockOverviewCard({ item }: { item: PoolItem }): React.JSX.Element {
  const status = item.status as string
  return (
    <div className={cn('rounded-lg border p-4 transition-shadow hover:shadow-md', twBorder('stone', 200), DARK.borderNeutral700)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('font-mono text-sm font-semibold', twText('stone', 800), DARK.textNeutral100)}>
            {item.symbol}
          </p>
          <p className={cn('truncate text-sm', twText('stone', 600), DARK.textNeutral300)}>
            {item.name}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[status] ?? STATUS_COLORS.candidate)}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {/* Basic Info */}
      <div className={cn('mt-2 grid grid-cols-3 gap-x-3 gap-y-1 rounded-md border px-2.5 py-2 text-xs', twBorder('stone', 100), twBg('stone', 50), DARK.borderNeutral800, DARK.bgNeutral900)}>
        {item.sector && (
          <div>
            <span className={twText('stone', 400)}>行业</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.sector}</p>
          </div>
        )}
        {item.marketCap !== undefined && (
          <div>
            <span className={twText('stone', 400)}>市值</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{formatMarketCap(item.marketCap)}</p>
          </div>
        )}
        {item.price !== undefined && (
          <div>
            <span className={twText('stone', 400)}>价格</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.price.toFixed(2)}</p>
          </div>
        )}
        {item.pe !== undefined && (
          <div>
            <span className={twText('stone', 400)}>PE</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.pe.toFixed(1)}</p>
          </div>
        )}
        {item.pb !== undefined && (
          <div>
            <span className={twText('stone', 400)}>PB</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.pb.toFixed(1)}</p>
          </div>
        )}
        {item.roe !== undefined && (
          <div>
            <span className={twText('stone', 400)}>ROE</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.roe.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className={cn('mt-3 rounded-md border p-3', twBorder('stone', 100), twBg('stone', 50) + '/50', DARK.borderNeutral800, DARK.bgNeutral900)}>
        <p className={cn('mb-2 text-[10px] font-medium uppercase tracking-wider', twText('stone', 400))}>
          数据采集进度
        </p>
        <CollectionProgress symbol={item.symbol} />
      </div>

      {/* News */}
      <div className={cn('mt-3 rounded-md border p-3', twBorder('stone', 100), twBg('stone', 50) + '/50', DARK.borderNeutral800, DARK.bgNeutral900)}>
        <p className={cn('mb-2 text-[10px] font-medium uppercase tracking-wider', twText('stone', 400))}>
          资讯采集（时效 × 质量）
        </p>
        <StockNewsStats symbol={item.symbol} />
      </div>
    </div>
  )
}
