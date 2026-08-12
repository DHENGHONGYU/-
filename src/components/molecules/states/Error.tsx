/**
 * @fileoverview P3 交互状态：错误（ErrorState）
 * 统一错误占位，提供重试动作，引用令牌，无硬编码颜色。
 * @module components/ui/states/Error
 */
import { type ReactNode, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'

export interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  /** 主标题 */
  title?: string
  /** 次要描述 */
  description?: string
  /** 重试回调 */
  onRetry?: () => void
  /** 重试按钮文案 */
  retryLabel?: string
  /** 额外操作区 */
  action?: ReactNode
}

/**
 * ErrorState
 */
export function ErrorState({
  title = '出错了',
  description,
  onRetry,
  retryLabel = '重试',
  action,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 py-10 text-center',
        className,
      )}
      {...props}
    >
      <div className={cn(THEME_TOKENS.iconSizes.xl, COLOR_TOKENS.danger.tailwind)} aria-hidden>
        ⚠
      </div>
      <p
        className={cn(
          THEME_TOKENS.typography.fontSize.base,
          THEME_TOKENS.typography.fontWeight.medium,
          THEME_TOKENS.color.destructive,
        )}
      >
        {title}
      </p>
      {description && (
        <p className={cn(THEME_TOKENS.typography.fontSize.sm, THEME_TOKENS.color.mutedForeground)}>
          {description}
        </p>
      )}
      {(onRetry ?? action) && (
        <div className="mt-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium text-white',
                COLOR_TOKENS.danger.bgClass,
              )}
            >
              {retryLabel}
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}

export default ErrorState
