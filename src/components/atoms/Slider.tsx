/**
 * @fileoverview Slider Atom层组件（Atom层组件）
 * @module components/atoms/Slider
 */

import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * 基础属性（两种 mode 共享）
 */
interface SliderBaseProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  id?: string
  min?: number
  max?: number
  step?: number
  showTooltip?: boolean
  disabled?: boolean
}

/**
 * 单端滑块模式（默认）
 */
interface SliderSingleProps extends SliderBaseProps {
  mode?: 'single'
  value: number
  onValueChange?: (value: number) => void
}

/**
 * 范围选择模式（双端滑块）
 */
interface SliderRangeProps extends SliderBaseProps {
  mode: 'range'
  value: [number, number]
  onValueChange?: (value: [number, number]) => void
}

/**
 * 联合类型：根据 mode 区分 value / onValueChange 的类型
 */
export type SliderProps = SliderSingleProps | SliderRangeProps

/**
 * Slider — 范围滑动条
 *
 * API: { min, max, step, value, mode, showTooltip, onValueChange, className }
 * 基于 input[type=range]，纯原生无第三方依赖。
 *
 * - mode='single'（默认）：单端滑块，value 为 number
 * - mode='range'：双端滑块，value 为 [number, number] 元组
 */
export const Slider = forwardRef<HTMLDivElement, SliderProps>(
  (props, ref) => {
    // 先解构共享属性（不在判别联合类型区分范围内）
    const {
      className,
      id,
      min = 0,
      max = 100,
      step = 1,
      showTooltip = false,
      disabled,
    } = props

    // ==================== 单端模式（默认）—— 保持原有实现完全一致 ====================
    // 使用 props.mode 直接收窄，让 TypeScript 正确推导 value / onValueChange 类型
    if (props.mode === undefined || props.mode === 'single') {
      const { value, onValueChange, ...restProps } = props
      const percentage = ((value - min) / (max - min)) * 100

      return (
        <div
          ref={ref}
          className={cn('relative flex w-full items-center', className)}
          {...restProps}
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
    }

    // ==================== 范围模式（双端滑块）====================
    // mode 既非 undefined 也非 'single'，必为 'range'，断言安全
    const rangeProps = props as SliderRangeProps
    const { value: rangeValue, onValueChange, ...restProps } = rangeProps
    const minPercent = ((rangeValue[0] - min) / (max - min)) * 100
    const maxPercent = ((rangeValue[1] - min) / (max - min)) * 100

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMin = Number(e.target.value)
      // 防止交叉：min 必须严格小于 max
      if (newMin < rangeValue[1]) {
        onValueChange?.([newMin, rangeValue[1]])
      }
    }

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMax = Number(e.target.value)
      // 防止交叉：max 必须严格大于 min
      if (newMax > rangeValue[0]) {
        onValueChange?.([rangeValue[0], newMax])
      }
    }

    // 双端滑块共享的 thumb 样式（与单端模式保持一致）
    const thumbClassNames = cn(
      '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none',
      '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
      '[&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:shadow',
      '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer',
      '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full',
      '[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0',
      '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:cursor-pointer',
    )

    return (
      <div
        ref={ref}
        className={cn('relative flex w-full items-center', className)}
        {...restProps}
      >
        {showTooltip && (
          <>
            <span
              className="absolute -top-6 z-10 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground"
              style={{ left: `${minPercent}%` }}
            >
              {rangeValue[0]}
            </span>
            <span
              className="absolute -top-6 z-10 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground"
              style={{ left: `${maxPercent}%` }}
            >
              {rangeValue[1]}
            </span>
          </>
        )}

        {/* 轨道容器：两个透明 range input 叠加，共享视觉轨道与填充 */}
        <div className="relative h-2 w-full">
          {/* 视觉轨道（底色） */}
          <div className="absolute inset-0 rounded-full bg-secondary" />

          {/* 两个 thumb 之间的填充段（primary 色） */}
          <div
            className="absolute inset-y-0 rounded-full bg-primary"
            style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
          />

          {/* 下端（min）thumb：透明轨道，仅 thumb 可交互 */}
          <input
            id={id ? `${id}-min` : undefined}
            type="range"
            min={min}
            max={max}
            step={step}
            value={rangeValue[0]}
            disabled={disabled}
            onChange={handleMinChange}
            className={cn(
              'absolute inset-0 h-full w-full appearance-none bg-transparent pointer-events-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              thumbClassNames,
            )}
          />

          {/* 上端（max）thumb：透明轨道，仅 thumb 可交互 */}
          <input
            id={id ? `${id}-max` : undefined}
            type="range"
            min={min}
            max={max}
            step={step}
            value={rangeValue[1]}
            disabled={disabled}
            onChange={handleMaxChange}
            className={cn(
              'absolute inset-0 h-full w-full appearance-none bg-transparent pointer-events-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              thumbClassNames,
            )}
          />
        </div>
      </div>
    )
  },
)

Slider.displayName = 'Slider'
