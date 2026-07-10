/**
 * DataState 组件 - 三态组合组件
 *
 * 组合 LoadingState、ErrorState、EmptyState 三个组件，
 * 覆盖常见异步数据场景，提供统一的数据状态展示。
 *
 * 优先级：loading > error > empty > children
 *
 * @module components/ui/DataState
 */

import { memo, type ReactNode } from 'react'
import { LoadingState, type LoadingStateProps } from '@/components/molecules/LoadingState'
import { ErrorState, type ErrorStateProps } from '@/components/molecules/ErrorState'
import { EmptyState, type EmptyStateProps } from '@/components/molecules/EmptyState'
import { cn } from '@/lib/utils'

// ============================================================
// Props 定义
// ============================================================

export interface DataStateProps<T = unknown> {
  /** 是否加载中 */
  isLoading: boolean
  /** 是否有错误 */
  isError: boolean
  /** 数据是否为空（非加载非错误） */
  isEmpty: boolean
  /** 实际数据 */
  data: T | undefined
  /** 正常数据渲染函数 */
  children: ReactNode
  /** LoadingState 配置 */
  loadingProps?: LoadingStateProps
  /** ErrorState 配置 */
  errorProps?: ErrorStateProps
  /** EmptyState 配置 */
  emptyProps?: EmptyStateProps
  /** 额外 className */
  className?: string
}

// ============================================================
// 主组件
// ============================================================

function DataStateInner<T = unknown>({
  isLoading,
  isError,
  isEmpty,
  data,
  children,
  loadingProps,
  errorProps,
  emptyProps,
  className,
}: DataStateProps<T>) {
  // 优先级：loading > error > empty > children
  if (isLoading) {
    return (
      <div className={cn('w-full', className)}>
        <LoadingState
          variant="skeleton"
          rows={5}
          message="加载中..."
          {...loadingProps}
        />
      </div>
    )
  }

  if (isError) {
    return (
      <div className={cn('w-full', className)}>
        <ErrorState
          variant="card"
          error={errorProps?.error ?? '操作失败'}
          {...errorProps}
        />
      </div>
    )
  }

  // 注意：isEmpty 判断需要在 data 存在但长度为 0 的情况下触发
  // 或者明确传入 isEmpty=true
  const showEmpty = isEmpty || (Array.isArray(data) && data.length === 0)

  if (showEmpty) {
    return (
      <div className={cn('w-full', className)}>
        <EmptyState
          title="暂无数据"
          description="没有找到相关数据，请稍后再试"
          {...emptyProps}
        />
      </div>
    )
  }

  return <>{children}</>
}

// 通过类型断言保留泛型签名（memo 默认擦除泛型）
export const DataState = memo(DataStateInner) as typeof DataStateInner

// ============================================================
// 便捷变体：仅 Loading/Error
// ============================================================

export interface LoadingErrorStateProps {
  isLoading: boolean
  isError: boolean
  error?: ErrorStateProps['error']
  onRetry?: ErrorStateProps['onRetry']
  loadingMessage?: string
  className?: string
}

export const LoadingErrorState = memo(function LoadingErrorState({
  isLoading,
  isError,
  error,
  onRetry,
  loadingMessage = '加载中...',
  className,
}: LoadingErrorStateProps) {
  if (isLoading) {
    return (
      <div className={cn('w-full', className)}>
        <LoadingState variant="spinner" message={loadingMessage} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className={cn('w-full', className)}>
        <ErrorState
          variant="card"
          error={error ?? '加载失败'}
          onRetry={onRetry}
        />
      </div>
    )
  }

  return <></>
})

// ============================================================
// 便捷变体：仅 Loading/Empty
// ============================================================

export interface LoadingEmptyStateProps<T = unknown> {
  isLoading: boolean
  isEmpty: boolean
  data?: T | undefined
  loadingMessage?: string
  emptyProps?: EmptyStateProps
  className?: string
}

function LoadingEmptyStateInner<T = unknown>({
  isLoading,
  isEmpty,
  data,
  loadingMessage = '加载中...',
  emptyProps,
  className,
}: LoadingEmptyStateProps<T>) {
  if (isLoading) {
    return (
      <div className={cn('w-full', className)}>
        <LoadingState variant="spinner" message={loadingMessage} />
      </div>
    )
  }

  const showEmpty = isEmpty || (Array.isArray(data) && data.length === 0)

  if (showEmpty) {
    return (
      <div className={cn('w-full', className)}>
        <EmptyState {...emptyProps} />
      </div>
    )
  }

  return <></>
}

export const LoadingEmptyState = memo(LoadingEmptyStateInner) as typeof LoadingEmptyStateInner

export default DataState
