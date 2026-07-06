import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS, HOVER } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

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

    logger.info('[Badge] 渲染开始', { 
      variant, 
      className,
      baseTokens: {
        radius: baseTokens.radius,
        border: baseTokens.border,
        paddingX: baseTokens.paddingX,
        paddingY: baseTokens.paddingY,
        fontSize: baseTokens.fontSize,
        fontWeight: baseTokens.fontWeight,
        transition: baseTokens.transition
      }
    })

    logger.info('[Badge] Token 取值详情', {
      THEME_TOKENS_radius_full: THEME_TOKENS.radius.full,
      THEME_TOKENS_color_border: THEME_TOKENS.color.border,
      THEME_TOKENS_typography_fontSize_xs: THEME_TOKENS.typography.fontSize.xs,
      THEME_TOKENS_typography_fontWeight_semibold: THEME_TOKENS.typography.fontWeight.semibold,
      COLOR_TOKENS_textPrimary_tailwind: COLOR_TOKENS.textPrimary.tailwind,
      COLOR_TOKENS_danger_bgClass: COLOR_TOKENS.danger.bgClass,
      COLOR_TOKENS_success_bgClass: COLOR_TOKENS.success.bgClass,
      COLOR_TOKENS_warning_bgClass: COLOR_TOKENS.warning.bgClass,
      variantTokenValue: variantTokens[variant]
    })

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
