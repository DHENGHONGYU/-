import { type ButtonHTMLAttributes, cloneElement, forwardRef, isValidElement } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'default'
  size?: 'sm' | 'md' | 'lg'
  asChild?: boolean
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild, children, ...props }, ref) => {
    const classes = cn(
      'inline-flex items-center justify-center font-medium transition-colors',
      THEME_TOKENS.radius.md,
      'focus-visible:outline-none',
      THEME_TOKENS.focusVisible.ringWidth,
      THEME_TOKENS.focusVisible.ringColor,
      'disabled:pointer-events-none disabled:opacity-50',
      {
        'bg-primary text-primary-foreground hover:bg-primary/90':
          variant === 'primary',
        'bg-secondary text-secondary-foreground hover:bg-secondary/80':
          variant === 'secondary',
        'border border-input bg-background hover:bg-accent hover:text-accent-foreground':
          variant === 'outline',
        'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
        [`${COLOR_TOKENS.danger.bgClass} text-white hover:opacity-90`]:
          variant === 'danger',
        [`${COLOR_TOKENS.success.bgClass} text-white hover:opacity-90`]:
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
