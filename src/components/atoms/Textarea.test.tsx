/**
 * Textarea 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染 textarea
 * 2. onChange 事件
 * 3. value/defaultValue
 * 4. placeholder
 * 5. disabled 状态
 * 6. rows 属性
 * 7. ref 转发
 * 8. className 合并
 * 9. ARIA 属性透传
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { Textarea } from '@/components/atoms/Textarea'

describe('Textarea', () => {
  it('默认渲染 textarea 元素', () => {
    render(<Textarea placeholder="请输入内容" />)
    expect(screen.getByPlaceholderText('请输入内容').tagName).toBe('TEXTAREA')
  })

  it('onChange 事件正确触发', () => {
    const handleChange = vi.fn()
    render(<Textarea onChange={handleChange} data-testid="textarea" />)
    const ta = screen.getByTestId('textarea') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'hello' } })
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(ta.value).toBe('hello')
  })

  it('受控 value 反映到 DOM', () => {
    const { rerender } = render(
      <Textarea value="initial" onChange={() => {}} data-testid="textarea" />,
    )
    const ta = screen.getByTestId('textarea') as HTMLTextAreaElement
    expect(ta.value).toBe('initial')
    rerender(<Textarea value="updated" onChange={() => {}} data-testid="textarea" />)
    expect(ta.value).toBe('updated')
  })

  it('defaultValue 在挂载时填充', () => {
    render(<Textarea defaultValue="default text" data-testid="textarea" />)
    const ta = screen.getByTestId('textarea') as HTMLTextAreaElement
    expect(ta.value).toBe('default text')
  })

  it('disabled 时不可编辑', () => {
    render(<Textarea disabled data-testid="textarea" />)
    const ta = screen.getByTestId('textarea') as HTMLTextAreaElement
    expect(ta).toBeDisabled()
  })

  it('placeholder 正确显示', () => {
    render(<Textarea placeholder="备注信息" />)
    expect(screen.getByPlaceholderText('备注信息')).toBeInTheDocument()
  })

  it('rows 属性透传', () => {
    render(<Textarea rows={8} data-testid="textarea" />)
    expect(screen.getByTestId('textarea')).toHaveAttribute('rows', '8')
  })

  it('ref 转发到 textarea 元素', () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(<Textarea ref={ref} data-testid="textarea" />)
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })

  it('自定义 className 合并', () => {
    render(<Textarea className="my-textarea" data-testid="textarea" />)
    const ta = screen.getByTestId('textarea')
    expect(ta).toHaveClass('my-textarea')
    expect(ta).toHaveClass('min-h-[80px]') // 默认样式
  })

  it('ARIA 属性（如 aria-label, aria-invalid）正确透传', () => {
    render(
      <Textarea aria-label="备注" aria-invalid="true" data-testid="textarea" />,
    )
    const ta = screen.getByTestId('textarea')
    expect(ta).toHaveAttribute('aria-label', '备注')
    expect(ta).toHaveAttribute('aria-invalid', 'true')
  })

  it('多行内容（换行符）保留', () => {
    render(
      <Textarea defaultValue="line1{'\n'}line2{'\n'}line3" data-testid="textarea" />,
    )
    const ta = screen.getByTestId('textarea') as HTMLTextAreaElement
    expect(ta.value).toContain('line1')
    expect(ta.value).toContain('line2')
    expect(ta.value).toContain('line3')
  })
})
