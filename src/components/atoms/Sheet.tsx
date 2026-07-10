import { type ButtonHTMLAttributes, type HTMLAttributes, forwardRef, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export interface SheetProps extends HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'left' | 'right' | 'top' | 'bottom'
}

export const Sheet = forwardRef<HTMLDivElement, SheetProps>(
  ({ className, open, onOpenChange, side = 'right', children, ...props }, ref) => {
    const internalRef = useRef<HTMLDivElement>(null)
    const sheetRef = (ref as React.RefObject<HTMLDivElement>) || internalRef

    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && open) {
          onOpenChange?.(false)
        }
      }
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }, [open, onOpenChange])

    const sideClasses = {
      left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm data-[state=open]:animate-in data-[state=open]:slide-in-from-left',
      right:
        'inset-y-0 right-0 h-full w-3/4 max-w-sm data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
      top: 'inset-x-0 top-0 w-full h-auto max-h-[50vh] data-[state=open]:animate-in data-[state=open]:slide-in-from-top',
      bottom:
        'inset-x-0 bottom-0 w-full h-auto max-h-[50vh] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
    }

    if (!open) return <></>

    return (
      <div className="fixed inset-0 z-50">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => onOpenChange?.(false)}
          data-testid="sheet-overlay"
        />
        <div
          ref={sheetRef}
          data-state={open ? 'open' : 'closed'}
          className={cn(
            'fixed z-50 gap-4 bg-background p-6 shadow-lg',
            sideClasses[side],
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    )
  },
)
Sheet.displayName = 'Sheet'

export const SheetContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-4', className)} {...props}>
      {children}
    </div>
  ),
)
SheetContent.displayName = 'SheetContent'

export const SheetHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-2', className)} {...props} />
  ),
)
SheetHeader.displayName = 'SheetHeader'

export const SheetFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
  ),
)
SheetFooter.displayName = 'SheetFooter'

export const SheetTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn('text-lg font-semibold text-foreground', className)} {...props} />
  ),
)
SheetTitle.displayName = 'SheetTitle'

export const SheetDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
)
SheetDescription.displayName = 'SheetDescription'

export const SheetClose = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity',
        'hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className,
      )}
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  ),
)
SheetClose.displayName = 'SheetClose'
