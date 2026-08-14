/**
 * @fileoverview Slider Atom层组件（Atom层组件）
 * @module components/atoms/Slider
 */

import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface SliderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  id?: string
  min?: number
  max?: number
  step?: number
  value: number
  showTooltip?: boolean
  onValueChange?: (value: number) => void
  disabled?: boolean
}

/**
 * Slider — 范围滑动条
 *
 * API: { min, max, step, value, showTooltip, onValueChange, className }
 * 基于 input[type=range]，纯原生无第三方依赖。
 */
export const Slider = forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      className,
      id,
      min = 0,
      max = 100,
      step = 1,
      value,
      showTooltip = false,
      onValueChange,
      disabled,
      ...props
    },
    ref,
  ) => {
    const percentage = ((value - min) / (max - min)) * 100

    return (
      <div
        ref={ref}
        className={cn('relative flex w-full items-center', className)}
        {...props}
      >
        {showTooltip && (
          <span
            className="absolute -top-6 z-10 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground"
            style={{ left: `${percentage}%` }}
          >
            {value}
          </span>
        )}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onValueChange?.(Number(e.target.value))}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
            '[&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:shadow',
            '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0',
          )}
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) ${percentage}%, hsl(var(--secondary)) ${percentage}%)`,
          }}
        />
      </div>
    )
  },
)

Slider.displayName = 'Slider'
