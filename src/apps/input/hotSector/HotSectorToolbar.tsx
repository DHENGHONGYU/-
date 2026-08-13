import React from 'react'
import { Button } from '@/components/atoms/Button'
import { Checkbox } from '@/components/atoms/Checkbox'
import { Select, SelectItem } from '@/components/atoms/Select'
import { cn } from '@/lib/utils'
import type { RepresentativePick } from '../hotSector.utils'

export interface HotSectorToolbarProps {
  hotSectorsCount: number
  selectedSectorsCount: number
  totalSelectedStocks: number
  targetGroup: string
  allGroups: string[]
  addingAll: boolean
  onToggleSelectAllSectors: (checked: boolean) => void
  onTargetGroupChange: (group: string) => void
  onAddSelectedSectors: () => void
  onAddSelectedStocks: () => void

  // 考核标准·及时性
  timelyOnly: boolean
  setTimelyOnly: (v: boolean) => void
  timelySectorsCount: number

  // 代表股抽取（15-20 只筛选）
  picks: RepresentativePick[]
  handleExtractRepresentatives: () => void
  handleAddPicks: () => void
}

/**
 * 板块级操作工具条 — 全选 + 及时性过滤 + 分组选择 + 代表股抽取 + 批量加入
 */
export function HotSectorToolbar({
  hotSectorsCount,
  selectedSectorsCount,
  totalSelectedStocks,
  targetGroup,
  allGroups,
  addingAll,
  onToggleSelectAllSectors,
  onTargetGroupChange,
  onAddSelectedSectors,
  onAddSelectedStocks,

  timelyOnly,
  setTimelyOnly,
  timelySectorsCount,

  picks,
  handleExtractRepresentatives,
  handleAddPicks,
}: HotSectorToolbarProps): React.JSX.Element {
  const allSelected = hotSectorsCount > 0 && selectedSectorsCount === hotSectorsCount

  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 border-border bg-muted/50')}>
      {/* 全选 */}
      <div
        className="cursor-pointer"
        role="checkbox"
        aria-checked={allSelected}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onToggleSelectAllSectors(!allSelected)
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <Checkbox
          checked={allSelected}
          onChange={() => { /* 由外层 div onClick 统一处理 */ }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
          aria-label="全选板块"
        />
      </div>
      <span className={cn('text-xs text-muted-foreground')}>
        已选 {selectedSectorsCount} / {hotSectorsCount} 个板块
        {totalSelectedStocks > 0 && (
          <span className={cn('ml-2 text-info')}>· 成分股 {totalSelectedStocks} 只</span>
        )}
      </span>

      {/* 及时性过滤（考核标准·近一周） */}
      <div className="flex items-center gap-1.5">
        <div
          className="cursor-pointer"
          role="checkbox"
          aria-checked={timelyOnly}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setTimelyOnly(!timelyOnly)
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Checkbox
            checked={timelyOnly}
            onChange={() => {}}
            onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
            aria-label="仅看近一周有评分的板块"
          />
        </div>
        <span className={cn('text-xs text-muted-foreground whitespace-nowrap')}>
          仅看近一周 {timelyOnly && timelySectorsCount > 0 && `(${timelySectorsCount})`}
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* 代表股抽取按钮 */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleExtractRepresentatives}
          disabled={addingAll}
        >
          抽取代表股 (15-20)
        </Button>

        <Select
          className="h-8 w-auto min-w-[140px]"
          value={targetGroup}
          onChange={(e) => onTargetGroupChange(e.target.value)}
          aria-label="热门板块目标分组"
          disabled={addingAll}
        >
          <SelectItem value="">默认分组</SelectItem>
          {allGroups.map((g) => (
            <SelectItem key={g} value={g}>
              {g}
            </SelectItem>
          ))}
        </Select>

        {picks.length > 0 && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => void handleAddPicks()}
            disabled={addingAll}
          >
            {addingAll ? '加入中...' : `加入代表股 (${picks.length})`}
          </Button>
        )}

        {selectedSectorsCount > 0 && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => void onAddSelectedSectors()}
            disabled={addingAll}
          >
            {addingAll ? '加入中...' : `加入选中板块 (${selectedSectorsCount})`}
          </Button>
        )}
        {totalSelectedStocks > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void onAddSelectedStocks()}
            disabled={addingAll}
          >
            {addingAll ? '加入中...' : `加入选中成分股 (${totalSelectedStocks})`}
          </Button>
        )}
      </div>
    </div>
  )
}