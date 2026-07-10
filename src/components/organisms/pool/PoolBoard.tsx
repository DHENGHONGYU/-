import React from 'react'
import { RESEARCH_STATUS, type ResearchStatus } from '@/config/dbConfig'
import { getPoolLabel, getPoolTransitionOptions } from '@/core/poolTransitionEngine'
import type { Stock } from '@/data/types'
import { PoolColumn } from './PoolColumn'
import { PoolList } from './PoolList'

export type PoolViewMode = 'kanban' | 'list'

export interface PoolBoardProps {
  stocks: Stock[]
  viewMode?: PoolViewMode
  selectedSymbols?: string[]
  allGroups?: string[]
  onSelectToggle?: (symbol: string) => void
  onTransition: (symbol: string, toStatus: ResearchStatus) => void
  onChangeGroup?: (symbol: string, group: string) => void
  onRefreshKline?: (stock: Stock) => void
  onAnalyze?: (symbol: string) => void
}

const STATUS_ORDER: ResearchStatus[] = [
  RESEARCH_STATUS.candidate,
  RESEARCH_STATUS.screened,
  RESEARCH_STATUS.deepDive,
  RESEARCH_STATUS.watching,
  RESEARCH_STATUS.archived,
]

export function PoolBoard({
  stocks,
  viewMode = 'kanban',
  selectedSymbols = [],
  allGroups = [],
  onSelectToggle,
  onTransition,
  onChangeGroup,
  onRefreshKline,
  onAnalyze,
}: PoolBoardProps): React.JSX.Element {
  if (viewMode === 'list') {
    return (
      <PoolList
        stocks={stocks}
        selectedSymbols={selectedSymbols}
        allGroups={allGroups}
        onSelectToggle={onSelectToggle ?? (() => {})}
        onTransition={onTransition}
        onChangeGroup={onChangeGroup}
        onRefreshKline={onRefreshKline}
        onAnalyze={onAnalyze}
      />
    )
  }

  const grouped = new Map<ResearchStatus, Stock[]>()
  for (const status of STATUS_ORDER) {
    grouped.set(status, [])
  }
  for (const stock of stocks) {
    const list = grouped.get(stock.researchStatus) ?? []
    list.push(stock)
    grouped.set(stock.researchStatus, list)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STATUS_ORDER.map((status) => {
        const list = grouped.get(status) ?? []
        const options = getPoolTransitionOptions(status)
        return (
          <PoolColumn
            key={status}
            title={getPoolLabel(status)}
            status={status}
            stocks={list}
            options={options}
            allGroups={allGroups}
            selectedSymbols={selectedSymbols}
            onSelectToggle={onSelectToggle}
            onTransition={onTransition}
            onChangeGroup={onChangeGroup}
            onRefreshKline={onRefreshKline}
            onAnalyze={onAnalyze}
          />
        )
      })}
    </div>
  )
}
