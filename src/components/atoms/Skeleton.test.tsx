/**
 * Skeleton 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染 div 骨架元素
 * 2. 包含 animate-pulse 类
 * 3. 包含 bg-muted 背景色
 * 4. 自定义 className 合并
 * 5. ref 转发
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { Skeleton } from '@/components/molecules/states/Skeleton'

describe('Skeleton', () => {
  it('默认渲染 div 元素', () => {
    render(<Skeleton data-testid="skeleton" />)
    expect(screen.getByTestId('skeleton').tagName).toBe('DIV')
  })

  it('包含 animate-pulse 类', () => {
    render(<Skeleton data-testid="skeleton" />)
    expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse')
  })

  it('包含 bg-muted 背景色（实际类为 bg-gray-100）', () => {
    render(<Skeleton data-testid="skeleton" />)
    expect(screen.getByTestId('skeleton')).toHaveClass('bg-gray-100')
  })

  it('包含 rounded-lg 圆角（默认 rect 变体）', () => {
    render(<Skeleton data-testid="skeleton" />)
    expect(screen.getByTestId('skeleton')).toHaveClass('rounded-lg')
  })

  it('自定义 className 合并', () => {
    render(<Skeleton className="my-skeleton" data-testid="skeleton" />)
    expect(screen.getByTestId('skeleton')).toHaveClass('my-skeleton')
    expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse')
  })

  it('ref 转发到 div 元素', () => {
    const ref = createRef<HTMLDivElement>()
    render(<Skeleton ref={ref} data-testid="skeleton" />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})
