/**
 * @fileoverview useFocusTrap — 焦点陷阱 hook
 * @module hooks/useFocusTrap
 *
 * V13: 为 Sheet/Dialog/Modal 提供焦点陷阱，满足 WCAG 2.1 AA 2.4.3 标准。
 * 行为：打开时自动聚焦容器内第一个可聚焦元素；Tab 键在容器内循环；
 * 关闭时恢复焦点到触发元素。
 */

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(active: boolean): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) {
      if (triggerRef.current) {
        triggerRef.current.focus()
        triggerRef.current = null
      }
      return
    }

    triggerRef.current = document.activeElement as HTMLElement | null

    const timer = requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusable.length > 0) {
        focusable[0]!.focus()
      } else {
        container.tabIndex = -1
        container.focus()
      }
    })

    return () => cancelAnimationFrame(timer)
  }, [active])

  useEffect(() => {
    if (!active) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const container = containerRef.current
      if (!container) return

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null)

      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active])

  return containerRef
}

export default useFocusTrap