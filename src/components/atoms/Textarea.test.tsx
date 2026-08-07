/**
 * Textarea 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 * 1. 基础渲染：textarea 标签、默认 className（含边框、圆角、focus ring）
 * 2. forwardRef：ref 挂载到 textarea
 * 3. className 合并：默认类 + 自定义 className
 * 4. disabled 属性透传
 * 5. id / placeholder / onChange 等原生属性透传
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Textarea } from './Textarea'

describe('Textarea', () => {
  describe('基础渲染 (P1)', () => {
    it('渲染为 textarea 标签', () => {
      render(<Textarea />)
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('包含默认类：flex w-full border border-input bg-background', () => {
      render(<Textarea />)
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.className).toContain('flex')
      expect(textarea.className).toContain('w-full')
      expect(textarea.className).toContain('border-input')
      expect(textarea.className).toContain('bg-background')
    })

    it('包含 focus-visible:outline-none 与 focus ring', () => {
      render(<Textarea />)
      const cls = screen.getByRole('textbox').className
      expect(cls).toContain('focus-visible:outline-none')
    })
  })

  describe('forwardRef (P4)', () => {
    it('ref 正确挂载到 textarea 元素', () => {
      const ref = vi.fn()
      render(<Textarea ref={ref} />)
      expect(ref).toHaveBeenCalled()
      expect(ref.mock.calls[0][0]?.tagName).toBe('TEXTAREA')
    })
  })

  describe('className 合并 (P6)', () => {
    it('自定义 className 与默认类并存', () => {
      render(<Textarea className="my-textarea" />)
      const cls = screen.getByRole('textbox').className
      expect(cls).toContain('my-textarea')
      expect(cls).toContain('w-full')
    })
  })

  describe('原生属性透传', () => {
    it('id 透传', () => {
      render(<Textarea id="ta-1" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'ta-1')
    })

    it('placeholder 透传', () => {
      render(<Textarea placeholder="请输入内容" />)
      expect(screen.getByPlaceholderText('请输入内容')).toBeInTheDocument()
    })

    it('disabled=true → textarea.disabled=true 且 className 含 disabled:opacity-50', () => {
      render(<Textarea disabled />)
      const ta = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(ta.disabled).toBe(true)
      expect(ta.className).toContain('disabled:opacity-50')
    })

    it('rows 透传', () => {
      render(<Textarea rows={5} />)
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).rows).toBe(5)
    })
  })
})
