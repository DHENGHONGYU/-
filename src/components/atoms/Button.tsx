import { type ButtonHTMLAttributes, cloneElement, forwardRef, isValidElement } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'default'
  size?: 'sm' | 'md' | 'lg'
  asChild?: boolean
  isLoading?: boolean
}

/**
 * Button
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild, children, ...props }, ref) => {
    const classes = cn(
      'inline-flex items-center justify-center font-medium transition-colors',
      THEME_TOKENS.radius.md,
      // 焦点环必须带 focus-visible: 前缀，否则 ring-2/ring-blue-500 会常驻显示（原缺陷：所有按钮恒显蓝色环）
      // 对齐 Input.tsx 的规范写法
      'focus-visible:outline-none',
      `focus-visible:${THEME_TOKENS.focusVisible.ringWidth}`,
      `focus-visible:${THEME_TOKENS.focusVisible.ringColor}`,
      'disabled:pointer-events-none disabled:opacity-50',
      {
        'bg-primary text-primary-foreground hover:bg-primary/90':
          variant === 'primary',
        'bg-secondary text-secondary-foreground hover:bg-secondary/80':
          variant === 'secondary',
        'border border-input bg-background hover:bg-accent hover:text-accent-foreground':
          variant === 'outline',
        'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
        // default：中性实心按钮，基于 surface-2 语义令牌，明暗模式一致
        'bg-surface-2 text-foreground hover:bg-surface-2/80':
          variant === 'default',
        // danger / success 改用语义令牌（bg-destructive / bg-success），明暗一致；
        // 原为硬编码 Tailwind 调色板裸类（bg-red-500 / bg-green-700），非主题感知
        'bg-destructive text-destructive-foreground hover:bg-destructive/90':
          variant === 'danger',
        'bg-success text-success-foreground hover:bg-success/90':
          variant === 'success',
      },
      {
        [`${THEME_TOKENS.controlSizes.sm} ${THEME_TOKENS.spacing.pxSm} ${THEME_TOKENS.typography.fontSize.sm}`]: size === 'sm',
        [`${THEME_TOKENS.controlSizes.md} ${THEME_TOKENS.spacing.pxMd} ${THEME_TOKENS.typography.fontSize.sm}`]: size === 'md',
        [`${THEME_TOKENS.controlSizes.lg} ${THEME_TOKENS.spacing.pxLg} ${THEME_TOKENS.typography.fontSize.base}`]: size === 'lg',
      },
      className,
    )

    if (asChild && isValidElement(children)) {
      return cloneElement(children, {
        className: cn(classes, (children.props as { className?: string }).className),
        ref,
        ...props,
      } as never)
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
