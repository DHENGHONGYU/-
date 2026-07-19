/**
 * Popover — 气泡浮层原子
 *
 * 纯 CSS hover/focus 实现，支持四方向定位与自定义内容。
 * 不依赖第三方 Popover 库，适用于简单 tooltip-like 场景。
 *
 * @module atoms/Popover
 * @since 2026-07-18 (P2 规划实现)
 */

import { type HTMLAttributes, type ReactNode } from 'react'

export interface PopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  /** 浮层内容（必填） */
  content: ReactNode
  /** 弹出方向 */
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** 触发元素 */
  children: ReactNode
}

const sideClasses: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

/**
 * Popover
 */
export function Popover({ content, side = 'top', children, className = '', ...rest }: PopoverProps) {
  return (
    <div className={`relative inline-block group ${className}`} {...rest}>
      {children}
      <div
        role="tooltip"
        className={`
          absolute z-50 opacity-0 group-hover:opacity-100 transition-opacity
          pointer-events-none rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md
          ${sideClasses[side] ?? sideClasses.top}
        `}
      >
        {content}
      </div>
    </div>
  )
}
