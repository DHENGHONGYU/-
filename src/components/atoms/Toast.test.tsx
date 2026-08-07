/**
 * Toaster 组件单元测试（Toast 通知容器）
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 * 1. 基础渲染：toasts.length===0 → return null（什么都不渲染）
 * 2. toasts 列表渲染：渲染 role="region" + aria-label="通知" + 每条 toast 的 role="alert"
 * 3. variant 样式分支 (default/success/error/warning/info)
 * 4. variant icon 分支 (success=✓, error=✗, warning=⚠, info=ⓘ, default=无)
 * 5. 条件渲染：title 非空显示 p.font-medium、description 非空显示 p.mt-1
 * 6. dismiss 关闭按钮：点击触发 dismiss(t.id)
 * 7. className 合并
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// useToast mock（vi.hoisted 静态提升模式）
const { useToastHook, dismissFn, toastsRef } = vi.hoisted(() => {
  const state = {
    toasts: [] as any[],
  }
  const dismissFn = vi.fn((id: string) => {
    state.toasts = state.toasts.filter((t) => t.id !== id)
  })
  function useToast() {
    return { toasts: state.toasts, dismiss: dismissFn }
  }
  const toastsRef = {
    get current() {
      return state.toasts
    },
    set next(v: any[]) {
      state.toasts = v
    },
  }
  return { useToastHook: useToast, dismissFn, toastsRef }
})

vi.mock('@/hooks/useToast', () => ({
  useToast: useToastHook,
}))

import { Toaster } from './Toast'

describe('Toaster', () => {
  beforeEach(() => {
    toastsRef.next = []
    dismissFn.mockClear()
  })

  describe('基础渲染', () => {
    it('toasts=[] → return null，什么都不渲染', () => {
      const { container } = render(<Toaster />)
      expect(container.firstChild).toBeNull()
    })

    it('toasts 非空 → 渲染 role="region" + aria-label="通知"', () => {
      toastsRef.next = [{ id: 't1', title: '提示', description: '内容' }]
      render(<Toaster />)
      expect(screen.getByRole('region')).toBeInTheDocument()
      expect(screen.getByRole('region')).toHaveAttribute('aria-label', '通知')
    })

    it('每条 toast 渲染为 role="alert"', () => {
      toastsRef.next = [{ id: 't1', title: 'A' }, { id: 't2', title: 'B' }]
      render(<Toaster />)
      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(2)
    })
  })

  describe('variant 样式分支', () => {
    const variants: Array<{ v: string; expectedClass: string }> = [
      { v: 'default', expectedClass: 'bg-background' },
      { v: 'success', expectedClass: 'bg-success/10' },
      { v: 'error', expectedClass: 'bg-destructive/10' },
      { v: 'warning', expectedClass: 'bg-warning/10' },
      { v: 'info', expectedClass: 'bg-primary/10' },
    ]

    variants.forEach(({ v, expectedClass }) => {
      it(`variant="${v}" → 卡片含 "${expectedClass}"`, () => {
        toastsRef.next = [{ id: 't1', title: 'T', variant: v }]
        render(<Toaster />)
        const alert = screen.getByRole('alert')
        expect(alert.className).toContain(expectedClass)
      })
    })
  })

  describe('variant icon 分支', () => {
    it('variant=success 渲染 ✓ 图标', () => {
      toastsRef.next = [{ id: 't1', title: 'T', variant: 'success' }]
      render(<Toaster />)
      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    it('variant=error 渲染 ✗ 图标', () => {
      toastsRef.next = [{ id: 't1', title: 'T', variant: 'error' }]
      render(<Toaster />)
      expect(screen.getByText('✗')).toBeInTheDocument()
    })

    it('variant=warning 渲染 ⚠ 图标', () => {
      toastsRef.next = [{ id: 't1', title: 'T', variant: 'warning' }]
      render(<Toaster />)
      expect(screen.getByText('⚠')).toBeInTheDocument()
    })

    it('variant=info 渲染 ⓘ 图标', () => {
      toastsRef.next = [{ id: 't1', title: 'T', variant: 'info' }]
      render(<Toaster />)
      expect(screen.getByText('ⓘ')).toBeInTheDocument()
    })

    it('variant=default 不渲染任何 icon span', () => {
      toastsRef.next = [{ id: 't1', title: 'T', variant: 'default' }]
      render(<Toaster />)
      expect(screen.queryByText('✓')).not.toBeInTheDocument()
      expect(screen.queryByText('✗')).not.toBeInTheDocument()
    })
  })

  describe('title & description 条件渲染', () => {
    it('title 非空渲染 font-medium 段落', () => {
      toastsRef.next = [{ id: 't1', title: 'Hello' }]
      render(<Toaster />)
      expect(screen.getByText('Hello')).toHaveClass('font-medium')
    })

    it('title 为空字符串 不渲染标题 p', () => {
      toastsRef.next = [{ id: 't1', title: '', description: 'desc' }]
      render(<Toaster />)
      const allPs = document.querySelectorAll('p')
      // 只有 description 的 p
      expect(allPs.length).toBe(1)
      expect(allPs[0].textContent).toBe('desc')
    })

    it('description 非空渲染 mt-1 段落', () => {
      toastsRef.next = [{ id: 't1', title: 'T', description: 'D' }]
      render(<Toaster />)
      const descP = screen.getByText('D')
      expect(descP.className).toContain('mt-1')
    })

    it('description 为 null 不渲染描述 p', () => {
      toastsRef.next = [{ id: 't1', title: 'T', description: null }]
      render(<Toaster />)
      const allPs = document.querySelectorAll('p')
      expect(allPs.length).toBe(1) // 只有 title
    })
  })

  describe('dismiss 关闭', () => {
    it('点击 ✗ 按钮触发 dismiss(t.id)', () => {
      toastsRef.next = [{ id: 'abc', title: 'T' }]
      render(<Toaster />)
      fireEvent.click(screen.getByRole('button', { name: '关闭通知' }))
      expect(dismissFn).toHaveBeenCalledWith('abc')
    })

    it('dismiss 调用后 toast 从列表中消失（mock 状态更新生效）', () => {
      toastsRef.next = [{ id: 'abc', title: 'T' }]
      const { rerender } = render(<Toaster />)
      fireEvent.click(screen.getByRole('button', { name: '关闭通知' }))
      // mock 实现里 dismissFn 已把 abc 从数组中移除
      rerender(<Toaster />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('className 合并', () => {
    it('根容器含默认 fixed/bottom-4/right-4/z-9999 + 自定义 className', () => {
      toastsRef.next = [{ id: 't1', title: 'T' }]
      render(<Toaster className="my-toaster" />)
      const region = screen.getByRole('region')
      expect(region.className).toContain('fixed')
      expect(region.className).toContain('my-toaster')
    })
  })
})
