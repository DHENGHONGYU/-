import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <label className={cn('relative inline-flex cursor-pointer items-center', className)}>
      <input
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        {...props}
      />
      <span
        className={cn(
          'peer h-6 w-11 rounded-full bg-input transition-colors',
          'after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-background after:transition-transform after:content-[""]',
          'peer-checked:bg-primary peer-checked:after:translate-x-5',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        )}
      />
    </label>
  ),
)
Switch.displayName = 'Switch'
