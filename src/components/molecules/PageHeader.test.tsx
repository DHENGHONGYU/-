/**
 * PageHeader 组件单元测试
 * 覆盖：标题/描述/操作区渲染、排版阶梯类、分隔线结构
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/molecules/PageHeader'

describe('PageHeader', () => {
  it('渲染标题为 h1 并套用排版阶梯', () => {
    render(<PageHeader title="复盘概览" />)
    const h1 = screen.getByRole('heading', { level: 1, name: '复盘概览' })
    expect(h1).toHaveClass('text-h1')
  })

  it('渲染描述（辅助文字）与操作区', () => {
    render(
      <PageHeader
        title="复盘概览"
        description="今日市场复盘"
        actions={<button type="button">刷新</button>}
      />,
    )
    expect(screen.getByText('今日市场复盘')).toHaveClass('text-body-sm', 'text-muted-foreground')
    expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument()
  })

  it('结构包含底部分隔线', () => {
    const { container } = render(<PageHeader title="标题" />)
    const header = container.querySelector('header')!
    expect(header).toHaveClass('border-b', 'border-border', 'pb-4')
  })
})
