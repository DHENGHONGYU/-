import { type HTMLAttributes, forwardRef, memo } from 'react'
import { cn } from '@/lib/utils'

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** 栅格间距 */
  gap?: number | string
}

export interface RowProps extends HTMLAttributes<HTMLDivElement> {
  /** 是否自动换行 */
  wrap?: boolean
}

export interface ColProps extends HTMLAttributes<HTMLDivElement> {
  /** 栅格占比 (1-24) */
  span?: number
  /** 偏移量 (0-24) */
  offset?: number
}

export const Grid = memo(forwardRef<HTMLDivElement, GridProps>(
  ({ className, gap = 16, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('grid', className)}
      style={{ gap: typeof gap === 'number' ? `${gap}px` : gap, ...style }}
      {...props}
    />
  ),
))

Grid.displayName = 'Grid'

export const Row = memo(forwardRef<HTMLDivElement, RowProps>(
  ({ className, wrap = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex', wrap && 'flex-wrap', className)}
      {...props}
    />
  ),
))

Row.displayName = 'Row'

export const Col = memo(forwardRef<HTMLDivElement, ColProps>(
  ({ className, span = 24, offset = 0, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex-shrink-0',
        className,
      )}
      style={{
        width: `${(span / 24) * 100}%`,
        marginLeft: offset ? `${(offset / 24) * 100}%` : undefined,
      }}
      {...props}
    />
  ),
))

Col.displayName = 'Col'
