import React from 'react'
import type { ResearchStatus } from '@/constants/pool.constants'
import type { PoolItem, PoolTransitionTarget } from '@/types/modules/pool.types'
import { PoolCard } from './PoolCard'

export interface PoolColumnProps {
  title: string
  status: ResearchStatus
  items: PoolItem[]
  options: PoolTransitionTarget[]
  allGroups?: string[]
  selectedSymbols?: string[]
  onSelectToggle?: (symbol: string) => void
  onTransition: (symbol: string, toStatus: ResearchStatus) => void
  onChangeGroup?: (symbol: string, group: string) => void
  onRefreshKline?: (item: PoolItem) => void
  onAnalyze?: (symbol: string) => void
}

/**
 * PoolColumn
 */
export function PoolColumn({
  title,
  status: _status,
  items,
  options,
  allGroups = [],
  selectedSymbols,
  onSelectToggle,
  onTransition,
  onChangeGroup,
  onRefreshKline,
  onAnalyze,
}: PoolColumnProps): React.JSX.Element {
  return (
    <div className="flex min-w-[220px] flex-1 flex-col rounded-md border bg-muted/30">
      <div className="border-b p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{items.length}</span>
        </div>
      </div>
      <div className="flex-1 space-y-2 p-2">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无标的</p>
        ) : (
          items.map((item) => (
            <PoolCard
              key={item.symbol}
              item={item}
              options={options}
              allGroups={allGroups}
              selected={selectedSymbols?.includes(item.symbol)}
              onSelectToggle={onSelectToggle}
              onTransition={onTransition}
              onChangeGroup={onChangeGroup}
              onRefreshKline={onRefreshKline}
              onAnalyze={onAnalyze}
            />
          ))
        )}
      </div>
    </div>
  )
}
