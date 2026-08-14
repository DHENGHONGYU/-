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
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const baseTokens = {
      radius: THEME_TOKENS.radius.full,
      border: THEME_TOKENS.color.border,
      paddingX: 'px-2.5',
      paddingY: 'py-0.5',
      fontSize: THEME_TOKENS.typography.fontSize.xs,
      fontWeight: THEME_TOKENS.typography.fontWeight.semibold,
      transition: 'transition-colors',
    }

    // 全部改用主题感知的语义令牌（bg-destructive / bg-success / bg-warning + -foreground），
    // 明暗模式一致；原为硬编码 Tailwind 调色板裸类（bg-red-500 / bg-green-700 / bg-amber-500 + text-white），
    // 与 Button 的语义令牌口径统一。outline 用 border-border + text-foreground 保持主题感知。
    const variantTokens: Record<BadgeVariant, string> = {
      default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
      secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
      outline: 'border-border text-foreground',
      destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
      success: 'border-transparent bg-success text-success-foreground hover:bg-success/80',
      warning: 'border-transparent bg-warning text-warning-foreground hover:bg-warning/80',
    }

    // 样式计算已完成，不再输出调试日志

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center',
          baseTokens.radius,
          baseTokens.border,
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
