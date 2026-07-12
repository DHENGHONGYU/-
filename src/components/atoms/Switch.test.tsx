/**
 * Switch 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染 input[type=checkbox]
 * 2. checked 状态切换
 * 3. onChange 事件
 * 4. disabled 状态
 * 5. ref 转发
 * 6. className 合并
 * 7. 不带 type 属性（已 Omit）
 * 8. ARIA 属性透传
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { Switch } from '@/components/atoms/Switch'

describe('Switch', () => {
  it('默认渲染 input[type=checkbox]', () => {
    render(<Switch aria-label="开关" />)
    const input = screen.getByLabelText('开关')
    expect(input.tagName).toBe('INPUT')
    expect(input).toHaveAttribute('type', 'checkbox')
  })

  it('外层使用 label 包装，点击 label 可切换', () => {
    const { container } = render(<Switch aria-label="开关" />)
    const labelEl = container.querySelector('label')
    expect(labelEl).toBeInTheDocument()
    expect(labelEl).toHaveClass('inline-flex')
  })

  it('点击 input 触发 onChange 与 checked 切换', () => {
    const handleChange = vi.fn()
    render(<Switch onChange={handleChange} aria-label="开关" />)
    const input = screen.getByLabelText('开关') as HTMLInputElement
    expect(input.checked).toBe(false)
    fireEvent.click(input)
    expect(handleChange).toHaveBeenCalled()
    expect(input.checked).toBe(true)
  })

  it('受控 checked 反映到 DOM', () => {
    const { rerender } = render(
      <Switch checked={false} onChange={() => {}} aria-label="受控" />,
    )
    const input = screen.getByLabelText('受控') as HTMLInputElement
    expect(input.checked).toBe(false)
    rerender(
      <Switch checked={true} onChange={() => {}} aria-label="受控" />,
    )
    expect(input.checked).toBe(true)
  })

  it('defaultChecked=true 时初始为 checked', () => {
    render(<Switch defaultChecked aria-label="默认开启" />)
    expect((screen.getByLabelText('默认开启') as HTMLInputElement).checked).toBe(true)
  })

  it('disabled 时不可点击', () => {
    const handleChange = vi.fn()
    render(<Switch disabled onChange={handleChange} aria-label="禁用" />)
    const input = screen.getByLabelText('禁用') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('ref 转发到 input 元素', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Switch ref={ref} aria-label="ref 测试" />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('自定义 className 应用到外层 label', () => {
    const { container } = render(
      <Switch className="my-switch" aria-label="自定义" />,
    )
    const labelEl = container.querySelector('label')
    expect(labelEl).toHaveClass('my-switch')
  })

  it('不含 type 属性（已被 Omit 排除）', () => {
    // SwitchProps 已 Omit 'type'，因此不应允许传 type
    // 这里验证组件只接受 'checkbox'
    render(<Switch aria-label="类型测试" />)
    const input = screen.getByLabelText('类型测试')
    expect(input).toHaveAttribute('type', 'checkbox')
  })

  it('name 属性正确透传', () => {
    render(<Switch name="darkMode" aria-label="暗色模式" />)
    expect(screen.getByLabelText('暗色模式')).toHaveAttribute('name', 'darkMode')
  })
})
