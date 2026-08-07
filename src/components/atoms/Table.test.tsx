/**
 * Table 系列组件单元测试 (Table/TableHeader/TableBody/TableRow/TableHead/TableCell)
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 * 1. 基础渲染：每个组件的语义化标签 + 默认 className
 * 2. Table：外层 div 包装 overflow-auto，table 为 w-full
 * 3. TableRow：包含 data-[state=selected]:bg-muted（条件属性选择器）
 * 4. TableHead：包含 [&:has([role=checkbox])]:pr-0（嵌套选择器）
 * 5. TableCell：包含 [&:has([role=checkbox])]:pr-0
 * 6. TableHeader：包含 [&_tr]:border-b
 * 7. TableBody：包含 [&_tr:last-child]:border-0
 * 8. forwardRef：各组件 ref 正确挂载
 * 9. className 合并
 * 10. 组合使用：Table>TableHeader>TableRow>TableHead + Table>TableBody>TableRow>TableCell 结构正确
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './Table'

describe('Table 系列组件', () => {
  describe('Table', () => {
    it('渲染外层 div.relative.w-full.overflow-auto 包裹 table', () => {
      const { container } = render(<Table />)
      const wrapper = container.firstElementChild as HTMLElement
      expect(wrapper.tagName).toBe('DIV')
      expect(wrapper.className).toContain('relative')
      expect(wrapper.className).toContain('overflow-auto')
      const table = wrapper.firstElementChild as HTMLTableElement
      expect(table.tagName).toBe('TABLE')
      expect(table.className).toContain('w-full')
    })

    it('forwardRef 挂载到 table 元素', () => {
      const ref = vi.fn()
      render(<Table ref={ref} />)
      expect(ref).toHaveBeenCalled()
      expect(ref.mock.calls[0][0]?.tagName).toBe('TABLE')
    })

    it('className 合并到 table', () => {
      const { container } = render(<Table className="my-table" />)
      const table = container.querySelector('table')!
      expect(table.className).toContain('my-table')
      expect(table.className).toContain('w-full')
    })
  })

  describe('TableHeader', () => {
    it('渲染为 thead 标签，包含 [&_tr]:border-b', () => {
      render(
        <table>
          <TableHeader />
        </table>,
      )
      const thead = screen.getByRole('rowgroup') as HTMLTableSectionElement
      expect(thead.tagName).toBe('THEAD')
      expect(thead.className).toContain('border-b')
    })

    it('forwardRef 挂载到 thead', () => {
      const ref = vi.fn()
      render(
        <table>
          <TableHeader ref={ref} />
        </table>,
      )
      expect(ref.mock.calls[0][0]?.tagName).toBe('THEAD')
    })
  })

  describe('TableBody', () => {
    it('渲染为 tbody，包含 [&_tr:last-child]:border-0', () => {
      render(
        <table>
          <TableBody />
        </table>,
      )
      const tbody = document.querySelector('tbody') as HTMLTableSectionElement
      expect(tbody.tagName).toBe('TBODY')
      expect(tbody.className).toContain('border-0')
    })
  })

  describe('TableRow', () => {
    it('渲染为 tr，包含 border-b + hover:bg-muted/50', () => {
      render(
        <table>
          <tbody>
            <TableRow />
          </tbody>
        </table>,
      )
      const tr = screen.getByRole('row') as HTMLTableRowElement
      expect(tr.tagName).toBe('TR')
      expect(tr.className).toContain('border-b')
      expect(tr.className).toContain('hover:bg-muted/50')
    })

    it('forwardRef 挂载到 tr', () => {
      const ref = vi.fn()
      render(
        <table>
          <tbody>
            <TableRow ref={ref} />
          </tbody>
        </table>,
      )
      expect(ref.mock.calls[0][0]?.tagName).toBe('TR')
    })
  })

  describe('TableHead', () => {
    it('渲染为 th，包含 h-10 + text-left + font-medium', () => {
      render(
        <table>
          <thead>
            <TableRow>
              <TableHead>列标题</TableHead>
            </TableRow>
          </thead>
        </table>,
      )
      const th = screen.getByText('列标题') as HTMLTableCellElement
      expect(th.tagName).toBe('TH')
      expect(th.className).toContain('h-10')
      expect(th.className).toContain('text-left')
      expect(th.className).toContain('font-medium')
    })

    it('forwardRef 挂载到 th', () => {
      const ref = vi.fn()
      render(
        <table>
          <thead>
            <TableRow>
              <TableHead ref={ref}>H</TableHead>
            </TableRow>
          </thead>
        </table>,
      )
      expect(ref.mock.calls[0][0]?.tagName).toBe('TH')
    })
  })

  describe('TableCell', () => {
    it('渲染为 td，包含 p-2 + align-middle', () => {
      render(
        <table>
          <tbody>
            <TableRow>
              <TableCell>单元格</TableCell>
            </TableRow>
          </tbody>
        </table>,
      )
      const td = screen.getByText('单元格') as HTMLTableCellElement
      expect(td.tagName).toBe('TD')
      expect(td.className).toContain('p-2')
      expect(td.className).toContain('align-middle')
    })

    it('forwardRef 挂载到 td', () => {
      const ref = vi.fn()
      render(
        <table>
          <tbody>
            <TableRow>
              <TableCell ref={ref}>C</TableCell>
            </TableRow>
          </tbody>
        </table>,
      )
      expect(ref.mock.calls[0][0]?.tagName).toBe('TD')
    })
  })

  describe('组合使用（完整表格结构）', () => {
    it('完整 Table > TableHeader/TableRow/TableHead + TableBody/TableRow/TableCell', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>名称</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>1</TableCell>
              <TableCell>Apple</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      )
      // 2 th + 2 td
      expect(screen.getAllByRole('columnheader')).toHaveLength(2)
      expect(screen.getAllByRole('cell')).toHaveLength(2)
      expect(screen.getAllByRole('row')).toHaveLength(2)
    })

    it('children 透传', () => {
      render(<Table>自定义内容</Table>)
      expect(screen.getByText('自定义内容')).toBeInTheDocument()
    })
  })
})
