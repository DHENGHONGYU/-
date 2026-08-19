/**
 * @fileoverview Card - 卡片组件（Atom层组件）
 * @module components/atoms/Card
 */

import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'

/**
 * Card - Apple 风格卡片组件
 * @description 使用纯白背景、16px 圆角、轻微阴影和优雅的悬停过渡
 * 符合 Apple Human Interface Guidelines：
 *   - 背景: 纯白 (#FFFFFF)
 *   - 圆角: 16px (1rem)
 *   - 阴影: 静态 alpha ≤ 0.05, 悬停 alpha ≤ 0.08
 *   - 过渡: 200ms ease-in-out
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      radius: THEME_TOKENS.radius.lg,
      background: COLOR_TOKENS.bgCard.tailwind,
    }
    return (
      <div
        ref={ref}
        className={cn(
          tokens.radius,
          tokens.background,
          'text-card-foreground shadow-elevation-1 transition-shadow duration-200 hover:shadow-elevation-2',
          className,
        )}
        {...props}
      />
    )
  },
)

Card.displayName = 'Card'

/**
 * CardHeader
 */
export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      stackGap: THEME_TOKENS.stackGap.sm,
      padding: THEME_TOKENS.spacing.lg,
    }
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col',
          tokens.stackGap,
          tokens.padding,
          className,
        )}
        {...props}
      />
    )
  },
)

CardHeader.displayName = 'CardHeader'

/**
 * CardTitle
 */
export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      fontSize: THEME_TOKENS.typography.fontSize.lg,
      fontWeight: THEME_TOKENS.typography.fontWeight.semibold,
      lineHeight: THEME_TOKENS.typography.lineHeight.none,
      letterSpacing: THEME_TOKENS.typography.letterSpacing.tight,
    }
    return (
      <h3
        ref={ref}
        className={cn(
          tokens.fontSize,
          tokens.fontWeight,
          tokens.lineHeight,
          tokens.letterSpacing,
          className,
        )}
        {...props}
      />
    )
  },
)

CardTitle.displayName = 'CardTitle'

/**
 * CardDescription
 */
export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      fontSize: THEME_TOKENS.typography.fontSize.sm,
      color: COLOR_TOKENS.textMuted.tailwind,
    }
    return (
      <p
        ref={ref}
        className={cn(
          tokens.fontSize,
          tokens.color,
          className,
        )}
        {...props}
      />
    )
  },
)

CardDescription.displayName = 'CardDescription'

/**
 * CardAction
 */
export const CardAction = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      gap: THEME_TOKENS.gap.sm,
    }
    return (
      <div
        ref={ref}
        className={cn(
          'ml-auto flex items-center',
          tokens.gap,
          className,
        )}
        {...props}
      />
    )
  },
)

CardAction.displayName = 'CardAction'

/**
 * CardContent
 */
export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      padding: THEME_TOKENS.spacing.lg,
    }
    return (
      <div
        ref={ref}
        className={cn(tokens.padding, 'pt-0', className)}
        {...props}
      />
    )
  },
)

CardContent.displayName = 'CardContent'

/**
 * CardFooter
 */
export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      padding: THEME_TOKENS.spacing.lg,
    }
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center',
          tokens.padding,
          'pt-0',
          className,
        )}
        {...props}
      />
    )
  },
)

CardFooter.displayName = 'CardFooter'
