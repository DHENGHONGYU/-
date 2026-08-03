import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type SkeletonVariant = 'text' | 'rect' | 'circle'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant
}

/**
 * Skeleton — 骨架屏占位
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'rect', ...props }, ref) => {
    const variantClasses: Record<SkeletonVariant, string> = {
      text: 'h-4 w-full rounded',
      rect: 'rounded-md',
      circle: 'rounded-full',
    }

    return (
      <div
        ref={ref}
        className={cn('animate-pulse bg-muted', variantClasses[variant], className)}
        {...props}
      />
    )
  },
)

Skeleton.displayName = 'Skeleton'
