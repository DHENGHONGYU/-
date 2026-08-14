/**
 * @fileoverview Tooltip - 工具提示组件（Atom层组件）
 * @module components/atoms/Tooltip
 */

import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'

export interface TooltipProps {
  content: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
  className?: string
}

const sideClasses: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1',
}

/**
 * Tooltip — 轻量级悬浮提示
 *
 * API: { content, side, children }
 * 纯 CSS hover 实现，无第三方依赖。
 */
export function Tooltip({ content, side = 'top', children, className }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && content != null && (
        <span
          role="tooltip"
          className={cn(
            'absolute z-50 whitespace-nowrap rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md',
            'pointer-events-none',
            sideClasses[side],
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
