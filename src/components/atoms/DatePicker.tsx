import { forwardRef, memo, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'

function toDateString(value: string | Date | undefined): string {
  if (!value) return ''
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return value
}

export interface DatePickerProps {
  value?: string | Date
  onChange?: (value: string) => void
  min?: string | Date
  max?: string | Date
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * DatePicker
 */
export const DatePicker = memo(forwardRef<HTMLInputElement, DatePickerProps>(
  ({ value, onChange, min, max, placeholder, disabled, className }, ref) => {
    const dateValue = useMemo(() => toDateString(value), [value])
    const minDate = useMemo(() => toDateString(min), [min])
    const maxDate = useMemo(() => toDateString(max), [max])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(e.target.value)
      },
      [onChange],
    )

    return (
      <input
        ref={ref}
        type="date"
        value={dateValue}
        onChange={handleChange}
        min={minDate || undefined}
        max={maxDate || undefined}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      />
    )
  },
))
DatePicker.displayName = 'DatePicker'