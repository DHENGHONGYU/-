import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  pressed: boolean
  onPressedChange?: (pressed: boolean) => void
  variant?: 'default' | 'outline'
  disabled?: boolean
}

/**
 * Toggle — 双态切换按钮
 *
 * API: { pressed, onPressedChange, children }
 * 类似 shadcn Toggle，pressed 控制激活态。
 */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, pressed, onPressedChange, disabled, variant = 'default', children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onPressedChange?.(!pressed)}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 transition-colors',
        THEME_TOKENS.radius.md,
        THEME_TOKENS.controlSizes.md,
        THEME_TOKENS.spacing.pxMd,
        THEME_TOKENS.typography.fontSize.sm,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'outline' && 'border border-input bg-background hover:bg-accent',
        pressed
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : variant === 'outline'
            ? 'text-foreground'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)

Toggle.displayName = 'Toggle'
