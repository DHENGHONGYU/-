import React from 'react'
import { Button } from '@/components/atoms/Button'
import { Checkbox } from '@/components/atoms/Checkbox'
import { Select, SelectItem } from '@/components/atoms/Select'
import { cn } from '@/lib/utils'

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
}

/**
 * 板块级操作工具条 — 全选 + 分组选择 + 批量加入按钮
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
}: HotSectorToolbarProps): React.JSX.Element {
  const allSelected = hotSectorsCount > 0 && selectedSectorsCount === hotSectorsCount

  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 border-border bg-muted/50')}>
      {/* 包裹可点击区域确保 checkbox 点击可靠。
          注意：外层 onClick 已处理所有点击事件，内部 Checkbox 仅做视觉展示，
          内部 onClick/onChange 都做屏蔽，避免 <label> 标签再次触发 click 事件导致双重 toggle。 */}
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
      <div className="ml-auto flex flex-wrap items-center gap-2">
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
