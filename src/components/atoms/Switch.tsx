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
  /** 开关尺寸，默认 'md' */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Switch — 开关切换
 *
 * API: { checked, onChange, aria-label }
 * onChange 接收 { target: { checked } } 以兼容 e.target.checked 用法。
 */
const sizeConfig = {
  sm: {
    track: 'h-5 w-9',
    thumb: 'h-4 w-4',
    translate: 'translate-x-4',
  },
  md: {
    track: 'h-6 w-11',
    thumb: 'h-5 w-5',
    translate: 'translate-x-5',
  },
  lg: {
    track: 'h-7 w-14',
    thumb: 'h-6 w-6',
    translate: 'translate-x-7',
  },
} as const

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onChange, disabled, size = 'md', ...props }, ref) => {
    const s = sizeConfig[size]
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.({ target: { checked: !checked } })}
        className={cn(
          'peer inline-flex shrink-0 cursor-pointer items-center rounded-full',
          s.track,
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
            'pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform',
            s.thumb,
            checked ? s.translate : 'translate-x-0',
          )}
        />
      </button>
    )
  },
)

Switch.displayName = 'Switch'
