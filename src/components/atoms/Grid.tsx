/**
 * Grid — 栅格容器原子
 *
 * 支持响应式列数、间距、对齐。
 *
 * @module atoms/Grid
 * @since 2026-07-18 (P2 规划实现)
 */

import { type ReactNode, type HTMLAttributes } from 'react'

export interface GridProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 子元素 */
  children: ReactNode
  /** 列数（默认 12 栅格系统） */
  cols?: number
  /** 响应式列数覆盖: { sm, md, lg, xl } */
  responsive?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  /** 间距 */
  gap?: 'none' | 'sm' | 'md' | 'lg'
}

const gapMap: Record<string, string> = {
  none: 'gap-0', sm: 'gap-2', md: 'gap-4', lg: 'gap-6',
}

function responsiveClass(resp?: Record<string, number>): string {
  if (!resp) return ''
  const map: Record<string, string> = { sm: 'sm', md: 'md', lg: 'lg', xl: 'xl' }
  return Object.entries(resp)
    .map(([bp, cols]) => `${map[bp] ?? bp}:grid-cols-${cols}`)
    .join(' ')
}

/**
 * Grid
 */
export function Grid({
  children, cols = 1, responsive, gap = 'md',
  className = '', ...rest
}: GridProps) {
  return (
    <div
      className={`
        grid grid-cols-${cols} ${gapMap[gap] ?? gapMap.md}
        ${responsiveClass(responsive)}
        ${className}
      `}
      {...rest}
    >
      {children}
    </div>
  )
}
