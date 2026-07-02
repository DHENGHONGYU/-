import { createContext, forwardRef, memo, useContext, useMemo, useState, type HTMLAttributes, type LiHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface MenuContextValue {
  selectedKeys: string[]
  mode: 'horizontal' | 'vertical'
  onSelect: (key: string) => void
}

const MenuContext = createContext<MenuContextValue | null>(null)

function useMenu() {
  const ctx = useContext(MenuContext)
  if (!ctx) throw new Error('Menu components must be used within <Menu>')
  return ctx
}

export interface MenuProps extends Omit<HTMLAttributes<HTMLUListElement>, 'onSelect'> {
  selectedKeys?: string[]
  defaultSelectedKeys?: string[]
  mode?: 'horizontal' | 'vertical'
  onSelect?: (key: string) => void
}

export const Menu = memo(forwardRef<HTMLUListElement, MenuProps>(
  ({ selectedKeys, defaultSelectedKeys, mode = 'vertical', onSelect, className, children, ...props }, ref) => {
    const [internalKeys, setInternalKeys] = useState<string[]>(defaultSelectedKeys ?? [])
    const isControlled = selectedKeys !== undefined
    const activeKeys = isControlled ? selectedKeys : internalKeys

    const context = useMemo<MenuContextValue>(
      () => ({
        selectedKeys: activeKeys,
        mode,
        onSelect: (key: string) => {
          onSelect?.(key)
          if (!isControlled) setInternalKeys([key])
        },
      }),
      [activeKeys, mode, onSelect, isControlled],
    )

    return (
      <MenuContext.Provider value={context}>
        <ul
          ref={ref}
          role="menu"
          className={cn(
            'flex list-none p-0 m-0',
            mode === 'horizontal' ? 'flex-row items-center gap-1' : 'flex-col gap-1',
            className,
          )}
          {...props}
        >
          {children}
        </ul>
      </MenuContext.Provider>
    )
  },
))
Menu.displayName = 'Menu'

export interface MenuItemProps extends LiHTMLAttributes<HTMLLIElement> {
  key: string
  icon?: React.ReactNode
  disabled?: boolean
  onClick?: React.MouseEventHandler<HTMLLIElement>
}

export const MenuItem = memo(forwardRef<HTMLLIElement, MenuItemProps>(
  ({ className, icon, disabled, children, onClick, key: itemKey, ...props }, ref) => {
    const { selectedKeys, onSelect } = useMenu()
    const isSelected = selectedKeys.includes(itemKey)

    const handleClick = (e: React.MouseEvent<HTMLLIElement>) => {
      if (disabled) return
      onClick?.(e)
      onSelect(itemKey)
    }

    return (
      <li
        ref={ref}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick(e as never)
          }
        }}
        className={cn(
          'flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:bg-accent focus-visible:text-accent-foreground',
          isSelected && 'bg-accent text-accent-foreground',
          disabled && 'pointer-events-none opacity-50',
          className,
        )}
        {...props}
      >
        {icon && <span className="flex h-4 w-4 items-center justify-center">{icon}</span>}
        {children}
      </li>
    )
  },
))
MenuItem.displayName = 'MenuItem'

export interface SubMenuProps {
  key: string
  title: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
  children?: React.ReactNode
  className?: string
}

export const SubMenu = memo(forwardRef<HTMLLIElement, SubMenuProps>(
  ({ className, title, icon, disabled, children }, ref) => {
    const [open, setOpen] = useState(false)
    const { mode } = useMenu()

    const isHorizontal = mode === 'horizontal'

    return (
      <li
        ref={ref}
        role="menuitem"
        className={cn('relative', className)}
        onMouseEnter={() => isHorizontal && !disabled && setOpen(true)}
        onMouseLeave={() => isHorizontal && !disabled && setOpen(false)}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => !isHorizontal && !disabled && setOpen(!open)}
          className={cn(
            'flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'focus-visible:bg-accent focus-visible:text-accent-foreground',
            disabled && 'pointer-events-none opacity-50',
          )}
          aria-expanded={open}
        >
          {icon && <span className="flex h-4 w-4 items-center justify-center">{icon}</span>}
          <span className="flex-1 text-left">{title}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </button>
        {open && (
          <ul
            role="menu"
            className={cn(
              'min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
              isHorizontal ? 'absolute left-0 top-full z-50 mt-1' : 'ml-4 mt-1',
            )}
          >
            {children}
          </ul>
        )}
      </li>
    )
  },
))
SubMenu.displayName = 'SubMenu'