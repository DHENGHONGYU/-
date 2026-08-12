import React from 'react'
import { Badge, Button, Checkbox } from '@/components/atoms'
import { QualityIndicator } from '@/components/organisms/input/QualityIndicator'
import { DEFAULT_POOL_GROUP } from '@/constants/pool.constants'
import type { ResearchStatus } from '@/constants/pool.constants'
import type { PoolItem, PoolTransitionTarget } from '@/types/modules/pool.types'

export interface PoolCardProps {
  item: PoolItem
  options: PoolTransitionTarget[]
  allGroups?: string[]
  selected?: boolean
  onSelectToggle?: (symbol: string) => void
  onTransition: (symbol: string, toStatus: ResearchStatus) => void
  onChangeGroup?: (symbol: string, group: string) => void
  onRefreshKline?: (item: PoolItem) => void
  onAnalyze?: (symbol: string) => void
}

/**
 * PoolCard
 */
export function PoolCard({
  item,
  options,
  allGroups = [],
  selected,
  onSelectToggle,
  onTransition,
  onChangeGroup,
  onRefreshKline,
  onAnalyze,
}: PoolCardProps): React.JSX.Element {
  const group = item.group ?? DEFAULT_POOL_GROUP
  const availableGroups = allGroups.filter((g) => g !== group)

  return (
    <div className="rounded-md border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {onSelectToggle && (
            <Checkbox
              checked={selected}
              onChange={() => onSelectToggle(item.symbol)}
              aria-label={`选择 ${item.symbol}`}
            />
          )}
          <div className="min-w-0">
            <p className="font-medium">{item.symbol}</p>
            <p className="truncate text-sm text-muted-foreground">{item.name}</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs">
          {item.source}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {item.price !== undefined && <span>价 {item.price.toFixed(2)}</span>}
        {item.pe !== undefined && <span>PE {item.pe.toFixed(2)}</span>}
        {item.pb !== undefined && <span>PB {item.pb.toFixed(2)}</span>}
        <Badge variant="secondary" className="text-xs">
          {group}
        </Badge>
      </div>

      <div className="mt-2">
        <QualityIndicator quality={item.dataQuality} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {options.map((option) => (
          <Button
            key={`${option.pool}-${option.status}`}
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onTransition(item.symbol, option.status as ResearchStatus)}
          >
            {option.label}
          </Button>
        ))}
        {availableGroups.length > 0 && onChangeGroup && (
          <select
            className="h-7 rounded-md border bg-background px-2 text-xs"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onChangeGroup(item.symbol, e.target.value)
              }
            }}
            aria-label={`切换 ${item.symbol} 分组`}
          >
            <option value="">移入分组</option>
            {availableGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        {onAnalyze && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onAnalyze(item.symbol)}
          >
            分析
          </Button>
        )}
        {onRefreshKline && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onRefreshKline(item)}
          >
            刷新行情
          </Button>
        )}
      </div>
    </div>
  )
}
