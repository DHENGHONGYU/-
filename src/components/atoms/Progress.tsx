/**
 * @fileoverview Progress Atom层组件（Atom层组件）
 * @module components/atoms/Progress
 */

import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  label?: string
  showMax?: boolean
}

/**
 * Progress
 */
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 5, label, showMax = true, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))

    return (
      <div
        ref={ref}
        className={cn('w-full space-y-1', className)}
        {...props}
      >
        {label && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{label}</span>
            {showMax && <span>{value.toFixed(1)} / {max}</span>}
          </div>
        )}
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  },
)

Progress.displayName = 'Progress'
