import { cn } from '@/lib/utils'

export interface TooltipProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'content'> {
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ children, content, side = 'top', className, ...props }: TooltipProps) {
  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div className={cn('group relative inline-flex', className)} {...props}>
      {children}
      <div
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-xs rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md',
          'opacity-0 transition-opacity group-hover:opacity-100',
          sideClasses[side],
        )}
      >
        {content}
      </div>
    </div>
  )
}
