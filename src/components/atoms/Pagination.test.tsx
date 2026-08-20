/**
 * Pagination 组件单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染（full 模式）：显示页码按钮、上一页/下一页、首尾页跳转
 * 2. 页码渲染正确性：totalPages=10, page=5 时显示正确的页码范围
 * 3. onPageChange 回调：点击页码按钮触发正确的页码
 * 4. 上一页/下一页按钮：page=1 时上一页禁用，page=totalPages 时下一页禁用
 * 5. simple 模式：仅显示上下页 + 范围文字，不显示数字页码
 * 6. numeric 模式：显示数字页码 + 上下页，无首尾页跳转
 * 7. 每页条数选择器：pageSizeOptions 存在时显示 select
 * 8. 总条目数显示：totalItems 存在时显示"共 N 条"
 * 9. 省略号显示：总页数很多时（如 20 页）显示省略号
 * 10. 禁用状态/不可点击：边界页首尾按钮正确禁用
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from '@/components/atoms/Pagination'

describe('Pagination', () => {
  // ============================================================
  // 1. 默认渲染（full 模式）
  // ============================================================
  it('默认 full 模式：渲染页码按钮、上一页/下一页、首尾页跳转', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={3} totalPages={10} onPageChange={onPageChange} />)

    // 导航容器存在
    const nav = screen.getByRole('navigation', { name: '分页' })
    expect(nav).toBeInTheDocument()

    // 首尾页按钮存在
    expect(screen.getByRole('button', { name: '第一页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '最后一页' })).toBeInTheDocument()

    // 上下页按钮存在
    expect(screen.getByRole('button', { name: '上一页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument()

    // 数字页码按钮存在
    expect(screen.getByRole('button', { name: '第 1 页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 10 页' })).toBeInTheDocument()
  })

  // ============================================================
  // 2. 页码渲染正确性
  // ============================================================
  it('totalPages=10, page=5 时显示正确的页码范围', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={5} totalPages={10} onPageChange={onPageChange} />)

    // 当前页附近应显示 4, 5, 6
    expect(screen.getByRole('button', { name: '第 4 页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 5 页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 6 页' })).toBeInTheDocument()

    // 首末页始终显示
    expect(screen.getByRole('button', { name: '第 1 页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 10 页' })).toBeInTheDocument()

    // 当前页应标记为 aria-current=page
    expect(screen.getByRole('button', { name: '第 5 页' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  // ============================================================
  // 3. onPageChange 回调
  // ============================================================
  it('点击页码按钮触发 onPageChange 并传入正确页码', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={5} totalPages={10} onPageChange={onPageChange} />)

    // page=5, totalPages=10 时可见页码为：1 ... 4 5 6 ... 10
    fireEvent.click(screen.getByRole('button', { name: '第 6 页' }))
    expect(onPageChange).toHaveBeenCalledTimes(1)
    expect(onPageChange).toHaveBeenCalledWith(6)
  })

  it('点击第一页按钮跳转到第 1 页', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={5} totalPages={10} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByRole('button', { name: '第一页' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('点击最后一页按钮跳转到最后一页', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={5} totalPages={10} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByRole('button', { name: '最后一页' }))
    expect(onPageChange).toHaveBeenCalledWith(10)
  })

  // ============================================================
  // 4. 上一页/下一页按钮禁用状态
  // ============================================================
  it('page=1 时上一页和第一页按钮禁用', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={10} onPageChange={onPageChange} />)

    const prevBtn = screen.getByRole('button', { name: '上一页' })
    const firstBtn = screen.getByRole('button', { name: '第一页' })
    expect(prevBtn).toBeDisabled()
    expect(firstBtn).toBeDisabled()

    // 点击不应触发回调
    fireEvent.click(prevBtn)
    fireEvent.click(firstBtn)
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('page=totalPages 时下一页和最后一页按钮禁用', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={10} totalPages={10} onPageChange={onPageChange} />)

    const nextBtn = screen.getByRole('button', { name: '下一页' })
    const lastBtn = screen.getByRole('button', { name: '最后一页' })
    expect(nextBtn).toBeDisabled()
    expect(lastBtn).toBeDisabled()

    // 点击不应触发回调
    fireEvent.click(nextBtn)
    fireEvent.click(lastBtn)
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('点击上一页按钮 page 减 1', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={5} totalPages={10} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByRole('button', { name: '上一页' }))
    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  it('点击下一页按钮 page 加 1', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={5} totalPages={10} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(onPageChange).toHaveBeenCalledWith(6)
  })

  // ============================================================
  // 5. simple 模式
  // ============================================================
  it('simple 模式：仅显示上下页 + 范围文字，不显示数字页码', () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        page={3}
        totalPages={10}
        pageSize={10}
        totalItems={95}
        variant="simple"
        onPageChange={onPageChange}
      />,
    )

    // 上下页按钮存在
    expect(screen.getByRole('button', { name: '上一页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument()

    // 首尾页按钮不应存在
    expect(screen.queryByRole('button', { name: '第一页' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '最后一页' })).not.toBeInTheDocument()

    // 数字页码不应存在
    expect(screen.queryByRole('button', { name: '第 1 页' })).not.toBeInTheDocument()

    // 显示范围文字：第 21-30 条，共 95 条
    expect(screen.getByText('第 21-30 条，共 95 条')).toBeInTheDocument()
  })

  it('simple 模式无 totalItems 时显示页码文字', () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        page={3}
        totalPages={10}
        variant="simple"
        onPageChange={onPageChange}
      />,
    )

    expect(screen.getByText('第 3 页，共 10 页')).toBeInTheDocument()
  })

  // ============================================================
  // 6. numeric 模式
  // ============================================================
  it('numeric 模式：显示数字页码 + 上下页，无首尾页跳转', () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        page={5}
        totalPages={10}
        variant="numeric"
        onPageChange={onPageChange}
      />,
    )

    // 上下页按钮存在
    expect(screen.getByRole('button', { name: '上一页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument()

    // 数字页码存在
    expect(screen.getByRole('button', { name: '第 1 页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 5 页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 10 页' })).toBeInTheDocument()

    // 首尾页跳转按钮不应存在
    expect(screen.queryByRole('button', { name: '第一页' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '最后一页' })).not.toBeInTheDocument()
  })

  // ============================================================
  // 7. 每页条数选择器
  // ============================================================
  it('pageSizeOptions 存在时显示每页条数 select', () => {
    const onPageChange = vi.fn()
    const onPageSizeChange = vi.fn()
    render(
      <Pagination
        page={1}
        totalPages={10}
        pageSize={10}
        pageSizeOptions={[10, 20, 50, 100]}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    )

    const select = screen.getByRole('combobox', { name: '每页条数' })
    expect(select).toBeInTheDocument()
    expect(select).toHaveValue('10')

    // 选项数量正确
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(4)
    expect(options[0]).toHaveValue('10')
    expect(options[1]).toHaveValue('20')
    expect(options[2]).toHaveValue('50')
    expect(options[3]).toHaveValue('100')
  })

  it('切换每页条数触发 onPageSizeChange', () => {
    const onPageChange = vi.fn()
    const onPageSizeChange = vi.fn()
    render(
      <Pagination
        page={1}
        totalPages={10}
        pageSize={10}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    )

    const select = screen.getByRole('combobox', { name: '每页条数' })
    fireEvent.change(select, { target: { value: '20' } })
    expect(onPageSizeChange).toHaveBeenCalledTimes(1)
    expect(onPageSizeChange).toHaveBeenCalledWith(20)
  })

  it('无 pageSizeOptions 时不显示每页条数 select', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={10} onPageChange={onPageChange} />)

    expect(
      screen.queryByRole('combobox', { name: '每页条数' }),
    ).not.toBeInTheDocument()
  })

  // ============================================================
  // 8. 总条目数显示
  // ============================================================
  it('totalItems 存在时显示"共 N 条"', () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        page={1}
        totalPages={10}
        totalItems={95}
        onPageChange={onPageChange}
      />,
    )

    expect(screen.getByText('共 95 条')).toBeInTheDocument()
  })

  it('无 totalItems 时不显示总条数文字', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={10} onPageChange={onPageChange} />)

    // full 模式下左侧 div 存在但内容为空
    const nav = screen.getByRole('navigation', { name: '分页' })
    expect(nav).not.toHaveTextContent('共')
  })

  // ============================================================
  // 9. 省略号显示
  // ============================================================
  it('总页数很多时（20 页）显示左右省略号', () => {
    const onPageChange = vi.fn()
    const { container } = render(
      <Pagination page={10} totalPages={20} onPageChange={onPageChange} />,
    )

    // 首末页存在
    expect(screen.getByRole('button', { name: '第 1 页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 20 页' })).toBeInTheDocument()

    // 当前页附近存在
    expect(screen.getByRole('button', { name: '第 9 页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 10 页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 11 页' })).toBeInTheDocument()

    // 中间间隔的页码不应直接显示（被省略号代替）
    expect(screen.queryByRole('button', { name: '第 3 页' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '第 17 页' })).not.toBeInTheDocument()

    // 省略号元素存在（2 个：左侧和右侧）
    // 注：role="presentation" 的元素不在可访问性树中，需通过 DOM 查询
    const ellipsis = container.querySelectorAll('[role="presentation"]')
    expect(ellipsis.length).toBeGreaterThanOrEqual(2)
  })

  it('总页数较少时（<=7）不显示省略号', () => {
    const onPageChange = vi.fn()
    const { container } = render(
      <Pagination page={4} totalPages={7} onPageChange={onPageChange} />,
    )

    // 所有页码都应显示
    for (let i = 1; i <= 7; i++) {
      expect(
        screen.getByRole('button', { name: `第 ${i} 页` }),
      ).toBeInTheDocument()
    }

    // 没有省略号
    const ellipsis = container.querySelectorAll('[role="presentation"]')
    expect(ellipsis.length).toBe(0)
  })

  // ============================================================
  // 10. 禁用状态/不可点击：边界页首尾按钮正确禁用
  // ============================================================
  it('边界页：page=1 时首按钮和上一页按钮禁用，点击不触发回调', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={5} onPageChange={onPageChange} />)

    const firstBtn = screen.getByRole('button', { name: '第一页' })
    const prevBtn = screen.getByRole('button', { name: '上一页' })

    expect(firstBtn).toBeDisabled()
    expect(prevBtn).toBeDisabled()

    // 禁用态样式
    expect(firstBtn).toHaveClass('opacity-50')
    expect(prevBtn).toHaveClass('opacity-50')

    // 点击不触发
    fireEvent.click(firstBtn)
    fireEvent.click(prevBtn)
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('边界页：page=totalPages 时尾按钮和下一页按钮禁用，点击不触发回调', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={5} totalPages={5} onPageChange={onPageChange} />)

    const lastBtn = screen.getByRole('button', { name: '最后一页' })
    const nextBtn = screen.getByRole('button', { name: '下一页' })

    expect(lastBtn).toBeDisabled()
    expect(nextBtn).toBeDisabled()

    // 点击不触发
    fireEvent.click(lastBtn)
    fireEvent.click(nextBtn)
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('点击当前页按钮不触发 onPageChange', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={5} totalPages={10} onPageChange={onPageChange} />)

    const currentBtn = screen.getByRole('button', { name: '第 5 页' })
    fireEvent.click(currentBtn)
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('自定义 className 合并到根元素', () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        page={1}
        totalPages={10}
        onPageChange={onPageChange}
        className="my-pagination"
      />,
    )

    const nav = screen.getByRole('navigation', { name: '分页' })
    expect(nav).toHaveClass('my-pagination')
    expect(nav).toHaveClass('flex') // 默认 class 仍存在
  })
})
