import React from 'react'
import type { ResearchStatus } from '@/config/dbConfig'
import type { Stock } from '@/data/types'
import { PoolCard } from './PoolCard'

export interface PoolColumnProps {
  title: string
  status: ResearchStatus
  stocks: Stock[]
  options: Array<{ value: ResearchStatus; label: string }>
  allGroups?: string[]
  selectedSymbols?: string[]
  onSelectToggle?: (symbol: string) => void
  onTransition: (symbol: string, toStatus: ResearchStatus) => void
  onChangeGroup?: (symbol: string, group: string) => void
  onRefreshKline?: (stock: Stock) => void
  onAnalyze?: (symbol: string) => void
}

/**
 * PoolColumn
 */
export function PoolColumn({
  title,
  status: _status,
  stocks,
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
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{stocks.length}</span>
        </div>
      </div>
      <div className="flex-1 space-y-2 p-2">
        {stocks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无标的</p>
        ) : (
          stocks.map((stock) => (
            <PoolCard
              key={stock.symbol}
              stock={stock}
              options={options}
              allGroups={allGroups}
              selected={selectedSymbols?.includes(stock.symbol)}
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
