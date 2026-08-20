/**
 * @fileoverview DropdownMenu - 下拉菜单组件（Atom层组件）
 * @module components/atoms/DropdownMenu
 */

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  forwardRef,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from 'react'
import { Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'

// ============================================================
// Context
// ============================================================

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null)

function useDropdownMenu() {
  const ctx = useContext(DropdownMenuContext)
  if (!ctx) {
    throw new Error('DropdownMenu components must be used within a <DropdownMenu>')
  }
  return ctx
}

// ============================================================
// RadioGroup Context（用于 DropdownMenuRadioItem）
// ============================================================

interface DropdownMenuRadioGroupContextValue {
  value: string
  onValueChange: (value: string) => void
}

const DropdownMenuRadioGroupContext = createContext<DropdownMenuRadioGroupContextValue | null>(null)

function useDropdownMenuRadioGroup() {
  return useContext(DropdownMenuRadioGroupContext)
}

// ============================================================
// DropdownMenu — 根容器
// ============================================================

export interface DropdownMenuProps {
  children: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * DropdownMenu — 下拉菜单根容器
 *
 * 复合组件模式，通过 Context 向子组件下发 open 状态与引用。
 */
export function DropdownMenu({ children, open: controlledOpen, defaultOpen = false, onOpenChange }: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next)
    }
    onOpenChange?.(next)
  }

  // 点击外部关闭
  useEffect(() => {
    if (!open) return

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        contentRef.current &&
        !contentRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    // 使用 setTimeout 避免触发点击立即关闭（当由点击 trigger 打开时）
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleDocumentClick)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, setOpen])

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className="relative inline-block">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}
DropdownMenu.displayName = 'DropdownMenu'

// ============================================================
// DropdownMenuTrigger — 触发器
// ============================================================

export interface DropdownMenuTriggerProps {
  children: ReactNode
  asChild?: boolean
}

/**
 * DropdownMenuTrigger — 下拉菜单触发器
 */
export const DropdownMenuTrigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps & ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, asChild = false, className, onClick, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useDropdownMenu()

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e as unknown as React.MouseEvent<HTMLButtonElement>)
      setOpen(!open)
    }

    // 合并 ref
    const setRefs = (node: HTMLButtonElement | null) => {
      ;(triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ;(ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
      }
    }

    if (asChild && isValidElement(children)) {
      // asChild 模式：将 props 克隆到唯一子元素
      const child = children as React.ReactElement
      const existingOnClick = (child.props as { onClick?: (e: React.MouseEvent) => void }).onClick

      return cloneElement(child, {
        ref: setRefs,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        onClick: (e: React.MouseEvent) => {
          existingOnClick?.(e)
          setOpen(!open)
        },
      } as React.HTMLAttributes<HTMLElement>)
    }

    return (
      <button
        ref={setRefs}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center justify-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
          className,
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    )
  },
)
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

// ============================================================
// DropdownMenuContent — 菜单内容面板
// ============================================================

export interface DropdownMenuContentProps {
  children: ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

const alignClasses: Record<NonNullable<DropdownMenuContentProps['align']>, string> = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
}

/**
 * DropdownMenuContent — 下拉菜单内容面板
 */
