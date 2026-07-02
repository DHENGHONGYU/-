/**
 * Progress 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染进度条
 * 2. value/max 比例反映到内层条 width
 * 3. value 超额时夹紧到 100%
 * 4. value 负值时夹紧到 0%
 * 5. label 渲染
 * 6. showMax=false 时不显示 max 文本
 * 7. 自定义 max（默认 5）
 * 8. ref 转发
 * 9. className 合并
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { Progress } from '@/components/ui/Progress'

describe('Progress', () => {
  it('默认渲染进度条容器', () => {
    const { container } = render(<Progress value={3} />)
    const outer = container.firstChild as HTMLElement
    expect(outer.tagName).toBe('DIV')
    expect(outer).toHaveClass('w-full')
  })

  it('value/max 比例反映到内层 bar 的 width', () => {
    const { container } = render(<Progress value={2} max={4} />)
    const innerBar = container.querySelector('.bg-primary') as HTMLElement
    expect(innerBar).toBeInTheDocument()
    expect(innerBar.style.width).toBe('50%')
  })

  it('value 超额时夹紧到 100%', () => {
    const { container } = render(<Progress value={10} max={5} />)
    const innerBar = container.querySelector('.bg-primary') as HTMLElement
    expect(innerBar.style.width).toBe('100%')
  })

  it('value 负值时夹紧到 0%', () => {
    const { container } = render(<Progress value={-5} max={5} />)
    const innerBar = container.querySelector('.bg-primary') as HTMLElement
    expect(innerBar.style.width).toBe('0%')
  })

  it('value=0 渲染 0% 宽度', () => {
    const { container } = render(<Progress value={0} max={5} />)
    const innerBar = container.querySelector('.bg-primary') as HTMLElement
    expect(innerBar.style.width).toBe('0%')
  })

  it('value=max 渲染 100% 宽度', () => {
    const { container } = render(<Progress value={5} max={5} />)
    const innerBar = container.querySelector('.bg-primary') as HTMLElement
    expect(innerBar.style.width).toBe('100%')
  })

  it('label 渲染时显示标签文本', () => {
    render(<Progress value={3} max={5} label="评分" />)
    expect(screen.getByText('评分')).toBeInTheDocument()
  })

  it('label + showMax=true 时显示 "value.toFixed(1) / max"', () => {
    render(<Progress value={3.5} max={5} label="评分" />)
    expect(screen.getByText('3.5 / 5')).toBeInTheDocument()
  })

  it('label + showMax=false 时不显示 max 文本', () => {
    render(<Progress value={3} max={5} label="评分" showMax={false} />)
    expect(screen.getByText('评分')).toBeInTheDocument()
    expect(screen.queryByText('3.0 / 5')).not.toBeInTheDocument()
  })

  it('默认 max=5', () => {
    const { container } = render(<Progress value={2.5} label="评分" />)
    const innerBar = container.querySelector('.bg-primary') as HTMLElement
    // 2.5 / 5 = 50%
    expect(innerBar.style.width).toBe('50%')
    expect(screen.getByText('2.5 / 5')).toBeInTheDocument()
  })

  it('ref 转发到外层 div', () => {
    const ref = createRef<HTMLDivElement>()
    render(<Progress ref={ref} value={3} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('自定义 className 合并', () => {
    render(<Progress value={3} className="my-progress" data-testid="progress" />)
    const outer = screen.getByTestId('progress')
    expect(outer).toHaveClass('my-progress')
    expect(outer).toHaveClass('w-full')
  })

  it('无 label 时不渲染 label 区域', () => {
    const { container } = render(<Progress value={3} />)
    // 容器内仅有外层 div + 进度条（无 label 区域）
    expect(container.querySelector('.text-muted-foreground')).toBeNull()
  })
})
