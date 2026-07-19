/**
 * Menu — 下拉菜单原子
 *
 * 受控打开/关闭，支持键盘导航（Escape 关闭）。
 *
 * @module atoms/Menu
 * @since 2026-07-18 (P2 规划实现)
 */

import { type ReactNode, type HTMLAttributes, useEffect, useRef } from 'react'

export interface MenuItem {
  key: string
  label: ReactNode
  disabled?: boolean
  danger?: boolean
  onClick?: () => void
}

export interface MenuProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 菜单项列表 */
  items: MenuItem[]
  /** 是否打开 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
}

/**
 * Menu
 */
export function Menu({ items, open, onClose, className = '', ...rest }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      role="menu"
      className={`absolute z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md ${className}`}
      {...rest}
    >
      {items.map((item) => (
        <button
          key={item.key}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => { item.onClick?.(); onClose() }}
          className={`
            flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none
            ${item.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent hover:text-accent-foreground'}
            ${item.danger ? 'text-destructive' : ''}
          `}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