export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ children, className, align = 'end', sideOffset = 4 }, ref) => {
    const { open, setOpen, contentRef, triggerRef } = useDropdownMenu()

    const getEnabledMenuItems = () => {
      const content = contentRef.current
      if (!content) return []
      return Array.from(content.querySelectorAll<HTMLElement>('[role^="menuitem"]')).filter((item) => {
        return item.getAttribute('aria-disabled') !== 'true' && !item.hasAttribute('disabled') && item.tabIndex !== -1
      })
    }

    const focusItem = (items: HTMLElement[], index: number) => {
      const item = items[index]
      if (item) item.focus()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!open) return

      const items = getEnabledMenuItems()
      if (items.length === 0) return

      const activeIndex = items.findIndex((item) => item === document.activeElement)
      const currentIndex = activeIndex >= 0 ? activeIndex : 0

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          const nextIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1
          focusItem(items, nextIndex)
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1
          focusItem(items, prevIndex)
          break
        }
        case 'Home': {
          e.preventDefault()
          focusItem(items, 0)
          break
        }
        case 'End': {
          e.preventDefault()
          focusItem(items, items.length - 1)
          break
        }
        case 'Escape': {
          e.preventDefault()
          setOpen(false)
          triggerRef.current?.focus()
          break
        }
        case 'Tab': {
          // 关闭菜单并将焦点移回 trigger，让默认 Tab / Shift+Tab 行为继续
          setOpen(false)
          triggerRef.current?.focus()
          break
        }
        default: {
          // 字母键快速搜索（单字母循环）
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const char = e.key.toLowerCase()
            const startIndex = activeIndex >= 0 ? activeIndex + 1 : 0
            const orderedItems = items.slice(startIndex).concat(items.slice(0, startIndex))
            const match = orderedItems.find((item) =>
              item.textContent?.trim().toLowerCase().startsWith(char),
            )
            if (match) {
              e.preventDefault()
              match.focus()
            }
          }
          break
        }
      }
    }

    // 菜单打开后自动聚焦第一个可用项
    useEffect(() => {
      if (!open) return
      const rafId = requestAnimationFrame(() => {
        const items = getEnabledMenuItems()
        if (items.length > 0) {
          focusItem(items, 0)
        }
      })
      return () => cancelAnimationFrame(rafId)
    }, [open])

    const setRefs = (node: HTMLDivElement | null) => {
      ;(contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ;(ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      }
    }

    if (!open) return null

    return (
      <div
        ref={setRefs}
        role="menu"
        data-state={open ? 'open' : 'closed'}
        tabIndex={-1}
        style={{ marginTop: `${sideOffset}px` }}
        onKeyDown={handleKeyDown}
        className={cn(
          'absolute z-50 min-w-[180px] p-1 rounded-lg',
          'bg-popover border border-border',
          'shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.12)]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'outline-none',
          alignClasses[align],
          className,
        )}
      >
        {children}
      </div>
    )
  },
)
DropdownMenuContent.displayName = 'DropdownMenuContent'

// ============================================================
// DropdownMenuItem — 菜单项
// ============================================================

export interface DropdownMenuItemProps {
  children: ReactNode
  className?: string
  disabled?: boolean
  onClick?: () => void
  inset?: boolean
}

/**
 * DropdownMenuItem — 下拉菜单项
 */
export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps & HTMLAttributes<HTMLDivElement>>(
  ({ children, className, disabled = false, onClick, inset = false, ...props }, ref) => {
    const { setOpen } = useDropdownMenu()

    const handleClick = () => {
      if (disabled) return
      onClick?.()
      setOpen(false)
    }

    return (
      <div
        ref={ref}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        className={cn(
          'relative flex items-center h-8 py-1.5 px-3 rounded-md text-sm',
          'cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
          'hover:bg-muted/80 hover:text-foreground',
          inset && 'pl-8',
          disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
          className,
        )}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        {...props}
      >
        {children}
      </div>
    )
  },
)
DropdownMenuItem.displayName = 'DropdownMenuItem'

// ============================================================
// DropdownMenuCheckboxItem — 多选菜单项
// ============================================================

export interface DropdownMenuCheckboxItemProps {
  children: ReactNode
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

/**
 * DropdownMenuCheckboxItem — 多选下拉菜单项
 */
export const DropdownMenuCheckboxItem = forwardRef<HTMLDivElement, DropdownMenuCheckboxItemProps & HTMLAttributes<HTMLDivElement>>(
  ({ children, checked, onCheckedChange, disabled = false, className, ...props }, ref) => {
    const toggle = () => {
      if (disabled) return
      onCheckedChange?.(!checked)
    }

    return (
      <div
        ref={ref}
        role="menuitemcheckbox"
        aria-checked={checked}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          'relative flex items-center h-8 py-1.5 pl-8 pr-3 rounded-md text-sm',
          'cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
          'hover:bg-muted/80 hover:text-foreground',
          checked && 'bg-primary/10 text-primary',
          disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
          className,
        )}
        onClick={toggle}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        {...props}
      >
        <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
          {checked && <Check className={THEME_TOKENS.iconSizes.sm} />}
        </span>
        {children}
      </div>
    )
  },
)
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem'

// ============================================================
// DropdownMenuRadioItem — 单选菜单项
// ============================================================

