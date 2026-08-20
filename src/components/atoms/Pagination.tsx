/**
 * @fileoverview Pagination - 分页组件（Atom层组件）
 * @module components/atoms/Pagination
 */

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'

export interface PaginationProps {
  /** 当前页码（从1开始） */
  page: number
  /** 总页数 */
  totalPages: number
  /** 每页显示条数（可选，用于显示"每页 N 条"选择器） */
  pageSize?: number
  /** 每页条数可选项（可选，传了则显示选择器） */
  pageSizeOptions?: number[]
  /** 总条目数（可选，用于显示"共 N 条"） */
  totalItems?: number
  /** 页码变化回调 */
  onPageChange: (page: number) => void
  /** 每页条数变化回调 */
  onPageSizeChange?: (pageSize: number) => void
  /** 显示模式：'full' 完整分页 | 'simple' 仅上下页 | 'numeric' 数字页码 */
  variant?: 'full' | 'simple' | 'numeric'
  /** 自定义类名 */
  className?: string
}

// ============================================================
// 页码生成辅助函数
// ============================================================

/**
 * 生成要显示的页码列表，使用 'ellipsis' 标记省略号位置。
 * 策略：首末页始终显示，当前页附近显示 1 个邻居，间隙处插入省略号。
 */
function getPageNumbers(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: Array<number | 'ellipsis'> = []

  // 始终显示第一页
  pages.push(1)

  // 左侧省略号判断
  if (page > 3) {
    pages.push('ellipsis')
  }

  // 当前页附近的页码（从 max(2, page-1) 到 min(totalPages-1, page+1)）
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  // 右侧省略号判断
  if (page < totalPages - 2) {
    pages.push('ellipsis')
  }

  // 始终显示最后一页
  pages.push(totalPages)

  return pages
}

// ============================================================
// 子组件：页码按钮
// ============================================================

interface PageButtonProps {
  onClick?: () => void
  disabled?: boolean
  isActive?: boolean
  'aria-label'?: string
  children: React.ReactNode
}

function PageButton({
  onClick,
  disabled,
  isActive,
  children,
  ...props
}: PageButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center text-sm font-medium transition-colors',
        THEME_TOKENS.radius.md,
        'border border-border',
        // 焦点环
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        {
          // 当前页
          'bg-primary text-primary-foreground border-primary': isActive,
          // 非当前页
          'bg-background text-foreground hover:bg-muted': !isActive && !disabled,
          // 禁用态
          'opacity-50 cursor-not-allowed pointer-events-none': disabled,
        },
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ============================================================
// 子组件：省略号
// ============================================================

function PageEllipsis() {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center text-muted-foreground"
    >
      <MoreHorizontal className={THEME_TOKENS.iconSizes.sm} />
    </span>
  )
}

// ============================================================
// 主组件：Pagination
// ============================================================

/**
 * Pagination
 *
 * 三种显示模式：
 * - full：完整分页（首尾页跳转 + 上下页 + 数字页码 + 每页条数选择器 + 总条目数）
 * - simple：仅上下页 + 范围显示
 * - numeric：数字页码 + 上下页
 *
 * 页码按钮尺寸：32×32px（h-8 w-8），圆角 md，边框 border
 */
