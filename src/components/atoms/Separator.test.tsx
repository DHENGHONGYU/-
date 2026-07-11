/**
 * Separator 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认 orientation=horizontal 渲染 1px 高的横线
 * 2. orientation=vertical 渲染 1px 宽的竖线
 * 3. decorative=true 时 role=none
 * 4. decorative=false 时 role=separator + aria-orientation
 * 5. 自定义 className 合并
 * 6. ref 转发
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { Separator } from '@/components/atoms/Separator'

describe('Separator', () => {
  it('默认 orientation=horizontal 渲染横线（h-[1px] w-full）', () => {
    render(<Separator data-testid="sep" />)
    const sep = screen.getByTestId('sep')
    expect(sep).toHaveClass('h-[1px]')
    expect(sep).toHaveClass('w-full')
  })

  it('orientation=horizontal 时 h-[1px] w-full', () => {
    render(<Separator orientation="horizontal" data-testid="sep" />)
    const sep = screen.getByTestId('sep')
    expect(sep).toHaveClass('h-[1px]')
    expect(sep).toHaveClass('w-full')
  })

  it('orientation=vertical 时 h-full w-[1px]', () => {
    render(<Separator orientation="vertical" data-testid="sep" />)
    const sep = screen.getByTestId('sep')
    expect(sep).toHaveClass('h-full')
    expect(sep).toHaveClass('w-[1px]')
  })

  it('decorative=true（默认）时 role=none', () => {
    render(<Separator data-testid="sep" />)
    expect(screen.getByTestId('sep')).toHaveAttribute('role', 'none')
  })

  it('decorative=false 时 role=separator', () => {
    render(<Separator decorative={false} data-testid="sep" />)
    expect(screen.getByTestId('sep')).toHaveAttribute('role', 'separator')
  })

  it('decorative=false 时 aria-orientation 反映 orientation', () => {
    render(<Separator decorative={false} orientation="vertical" data-testid="sep" />)
    expect(screen.getByTestId('sep')).toHaveAttribute('aria-orientation', 'vertical')
  })

  it('decorative=true 时 aria-orientation 不设置', () => {
    render(<Separator data-testid="sep" />)
    const sep = screen.getByTestId('sep')
    expect(sep).not.toHaveAttribute('aria-orientation')
  })

  it('应用基础 separator 样式（bg-border, shrink-0）', () => {
    render(<Separator data-testid="sep" />)
    const sep = screen.getByTestId('sep')
    expect(sep).toHaveClass('bg-border')
    expect(sep).toHaveClass('shrink-0')
  })

  it('自定义 className 合并', () => {
    render(<Separator className="my-sep" data-testid="sep" />)
    const sep = screen.getByTestId('sep')
    expect(sep).toHaveClass('my-sep')
    expect(sep).toHaveClass('bg-border')
  })

  it('ref 转发到 div 元素', () => {
    const ref = createRef<HTMLDivElement>()
    render(<Separator ref={ref} data-testid="sep" />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})
