/**
 * @module cockpit/hooks/useWidgetErrorState
 * @description Widget 统一错误状态管理 Hook。
 *
 * 封装所有 Widget 组件共用的视觉状态判定逻辑：
 * - `error` 有值 → `'error'`（显示错误提示 + 重试按钮）
 * - `loading=true` → `'loading'`（显示骨架屏）
 * - `loading=false` 且无数据 → `'error'`（接口失败未设置 error，显示友好默认提示）
 * - 否则 → `'ready'`（正常渲染）
 *
 * @example
 * ```tsx
 * const { visualState, displayError } = useWidgetErrorState({
 *   loading,
 *   error,
 *   hasData: !!portfolio,
 *   fallbackErrorMessage: '持仓数据暂不可用，请检查后端服务或稍后重试',
 * })
 *
 * return (
 *   <WidgetStateShell visualState={visualState} error={displayError} ...>
 *     {children}
 *   </WidgetStateShell>
 * )
 * ```
 */

import { useMemo } from 'react'
import type { WidgetVisualState } from '@/cockpit/widgets/components/WidgetStateShell'

export interface UseWidgetErrorStateOptions {
  /** 是否正在加载 */
  loading: boolean
  /** 错误信息（来自 errorMap） */
  error: string | null | undefined
  /** 是否有可用数据 */
  hasData: boolean
  /** 当 error 为空但数据不可用（loading=false, hasData=false）时的默认错误提示 */
  fallbackErrorMessage?: string
}

export interface UseWidgetErrorStateResult {
  /** 当前视觉状态 */
  visualState: WidgetVisualState
  /** 传递给 WidgetStateShell 的 error 属性（含 fallback） */
  displayError: string | null
  /** 便捷判断 */
  isError: boolean
  isLoading: boolean
  isReady: boolean
}

/**
 * useWidgetErrorState — Widget 统一错误状态管理 Hook
 *
 * @param options 状态输入
 * @returns 视觉状态与格式化错误信息
 */
export function useWidgetErrorState(options: UseWidgetErrorStateOptions): UseWidgetErrorStateResult {
  const { loading, error, hasData, fallbackErrorMessage } = options

  return useMemo(() => {
    let visualState: WidgetVisualState = 'ready'

    if (error) {
      visualState = 'error'
    } else if (loading) {
      visualState = 'loading'
    } else if (!hasData) {
      // loading=false 但无数据：接口失败未正确设置 error，或后端返回空
      visualState = 'error'
    }

    const displayError = error ?? (visualState === 'error' ? (fallbackErrorMessage ?? '数据暂不可用，请稍后重试') : null)

    return {
      visualState,
      displayError,
      isError: visualState === 'error',
      isLoading: visualState === 'loading',
      isReady: visualState === 'ready',
    }
  }, [error, loading, hasData, fallbackErrorMessage])
}
