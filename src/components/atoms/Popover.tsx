import { type HTMLAttributes, type ReactNode, forwardRef, memo, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export type PopoverPlacement = 'top' | 'bottom' | 'left' | 'right'
export type PopoverTrigger = 'click' | 'hover' | 'focus'

export interface PopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  /** 触发方式 */
  trigger?: PopoverTrigger
  /** 浮层内容 */
  content: ReactNode
  /** 浮层位置 */
  placement?: PopoverPlacement
  /** 触发元素 */
  children: ReactNode
  /** 是否默刻显示 */
  defaultOpen?: boolean
}

const placementClasses: Record<PopoverPlacement, string> = {
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
}

/**
 * Popover
 */
export const Popover = memo(forwardRef<HTMLDivElement, PopoverProps>(
  ({
    className,
    trigger = 'click',
    content,
    placement = 'bottom',
    children,
    defaultOpen = false,
    ...props
  }, ref) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    const popoverRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (!isOpen) return

      const handleClickOutside = (event: MouseEvent) => {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(event.target as Node) &&
          !triggerRef.current?.contains(event.target as Node)
        ) {
          setIsOpen(false)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    const handleTrigger = () => {
      setIsOpen((prev) => !prev)
    }

    const handleMouseEnter = () => {
      if (trigger === 'hover') setIsOpen(true)
    }

    const handleMouseLeave = () => {
      if (trigger === 'hover') setIsOpen(false)
    }

    const handleFocus = () => {
      if (trigger === 'focus') setIsOpen(true)
    }

    const handleBlur = () => {
      if (trigger === 'focus') setIsOpen(false)
    }

    return (
      <div
        ref={ref}
        className={cn('relative inline-block', className)}
        {...props}
      >
        <div
          ref={triggerRef}
          onClick={trigger === 'click' ? handleTrigger : undefined}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          {children}
        </div>
        {isOpen && (
          <div
            ref={popoverRef}
            className={cn(
              'absolute z-50 min-w-[200px] rounded-md border bg-popover p-4 text-popover-foreground shadow-md',
              'animate-in fade-in-0 zoom-in-95',
              placementClasses[placement],
            )}
            style={{ transformOrigin: 'center' }}
          >
            {content}
          </div>
        )}
      </div>
    )
  },
))

Popover.displayName = 'Popover'
