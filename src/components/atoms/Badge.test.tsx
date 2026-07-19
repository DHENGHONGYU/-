/**
 * Badge 组件单元测试
 *
 * 覆盖场景：
 * 1. 6 种 variant 样式生效
 * 2. 自定义 className 合并
 * 3. ref 转发
 * 4. 原生属性透传
 * 5. 默认 variant（default）样式
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { Badge } from '@/components/atoms/Badge'

describe('Badge', () => {
  it('默认 variant=default 应用 primary 样式', () => {
    render(<Badge>徽章</Badge>)
    const badge = screen.getByText('徽章')
    expect(badge.tagName).toBe('SPAN')
    expect(badge).toHaveClass('bg-primary')
    expect(badge).toHaveClass('text-primary-foreground')
  })

  it('variant=secondary 应用 secondary 样式', () => {
    render(<Badge variant="secondary">次要</Badge>)
    expect(screen.getByText('次要')).toHaveClass('bg-secondary')
  })

  it('variant=outline 应用 outline 样式（主题感知前景色，无背景色）', () => {
    render(<Badge variant="outline">轮廓</Badge>)
    const badge = screen.getByText('轮廓')
    // 迁移后：outline 用主题感知的 text-foreground + border-border
    expect(badge).toHaveClass('text-foreground')
    expect(badge).toHaveClass('border-border')
    // outline 不应该带 bg-primary/secondary/destructive
    expect(badge).not.toHaveClass('bg-primary')
  })

  it('variant=destructive 应用主题感知的 destructive 语义令牌', () => {
    render(<Badge variant="destructive">危险</Badge>)
    const badge = screen.getByText('危险')
    expect(badge).toHaveClass('bg-destructive')
    expect(badge).toHaveClass('text-destructive-foreground')
  })

  it('variant=success 应用主题感知的 success 语义令牌', () => {
    render(<Badge variant="success">成功</Badge>)
    const badge = screen.getByText('成功')
    expect(badge).toHaveClass('bg-success')
    expect(badge).toHaveClass('text-success-foreground')
  })

  it('variant=warning 应用主题感知的 warning 语义令牌', () => {
    render(<Badge variant="warning">警告</Badge>)
    const badge = screen.getByText('警告')
    expect(badge).toHaveClass('bg-warning')
    expect(badge).toHaveClass('text-warning-foreground')
  })

  it('应用基础徽章样式（rounded-full, px-2.5 等）', () => {
    render(<Badge>基础</Badge>)
    const badge = screen.getByText('基础')
    expect(badge).toHaveClass('inline-flex')
    expect(badge).toHaveClass('rounded-full')
    expect(badge).toHaveClass('px-2.5')
    expect(badge).toHaveClass('text-xs')
  })

  it('自定义 className 合并', () => {
    render(<Badge className="my-badge">合并</Badge>)
    const badge = screen.getByText('合并')
    expect(badge).toHaveClass('my-badge')
    expect(badge).toHaveClass('bg-primary')
  })

  it('ref 转发到 span 元素', () => {
    const ref = createRef<HTMLSpanElement>()
    render(<Badge ref={ref}>ref 测试</Badge>)
    expect(ref.current).toBeInstanceOf(HTMLSpanElement)
  })

  it('原生 HTML 属性（如 title、aria-label）正确透传', () => {
    render(
      <Badge title="标题提示" aria-label="徽章">
        内容
      </Badge>,
    )
    expect(screen.getByLabelText('徽章')).toHaveAttribute('title', '标题提示')
  })

  it('作为子元素渲染（如包含图标 + 文字）', () => {
    render(
      <Badge>
        <span data-testid="icon">★</span>
        收藏
      </Badge>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('收藏')).toBeInTheDocument()
  })
})
