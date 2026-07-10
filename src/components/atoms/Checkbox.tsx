import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className={cn('flex items-center gap-2 text-sm', className)}>
        <input
          ref={ref}
          type="checkbox"
          className="h-4 w-4 rounded border-border bg-background text-primary accent-primary focus:ring-1 focus:ring-ring"
          {...props}
        />
        {label && <span className="text-foreground">{label}</span>}
      </label>
    )
  },
)
Checkbox.displayName = 'Checkbox'
