/**
 * @module HoldingsFilter
 * @description 持仓列表筛选区组件。支持日期范围、交易方向、关键字搜索，高级筛选可折叠收起。
 * 所有枚举值、标签文本从 @/constants/trade.constants 引用，禁止硬编码。
 */

import React, { useCallback } from 'react'
import { Search, RotateCcw, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { TRADE_DIRECTION_OPTIONS } from '@/constants/trade.constants'
import type { FilterState, FilterHandlers } from '@/types/modules/trade.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface HoldingsFilterProps {
  /** 筛选状态 */
  filter: FilterState
  /** 筛选操作回调 */
  handlers: FilterHandlers
  /** 是否加载中 */
  isExporting: boolean
}

export default function HoldingsFilter({
  filter,
  handlers,
  isExporting,
}: HoldingsFilterProps): React.JSX.Element {
  const handleSearch = useCallback(() => {
    logger.info('[HoldingsFilter] 执行筛选搜索', { filter })
    handlers.onSearch()
  }, [handlers, filter])

  const handleReset = useCallback(() => {
    logger.info('[HoldingsFilter] 重置筛选条件', { currentFilter: filter })
    handlers.onReset()
  }, [handlers, filter])

  const handleExport = useCallback(() => {
    logger.info('[HoldingsFilter] 导出持仓数据', { filter, isExporting })
    handlers.onExport()
  }, [handlers, filter, isExporting])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch()
    },
    [handleSearch],
  )

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* 开始日期 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">开始日期</label>
            <input
              type="date"
              value={filter.startDate}
              onChange={handleSearch}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          {/* 结束日期 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">结束日期</label>
            <input
              type="date"
              value={filter.endDate}
              onChange={handleSearch}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          {/* 交易方向 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">交易方向</label>
            <select
              value={filter.direction}
              onChange={handleSearch}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {TRADE_DIRECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 搜索关键词 */}
          <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">证券代码/名称</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={filter.keyword}
                onChange={handleSearch}
                onKeyDown={handleKeyDown}
                placeholder="输入代码或名称搜索..."
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSearch}>
              <Search className="mr-1 h-4 w-4" />
              搜索
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-1 h-4 w-4" />
              重置
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
              <Download className="mr-1 h-4 w-4" />
              {isExporting ? '导出中...' : '导出 Excel'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}