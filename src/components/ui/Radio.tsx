import { createContext, forwardRef, memo, useContext, useMemo, useRef, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface RadioGroupContextValue {
  value: string
  name?: string
  onValueChange: (value: string) => void
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null)

function useRadioGroup() {
  const ctx = useContext(RadioGroupContext)
  if (!ctx) throw new Error('Radio must be used within <RadioGroup>')
  return ctx
}

export interface RadioGroupProps {
  value?: string
  defaultValue?: string
  name?: string
  onChange?: (value: string) => void
  children?: React.ReactNode
  className?: string
}

export const RadioGroup = memo(forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, defaultValue, name, onChange, children, className }, ref) => {
    const [internalValue, setInternalValue] = useState(defaultValue ?? '')
    const isControlled = value !== undefined
    const activeValue = isControlled ? value : internalValue

    const context = useMemo<RadioGroupContextValue>(
      () => ({
        value: activeValue,
        name,
        onValueChange: (v: string) => {
          onChange?.(v)
          if (!isControlled) setInternalValue(v)
        },
      }),
      [activeValue, name, onChange, isControlled],
    )

    return (
      <RadioGroupContext.Provider value={context}>
        <div ref={ref} role="radiogroup" className={cn('flex flex-col gap-2', className)}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    )
  },
))
RadioGroup.displayName = 'RadioGroup'

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue'> {
  value: string
  label?: React.ReactNode
}

export const Radio = memo(forwardRef<HTMLInputElement, RadioProps>(
  ({ className, value, label, disabled, id, ...props }, ref) => {
    const { value: groupValue, name: groupName, onValueChange } = useRadioGroup()
    const isChecked = groupValue === value
    const internalId = useRef(id ?? `radio-${value}-${Math.random().toString(36).slice(2, 9)}`)

    return (
      <label
        htmlFor={internalId.current}
        className={cn(
          'inline-flex items-center gap-2 text-sm font-medium leading-none',
          disabled && 'cursor-not-allowed opacity-50',
          !disabled && 'cursor-pointer',
          className,
        )}
      >
        <input
          ref={ref}
          type="radio"
          id={internalId.current}
          name={groupName}
          value={value}
          checked={isChecked}
          disabled={disabled}
          aria-checked={isChecked}
          role="radio"
          onChange={() => onValueChange(value)}
          className="sr-only"
          {...props}
        />
        <span
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-full border border-input',
            isChecked && 'border-primary',
            !disabled && 'group-hover:border-primary',
          )}
          aria-hidden="true"
        >
          {isChecked && (
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          )}
        </span>
        {label && <span>{label}</span>}
      </label>
    )
  },
))
Radio.displayName = 'Radio'