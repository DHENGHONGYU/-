import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      radius: THEME_TOKENS.radius.lg,
      background: COLOR_TOKENS.bgCard.tailwind,
      border: 'border shadow-sm',
    }
    logger.info('[Card] 样式计算', { tokens, className })
    return (
      <div
        ref={ref}
        className={cn(
          tokens.radius,
          tokens.border,
          tokens.background,
          'text-card-foreground',
          className,
        )}
        {...props}
      />
    )
  },
)

Card.displayName = 'Card'

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      stackGap: THEME_TOKENS.stackGap.sm,
      padding: THEME_TOKENS.spacing.lg,
    }
    logger.info('[CardHeader] 样式计算', { tokens, className })
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

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      fontSize: THEME_TOKENS.typography.fontSize.lg,
      fontWeight: THEME_TOKENS.typography.fontWeight.semibold,
      lineHeight: THEME_TOKENS.typography.lineHeight.none,
      letterSpacing: THEME_TOKENS.typography.letterSpacing.tight,
    }
    logger.info('[CardTitle] 样式计算', { tokens, className })
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

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      fontSize: THEME_TOKENS.typography.fontSize.sm,
      color: COLOR_TOKENS.textMuted.tailwind,
    }
    logger.info('[CardDescription] 样式计算', { tokens, className })
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

export const CardAction = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      gap: THEME_TOKENS.gap.sm,
    }
    logger.info('[CardAction] 样式计算', { tokens, className })
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

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      padding: THEME_TOKENS.spacing.lg,
    }
    logger.info('[CardContent] 样式计算', { tokens, className })
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

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const tokens = {
      padding: THEME_TOKENS.spacing.lg,
    }
    logger.info('[CardFooter] 样式计算', { tokens, className })
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