export interface DropdownMenuRadioItemProps {
  children: ReactNode
  value: string
  disabled?: boolean
  className?: string
}

/**
 * DropdownMenuRadioItem — 单选下拉菜单项
 *
 * 需配合 DropdownMenuRadioGroup 使用。
 */
export const DropdownMenuRadioItem = forwardRef<HTMLDivElement, DropdownMenuRadioItemProps & HTMLAttributes<HTMLDivElement>>(
  ({ children, value, disabled = false, className, ...props }, ref) => {
    const radioCtx = useDropdownMenuRadioGroup()
    const { setOpen } = useDropdownMenu()

    const checked = radioCtx ? radioCtx.value === value : false

    const handleSelect = () => {
      if (disabled) return
      radioCtx?.onValueChange(value)
    }

    return (
      <div
        ref={ref}
        role="menuitemradio"
        aria-checked={checked}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          'relative flex items-center h-8 py-1.5 pl-8 pr-3 rounded-md text-sm',
          'cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
          'hover:bg-muted/80 hover:text-foreground',
          checked && 'bg-primary/10 text-primary',
          disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
          className,
        )}
        onClick={handleSelect}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSelect()
            setOpen(false)
          }
        }}
        {...props}
      >
        <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
          {checked && <Circle className="h-2 w-2 fill-current" />}
        </span>
        {children}
      </div>
    )
  },
)
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem'

// ============================================================
// DropdownMenuLabel — 分组标题
// ============================================================

export interface DropdownMenuLabelProps {
  children: ReactNode
  className?: string
}

/**
 * DropdownMenuLabel — 菜单分组标题
 */
export const DropdownMenuLabel = forwardRef<HTMLDivElement, DropdownMenuLabelProps & HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-3 py-2 text-xs font-medium uppercase text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)
DropdownMenuLabel.displayName = 'DropdownMenuLabel'

// ============================================================
// DropdownMenuSeparator — 分割线
// ============================================================

export interface DropdownMenuSeparatorProps {
  className?: string
}

/**
 * DropdownMenuSeparator — 菜单分割线
 */
export const DropdownMenuSeparator = forwardRef<HTMLDivElement, DropdownMenuSeparatorProps & HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={cn('h-px bg-border my-1', className)}
      {...props}
    />
  ),
)
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

// ============================================================
// DropdownMenuShortcut — 快捷键文字
// ============================================================

export interface DropdownMenuShortcutProps {
  children: ReactNode
  className?: string
}

/**
 * DropdownMenuShortcut — 快捷键提示文字
 *
 * 通常放在 DropdownMenuItem 的最右侧。
 */
export const DropdownMenuShortcut = forwardRef<HTMLSpanElement, DropdownMenuShortcutProps & HTMLAttributes<HTMLSpanElement>>(
  ({ children, className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn('ml-auto text-xs text-muted-foreground', className)}
      {...props}
    >
      {children}
    </span>
  ),
)
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut'

// ============================================================
// DropdownMenuGroup — 菜单分组
// ============================================================

/**
 * DropdownMenuGroup — 菜单分组容器
 *
 * 纯语义分组，用于将相关菜单项组织在一起。
 * 当用于单选分组时，提供 value + onValueChange 以支持 RadioItem。
 */
export interface DropdownMenuGroupProps {
  children: ReactNode
  className?: string
  value?: string
  onValueChange?: (value: string) => void
}

export const DropdownMenuGroup = forwardRef<HTMLDivElement, DropdownMenuGroupProps & HTMLAttributes<HTMLDivElement>>(
  ({ children, className, value, onValueChange, ...props }, ref) => {
    // 如果提供了 value，则作为 RadioGroup 上下文提供者
    const isRadioGroup = value !== undefined

    if (isRadioGroup && onValueChange !== undefined) {
      return (
        <DropdownMenuRadioGroupContext.Provider value={{ value, onValueChange }}>
          <div ref={ref} role="group" className={cn('', className)} {...props}>
            {children}
          </div>
        </DropdownMenuRadioGroupContext.Provider>
      )
    }

    return (
      <div ref={ref} role="group" className={cn('', className)} {...props}>
        {children}
      </div>
    )
  },
)
DropdownMenuGroup.displayName = 'DropdownMenuGroup'
