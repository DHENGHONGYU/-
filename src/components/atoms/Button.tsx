/**
 * @fileoverview Button - 按钮组件（Atom层组件）
 * @module components/atoms/Button
 */

import { type ButtonHTMLAttributes, cloneElement, forwardRef, isValidElement } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'
import { Loader2 } from 'lucide-react'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'danger'
  | 'danger-outline'
  | 'danger-ghost'
  | 'success'
  | 'default'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  asChild?: boolean
  isLoading?: boolean
}

/**
 * Button
 *
 * 变体：primary / secondary / outline / ghost / link
 * 危险操作三态：danger（实心） / danger-outline / danger-ghost
 * 状态：default / hover / focus / pressed / disabled / loading
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', asChild, isLoading, disabled, children, ...props },
    ref,
  ) => {
    const isDisabled = disabled || isLoading

    const classes = cn(
      'inline-flex items-center justify-center font-medium transition-colors duration-200 ease-out',
      THEME_TOKENS.radius.md,
      // 焦点环：2px ring + 2px offset（背景色），保证对比度
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'disabled:pointer-events-none disabled:opacity-60',
      // pressed 微动效
      'active:scale-[0.98]',
      {
        'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'primary',
        'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
        'border border-input bg-background hover:bg-accent hover:text-accent-foreground':
          variant === 'outline',
        'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
        'text-primary underline-offset-4 hover:underline': variant === 'link',
        // default：中性实心按钮，基于 surface-2 语义令牌，明暗模式一致
        'bg-surface-2 text-foreground hover:bg-surface-2/80': variant === 'default',
        // 危险操作三态
        'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'danger',
        'border border-destructive bg-background text-destructive hover:bg-destructive/10':
          variant === 'danger-outline',
        'text-destructive hover:bg-destructive/10': variant === 'danger-ghost',
        // success
        'bg-success text-success-foreground hover:bg-success/90': variant === 'success',
      },
      {
        [`${THEME_TOKENS.controlSizes.sm} px-3 ${THEME_TOKENS.typography.fontSize.sm}`]: size === 'sm',
        [`${THEME_TOKENS.controlSizes.md} ${THEME_TOKENS.spacing.pxMd} ${THEME_TOKENS.typography.fontSize.sm}`]: size === 'md',
        [`${THEME_TOKENS.controlSizes.lg} ${THEME_TOKENS.spacing.pxLg} ${THEME_TOKENS.typography.fontSize.base}`]: size === 'lg',
      },
      className,
    )

    // loading spinner 尺寸与图标一致
    const spinnerSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'

    const content = isLoading ? (
      <>
        <Loader2 className={cn('animate-spin opacity-90', spinnerSize)} aria-hidden="true" />
        {/* 保留文字内容作为占位，避免宽度跳动；视觉上仍可读 */}
        <span className="opacity-90">{children}</span>
      </>
    ) : (
      children
    )

    if (asChild && isValidElement(children)) {
      return cloneElement(children, {
        className: cn(classes, (children.props as { className?: string }).className),
        ref,
        ...props,
      } as never)
    }

    return (
      <button ref={ref} className={classes} disabled={isDisabled} {...props}>
        {content}
      </button>
    )
  },
)

Button.displayName = 'Button'
