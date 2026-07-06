/**
 * @module Pagination
 * @description 标准后台分页组件。支持每页条数切换、页码跳转、前后翻页。
 * 所有配置值从 @/constants/trade.constants 引用，禁止硬编码。
 */

import React, { useCallback, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import {
  PAGINATION_DEFAULTS,
  PAGINATION_MAX_VISIBLE,
} from '@/constants/trade.constants'
import type { PaginationState, PaginationHandlers } from '@/types/modules/trade.types'

interface PaginationProps {
  /** 分页状态 */
  pagination: PaginationState
  /** 分页操作回调 */
  handlers: PaginationHandlers
}

export default function Pagination({ pagination, handlers }: PaginationProps): React.JSX.Element {
  const { page, pageSize, total } = pagination
  const { onPageChange, onPageSizeChange } = handlers
  const [jumpValue, setJumpValue] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  /** 计算可见页码范围 */
  const getVisiblePages = useCallback((): number[] => {
    const half = Math.floor(PAGINATION_MAX_VISIBLE / 2)
    let start = Math.max(1, page - half)
    const end = Math.min(totalPages, start + PAGINATION_MAX_VISIBLE - 1)
    if (end - start + 1 < PAGINATION_MAX_VISIBLE) {
      start = Math.max(1, end - PAGINATION_MAX_VISIBLE + 1)
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [page, totalPages])

  const handleJump = useCallback(() => {
    const target = parseInt(jumpValue, 10)
    if (isNaN(target) || target < 1 || target > totalPages) return
    onPageChange(target)
    setJumpValue('')
  }, [jumpValue, totalPages, onPageChange])

  const handleJumpKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleJump()
    },
    [handleJump],
  )

  const visiblePages = getVisiblePages()

  return (
    <div className="flex items-center justify-between border-t px-2 py-3">
      {/* 左侧：总条数 + 每页条数 */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          共 {total} 条
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">每页</span>
          <Select
            aria-label="每页显示条数"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number((e.target as HTMLSelectElement).value))}
            className="h-8 w-20"
          >
            {PAGINATION_DEFAULTS.PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={String(size)}>
                {size}
              </option>
            ))}
          </Select>
          <span className="text-sm text-muted-foreground">条</span>
        </div>
      </div>

      {/* 右侧：翻页控制 */}
      <div className="flex items-center gap-1">
        {/* 上一页 */}
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* 页码 */}
        {visiblePages.map((p) => (
          <Button
            key={p}
            variant={p === page ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onPageChange(p)}
            className="h-8 w-8 p-0 text-sm"
          >
            {p}
          </Button>
        ))}

        {/* 下一页 */}
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* 跳转 */}
        <div className="ml-3 flex items-center gap-1">
          <span className="text-sm text-muted-foreground">跳至</span>
          <input
            type="text"
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value.replace(/\D/g, ''))}
            onKeyDown={handleJumpKeyDown}
            placeholder="..."
            aria-label="跳转到页码"
            className="h-8 w-12 rounded-md border border-input bg-background px-2 text-center text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleJump}
            className="h-8 px-2 text-xs"
          >
            跳转
          </Button>
        </div>
      </div>
    </div>
  )
}