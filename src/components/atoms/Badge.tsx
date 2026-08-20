/**
 * @fileoverview Badge - 徽章组件（Atom层组件）
 * @module components/atoms/Badge
 */

import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

/**
 * Badge
 *
 * 状态色使用规范：低浓度背景（8-15%）+ 同色边框（25-30%）+ 100% 图标文字。
 * 避免大面积实心状态色块，保持视觉清爽。
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const baseTokens = {
      radius: THEME_TOKENS.radius.full,
      paddingX: 'px-2.5',
      paddingY: 'py-0.5',
      fontSize: THEME_TOKENS.typography.fontSize.xs,
      fontWeight: THEME_TOKENS.typography.fontWeight.semibold,
      transition: 'transition-colors',
    }

    // 低浓度背景 + 同色边框 + 100% 文字，符合 V9 状态色使用规范
    const variantTokens: Record<BadgeVariant, string> = {
      default:
        'border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15',
      secondary:
        'border border-secondary-foreground/20 bg-secondary text-secondary-foreground hover:bg-secondary/80',
      outline:
        'border border-border bg-background text-foreground hover:bg-muted',
      destructive:
        'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15',
      success:
        'border border-success/30 bg-success/10 text-success hover:bg-success/15',
      warning:
        'border border-warning/30 bg-warning/10 text-warning hover:bg-warning/15',
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center',
          baseTokens.radius,
          baseTokens.paddingX,
          baseTokens.paddingY,
          baseTokens.fontSize,
          baseTokens.fontWeight,
          baseTokens.transition,
          variantTokens[variant],
          className,
        )}
        {...props}
      />
    )
  },
)

Badge.displayName = 'Badge'
