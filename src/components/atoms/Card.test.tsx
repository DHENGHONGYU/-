/**
 * Card 组件族单元测试
 *
 * 覆盖场景：
 * 1. Card/CardHeader/CardTitle/CardDescription/CardAction/CardContent/CardFooter 渲染
 * 2. 复合结构（完整卡片）
 * 3. className 合并
 * 4. ref 转发
 * 5. 透传原生 HTML 属性
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/Card'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

describe('Card 组件族', () => {
  it('Card 渲染 div 并应用默认样式', () => {
    render(<Card data-testid="card">主体</Card>)
    const card = screen.getByTestId('card')
    expect(card.tagName).toBe('DIV')
    expect(card).toHaveClass('rounded-lg')
    expect(card).toHaveClass('border')
    // 断言令牌引用(AGENTS.md §3.5.5):COLOR_TOKENS.bgCard.tailwind = 'bg-white'
    expect(card).toHaveClass(COLOR_TOKENS.bgCard.tailwind)
    expect(card).toHaveClass('text-card-foreground')
  })

  it('CardHeader 渲染并应用 flex 布局', () => {
    render(<CardHeader data-testid="header">头部</CardHeader>)
    const header = screen.getByTestId('header')
    expect(header).toHaveClass('flex')
    expect(header).toHaveClass('flex-col')
  })

  it('CardTitle 渲染 h3', () => {
    render(<CardTitle>卡片标题</CardTitle>)
    const title = screen.getByText('卡片标题')
    expect(title.tagName).toBe('H3')
    expect(title).toHaveClass('text-lg')
    expect(title).toHaveClass('font-semibold')
  })

  it('CardDescription 渲染 p', () => {
    render(<CardDescription>卡片描述</CardDescription>)
    const desc = screen.getByText('卡片描述')
    expect(desc.tagName).toBe('P')
    // 断言令牌引用(AGENTS.md §3.5.5):COLOR_TOKENS.textMuted.tailwind = 'text-slate-400'
    expect(desc).toHaveClass(COLOR_TOKENS.textMuted.tailwind)
  })

  it('CardAction 渲染 div', () => {
    render(<CardAction data-testid="action">操作</CardAction>)
    const action = screen.getByTestId('action')
    expect(action.tagName).toBe('DIV')
    expect(action).toHaveClass('ml-auto')
  })

  it('CardContent 渲染 div', () => {
    render(<CardContent data-testid="content">内容</CardContent>)
    expect(screen.getByTestId('content').tagName).toBe('DIV')
  })

  it('CardFooter 渲染 div', () => {
    render(<CardFooter data-testid="footer">底部</CardFooter>)
    expect(screen.getByTestId('footer').tagName).toBe('DIV')
  })

  it('完整 Card 复合结构渲染正确', () => {
    render(
      <Card data-testid="full-card">
        <CardHeader>
          <CardTitle>标题</CardTitle>
          <CardDescription>描述文字</CardDescription>
          <CardAction>操作</CardAction>
        </CardHeader>
        <CardContent>内容主体</CardContent>
        <CardFooter>底部操作</CardFooter>
      </Card>,
    )
    expect(screen.getByTestId('full-card')).toBeInTheDocument()
    expect(screen.getByText('标题').tagName).toBe('H3')
    expect(screen.getByText('描述文字').tagName).toBe('P')
    expect(screen.getByText('内容主体')).toBeInTheDocument()
    expect(screen.getByText('底部操作')).toBeInTheDocument()
  })

  it('自定义 className 合并到默认 className', () => {
    render(<Card className="my-card" data-testid="card">内容</Card>)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('my-card')
    expect(card).toHaveClass('rounded-lg')
  })

  it('Card ref 转发到 div 元素', () => {
    const ref = createRef<HTMLDivElement>()
    render(<Card ref={ref} data-testid="card">ref 测试</Card>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('CardHeader ref 转发到 div 元素', () => {
    const ref = createRef<HTMLDivElement>()
    render(<CardHeader ref={ref} data-testid="header">ref 测试</CardHeader>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('原生 HTML 属性（如 aria-label、data-*）正确透传', () => {
    render(
      <Card aria-label="卡片" data-foo="bar">
        内容
      </Card>,
    )
    const card = screen.getByLabelText('卡片')
    expect(card).toHaveAttribute('data-foo', 'bar')
  })
})
