/**
 * DatePicker — 日期选择原子
 *
 * 原生 input[type="date"] 封装，支持范围选择、最小/最大日期限制。
 *
 * @module atoms/DatePicker
 * @since 2026-07-18 (P2 规划实现)
 */

import { type InputHTMLAttributes } from 'react'

export interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** 选中日期（ISO 字符串如 "2026-07-18"） */
  value?: string
  /** 默认日期 */
  defaultValue?: string
  /** 最小可选日期 */
  minDate?: string
  /** 最大可选日期 */
  maxDate?: string
  /** 日期变化回调 */
  onChange?: (value: string) => void
  /** 是否范围选择（待扩展，当前 hint） */
  range?: boolean
}

/**
 * DatePicker
 */
export function DatePicker({
  value, defaultValue, minDate, maxDate, onChange,
  className = '', range, ...rest
}: DatePickerProps) {
  return (
    <input
      type="date"
      value={value}
      defaultValue={defaultValue}
      min={minDate}
      max={maxDate}
      onChange={(e) => onChange?.(e.target.value)}
      className={`
        flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
        ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium
        placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
        ${className}
      `}
      {...(rest as InputHTMLAttributes<HTMLInputElement>)}
    />
  )
}
