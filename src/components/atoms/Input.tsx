/**
 * @fileoverview Input - 输入框组件（Atom层组件）
 * @module components/atoms/Input
 */

import { type InputHTMLAttributes, forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'
import { AlertCircle, Check } from 'lucide-react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 前缀元素（图标或文字） */
  startAdornment?: ReactNode
  /** 后缀元素（图标或文字） */
  endAdornment?: ReactNode
  /** 错误状态 */
  error?: boolean
  /** 成功状态 */
  success?: boolean
  /** 底部错误文案（error=true 时显示） */
  errorText?: string
  /** 底部辅助文案 */
  helperText?: string
}

/**
 * Input
 *
 * 状态：default / focus / disabled / readonly / error / success
 * 变体：前缀/后缀元素、组合输入
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      startAdornment,
      endAdornment,
      error,
      success,
      errorText,
      helperText,
      disabled,
      readOnly,
      ...props
    },
    ref,
  ) => {
    const inputId = props.id ?? props.name
    const describedBy = cn(
      error && errorText ? `${inputId}-error` : undefined,
      helperText ? `${inputId}-helper` : undefined,
    )

    return (
      <div className="w-full">
        <div
          className={cn(
            'relative flex w-full items-center overflow-hidden border bg-background',
            THEME_TOKENS.controlSizes.md,
            THEME_TOKENS.radius.md,
            'ring-offset-background',
            'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            {
              'border-destructive focus-within:ring-destructive': error,
              'border-success focus-within:ring-success': success && !error,
              'border-input': !error && !success,
              'bg-muted opacity-60': disabled,
              'bg-muted/50': readOnly,
            },
          )}
        >
          {startAdornment && (
            <span
              className={cn(
                'flex shrink-0 items-center justify-center pl-3 pr-2',
                COLOR_TOKENS.textMuted.tailwind,
              )}
            >
              {startAdornment}
            </span>
          )}
          <input
            ref={ref}
            type={type}
            disabled={disabled}
            readOnly={readOnly}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy || undefined}
            className={cn(
              'flex-1 bg-transparent outline-none',
              THEME_TOKENS.typography.fontSize.sm,
              'placeholder:text-muted-foreground',
              disabled && 'cursor-not-allowed',
              readOnly && 'cursor-default',
              // 组合输入：当存在前后缀时调整内边距
              !startAdornment && THEME_TOKENS.spacing.pxMd,
              !endAdornment && !success && !error && THEME_TOKENS.spacing.pxMd,
              // 右侧为图标/校验图标时保留空间
              (endAdornment != null || !!success || !!error) && 'pr-2',
              className,
            )}
            {...props}
          />
          {success && !error && (
            <span className="flex shrink-0 items-center justify-center pr-3 text-success">
              <Check className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          {error && (
            <span className="flex shrink-0 items-center justify-center pr-3 text-destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          {endAdornment && !success && !error && (
            <span
              className={cn(
                'flex shrink-0 items-center justify-center pr-3',
                COLOR_TOKENS.textMuted.tailwind,
              )}
            >
              {endAdornment}
            </span>
          )}
        </div>
        {error && errorText && (
          <p
            id={`${inputId}-error`}
            className={cn('mt-1.5 flex items-center gap-1 text-xs text-destructive')}
          >
            <AlertCircle className="h-3 w-3" />
            {errorText}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
