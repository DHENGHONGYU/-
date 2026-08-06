/**
 * FilterChip 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 * 1. 基础渲染：label + Badge variant=secondary
 * 2. removable=true: 显示 X 按钮, onRemove 回调
 * 3. removable=false: 不渲染 X 按钮
 * 4. 未传 onRemove 时点击不抛异常
 * 5. aria-label="移除 {label}" 无障碍
 * 6. className 合并
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterChip } from './FilterChip'

describe('FilterChip', () => {
  describe('基础渲染', () => {
    it('显示 label 文本', () => {
      render(<FilterChip label="市盈率 < 20" />)
      expect(screen.getByText('市盈率 < 20')).toBeInTheDocument()
    })

    it('外层使用 variant=secondary (Badge)', () => {
      const { container } = render(<FilterChip label="行业=银行" />)
      // Badge secondary variant 使用 bg-secondary 类
      const badge = container.querySelector('.bg-secondary')
      expect(badge).toBeInTheDocument()
    })

    it('显示 badge 基础布局 inline-flex gap-1', () => {
      const { container } = render(<FilterChip label="F" />)
      const root = container.firstElementChild!
      expect(root.className).toContain('inline-flex')
      expect(root.className).toContain('gap-1')
    })
  })

  describe('removable=true (默认)', () => {
    it('渲染 X 关闭按钮', () => {
      render(<FilterChip label="PE < 30" onRemove={vi.fn()} />)
      expect(
        screen.getByRole('button', { name: '移除 PE < 30' })
      ).toBeInTheDocument()
    })

    it('点击 X 触发 onRemove 回调', () => {
      const onRemove = vi.fn()
      render(<FilterChip label="ROE > 15" onRemove={onRemove} />)
      fireEvent.click(screen.getByRole('button', { name: '移除 ROE > 15' }))
      expect(onRemove).toHaveBeenCalledTimes(1)
    })

    it('未传 onRemove 时点击不抛异常', () => {
      render(<FilterChip label="仅A股" />)
      expect(() =>
        fireEvent.click(screen.getByRole('button', { name: '移除 仅A股' }))
      ).not.toThrow()
    })

    it('aria-label 与 label 一致 (无障碍)', () => {
      render(<FilterChip label="医药行业" onRemove={vi.fn()} />)
      const btn = screen.getByRole('button')
      expect(btn).toHaveAttribute('aria-label', '移除 医药行业')
    })

    it('关闭按钮包含 X SVG (h-3 w-3)', () => {
      const { container } = render(<FilterChip label="X" onRemove={vi.fn()} />)
      const icon = container.querySelector('svg.h-3.w-3')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('removable=false', () => {
    it('不渲染关闭按钮', () => {
      render(<FilterChip label="仅沪深" removable={false} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('仍正确显示 label', () => {
      render(<FilterChip label="静态标签" removable={false} />)
      expect(screen.getByText('静态标签')).toBeInTheDocument()
    })
  })

  describe('className 合并', () => {
    it('自定义 className 与 Badge 默认类合并', () => {
      const { container } = render(
        <FilterChip label="自定义" className="my-chip" />
      )
      const root = container.firstElementChild!
      expect(root.className).toContain('my-chip')
      expect(root.className).toContain('inline-flex')
    })
  })
})
