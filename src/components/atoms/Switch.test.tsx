/**
 * Switch 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染：md 尺寸、未选中状态
 * 2. checked 状态：aria-checked=true，背景色为 primary
 * 3. onChange 回调：点击时切换状态
 * 4. disabled 状态：opacity 降低，点击不触发 onChange
 * 5. size=sm：应用 sm 尺寸类（w-9 h-5）
 * 6. size=md（默认）：应用 md 尺寸类（w-11 h-6）
 * 7. size=lg：应用 lg 尺寸类（w-14 h-7）
 * 8. 焦点环：focus 时显示 ring
 * 9. role="switch" 正确设置
 * 10. aria-checked 属性随 checked 变化
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Switch } from '@/components/atoms/Switch'

describe('Switch', () => {
  it('默认渲染：md 尺寸、未选中状态', () => {
    render(<Switch checked={false} aria-label="默认开关" />)
    const sw = screen.getByRole('switch', { name: '默认开关' })
    expect(sw).toBeInTheDocument()
    expect(sw).toHaveAttribute('aria-checked', 'false')
    // md 尺寸类
    expect(sw).toHaveClass('w-11')
    expect(sw).toHaveClass('h-6')
  })

  it('checked 状态：aria-checked=true，背景色为 primary', () => {
    render(<Switch checked={true} aria-label="已选中开关" />)
    const sw = screen.getByRole('switch', { name: '已选中开关' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(sw).toHaveClass('bg-primary')
  })

  it('onChange 回调：点击时切换状态', () => {
    const handleChange = vi.fn()
    render(<Switch checked={false} onChange={handleChange} aria-label="点击测试" />)
    const sw = screen.getByRole('switch', { name: '点击测试' })
    fireEvent.click(sw)
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith({ target: { checked: true } })
  })

  it('disabled 状态：opacity 降低，点击不触发 onChange', () => {
    const handleChange = vi.fn()
    render(
      <Switch checked={false} disabled onChange={handleChange} aria-label="禁用开关" />,
    )
    const sw = screen.getByRole('switch', { name: '禁用开关' })
    expect(sw).toBeDisabled()
    expect(sw).toHaveClass('disabled:opacity-50')
    fireEvent.click(sw)
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('size=sm：应用 sm 尺寸类（w-9 h-5）', () => {
    render(<Switch checked={false} size="sm" aria-label="sm 尺寸" />)
    const sw = screen.getByRole('switch', { name: 'sm 尺寸' })
    expect(sw).toHaveClass('w-9')
    expect(sw).toHaveClass('h-5')
  })

  it('size=md（默认）：应用 md 尺寸类（w-11 h-6）', () => {
    render(<Switch checked={false} size="md" aria-label="md 尺寸" />)
    const sw = screen.getByRole('switch', { name: 'md 尺寸' })
    expect(sw).toHaveClass('w-11')
    expect(sw).toHaveClass('h-6')
  })

  it('size=lg：应用 lg 尺寸类（w-14 h-7）', () => {
    render(<Switch checked={false} size="lg" aria-label="lg 尺寸" />)
    const sw = screen.getByRole('switch', { name: 'lg 尺寸' })
    expect(sw).toHaveClass('w-14')
    expect(sw).toHaveClass('h-7')
  })

  it('焦点环：focus 时显示 ring', () => {
    render(<Switch checked={false} aria-label="焦点测试" />)
    const sw = screen.getByRole('switch', { name: '焦点测试' })
    // 焦点环样式类应存在于 class 属性中
    expect(sw.className).toContain('focus-visible:ring-2')
    expect(sw.className).toContain('focus-visible:ring-ring')
    expect(sw.className).toContain('focus-visible:ring-offset-2')
  })

  it('role="switch" 正确设置', () => {
    render(<Switch checked={false} aria-label="角色测试" />)
    const sw = screen.getByRole('switch', { name: '角色测试' })
    expect(sw).toHaveAttribute('role', 'switch')
  })

  it('aria-checked 属性随 checked 变化', () => {
    const { rerender } = render(
      <Switch checked={false} onChange={() => {}} aria-label="aria 测试" />,
    )
    const sw = screen.getByRole('switch', { name: 'aria 测试' })
    expect(sw).toHaveAttribute('aria-checked', 'false')

    rerender(<Switch checked={true} onChange={() => {}} aria-label="aria 测试" />)
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })
})
