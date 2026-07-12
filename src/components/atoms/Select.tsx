import { forwardRef, type SelectHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /**
   * shadcn/ui 风格的值变更回调。
   * 与原生 onChange 可共存：触发时两者都会被调用。
   */
  onValueChange?: (value: string) => void
}

/**
 * Select
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, onValueChange, onChange, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        onChange={(e) => {
          onChange?.(e)
          onValueChange?.(e.target.value)
        }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
    </div>
  ),
)
Select.displayName = 'Select'

export type SelectItemProps = React.OptionHTMLAttributes<HTMLOptionElement>

/**
 * SelectItem
 */
export const SelectItem = forwardRef<HTMLOptionElement, SelectItemProps>(
  ({ className, children, ...props }, ref) => (
    <option ref={ref} className={cn('', className)} {...props}>
      {children}
    </option>
  ),
)
SelectItem.displayName = 'SelectItem'

// ============================================================
// shadcn/ui 兼容层
// 在原生 <select> 实现中作为透明包装，不渲染额外 DOM。
// 这样可让按 shadcn/ui 风格编写的页面（如 BacktestPage）无需修改即可通过 TS 检查。
// ============================================================

export type SelectContentProps = HTMLAttributes<HTMLDivElement>

/** 下拉内容容器（兼容层：透明透传 children 到原生 select） */
export const SelectContent = ({ children }: SelectContentProps) => <>{children}</>
SelectContent.displayName = 'SelectContent'

export type SelectTriggerProps = HTMLAttributes<HTMLDivElement>

/** 触发器（兼容层：原生 select 自带触发器，这里仅透传 children） */
export const SelectTrigger = ({ children }: SelectTriggerProps) => <>{children}</>
SelectTrigger.displayName = 'SelectTrigger'

export interface SelectValueProps {
  /** 占位提示文本（兼容层：原生 select 通过 placeholder 属性或默认 option 处理，这里不渲染） */
  placeholder?: string
  children?: ReactNode
}

/** 当前值显示（兼容层：原生 select 自动显示选中项，这里不渲染） */
export const SelectValue = (_props: SelectValueProps) => null
SelectValue.displayName = 'SelectValue'
