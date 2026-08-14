/**
 * @fileoverview Label Atom层组件（Atom层组件）
 * @module components/atoms/Label
 */

import { type LabelHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  optional?: boolean
}

/**
 * Label
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, optional, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-sm font-medium leading-none',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    >
      {children}
      {optional && (
        <span className="ml-1 text-xs text-muted-foreground">(可选)</span>
      )}
    </label>
  ),
)

Label.displayName = 'Label'
