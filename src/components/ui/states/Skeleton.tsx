/**
 * @fileoverview P3 交互状态：骨架屏（Skeleton）
 * 统一加载占位骨架，引用令牌，无硬编码颜色。
 * @module components/ui/states/Skeleton
 */
import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** 形状 */
  variant?: 'text' | 'rect' | 'circle'
}

const VARIANT = {
  text: cn(THEME_TOKENS.radius.sm, 'h-4 w-full'),
  rect: cn(THEME_TOKENS.radius.lg, 'h-20 w-full'),
  circle: cn(THEME_TOKENS.radius.full, 'h-12 w-12'),
} as const

export function Skeleton({ variant = 'rect', className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        THEME_TOKENS.color.mutedBackground,
        THEME_TOKENS.motion.skeletonPulse,
        VARIANT[variant],
        className,
      )}
      aria-hidden
      {...props}
    />
  )
}

export default Skeleton
