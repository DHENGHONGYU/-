/**
 * @fileoverview Table - 表格组件（Atom层组件）
 * @module components/atoms/Table
 */

import { type HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'

/**
 * Table 系列组件 — 标准数据表格
 *
 * 用法：
 * <Table>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead>列标题</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell>单元格</TableCell>
 *     </TableRow>
 *   </TableBody>
 * </Table>
 */

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  ),
)
Table.displayName = 'Table'

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
  ),
)
TableHeader.displayName = 'TableHeader'

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  ),
)
TableBody.displayName = 'TableBody'

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = 'TableRow'

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-10 px-2 text-left align-middle font-medium text-muted-foreground',
        THEME_TOKENS.typography.fontSize.sm,
        '[&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  ),
)
TableHead.displayName = 'TableHead'

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        'p-2 align-middle',
        THEME_TOKENS.typography.fontSize.sm,
        '[&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  ),
)
TableCell.displayName = 'TableCell'
