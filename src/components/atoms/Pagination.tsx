import { forwardRef, memo, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface PaginationProps {
  total: number
  pageSize?: number
  current?: number
  onChange?: (page: number) => void
  className?: string
}

function generatePages(current: number, totalPages: number): (number | 'ellipsis-start' | 'ellipsis-end')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = []

  pages.push(1)

  if (current <= 3) {
    for (let i = 2; i <= 5; i++) pages.push(i)
    pages.push('ellipsis-end')
  } else if (current >= totalPages - 2) {
    pages.push('ellipsis-start')
    for (let i = totalPages - 4; i < totalPages; i++) pages.push(i)
  } else {
    pages.push('ellipsis-start')
    pages.push(current - 1, current, current + 1)
    pages.push('ellipsis-end')
  }

  pages.push(totalPages)

  return pages
}

export const Pagination = memo(forwardRef<HTMLDivElement, PaginationProps>(
  ({ total, pageSize = 10, current = 1, onChange, className }, ref) => {
    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

    const safeCurrent = useMemo(() => {
      if (current < 1) return 1
      if (current > totalPages) return totalPages
      return current
    }, [current, totalPages])

    const pages = useMemo(() => generatePages(safeCurrent, totalPages), [safeCurrent, totalPages])

    const handlePageChange = useCallback(
      (page: number) => {
        if (page < 1 || page > totalPages || page === safeCurrent) return
        onChange?.(page)
      },
      [totalPages, safeCurrent, onChange],
    )

    if (total === 0) return <></>

    return (
      <nav ref={ref} role="navigation" aria-label="pagination" className={cn('flex items-center gap-1', className)}>
        <button
          type="button"
          disabled={safeCurrent <= 1}
          onClick={() => handlePageChange(safeCurrent - 1)}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md text-sm',
            'hover:bg-accent hover:text-accent-foreground',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((page, index) => {
          if (page === 'ellipsis-start' || page === 'ellipsis-end') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground"
                aria-hidden="true"
              >
                ...
              </span>
            )
          }

          const isActive = page === safeCurrent
          return (
            <button
              key={page}
              type="button"
              disabled={isActive}
              onClick={() => handlePageChange(page)}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-md text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                isActive && 'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:pointer-events-none',
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`第 ${page} 页`}
            >
              {page}
            </button>
          )
        })}

        <button
          type="button"
          disabled={safeCurrent >= totalPages}
          onClick={() => handlePageChange(safeCurrent + 1)}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md text-sm',
            'hover:bg-accent hover:text-accent-foreground',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <span className="ml-2 text-sm text-muted-foreground">
          共 {total} 条
        </span>
      </nav>
    )
  },
))
Pagination.displayName = 'Pagination'