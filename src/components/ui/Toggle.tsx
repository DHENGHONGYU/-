import { type ButtonHTMLAttributes, forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface ToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  variant?: 'default' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      className,
      pressed,
      defaultPressed = false,
      onPressedChange,
      variant = 'default',
      size = 'md',
      children,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [internalPressed, setInternalPressed] = useState(defaultPressed)
    const isPressed = pressed !== undefined ? pressed : internalPressed

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const next = !isPressed
      if (pressed === undefined) {
        setInternalPressed(next)
      }
      onPressedChange?.(next)
      onClick?.(e)
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={isPressed}
        data-state={isPressed ? 'on' : 'off'}
        onClick={handleClick}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-transparent text-muted-foreground hover:bg-muted hover:text-muted-foreground':
              variant === 'default' && !isPressed,
            'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default' && isPressed,
            'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground':
              variant === 'outline' && !isPressed,
            'border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80':
              variant === 'outline' && isPressed,
          },
          {
            'h-8 px-2 text-xs': size === 'sm',
            'h-10 px-3 text-sm': size === 'md',
            'h-12 px-4 text-base': size === 'lg',
          },
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)

Toggle.displayName = 'Toggle'
