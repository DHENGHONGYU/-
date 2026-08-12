import React from 'react'
import { RESEARCH_STATUS, type ResearchStatus } from '@/constants/pool.constants'
import { POOL_TYPE } from '@/constants/pool.constants'
import { getPoolLabel, getPoolTransitionOptions } from '@/core/poolTransitionEngine'
import type { PoolItem } from '@/types/modules/pool.types'
import { PoolColumn } from './PoolColumn'
import { PoolList } from './PoolList'

export type PoolViewMode = 'kanban' | 'list'

export interface PoolBoardProps {
  items: PoolItem[]
  viewMode?: PoolViewMode
  selectedSymbols?: string[]
  allGroups?: string[]
  onSelectToggle?: (symbol: string) => void
  onTransition: (symbol: string, toStatus: ResearchStatus) => void
  onChangeGroup?: (symbol: string, group: string) => void
  onRefreshKline?: (item: PoolItem) => void
  onAnalyze?: (symbol: string) => void
}

const STATUS_ORDER: ResearchStatus[] = [
  RESEARCH_STATUS.candidate,
  RESEARCH_STATUS.screened,
  RESEARCH_STATUS.deepDive,
  RESEARCH_STATUS.watching,
  RESEARCH_STATUS.archived,
]

/**
 * PoolBoard
 */
export function PoolBoard({
  items,
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
        items={items}
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

  const grouped = new Map<ResearchStatus, PoolItem[]>()
  for (const status of STATUS_ORDER) {
    grouped.set(status, [])
  }
  for (const item of items) {
    if (!STATUS_ORDER.includes(item.status as ResearchStatus)) continue
    const list = grouped.get(item.status as ResearchStatus) ?? []
    list.push(item)
    grouped.set(item.status as ResearchStatus, list)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STATUS_ORDER.map((status) => {
        const list = grouped.get(status) ?? []
        const options = getPoolTransitionOptions(POOL_TYPE.research, status)
        return (
          <PoolColumn
            key={status}
            title={getPoolLabel(POOL_TYPE.research, status)}
            status={status}
            items={list}
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
