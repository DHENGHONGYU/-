import React from 'react'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Checkbox } from '@/components/atoms/Checkbox'
import { cn } from '@/lib/utils'
import type { HotSectorStock } from '@/services/input/hotSectorService'

export interface StockItemProps {
  stock: HotSectorStock
  sectorCode: string
  isAdded: boolean
  isAdding: boolean
  isChecked: boolean
  onToggleStock: (sectorCode: string, symbol: string) => void
  onAddHotStock: (symbol: string) => void
}

/**
 * 成分股行 — 单只股票的勾选 + 加入按钮
 */
export function StockItem({
  stock,
  sectorCode,
  isAdded,
  isAdding,
  isChecked,
  onToggleStock,
  onAddHotStock,
}: StockItemProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1.5 text-sm',
        'hover:bg-muted/50',
      )}
    >
      {/* 包裹可点击区域确保 checkbox 点击可靠。
          外层 onClick 统一处理所有点击事件，内部 Checkbox 仅做视觉展示。 */}
      <div
        className={cn(isAdded ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}
        role="checkbox"
        aria-checked={isChecked}
        aria-disabled={isAdded}
        onClick={(e) => {
          if (isAdded) return
          e.stopPropagation()
          e.preventDefault()
          onToggleStock(sectorCode, stock.symbol)
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <Checkbox
          checked={isChecked}
          onChange={() => { /* 由外层 div onClick 统一处理 */ }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
          disabled={isAdded}
          aria-label={`选择 ${stock.symbol}`}
        />
      </div>
      <span className={cn('font-mono text-xs text-foreground')}>
        {stock.symbol}
      </span>
      <span className={cn('flex-1 truncate text-xs text-muted-foreground')}>
        {stock.name}
      </span>
      {isAdded ? (
        <Badge variant="secondary" className="text-[10px]">已加入</Badge>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void onAddHotStock(stock.symbol)}
          disabled={isAdding}
          className="h-6 px-1.5 text-[11px]"
        >
          {isAdding ? '...' : '加入'}
        </Button>
      )}
    </div>
  )
}
