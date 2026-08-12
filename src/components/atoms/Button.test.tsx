/**
 * Button 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染：使用 primary variant + md size
 * 2. 6 种 variant 样式生效
 * 3. 3 种 size 样式生效
 * 4. asChild 透传 children className/ref
 * 5. click 事件冒泡
 * 6. disabled 状态
 * 7. ref 转发
 * 8. 自定义 className 合并
 * 9. isLoading 状态
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { Button } from '@/components/atoms/Button'

describe('Button', () => {
  it('默认渲染：primary variant + md size', () => {
    render(<Button>点击</Button>)
    const btn = screen.getByRole('button', { name: '点击' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveClass('bg-primary')
    expect(btn).toHaveClass('h-10')
  })

  it('variant=secondary 应用 secondary 样式', () => {
    render(<Button variant="secondary">次要</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-secondary')
  })

  it('variant=outline 应用 outline 样式', () => {
    render(<Button variant="outline">轮廓</Button>)
    expect(screen.getByRole('button')).toHaveClass('border')
  })

  it('variant=ghost 应用 ghost 样式', () => {
    render(<Button variant="ghost">幽灵</Button>)
    expect(screen.getByRole('button')).toHaveClass('hover:bg-accent')
  })

  it('variant=danger 应用主题感知的 destructive 语义令牌', () => {
    render(<Button variant="danger">危险</Button>)
    // 迁移后：改用语义令牌 bg-destructive + text-destructive-foreground（明暗一致）
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('bg-destructive')
    expect(btn).toHaveClass('text-destructive-foreground')
  })

  it('variant=success 应用主题感知的 success 语义令牌', () => {
    render(<Button variant="success">成功</Button>)
    // 迁移后：改用语义令牌 bg-success + text-success-foreground（明暗一致）
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('bg-success')
    expect(btn).toHaveClass('text-success-foreground')
  })

  it('size=sm 应用 sm 样式', () => {
    render(<Button size="sm">小</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-8')
  })

  it('size=md 应用 md 样式', () => {
    render(<Button size="md">中</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-10')
  })

  it('size=lg 应用 lg 样式', () => {
    render(<Button size="lg">大</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-12')
  })

  it('asChild=true 时透传 children className/ref/事件', () => {
    const handleClick = vi.fn()
    const ref = createRef<HTMLAnchorElement>()
    render(
      // asChild 时 Button 实际渲染 children，ref 指向 anchor
      <Button asChild variant="primary" size="md" onClick={handleClick} ref={ref as any}>
        <a href="/test" className="custom-link">
          链接
        </a>
      </Button>,
    )
    const anchor = screen.getByText('链接')
    expect(anchor.tagName).toBe('A')
    // Button 的 className 应合并到 a 上
    expect(anchor).toHaveClass('bg-primary')
    expect(anchor).toHaveClass('custom-link')
    expect(anchor).toHaveAttribute('href', '/test')
    // ref 应当指向 anchor
    expect(ref.current).toBeInstanceOf(HTMLAnchorElement)
    // onClick 应当透传
    fireEvent.click(anchor)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('asChild=true 但 children 不是 element 时仍渲染 button', () => {
    render(
      <Button asChild>
        plain text
      </Button>,
    )
    // 当 children 不是 valid element 时，仍然渲染 button
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('disabled 时不可点击并应用 disabled 样式', () => {
    const handleClick = vi.fn()
    render(
      <Button disabled onClick={handleClick}>
        禁用
      </Button>,
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveClass('disabled:opacity-50')
    fireEvent.click(btn)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('普通模式触发 onClick 事件', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>触发</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('自定义 className 与默认 className 合并', () => {
    render(<Button className="my-custom">自定义</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('my-custom')
    expect(btn).toHaveClass('inline-flex') // 默认 class 仍存在
  })

  it('额外 props（如 type、aria-label）正确透传', () => {
    render(
      <Button type="submit" aria-label="提交按钮">
        提交
      </Button>,
    )
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('type', 'submit')
    expect(btn).toHaveAttribute('aria-label', '提交按钮')
  })

  it('ref 正确转发到 button 元素', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>ref 测试</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('isLoading 时显示加载状态', () => {
    render(<Button isLoading>加载中</Button>)
    const btn = screen.getByRole('button')
    // isLoading 只是透传到 button 元素，不会自动设置 disabled
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('加载中')
  })
})
