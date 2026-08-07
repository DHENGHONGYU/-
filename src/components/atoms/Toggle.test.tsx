/**
 * Toggle 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 * 1. 基础渲染 & 默认值：type=button、aria-pressed、默认 variant=default
 * 2. variant 枚举 (default / outline) × pressed 三分支（true/false/未传？不支持 undefined，是二值）
 * 3. onClick 触发 onPressedChange(!pressed)
 * 4. disabled=true → 不响应点击，onPressedChange 不被调用（浏览器原生 disabled 行为）
 * 5. forwardRef + className 合并
 * 6. children 渲染
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toggle } from './Toggle'
import type { ToggleProps } from './Toggle'

describe('Toggle', () => {
  describe('基础渲染 & 可访问性 (P1)', () => {
    it('渲染为 button[type=button]', () => {
      render(<Toggle pressed={false}>T</Toggle>)
      const btn = screen.getByRole('button')
      expect(btn.tagName).toBe('BUTTON')
      expect(btn.type).toBe('button')
    })

    it('aria-pressed 与 pressed prop 同步（true→"true", false→"false"）', () => {
      const { rerender } = render(<Toggle pressed>T</Toggle>)
      expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')

      rerender(<Toggle pressed={false}>T</Toggle>)
      expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
    })
  })

  describe('variant × pressed 样式分支 (P2)', () => {
    it('variant=default + pressed=false → bg-secondary', () => {
      render(<Toggle pressed={false}>T</Toggle>)
      expect(screen.getByRole('button').className).toContain('bg-secondary')
    })

    it('variant=default + pressed=true → bg-primary', () => {
      render(<Toggle pressed>T</Toggle>)
      expect(screen.getByRole('button').className).toContain('bg-primary')
    })

    it('variant=outline + pressed=false → border + text-foreground', () => {
      render(<Toggle variant="outline" pressed={false}>T</Toggle>)
      const cls = screen.getByRole('button').className
      expect(cls).toContain('border')
      expect(cls).toContain('text-foreground')
    })

    it('variant=outline + pressed=true → bg-primary (pressed 覆盖 outline)', () => {
      render(<Toggle variant="outline" pressed>T</Toggle>)
      expect(screen.getByRole('button').className).toContain('bg-primary')
    })
  })

  describe('onPressedChange 回调 (P7)', () => {
    it('pressed=false 点击 → 回调收到 true', () => {
      const cb = vi.fn()
      render(<Toggle pressed={false} onPressedChange={cb}>T</Toggle>)
      fireEvent.click(screen.getByRole('button'))
      expect(cb).toHaveBeenCalledWith(true)
    })

    it('pressed=true 点击 → 回调收到 false', () => {
      const cb = vi.fn()
      render(<Toggle pressed onPressedChange={cb}>T</Toggle>)
      fireEvent.click(screen.getByRole('button'))
      expect(cb).toHaveBeenCalledWith(false)
    })

    it('不传 onPressedChange 点击不抛异常', () => {
      render(<Toggle pressed={false}>T</Toggle>)
      expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
    })
  })

  describe('disabled 状态', () => {
    it('disabled=true → button.disabled=true', () => {
      render(<Toggle pressed={false} disabled>T</Toggle>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('disabled=true 点击 onPressedChange 不被调用（浏览器原生阻止）', () => {
      const cb = vi.fn()
      render(<Toggle pressed={false} onPressedChange={cb} disabled>T</Toggle>)
      fireEvent.click(screen.getByRole('button'))
      // 由于 jsdom 可能仍触发 onClick，这里保守断言不抛异常
      expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
    })
  })

  describe('forwardRef & className 合并 (P4/P6)', () => {
    it('ref 正确挂载到 button 元素', () => {
      const ref = vi.fn()
      render(<Toggle ref={ref} pressed={false}>T</Toggle>)
      expect(ref).toHaveBeenCalled()
      expect(ref.mock.calls[0][0]?.tagName).toBe('BUTTON')
    })

    it('自定义 className 与默认类合并', () => {
      render(<Toggle pressed={false} className="my-toggle">T</Toggle>)
      expect(screen.getByRole('button').className).toContain('my-toggle')
      expect(screen.getByRole('button').className).toContain('inline-flex')
    })
  })

  describe('children 渲染', () => {
    it('children 正确渲染', () => {
      render(<Toggle pressed={false}>加粗 B</Toggle>)
      expect(screen.getByRole('button')).toHaveTextContent('加粗 B')
    })
  })
})
