import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS, HOVER } from '@/constants/theme.tokens'

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

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

    const variantTokens: Record<BadgeVariant, string> = {
      default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
      secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
      outline: COLOR_TOKENS.textPrimary.tailwind,
      destructive: `border-transparent ${COLOR_TOKENS.danger.bgClass} text-white ${HOVER.bgRed600}`,
      success: `border-transparent ${COLOR_TOKENS.success.bgClass} text-white ${HOVER.bgGreen800}`,
      warning: `border-transparent ${COLOR_TOKENS.warning.bgClass} text-white ${HOVER.bgAmber800}`,
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
