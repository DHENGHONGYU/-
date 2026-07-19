/**
 * Pagination — 分页原子
 *
 * 受控页码/每页条数，显示页码按钮和首/末/前/后导航。
 *
 * @module atoms/Pagination
 * @since 2026-07-18 (P2 规划实现)
 */

import { type HTMLAttributes } from 'react'

export interface PaginationProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** 当前页码（1-based） */
  page: number
  /** 总页数 */
  total: number
  /** 页码变化回调 */
  onChange: (page: number) => void
  /** 每页条数 */
  pageSize?: number
  /** 每页条数变化回调 */
  onPageSizeChange?: (size: number) => void
  /** 可选每页条数 */
  pageSizeOptions?: number[]
  /** 是否显示每页条数选择器 */
  showSizeChanger?: boolean
}

function PageBtn({ active, disabled, onClick, label }: {
  active?: boolean; disabled?: boolean; onClick: () => void; label: string
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`
        inline-flex h-8 w-8 items-center justify-center rounded text-sm
        ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}
        ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
      `}
    >
      {label}
    </button>
  )
}

const ELLIPSIS = '…'

/**
 * Pagination
 */
export function Pagination({
  page, total, onChange, pageSize, onPageSizeChange,
  pageSizeOptions = [10, 20, 50], showSizeChanger = false,
  className = '', ...rest
}: PaginationProps) {
  if (total <= 1) return null

  const pages: (number | string)[] = []
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== ELLIPSIS) {
      pages.push(ELLIPSIS)
    }
  }

  return (
    <div className={`flex items-center gap-1 ${className}`} {...rest}>
      <PageBtn label="«" disabled={page === 1} onClick={() => onChange(1)} />
      <PageBtn label="‹" disabled={page === 1} onClick={() => onChange(page - 1)} />
      {pages.map((p, i) =>
        p === ELLIPSIS ? (
          <span key={`e-${i}`} className="inline-flex h-8 w-8 items-center justify-center text-sm text-muted-foreground">
            {ELLIPSIS}
          </span>
        ) : (
          <PageBtn key={p} label={String(p)} active={p === page} onClick={() => onChange(p as number)} />
        ),
      )}
      <PageBtn label="›" disabled={page === total} onClick={() => onChange(page + 1)} />
      <PageBtn label="»" disabled={page === total} onClick={() => onChange(total)} />

      {showSizeChanger && (
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          className="ml-3 h-8 rounded border bg-background px-2 text-xs"
          aria-label="每页条数"
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>{s} 条/页</option>
          ))}
        </select>
      )}
    </div>
  )
}
