import { cn } from '@/lib/utils'
import { Label } from '@/components/atoms'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

export interface FormFieldProps {
  /** 标签文本 */
  label?: string
  /** 关联控件 ID */
  htmlFor?: string
  /** 错误信息 */
  error?: string
  /** 帮助文本 */
  help?: string
  /** 是否必填 */
  required?: boolean
  /** 子控件 */
  children: React.ReactNode
  /** 容器 className */
  className?: string
}

/**
 * 表单字段分子
 *
 * 组合：Label + 控件 + 错误提示 + 帮助文本
 */
export function FormField({
  label,
  htmlFor,
  error,
  help,
  required,
  children,
  className,
}: FormFieldProps) {
  const showLabel = label != null && label.length > 0
  const showError = error != null && error.length > 0
  const showHelp = help != null && help.length > 0 && !showError

  return (
    <div className={cn('space-y-1.5', className)}>
      {showLabel && (
        <Label htmlFor={htmlFor}>
          {label}
          {required === true && <span className={cn('ml-1', COLOR_TOKENS.danger.tailwind)}>*</span>}
        </Label>
      )}
      {children}
      {showError && (
        <p className={cn('text-xs', COLOR_TOKENS.danger.tailwind)}>{error}</p>
      )}
      {showHelp && (
        <p className="text-xs text-muted-foreground">{help}</p>
      )}
    </div>
  )
}
