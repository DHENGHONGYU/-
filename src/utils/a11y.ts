/**
 * 无障碍（Accessibility）工具
 * v0.9.11 P2-A11Y
 * 标准：WCAG 2.1 Level AA
 */

import type React from 'react'

// 生成唯一 ID（用于 aria-labelledby/aria-describedby）
let idCounter = 0
export function generateId(prefix = 'a11y'): string {
  return `${prefix}-${++idCounter}`
}

// 键盘导航助手
export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const

export type KeyType = (typeof KEYS)[keyof typeof KEYS]

// 处理键盘事件（回车/空格触发点击）
export function handleKeyboardActivation(handler: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) {
      e.preventDefault()
      handler()
    }
  }
}

// 处理 Escape 键
export function handleEscapeKey(handler: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === KEYS.ESCAPE) {
      e.preventDefault()
      handler()
    }
  }
}

// 判断是否为交互元素
export function isInteractiveElement(tag: string): boolean {
  const interactiveTags = ['button', 'a', 'input', 'select', 'textarea', 'details', 'menuitem']
  return interactiveTags.includes(tag.toLowerCase())
}

// 获取可聚焦元素选择器列表
export const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ')

// 检查元素是否可聚焦
export function isFocusable(element: HTMLElement): boolean {
  if (element.hasAttribute('disabled') && element.tagName !== 'A') {
    return false
  }
  if (element.getAttribute('aria-hidden') === 'true') {
    return false
  }
  const tabIndex = element.getAttribute('tabindex')
  if (tabIndex !== null && parseInt(tabIndex, 10) < 0) {
    return false
  }
  return true
}

// Live Region 助手（用于屏幕阅读器公告）
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite',
  containerId = 'sr-announcer',
) {
  let announcer = document.getElementById(containerId)
  if (!announcer) {
    announcer = document.createElement('div')
    announcer.id = containerId
    announcer.setAttribute('aria-live', priority)
    announcer.setAttribute('aria-atomic', 'true')
    announcer.className = 'sr-only'
    announcer.style.cssText =
      'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;'
    document.body.appendChild(announcer)
  }

  // 清空并重新设置以触发动画
  announcer.textContent = ''
  setTimeout(() => {
    announcer!.textContent = message
  }, 100)
}

// 组合 label 和 description 的 aria 属性
export interface AriaDescribedByProps {
  labelId?: string
  descriptionId?: string
  errorId?: string
}

export function getAriaDescribedByIds({ labelId, descriptionId, errorId }: AriaDescribedByProps): string | undefined {
  const ids = [labelId, descriptionId, errorId].filter(Boolean) as string[]
  return ids.length > 0 ? ids.join(' ') : undefined
}

// 为表单字段生成无障碍属性
export function getFieldAriaProps(
  fieldId: string,
  options: {
    required?: boolean
    hasError?: boolean
    errorMessage?: string
    describedById?: string
  } = {},
) {
  const describedByIds: string[] = []

  if (options.describedById) {
    describedByIds.push(options.describedById)
  }

  if (options.hasError && options.errorMessage) {
    const errorId = `${fieldId}-error`
    describedByIds.push(errorId)
  }

  return {
    id: fieldId,
    'aria-labelledby': `${fieldId}-label`,
    'aria-describedby': describedByIds.length > 0 ? describedByIds.join(' ') : undefined,
    'aria-required': options.required,
    'aria-invalid': options.hasError,
  }
}

// 焦点管理：聚焦到元素
export function focusElement(element: HTMLElement | null | undefined) {
  if (element) {
    element.focus()
    // 如果是 input，选择所有文本
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.select()
    }
  }
}

// 焦点管理：聚焦到第一个可聚焦元素
export function focusFirst(container: HTMLElement | null) {
  if (!container) return
  const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
  focusElement(focusable[0])
}

// 焦点管理：聚焦到最后一个可聚焦元素
export function focusLast(container: HTMLElement | null) {
  if (!container) return
  const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
  focusElement(focusable[focusable.length - 1])
}

// 减少运动偏好检测
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// 高对比度模式检测
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: more)').matches
}
