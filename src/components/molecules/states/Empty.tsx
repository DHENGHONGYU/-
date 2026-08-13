/**
 * @fileoverview P3 交互状态：空数据（Empty）
 * 统一空状态占位，引用令牌，无硬编码颜色。
 * @module components/ui/states/Empty
 */
import { type ReactNode, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'

export interface EmptyProps extends HTMLAttributes<HTMLDivElement> {
  /** 主标题 */
  title?: string
  /** 次要描述 */
  description?: string
  /** 自定义图标 */
  icon?: ReactNode
  /** 操作区（如「去导入」按钮） */
  action?: ReactNode
}

/**
 * Empty
 */
export function Empty({
  title = '暂无数据',
  description,
  icon,
  action,
  className,
  ...props
}: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 py-10 text-center',
        className,
      )}
      {...props}
    >
      {icon != null && (
        <div className={cn(THEME_TOKENS.iconSizes.xl, THEME_TOKENS.color.muted)}>{icon}</div>
      )}
      <p
        className={cn(
          THEME_TOKENS.typography.fontSize.base,
          THEME_TOKENS.typography.fontWeight.medium,
          THEME_TOKENS.color.muted,
        )}
      >
        {title}
      </p>
      {(description ?? '') !== '' && (
        <p className={cn(THEME_TOKENS.typography.fontSize.sm, THEME_TOKENS.color.mutedForeground)}>
          {description}
        </p>
      )}
      {action != null && <div className="mt-2">{action}</div>}
    </div>
  )
}

export default Empty
