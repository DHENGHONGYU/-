/**
 * EmptyState 组件 - 全局空数据状态展示
 *
 * 用于展示空数据场景，支持：
 * - 自定义图标
 * - 自定义标题和描述
 * - 主操作按钮
 * - 次要操作按钮
 *
 * @module components/ui/EmptyState
 */

import { memo } from 'react'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { cn } from '@/lib/utils'

// ============================================================
// Props 定义
// ============================================================

export interface EmptyStateAction {
  label: string
  onClick: () => void
}

export interface EmptyStateProps {
  /** 标题 */
  title?: string
  /** 描述文本 */
  description?: string
  /** 空状态图标（默认为 Inbox） */
  icon?: React.ReactNode
  /** 主操作按钮 */
  action?: EmptyStateAction
  /** 次要操作按钮 */
  secondaryAction?: EmptyStateAction
  /** 额外 className */
  className?: string
}

// ============================================================
// 主组件
// ============================================================

/**
 * EmptyState
 */
export const EmptyState = memo(function EmptyState({
  title = '暂无数据',
  description,
  icon,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const hasActions = action || secondaryAction

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4',
        'text-center',
        className
      )}
    >
      {/* 图标 */}
      <div className="mb-4">
        {icon ?? (
          <Inbox className="h-12 w-12 text-muted-foreground/40" />
        )}
      </div>

      {/* 文本内容 */}
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-medium text-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {/* 操作按钮 */}
      {hasActions && (
        <div className="mt-6 flex items-center gap-3">
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
          {action && (
            <Button onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
})

export default EmptyState
