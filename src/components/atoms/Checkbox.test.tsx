/**
 * Checkbox 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染 input[type=checkbox]
 * 2. label 属性渲染 label 文本
 * 3. checked 状态变化
 * 4. onChange 事件
 * 5. disabled 状态
 * 6. ref 转发
 * 7. className 合并
 * 8. ARIA 属性透传
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { Checkbox } from '@/components/atoms/Checkbox'

describe('Checkbox', () => {
  it('默认渲染 input[type=checkbox]', () => {
    render(<Checkbox aria-label="同意" />)
    const cb = screen.getByLabelText('同意')
    expect(cb.tagName).toBe('INPUT')
    expect(cb).toHaveAttribute('type', 'checkbox')
  })

  it('label 属性渲染 label 文本', () => {
    render(<Checkbox label="记住我" />)
    expect(screen.getByText('记住我')).toBeInTheDocument()
  })

  it('无 label 时不渲染 label 文本节点', () => {
    const { container } = render(<Checkbox aria-label="无标签" />)
    // 容器内仅有 input + 无 span
    const span = container.querySelector('span')
    expect(span).toBeNull()
  })

  it('点击 input 触发 onChange 与状态切换', () => {
    const handleChange = vi.fn()
    render(<Checkbox onChange={handleChange} aria-label="测试" />)
    const cb = screen.getByLabelText('测试') as HTMLInputElement
    expect(cb.checked).toBe(false)
    fireEvent.click(cb)
    expect(handleChange).toHaveBeenCalled()
    expect(cb.checked).toBe(true)
  })

  it('受控 checked 反映到 DOM', () => {
    const { rerender } = render(
      <Checkbox checked={false} onChange={() => {}} aria-label="受控" />,
    )
    const cb = screen.getByLabelText('受控') as HTMLInputElement
    expect(cb.checked).toBe(false)
    rerender(<Checkbox checked={true} onChange={() => {}} aria-label="受控" />)
    expect(cb.checked).toBe(true)
  })

  it('disabled 时不可点击', () => {
    const handleChange = vi.fn()
    render(
      <Checkbox disabled onChange={handleChange} label="禁用" />,
    )
    const cb = screen.getByLabelText('禁用') as HTMLInputElement
    expect(cb).toBeDisabled()
  })

  it('ref 转发到 input 元素', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Checkbox ref={ref} aria-label="ref 测试" />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('自定义 className 应用到外层 label', () => {
    const { container } = render(
      <Checkbox className="my-checkbox" label="自定义" />,
    )
    const labelEl = container.querySelector('label')
    expect(labelEl).toHaveClass('my-checkbox')
    expect(labelEl).toHaveClass('flex') // 默认样式
  })

  it('原生属性（如 name, value）正确透传', () => {
    render(
      <Checkbox name="agree" value="yes" aria-label="姓名测试" />,
    )
    const cb = screen.getByLabelText('姓名测试')
    expect(cb).toHaveAttribute('name', 'agree')
    expect(cb).toHaveAttribute('value', 'yes')
  })

  it('label 文案与 input 通过 DOM 嵌套关联', () => {
    const { container } = render(<Checkbox label="嵌套" />)
    const label = container.querySelector('label')!
    const cb = label.querySelector('input')!
    const text = label.querySelector('span')!
    expect(cb).toBeTruthy()
    expect(text.textContent).toBe('嵌套')
  })
})
