import React from 'react'
import { CollectionProgress } from '@/components/organisms/pool/CollectionProgress'
import { StockNewsStats } from '@/components/organisms/pool/StockNewsStats'
import { cn } from '@/lib/utils'
import type { PoolItem } from '@/types/modules/pool.types'

const STATUS_LABELS: Record<string, string> = {
  candidate: '候选',
  screened: '初筛',
  deepDive: '深研',
  watching: '跟踪',
  archived: '归档',
}

/** 状态徽章语义色 — 全部使用 CSS 变量，主题感知 */
const STATUS_COLORS: Record<string, string> = {
  candidate: 'bg-muted text-muted-foreground',
  screened: 'bg-info/15 text-info',
  deepDive: 'bg-primary/15 text-primary',
  watching: 'bg-warning/15 text-warning',
  archived: 'bg-muted text-muted-foreground/70',
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
    <div className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-elevation-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-foreground">
            {item.symbol}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {item.name}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[status] ?? STATUS_COLORS.candidate)}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {/* Basic Info */}
      <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 rounded-md border border-divider bg-surface-2 px-2.5 py-2 text-xs">
        {item.sector && (
          <div>
            <span className="text-muted-foreground">行业</span>
            <p className="font-medium text-foreground">{item.sector}</p>
          </div>
        )}
        {item.marketCap !== undefined && (
          <div>
            <span className="text-muted-foreground">市值</span>
            <p className="font-medium text-foreground">{formatMarketCap(item.marketCap)}</p>
          </div>
        )}
        {item.price !== undefined && (
          <div>
            <span className="text-muted-foreground">价格</span>
            <p className="font-medium text-foreground">{item.price.toFixed(2)}</p>
          </div>
        )}
        {item.pe !== undefined && (
          <div>
            <span className="text-muted-foreground">PE</span>
            <p className="font-medium text-foreground">{item.pe.toFixed(1)}</p>
          </div>
        )}
        {item.pb !== undefined && (
          <div>
            <span className="text-muted-foreground">PB</span>
            <p className="font-medium text-foreground">{item.pb.toFixed(1)}</p>
          </div>
        )}
        {item.roe !== undefined && (
          <div>
            <span className="text-muted-foreground">ROE</span>
            <p className="font-medium text-foreground">{item.roe.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="mt-3 rounded-md border border-divider bg-surface-2/50 p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          数据采集进度
        </p>
        <CollectionProgress symbol={item.symbol} />
      </div>

      {/* News */}
      <div className="mt-3 rounded-md border border-divider bg-surface-2/50 p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          资讯采集（时效 × 质量）
        </p>
        <StockNewsStats symbol={item.symbol} />
      </div>
    </div>
  )
}
