import { type TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'

/**
 * Textarea — 多行文本输入
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex w-full border border-input bg-background',
        THEME_TOKENS.controlSizes.md,
        THEME_TOKENS.radius.md,
        THEME_TOKENS.spacing.pxMd,
        THEME_TOKENS.spacing.pyMd,
        THEME_TOKENS.typography.fontSize.sm,
        `placeholder:${COLOR_TOKENS.textMuted.tailwind}`,
        'focus-visible:outline-none',
        `focus-visible:${THEME_TOKENS.focusVisible.ringWidth}`,
        `focus-visible:${THEME_TOKENS.focusVisible.ringColor}`,
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)

Textarea.displayName = 'Textarea'
