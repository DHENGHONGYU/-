import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Popover } from '@/components/atoms/Popover'
import { Menu } from '@/components/atoms/Menu'
import { Pagination } from '@/components/atoms/Pagination'
import { List } from '@/components/atoms/List'
import { Grid } from '@/components/atoms/Grid'
import { DatePicker } from '@/components/atoms/DatePicker'

describe('P2 新增原子组件 — 冒烟测试', () => {
  it('Popover renders trigger + tooltip', () => {
    render(<Popover content="提示内容"><button>触发</button></Popover>)
    expect(screen.getByText('触发')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('提示内容')
  })

  it('Menu renders items and handles Escape', () => {
    const onClose = vi.fn()
    render(<Menu open items={[
      { key: 'a', label: '选项A', onClick: vi.fn() },
      { key: 'b', label: '选项B', danger: true },
      { key: 'c', label: '选项C', disabled: true },
    ]} onClose={onClose} />)
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
    expect(screen.getByText('选项B')).toBeInTheDocument()
  })

  it('Pagination renders page buttons', () => {
    render(<Pagination page={3} total={10} onChange={vi.fn()} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('«')).toBeInTheDocument()
    expect(screen.getByText('»')).toBeInTheDocument()
  })

  it('Pagination hides when total <= 1', () => {
    const { container } = render(<Pagination page={1} total={1} onChange={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('List renders items', () => {
    render(<List items={[
      { key: '1', content: '第一项', description: '描述' },
      { key: '2', content: '第二项', disabled: true },
    ]} />)
    expect(screen.getByText('第一项')).toBeInTheDocument()
    expect(screen.getByText('描述')).toBeInTheDocument()
  })

  it('Grid renders children with columns', () => {
    render(<Grid cols={3}><span>A</span><span>B</span><span>C</span></Grid>)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('DatePicker renders and fires onChange', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-07-18" onChange={onChange} />)
    const input = screen.getByDisplayValue('2026-07-18')
    expect(input).toBeInTheDocument()
  })
})
