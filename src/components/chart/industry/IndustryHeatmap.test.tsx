import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IndustryHeatmap, type IndustryHeatmapDataItem } from './IndustryHeatmap'

const baseData: IndustryHeatmapDataItem[] = [
  { code: 'A', name: '行业A', value: 80 },
  { code: 'B', name: '行业B', value: 20 },
  { code: 'C', name: '行业C', value: 50 },
]

describe('IndustryHeatmap 独立复检（验收闸门一档实跑）', () => {
  it('渲染所有行业单元格', () => {
    render(<IndustryHeatmap data={baseData} />)
    expect(screen.getByText('行业A')).toBeInTheDocument()
    expect(screen.getByText('行业B')).toBeInTheDocument()
    expect(screen.getByText('行业C')).toBeInTheDocument()
  })

  it('onCellClick 提供时单元格可键盘激活（role=button/tabIndex/Enter·Space）— 验证 B1 修复', () => {
    const onCellClick = vi.fn()
    render(<IndustryHeatmap data={baseData} onCellClick={onCellClick} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(baseData.length)
    fireEvent.keyDown(buttons[0]!, { key: 'Enter' })
    expect(onCellClick).toHaveBeenCalledWith(baseData[0])
    fireEvent.keyDown(buttons[1]!, { key: ' ' })
    expect(onCellClick).toHaveBeenCalledWith(baseData[1])
  })

  it('onCellClick 提供时鼠标点击触发回调', () => {
    const onCellClick = vi.fn()
    render(<IndustryHeatmap data={baseData} onCellClick={onCellClick} />)
    fireEvent.click(screen.getByText('行业A'))
    expect(onCellClick).toHaveBeenCalledWith(baseData[0])
  })

  it('无 onCellClick 时单元格非 button（不强制键盘语义）', () => {
    render(<IndustryHeatmap data={baseData} />)
    expect(screen.queryAllByRole('button').length).toBe(0)
  })

  it('单元格背景色为有效色值（非 rgb(NaN,...)）— 验证 A1 当下正确性', () => {
    render(<IndustryHeatmap data={baseData} />)
    const cell = screen.getByText('行业A').closest('div')!
    const bg = cell.style.backgroundColor
    expect(bg).toMatch(/^rgb\(/)
    expect(bg).not.toContain('NaN')
  })

  it('onCellClick 提供时单元格有 focus-visible 视觉反馈（className 含令牌）— 验证 B6', () => {
    const onCellClick = vi.fn()
    render(<IndustryHeatmap data={baseData} onCellClick={onCellClick} />)
    const cell = screen.getByText('行业A').closest('div')!
    expect(cell.className).toContain('focus-visible:outline-none')
    expect(cell.className).toContain('focus-visible:ring-2')
    expect(cell.className).toContain('focus-visible:ring-blue-500')
    expect(cell.className).toContain('focus-visible:ring-offset-2')
  })

  it('无 onCellClick 时单元格无 focus-visible className（不强制可访问性语义）', () => {
    render(<IndustryHeatmap data={baseData} />)
    const cell = screen.getByText('行业A').closest('div')!
    expect(cell.className).not.toContain('focus-visible:')
  })
})
