import React from 'react'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Checkbox } from '@/components/atoms/Checkbox'
import { cn } from '@/lib/utils'
import type { RankedSector } from '../hotSector.types'
import { getTimeliness } from '../hotSector.utils'
import { StockItem } from './StockItem'

export interface SectorCardProps {
  sector: RankedSector
  isSelected: boolean
  isExpanded: boolean
  selectedStocks: Set<string>
  addingAll: boolean
  addingHot: Set<string>
  existingSymbols: Set<string>
  onToggleSector: (sectorCode: string) => void
  onToggleExpand: (sectorCode: string) => void
  onToggleStock: (sectorCode: string, symbol: string) => void
  onToggleSelectAllStocksInSector: (sectorCode: string, willCheck: boolean) => void
  onAddAllHotStocks: (sectorCode: string) => void
  onAddHotStock: (symbol: string) => void
}

/**
 * 板块卡片 — 板块头部（勾选 + 名称 + 评分 + 展开） + 成分股展开区
 */
export function SectorCard({
  sector,
  isSelected,
  isExpanded,
  selectedStocks,
  addingAll,
  addingHot,
  existingSymbols,
  onToggleSector,
  onToggleExpand,
  onToggleStock,
  onToggleSelectAllStocksInSector,
  onAddAllHotStocks,
  onAddHotStock,
}: SectorCardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-md border transition-colors',
        isSelected
          ? 'border-info bg-info/10'
          : 'border-border',
      )}
    >
      {/* 板块头部：勾选 + 名称 + 评分 + 展开按钮 + 全部加入 */}
      <div className="flex items-center gap-3 p-3">
        {/* 包裹可点击区域确保 checkbox 点击可靠。
            注意：外层 onClick 已处理所有点击事件，内部 Checkbox 仅做视觉展示，
            将 onClick 绑定到原生 input 避免外层 <label> 再次触发 click */}
        <div
          className="cursor-pointer"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`选择板块 ${sector.name} (${sector.code})`}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onToggleSector(sector.code)
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Checkbox
            checked={isSelected}
            onChange={() => { /* 由外层 div onClick 统一处理，避免 label 触发二次 toggle */ }}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
            aria-label={`选择板块 ${sector.name} (${sector.code})`}
          />
        </div>
        <button
          onClick={() => onToggleExpand(sector.code)}
          className={cn('flex flex-1 items-center gap-2 text-left hover:text-foreground')}
        >
          <span className={cn('font-medium text-foreground')}>
            {sector.name}
          </span>
          <Badge
            className={
              sector.trend === 'up'
                ? 'bg-success/10 text-success'
                : sector.trend === 'down'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground'
            }
          >
            {sector.score}
          </Badge>
          {/* 考核标准·及时性：近一周评分标记 */}
          {(() => {
            const { timely, daysAgo } = getTimeliness(sector.scoreDate)
            if (timely) {
              return <Badge className="bg-success/10 text-success">近一周</Badge>
            }
            return (
              <Badge variant="secondary" className="text-muted-foreground">
                {daysAgo !== null ? `${daysAgo}天前` : '未标注日期'}
              </Badge>
            )
          })()}
          <span className={cn('text-xs text-muted-foreground/70')}>
            {sector.stocks.length} 只成分股
          </span>
          <svg
            className={cn('h-4 w-4 transition-transform', isExpanded ? 'rotate-90' : '', 'text-muted-foreground/70')}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void onAddAllHotStocks(sector.code)}
          disabled={addingAll}
          className="h-7 px-2 text-xs"
        >
          {addingAll ? '...' : '全部加入'}
        </Button>
      </div>

      {/* 成分股展开区（逐项选择） */}
      {isExpanded && (
        <div className={cn('border-t border-border')}>
          <div className="px-3 py-2">
            <div className={cn('mb-2 flex items-center gap-2 text-xs text-muted-foreground')}>
              {/* 包裹可点击区域确保 checkbox 点击可靠。
                  外层 onClick 统一处理所有点击事件，内部 Checkbox 仅做视觉展示。 */}
              <div
                className="cursor-pointer"
                role="checkbox"
                aria-checked={sector.stocks.length > 0 && selectedStocks.size === sector.stocks.length}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  const willCheck = !(sector.stocks.length > 0 && selectedStocks.size === sector.stocks.length)
                  onToggleSelectAllStocksInSector(sector.code, willCheck)
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <Checkbox
                  checked={sector.stocks.length > 0 && selectedStocks.size === sector.stocks.length}
                  onChange={() => { /* 由外层 div onClick 统一处理 */ }}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
                  aria-label={`全选 ${sector.name} 成分股`}
                />
              </div>
              <span>全选成分股</span>
            </div>
            <div className={cn('grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3', 'divide-border')}>
              {sector.stocks.map((stock) => (
                <StockItem
                  key={stock.symbol}
                  stock={stock}
                  sectorCode={sector.code}
                  isAdded={existingSymbols.has(stock.symbol)}
                  isAdding={addingHot.has(stock.symbol)}
                  isChecked={selectedStocks.has(stock.symbol)}
                  onToggleStock={onToggleStock}
                  onAddHotStock={onAddHotStock}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
