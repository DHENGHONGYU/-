/**
 * @file Alert.tsx
 * @description 警告提示组件
 * @module components/ui/Alert
 *
 * 功能特性：
 * - 多种变体：default / destructive / success / warning / info
 * - 支持标题和描述
 * - 可选关闭按钮
 * - 完整的 ARIA 属性
 * - 适配 V9 样式系统
 *
 * @author V9 Component Library Team
 * @version V9
 */

import { type ReactNode, memo } from 'react'
import { cn } from '@/lib/utils'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export type AlertVariant = 'default' | 'destructive' | 'success' | 'warning' | 'info'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 变体样式 */
  variant?: AlertVariant
  /** 是否可关闭 */
  closable?: boolean
  /** 关闭回调 */
  onClose?: () => void
  /** 图标 */
  icon?: ReactNode
}

export interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

// ============================================================
// 变体样式配置
// ============================================================

const VARIANT_STYLES: Record<AlertVariant, {
  container: string
  icon: string
}> = {
  default: {
    container: 'bg-muted/50 border-muted-foreground/20',
    icon: 'text-muted-foreground',
  },
  destructive: {
    container: 'bg-destructive/10 border-destructive/30',
    icon: 'text-destructive',
  },
  success: {
    container: 'bg-positive/10 border-positive/30',
    icon: 'text-positive',
  },
  warning: {
    container: 'bg-warning/10 border-warning/30',
    icon: 'text-warning',
  },
  info: {
    container: 'bg-info/10 border-info/30',
    icon: 'text-info',
  },
}

// ============================================================
// 默认图标
// ============================================================

const DefaultIcons: Record<AlertVariant, ReactNode> = {
  default: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  destructive: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  success: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
}

// ============================================================
// Alert 组件
// ============================================================

export const Alert = memo(function Alert({
  className,
  variant = 'default',
  closable = false,
  onClose,
  icon,
  children,
  ...props
}: AlertProps) {
  const styles = VARIANT_STYLES[variant]
  const defaultIcon = DefaultIcons[variant]

  const handleClose = () => {
    logger.info('[Alert] Closed', { variant })
    onClose?.()
  }

  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-lg border p-4',
        'flex gap-3 items-start',
        styles.container,
        className,
      )}
      {...props}
    >
      <div className={cn('shrink-0 mt-0.5', styles.icon)}>
        {icon || defaultIcon}
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
      {closable && (
        <button
          type="button"
          onClick={handleClose}
          className={cn(
            'shrink-0 rounded-sm opacity-70 transition-opacity',
            'hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring',
            'p-0.5 -mr-1 -mt-0.5',
            styles.icon,
          )}
          aria-label="关闭"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
})

// ============================================================
// AlertTitle 组件
// ============================================================

export function AlertTitle({ className, children, ...props }: AlertTitleProps) {
  return (
    <h5
      className={cn('mb-1 font-semibold leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </h5>
  )
}

// ============================================================
// AlertDescription 组件
// ============================================================

export function AlertDescription({ className, children, ...props }: AlertDescriptionProps) {
  return (
    <div
      className={cn('text-sm [&_p]:leading-relaxed', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export default Alert
