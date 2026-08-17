/**
 * @fileoverview LazyImage — 图片懒加载 + 占位符 + 错误降级
 * @module components/atoms/LazyImage
 *
 * V12: 统一图片懒加载组件，支持 loading="lazy"、占位骨架屏、加载失败降级。
 * 所有项目图片应通过此组件渲染，避免直接使用 <img>。
 *
 * @compliance AGENTS.md §三 用户体验规范
 */

import { useState, useCallback, type ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface LazyImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'loading'> {
  /** 加载前占位高度（px），默认 200 */
  placeholderHeight?: number
  /** 加载失败降级文本 */
  fallbackText?: string
  /** 是否显示加载骨架屏 */
  showSkeleton?: boolean
}

/**
 * 图片懒加载组件
 *
 * 特性：
 * - 原生 loading="lazy"（浏览器级懒加载）
 * - 加载中骨架屏动画
 * - 加载失败降级占位
 * - 解码完成后淡入动画
 */
export function LazyImage({
  src,
  alt = '',
  placeholderHeight = 200,
  fallbackText = '图片加载失败',
  showSkeleton = true,
  className,
  onLoad,
  onError,
  ...imgProps
}: LazyImageProps): React.JSX.Element {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setStatus('loaded')
      onLoad?.(e)
    },
    [onLoad],
  )

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setStatus('error')
      onError?.(e)
    },
    [onError],
  )

  if (status === 'error') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground',
          className,
        )}
        style={{ height: placeholderHeight }}
        role="img"
        aria-label={fallbackText}
      >
        {fallbackText}
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', className)} style={{ height: placeholderHeight }}>
      {/* 骨架屏 */}
      {showSkeleton && status === 'loading' && (
        <div className="absolute inset-0 animate-pulse rounded-md bg-muted" />
      )}

      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          status === 'loaded' ? 'opacity-100' : 'opacity-0',
        )}
        {...imgProps}
      />
    </div>
  )
}

export default LazyImage