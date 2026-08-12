/**
 * @doc [V9-DOC-PROJ-239]
 */
import { useMemo } from 'react'
import { usePageStore } from '@/store/pageStore'

export interface PageGuardState {
  /** 页面是否可见（v-if 等价） */
  isVisible: boolean
  /** 页面是否可交互（disabled 反向） */
  isClickable: boolean
  /** 不可交互时的提示文案 */
  tooltipText: string
  /** 直接展开到 Button 的 props */
  guardProps: {
    disabled: boolean
    title?: string
  }
}

/**
 * 页面守卫 Hook
 * @param pageKey 页面唯一标识（如 'stock-analysis'、'intelligent-score'）
 * @returns 页面可见性/可交互状态及 Button props
 *
 * 说明：当前 pageStore 的 isVisible/isClickable/tooltipText 为全局单一状态，
 * pageKey 暂作为语义标识保留，便于未来按页面维度扩展状态时无需改动调用方。
 *
 * 使用示例：
 * ```tsx
 * const { isVisible, guardProps } = usePageGuard('stock-analysis')
 * return isVisible && (
 *   <Button {...guardProps} onClick={handleScore}>运行评分</Button>
 * )
 * ```
/**
 * usePageGuard
 * @param pageKey
 * @returns PageGuardState
 */
export function usePageGuard(pageKey: string): PageGuardState {
  // pageKey 当前作为语义标识保留，store 状态为全局读取（见上方说明）
  void pageKey

  const isVisible = usePageStore((s) => s.isVisible)
  const isClickable = usePageStore((s) => s.isClickable)
  const tooltipText = usePageStore((s) => s.tooltipText)

  return useMemo(() => ({
    isVisible,
    isClickable,
    tooltipText,
    guardProps: {
      disabled: !isClickable,
      title: !isClickable ? tooltipText : undefined,
    },
  }), [isVisible, isClickable, tooltipText])
}
