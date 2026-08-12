/**
 * Label 组件单元测试
 *
 * 覆盖场景：
 * 1. 渲染 children 文本
 * 2. optional=true 时显示"(可选)"
 * 3. optional=false 时不显示"(可选)"
 * 4. htmlFor 属性透传（关联表单控件）
 * 5. className 合并
 * 6. ref 转发
 * 7. 原生 label 属性（如 form）
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { Label } from '@/components/atoms/Label'

describe('Label', () => {
  it('渲染 children 文本', () => {
    render(<Label>用户名</Label>)
    expect(screen.getByText('用户名')).toBeInTheDocument()
  })

  it('渲染为 label 元素', () => {
    render(<Label>标签</Label>)
    const label = screen.getByText('标签')
    expect(label.tagName).toBe('LABEL')
  })

  it('optional=true 时显示"(可选)"标记', () => {
    render(<Label optional>邮箱</Label>)
    expect(screen.getByText('(可选)')).toBeInTheDocument()
  })

  it('optional=false 时不显示"(可选)"标记', () => {
    render(<Label optional={false}>必填</Label>)
    expect(screen.queryByText('(可选)')).not.toBeInTheDocument()
  })

  it('未传 optional 时不显示"(可选)"标记', () => {
    render(<Label>姓名</Label>)
    expect(screen.queryByText('(可选)')).not.toBeInTheDocument()
  })

  it('htmlFor 透传：可关联 input 元素', () => {
    render(
      <>
        <Label htmlFor="username-input">用户名</Label>
        <input id="username-input" />
      </>,
    )
    const label = screen.getByText('用户名')
    expect(label).toHaveAttribute('for', 'username-input')
  })

  it('应用基础 label 样式', () => {
    render(<Label>样式</Label>)
    const label = screen.getByText('样式')
    expect(label).toHaveClass('text-sm')
    expect(label).toHaveClass('font-medium')
  })

  it('自定义 className 合并', () => {
    render(<Label className="my-label">合并</Label>)
    const label = screen.getByText('合并')
    expect(label).toHaveClass('my-label')
    expect(label).toHaveClass('text-sm')
  })

  it('ref 转发到 label 元素', () => {
    const ref = createRef<HTMLLabelElement>()
    render(<Label ref={ref}>ref 测试</Label>)
    expect(ref.current).toBeInstanceOf(HTMLLabelElement)
  })

  it('原生属性（如 form、title）正确透传', () => {
    render(
      <Label form="my-form" title="提示">
        表单字段
      </Label>,
    )
    const label = screen.getByText('表单字段')
    expect(label).toHaveAttribute('form', 'my-form')
    expect(label).toHaveAttribute('title', '提示')
  })

  it('children 与 optional 标记可同时渲染', () => {
    render(<Label optional>手机号</Label>)
    const label = screen.getByText('手机号')
    expect(label).toBeInTheDocument()
    expect(label.textContent).toContain('手机号')
    expect(label.textContent).toContain('(可选)')
  })
})
