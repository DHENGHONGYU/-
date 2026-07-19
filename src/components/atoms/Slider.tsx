import { type InputHTMLAttributes, forwardRef, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  min?: number
  max?: number
  step?: number
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  showTooltip?: boolean
}

/**
 * Slider — 范围选择器（原子组件，包装原生 input[type=range]）
 *
 * @param props 组件 props
 * @param props.min 最小值，默认 0
 * @param props.max 最大值，默认 100
 * @param props.step 步进，默认 1
 * @param props.value 受控值
 * @param props.defaultValue 非受控初值
 * @param props.onValueChange 值变化回调
 * @param props.showTooltip 是否在拖拽时显示值提示（拖到容器外自动清理）
 * @param props.disabled 是否禁用
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    { className, min = 0, max = 100, step = 1, value, defaultValue, onValueChange, showTooltip = false, disabled, ...props },
    ref,
  ) => {
    const [internalValue, setInternalValue] = useState(defaultValue ?? min)
    const [isDragging, setIsDragging] = useState(false)

    const currentValue = value ?? internalValue
    const percentage = ((currentValue - min) / (max - min)) * 100

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(e.target.value)
        if (value === undefined) {
          setInternalValue(newValue)
        }
        onValueChange?.(newValue)
      },
      [value, onValueChange],
    )

    return (
      <div className={cn('relative flex w-full items-center', className)}>
        <div className="relative h-2 w-full rounded-full bg-secondary">
          <div
            className="absolute h-full rounded-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          disabled={disabled}
          className={cn(
            'absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md',
            '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-md',
          )}
          {...props}
        />
        {showTooltip && isDragging && (
          <div
            className="absolute -top-8 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow-md"
            style={{ left: `calc(${percentage}% - 1rem)` }}
          >
            {currentValue}
          </div>
        )}
      </div>
    )
  },
)

Slider.displayName = 'Slider'
