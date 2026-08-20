/**
 * Input 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染 input
 * 2. type 属性透传
 * 3. onChange 事件
 * 4. value/defaultValue
 * 5. disabled 状态
 * 6. placeholder
 * 7. ref 转发
 * 8. className 合并
 * 9. ARIA 属性透传
 * 10. error / success 状态与文案
 * 11. startAdornment / endAdornment
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { Input } from '@/components/atoms/Input'
import { Search, Calendar } from 'lucide-react'

describe('Input', () => {
  it('默认渲染 input 元素', () => {
    render(<Input placeholder="请输入" />)
    const input = screen.getByPlaceholderText('请输入')
    expect(input.tagName).toBe('INPUT')
  })

  it('type 属性透传', () => {
    render(<Input type="email" data-testid="email" />)
    expect(screen.getByTestId('email')).toHaveAttribute('type', 'email')
  })

  it('type=password 生效', () => {
    render(<Input type="password" data-testid="pwd" />)
    expect(screen.getByTestId('pwd')).toHaveAttribute('type', 'password')
  })

  it('onChange 事件正确触发', () => {
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} data-testid="input" />)
    const input = screen.getByTestId('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(input.value).toBe('hello')
  })

  it('受控 value 反映到 DOM', () => {
    const { rerender } = render(<Input value="initial" onChange={() => {}} data-testid="input" />)
    const input = screen.getByTestId('input') as HTMLInputElement
    expect(input.value).toBe('initial')
    rerender(<Input value="updated" onChange={() => {}} data-testid="input" />)
    expect(input.value).toBe('updated')
  })

  it('disabled 时不可编辑', () => {
    render(<Input disabled data-testid="input" />)
    const input = screen.getByTestId('input') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('placeholder 正确显示', () => {
    render(<Input placeholder="搜索股票代码" />)
    expect(screen.getByPlaceholderText('搜索股票代码')).toBeInTheDocument()
  })

  it('ref 转发到 input 元素', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input ref={ref} data-testid="input" />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('自定义 className 合并到 input 元素', () => {
    render(<Input className="custom-input" data-testid="input" />)
    const input = screen.getByTestId('input')
    expect(input).toHaveClass('custom-input')
  })

  it('ARIA 属性（如 aria-label, aria-invalid）正确透传', () => {
    render(
      <Input aria-label="用户名" aria-invalid="true" data-testid="input" />,
    )
    const input = screen.getByTestId('input')
    expect(input).toHaveAttribute('aria-label', '用户名')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('onFocus 和 onBlur 事件正确触发', () => {
    const handleFocus = vi.fn()
    const handleBlur = vi.fn()
    render(
      <Input onFocus={handleFocus} onBlur={handleBlur} data-testid="input" />,
    )
    const input = screen.getByTestId('input')
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(handleFocus).toHaveBeenCalledTimes(1)
    expect(handleBlur).toHaveBeenCalledTimes(1)
  })

  it('error 状态显示错误边框、图标与文案', () => {
    render(<Input error errorText="必填项" data-testid="input" />)
    const wrapper = screen.getByTestId('input').parentElement
    expect(wrapper).toHaveClass('border-destructive')
    expect(screen.getByText('必填项')).toBeInTheDocument()
    expect(document.querySelector('[data-testid=input] ~ span svg')).toBeInTheDocument()
  })

  it('success 状态显示成功边框与对勾图标', () => {
    render(<Input success data-testid="input" />)
    const wrapper = screen.getByTestId('input').parentElement
    expect(wrapper).toHaveClass('border-success')
    expect(document.querySelector('[data-testid=input] ~ span svg')).toBeInTheDocument()
  })

  it('前缀图标正确渲染', () => {
    render(<Input startAdornment={<Search className="h-4 w-4" />} data-testid="input" />)
    const wrapper = screen.getByTestId('input').parentElement
    expect(wrapper?.querySelector('svg')).toBeInTheDocument()
  })

  it('后缀元素正确渲染', () => {
    render(<Input endAdornment={<Calendar className="h-4 w-4" />} data-testid="input" />)
    const wrapper = screen.getByTestId('input').parentElement
    expect(wrapper?.querySelector('svg')).toBeInTheDocument()
  })
})
