/**
 * @fileoverview Input - 输入框组件（Atom层组件）
 * @module components/atoms/Input
 */

import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'

/**
 * Input
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex w-full border border-input bg-background',
        THEME_TOKENS.controlSizes.md,
        THEME_TOKENS.radius.md,
        THEME_TOKENS.spacing.pxMd,
        THEME_TOKENS.spacing.pyMd,
        THEME_TOKENS.typography.fontSize.sm,
        'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium',
        `placeholder:${COLOR_TOKENS.textMuted.tailwind}`,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)

Input.displayName = 'Input'
