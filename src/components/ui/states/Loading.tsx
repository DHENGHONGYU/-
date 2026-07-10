/**
 * @fileoverview P3 交互状态：加载中（Loading）
 * 统一加载指示器，引用令牌，无硬编码颜色。
 * @module components/ui/states/Loading
 */
import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'

export interface LoadingProps extends HTMLAttributes<HTMLDivElement> {
  /** 提示文案 */
  label?: string
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
}

const SPINNER = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
} as const

export function Loading({ label = '加载中…', size = 'md', className, ...props }: LoadingProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-6', className)}
      {...props}
    >
      <div
        className={cn(
          'rounded-full border-current border-t-transparent',
          THEME_TOKENS.motion.spin,
          SPINNER[size],
          THEME_TOKENS.color.muted,
        )}
        role="status"
        aria-label={label}
      />
      {label && (
        <span className={cn(THEME_TOKENS.typography.fontSize.sm, THEME_TOKENS.color.muted)}>
          {label}
        </span>
      )}
    </div>
  )
}

export default Loading
