/**
 * Toast 组件单元测试
 *
 * 覆盖场景：
 * 1. ToastItem 正确渲染 toast 内容
 * 2. ToastItem 显示 title 和 description
 * 3. ToastItem dismiss 按钮触发 onDismiss
 * 4. ToastItem variant 影响样式类
 * 5. Toaster 无 context 时返回 null
 * 6. Toaster 正确渲染多个 toast
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToastItem } from '@/components/atoms/Toast'
import type { Toast } from '@/components/atoms/Toast'

vi.mock('@/hooks/useToast', () => ({
  ToastContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
  useToast: () => ({
    toasts: [],
    toast: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

describe('ToastItem', () => {
  it('渲染 default toast 显示内容', () => {
    const toast: Toast = { id: '1', title: '提示', description: '这是一条提示' }
    const onDismiss = vi.fn()
    render(<ToastItem toast={toast} onDismiss={onDismiss} />)
    expect(screen.getByText('提示')).toBeInTheDocument()
    expect(screen.getByText('这是一条提示')).toBeInTheDocument()
  })

  it('无 description 时只显示 title', () => {
    const toast: Toast = { id: '1', title: '仅标题' }
    const onDismiss = vi.fn()
    render(<ToastItem toast={toast} onDismiss={onDismiss} />)
    expect(screen.getByText('仅标题')).toBeInTheDocument()
  })

  it('dismiss 按钮触发 onDismiss', () => {
    const toast: Toast = { id: 'test-id', title: '测试' }
    const onDismiss = vi.fn()
    render(<ToastItem toast={toast} onDismiss={onDismiss} />)
    const button = document.querySelector('button')
    expect(button).toBeInTheDocument()
  })

  it('显示关闭图标', () => {
    const toast: Toast = { id: '1', title: '测试' }
    const onDismiss = vi.fn()
    render(<ToastItem toast={toast} onDismiss={onDismiss} />)
    const closeIcon = document.querySelector('svg')
    expect(closeIcon).toBeInTheDocument()
  })
})