export function Pagination({
  page,
  totalPages,
  pageSize,
  pageSizeOptions,
  totalItems,
  onPageChange,
  onPageSizeChange,
  variant = 'full',
  className,
}: PaginationProps) {
  const safePage = Math.max(1, Math.min(page, totalPages))
  const isFirstPage = safePage <= 1
  const isLastPage = safePage >= totalPages

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === safePage) return
    onPageChange(nextPage)
  }

  const handleFirst = () => handlePageChange(1)
  const handlePrev = () => handlePageChange(safePage - 1)
  const handleNext = () => handlePageChange(safePage + 1)
  const handleLast = () => handlePageChange(totalPages)

  // simple 模式：仅上下页 + 范围显示
  if (variant === 'simple') {
    const startItem = totalItems ? (safePage - 1) * (pageSize ?? 10) + 1 : null
    const endItem = totalItems
      ? Math.min(safePage * (pageSize ?? 10), totalItems)
      : null

    return (
      <nav
        role="navigation"
        aria-label="分页"
        className={cn(
          'flex items-center justify-between text-sm',
          className,
        )}
      >
        <span className="text-muted-foreground">
          {totalItems != null && startItem != null && endItem != null
            ? `第 ${startItem}-${endItem} 条，共 ${totalItems} 条`
            : `第 ${safePage} 页，共 ${totalPages} 页`}
        </span>
        <div className="flex items-center gap-2">
          <PageButton
            onClick={handlePrev}
            disabled={isFirstPage}
            aria-label="上一页"
          >
            <ChevronLeft className={THEME_TOKENS.iconSizes.sm} />
          </PageButton>
          <PageButton
            onClick={handleNext}
            disabled={isLastPage}
            aria-label="下一页"
          >
            <ChevronRight className={THEME_TOKENS.iconSizes.sm} />
          </PageButton>
        </div>
      </nav>
    )
  }

  // numeric 模式：数字页码 + 上下页
  if (variant === 'numeric') {
    const pages = getPageNumbers(safePage, totalPages)

    return (
      <nav
        role="navigation"
        aria-label="分页"
        className={cn('flex items-center gap-1', className)}
      >
        <PageButton
          onClick={handlePrev}
          disabled={isFirstPage}
          aria-label="上一页"
        >
          <ChevronLeft className={THEME_TOKENS.iconSizes.sm} />
        </PageButton>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <PageEllipsis key={`ellipsis-${i}`} />
          ) : (
            <PageButton
              key={p}
              isActive={p === safePage}
              onClick={() => handlePageChange(p)}
              aria-label={`第 ${p} 页`}
            >
              {p}
            </PageButton>
          ),
        )}

        <PageButton
          onClick={handleNext}
          disabled={isLastPage}
          aria-label="下一页"
        >
          <ChevronRight className={THEME_TOKENS.iconSizes.sm} />
        </PageButton>
      </nav>
    )
  }

  // full 模式：完整分页
  const pages = getPageNumbers(safePage, totalPages)

  return (
    <nav
      role="navigation"
      aria-label="分页"
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 text-sm',
        className,
      )}
    >
      {/* 左侧：共 N 条 */}
      <div className="text-muted-foreground">
        {totalItems != null ? `共 ${totalItems} 条` : null}
      </div>

      {/* 中间：页码导航 */}
      <div className="flex items-center gap-1">
        <PageButton
          onClick={handleFirst}
          disabled={isFirstPage}
          aria-label="第一页"
        >
          <ChevronsLeft className={THEME_TOKENS.iconSizes.sm} />
        </PageButton>

        <PageButton
          onClick={handlePrev}
          disabled={isFirstPage}
          aria-label="上一页"
        >
          <ChevronLeft className={THEME_TOKENS.iconSizes.sm} />
        </PageButton>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <PageEllipsis key={`ellipsis-${i}`} />
          ) : (
            <PageButton
              key={p}
              isActive={p === safePage}
              onClick={() => handlePageChange(p)}
              aria-label={`第 ${p} 页`}
            >
              {p}
            </PageButton>
          ),
        )}

        <PageButton
          onClick={handleNext}
          disabled={isLastPage}
          aria-label="下一页"
        >
          <ChevronRight className={THEME_TOKENS.iconSizes.sm} />
        </PageButton>

        <PageButton
          onClick={handleLast}
          disabled={isLastPage}
          aria-label="最后一页"
        >
          <ChevronsRight className={THEME_TOKENS.iconSizes.sm} />
        </PageButton>
      </div>

      {/* 右侧：每页条数选择器 */}
      {pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground whitespace-nowrap">每页</span>
          <div className="relative">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={cn(
                'h-8 appearance-none rounded-md border border-border bg-background px-2 pr-7 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
              aria-label="每页条数"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <ChevronRight
              className={cn(
                'pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rotate-90 opacity-50',
                THEME_TOKENS.iconSizes.xs,
              )}
            />
          </div>
          <span className="text-muted-foreground whitespace-nowrap">条</span>
        </div>
      ) : null}
    </nav>
  )
}

Pagination.displayName = 'Pagination'
