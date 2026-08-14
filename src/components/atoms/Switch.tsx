/**
 * @fileoverview Switch Atom层组件（Atom层组件）
 * @module components/atoms/Switch
 */

import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  /** onChange 接收模拟 event 对象（兼容 e.target.checked 用法） */
  onChange?: (e: { target: { checked: boolean } }) => void
  disabled?: boolean
}

/**
 * Switch — 开关切换
 *
 * API: { checked, onChange, aria-label }
 * onChange 接收 { target: { checked } } 以兼容 e.target.checked 用法。
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onChange, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.({ target: { checked: !checked } })}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
        'border-2 border-transparent transition-colors',
        THEME_TOKENS.focusVisible.ringWidth,
        THEME_TOKENS.focusVisible.ringColor,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  ),
)

Switch.displayName = 'Switch'
