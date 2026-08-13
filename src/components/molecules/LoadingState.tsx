/**
 * LoadingState 组件 - 全局加载状态展示
 *
 * 支持三种展示模式：
 * - skeleton: 骨架屏模式，适合内容加载
 * - spinner: 旋转图标模式，适合快速加载
 * - progress: 进度条模式，适合文件上传/下载等场景
 *
 * @module components/ui/LoadingState
 */

import { memo } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Props 定义
// ============================================================

export interface LoadingStateProps {
  /** 展示模式 */
  variant?: 'skeleton' | 'spinner' | 'progress'
  /** 骨架屏行数（仅 skeleton 模式） */
  rows?: number
  /** 骨架屏高度（仅 skeleton 模式） */
  height?: number
  /** 加载文案 */
  message?: string
  /** 进度百分比 0-100（仅 progress 模式） */
  progress?: number
  /** 自定义图标（仅 spinner 模式） */
  icon?: React.ReactNode
  /** 额外 className */
  className?: string
}

// ============================================================
// 骨架屏行组件
// ============================================================

interface SkeletonRowProps {
  height?: number
  isLast?: boolean
}

function SkeletonRow({ height = 16, isLast = false }: SkeletonRowProps) {
  return (
    <div
      className={cn(
        'h-4 rounded bg-muted animate-pulse',
        !isLast && 'mb-3'
      )}
      style={{ width: isLast ? '60%' : '100%', height }}
    />
  )
}

// ============================================================
// Skeleton 模式
// ============================================================

interface LoadingSkeletonProps {
  rows?: number
  height?: number
  message?: string
  className?: string
}

function LoadingSkeleton({ rows = 5, height, message, className }: LoadingSkeletonProps) {
  return (
    <div className={cn('space-y-4 p-6', className)}>
      {(message ?? '') !== '' && (
        <p className="text-sm text-muted-foreground text-center">{message}</p>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow
            key={i}
            height={height}
            isLast={i === rows - 1}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Spinner 模式
// ============================================================

interface LoadingSpinnerProps {
  message?: string
  icon?: React.ReactNode
  className?: string
}

function LoadingSpinner({ message, icon }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      {icon ?? (
        <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
      )}
      {(message ?? '') !== '' && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}

// ============================================================
// Progress 模式
// ============================================================

interface LoadingProgressProps {
  progress?: number
  message?: string
  className?: string
}

function LoadingProgress({ progress = 0, message, className }: LoadingProgressProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return (
    <div className={cn('space-y-3 p-6', className)}>
      {(message ?? '') !== '' && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{message}</span>
          <span className="font-medium">{clampedProgress}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================

/**
 * LoadingState
 */
export const LoadingState = memo(function LoadingState({
  variant = 'spinner',
  rows = 5,
  height,
  message,
  progress,
  icon,
  className,
}: LoadingStateProps) {
  return (
    <div className={cn('w-full', className)}>
      {variant === 'skeleton' && (
        <LoadingSkeleton rows={rows} height={height} message={message} className={className} />
      )}
      {variant === 'spinner' && (
        <LoadingSpinner message={message} icon={icon} />
      )}
      {variant === 'progress' && (
        <LoadingProgress progress={progress} message={message} />
      )}
    </div>
  )
})

export default LoadingState
