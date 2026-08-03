import { type HTMLAttributes, forwardRef, useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface SliderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  id?: string
  min?: number
  max?: number
  step?: number
  /** 受控值（优先级高于 defaultValue） */
  value?: number
  /** 非受控默认值（未传 value 时生效，默认 0） */
  defaultValue?: number
  showTooltip?: boolean
  onValueChange?: (value: number) => void
  disabled?: boolean
}

/**
 * Slider — 范围滑动条
 *
 * API: { min, max, step, value, defaultValue, showTooltip, onValueChange, className }
 * 基于 input[type=range]，纯原生无第三方依赖。
 *
 * - 受控模式：传入 `value`，由父组件管理状态
 * - 非受控模式：传入 `defaultValue`（或都不传，默认 0），由组件内部管理状态
 * - `showTooltip=true` 时，tooltip 仅在拖拽（mouseDown 期间）显示
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
      defaultValue = 0,
      showTooltip = false,
      onValueChange,
      disabled,
      ...props
    },
    ref,
  ) => {
    // 非受控模式下的内部状态（初始为 undefined，通过 fallback 链取默认值）
    // 使用 undefined 初始值避免 useState 在跨渲染时不复用初始值的问题
    const [internalValue, setInternalValue] = useState<number | undefined>(undefined)
    // tooltip 仅在拖拽期间显示
    const [isDragging, setIsDragging] = useState(false)
    // 用于判定 mouseUp 是否由 pointer 真实抬起触发（避免 programmatic 触发误判）
    const draggingRef = useRef(false)

    const isControlled = value !== undefined
    const currentValue = isControlled ? value : (internalValue ?? defaultValue)

    const percentage = max === min ? 0 : ((currentValue - min) / (max - min)) * 100

    const handleChange = useCallback(
      (next: number) => {
        if (!isControlled) {
          setInternalValue(next)
        }
        onValueChange?.(next)
      },
      [isControlled, onValueChange],
    )

    const handleMouseDown = useCallback(() => {
      draggingRef.current = true
      setIsDragging(true)
    }, [])

    const handleMouseUp = useCallback(() => {
      if (draggingRef.current) {
        draggingRef.current = false
        setIsDragging(false)
      }
    }, [])

    const showTooltipNow = showTooltip && isDragging

    return (
      <div
        ref={ref}
        className={cn('relative flex w-full items-center', className)}
        {...props}
      >
        {showTooltipNow && (
          <span
            className="absolute -top-6 z-10 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground"
            style={{ left: `${percentage}%` }}
          >
            {currentValue}
          </span>
        )}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          disabled={disabled}
          onChange={(e) => handleChange(Number(e.target.value))}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
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
