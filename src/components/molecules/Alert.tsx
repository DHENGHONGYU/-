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
import { THEME_TOKENS, COLOR_TOKENS, COLOR_SHADES } from '@/constants/theme.tokens'

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

export type AlertTitleProps = React.HTMLAttributes<HTMLHeadingElement>

export type AlertDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>

// ============================================================
// 变体样式配置（使用 Design Tokens）
// ============================================================

const VARIANT_STYLES: Record<AlertVariant, {
  container: string
  icon: string
}> = {
  default: {
    container: `${COLOR_TOKENS.bgMuted.tailwind}/50 ${COLOR_SHADES.slate[300]}/20`,
    icon: COLOR_TOKENS.textMuted.tailwind,
  },
  destructive: {
    container: `${COLOR_TOKENS.danger.bgClass}/10 ${COLOR_SHADES.red[300]}/30`,
    icon: COLOR_TOKENS.danger.tailwind,
  },
  success: {
    container: `${COLOR_TOKENS.success.bgClass}/10 ${COLOR_SHADES.green[300]}/30`,
    icon: COLOR_TOKENS.success.tailwind,
  },
  warning: {
    container: `${COLOR_TOKENS.warning.bgClass}/10 ${COLOR_SHADES.amber[300]}/30`,
    icon: COLOR_TOKENS.warning.tailwind,
  },
  info: {
    container: `${COLOR_TOKENS.info.bgClass}/10 ${COLOR_SHADES.blue[300]}/30`,
    icon: COLOR_TOKENS.info.tailwind,
  },
}

// ============================================================
// 默认图标（使用 Design Tokens）
// ============================================================

const DefaultIcons: Record<AlertVariant, ReactNode> = {
  default: (
    <svg className={THEME_TOKENS.iconSizes.md} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  destructive: (
    <svg className={THEME_TOKENS.iconSizes.md} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  success: (
    <svg className={THEME_TOKENS.iconSizes.md} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  warning: (
    <svg className={THEME_TOKENS.iconSizes.md} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg className={THEME_TOKENS.iconSizes.md} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  const tokens = {
    radius: THEME_TOKENS.radius.lg,
    padding: THEME_TOKENS.spacing.md,
    gap: THEME_TOKENS.gap.md,
    border: 'border',
  }

  const handleClose = () => {
    onClose?.()
  }

  return (
    <div
      role="alert"
      className={cn(
        'relative w-full flex items-start',
        tokens.radius,
        tokens.border,
        tokens.padding,
        tokens.gap,
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
            'shrink-0 opacity-70 transition-opacity',
            'hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring',
            THEME_TOKENS.radius.sm,
            THEME_TOKENS.spacing.xs,
            '-mr-1 -mt-0.5',
            styles.icon,
          )}
          aria-label="关闭"
        >
          <svg className={THEME_TOKENS.iconSizes.sm} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const tokens = {
    fontSize: THEME_TOKENS.typography.fontSize.base,
    fontWeight: THEME_TOKENS.typography.fontWeight.semibold,
    lineHeight: THEME_TOKENS.typography.lineHeight.none,
    letterSpacing: THEME_TOKENS.typography.letterSpacing.tight,
    marginBottom: 'mb-1',
  }

  return (
    <h5
      className={cn(
        tokens.marginBottom,
        tokens.fontWeight,
        tokens.lineHeight,
        tokens.letterSpacing,
        className,
      )}
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
  const tokens = {
    fontSize: THEME_TOKENS.typography.fontSize.sm,
    lineHeight: THEME_TOKENS.typography.lineHeight.relaxed,
  }

  return (
    <div
      className={cn(
        tokens.fontSize,
        tokens.lineHeight,
        '[&_p]:leading-relaxed',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default Alert
