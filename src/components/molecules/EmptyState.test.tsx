/**
 * EmptyState 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 * 1. 默认 title='暂无数据'，无 description/action 的极简渲染
 * 2. 自定义 title / description / icon
 * 3. 仅主操作按钮 (action)
 * 4. 仅次操作按钮 (secondaryAction)
 * 5. 同时存在主次操作按钮：主次顺序 + 各自回调
 * 6. className、memo
 *
 * 注意：EmptyStateProps 只接受 className 字段，不接受 HTMLAttributes，
 *       所以不要写 data-testid 透传的断言。
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  describe('基础渲染 (默认值)', () => {
    it('默认 title="暂无数据" 渲染为 H3', () => {
      render(<EmptyState />)
      const title = screen.getByText('暂无数据')
      expect(title.tagName).toBe('H3')
      expect(title).toBeInTheDocument()
    })

    it('无 description 时不渲染描述文字', () => {
      const { container } = render(<EmptyState />)
      const ps = container.querySelectorAll('p.text-muted-foreground')
      expect(ps.length).toBe(0)
    })

    it('无 action/secondaryAction 时不渲染按钮', () => {
      render(<EmptyState />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('默认 icon=Inbox (h-12 w-12 text-muted-foreground/40)', () => {
      const { container } = render(<EmptyState />)
      const icon = container.querySelector('svg.h-12.w-12')
      expect(icon).toBeInTheDocument()
    })

    it('外层容器包含 flex flex-col items-center justify-center', () => {
      const { container } = render(<EmptyState />)
      const root = container.firstElementChild as HTMLElement
      expect(root.className).toContain('flex')
      expect(root.className).toContain('flex-col')
      expect(root.className).toContain('items-center')
      expect(root.className).toContain('justify-center')
      expect(root.className).toContain('text-center')
    })
  })

  describe('自定义 title / description / icon', () => {
    it('渲染自定义 title，覆盖默认值', () => {
      render(<EmptyState title="列表为空" />)
      expect(screen.getByText('列表为空')).toBeInTheDocument()
      expect(screen.queryByText('暂无数据')).not.toBeInTheDocument()
    })

    it('description 存在时渲染 p.text-muted-foreground 描述文字', () => {
      render(
        <EmptyState
          title="无收藏"
          description="点击下方按钮，添加第一支股票到你的自选列表。"
        />
      )
      expect(
        screen.getByText('点击下方按钮，添加第一支股票到你的自选列表。')
      ).toBeInTheDocument()
    })

    it('自定义 icon 覆盖默认 Inbox', () => {
      render(
        <EmptyState icon={<span data-testid="custom-icon">📭</span>} />
      )
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    })
  })

  describe('主操作按钮 action', () => {
    it('action 存在时渲染按钮并显示 label', () => {
      const action = { label: '去加载', onClick: vi.fn() }
      render(<EmptyState action={action} />)
      const btn = screen.getByRole('button', { name: '去加载' })
      expect(btn).toBeInTheDocument()
    })

    it('主按钮默认 variant=primary (bg-primary / hover:bg-primary/90)', () => {
      const action = { label: '新建', onClick: vi.fn() }
      render(<EmptyState action={action} />)
      const btn = screen.getByRole('button', { name: '新建' })
      expect(btn.className).toContain('bg-primary')
    })

    it('点击主按钮调用 action.onClick', () => {
      const onClick = vi.fn()
      render(<EmptyState action={{ label: '新建', onClick }} />)
      fireEvent.click(screen.getByRole('button', { name: '新建' }))
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('次操作按钮 secondaryAction', () => {
    it('secondaryAction 存在时渲染 outline variant 按钮', () => {
      const secondary = { label: '查看文档', onClick: vi.fn() }
      render(<EmptyState secondaryAction={secondary} />)
      const btn = screen.getByRole('button', { name: '查看文档' })
      expect(btn).toBeInTheDocument()
      expect(btn.className).toContain('border')
      expect(btn.className).toContain('bg-background')
    })

    it('点击次按钮调用 secondaryAction.onClick', () => {
      const onClick = vi.fn()
      render(<EmptyState secondaryAction={{ label: '清空', onClick }} />)
      fireEvent.click(screen.getByRole('button', { name: '清空' }))
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('主次操作按钮同时存在', () => {
    it('两者按钮都被渲染', () => {
      const action = { label: '确认', onClick: vi.fn() }
      const secondaryAction = { label: '取消', onClick: vi.fn() }
      render(<EmptyState action={action} secondaryAction={secondaryAction} />)
      expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
    })

    it('DOM 顺序：secondary (取消) 在主按钮 (确认) 之前', () => {
      const action = { label: '确认', onClick: vi.fn() }
      const secondaryAction = { label: '取消', onClick: vi.fn() }
      render(<EmptyState action={action} secondaryAction={secondaryAction} />)
      const cancel = screen.getByRole('button', { name: '取消' })
      const confirm = screen.getByRole('button', { name: '确认' })
      const pos = cancel.compareDocumentPosition(confirm)
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('两者回调独立触发互不影响', () => {
      const a = vi.fn()
      const b = vi.fn()
      render(
        <EmptyState
          action={{ label: '主', onClick: a }}
          secondaryAction={{ label: '次', onClick: b }}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: '次' }))
      expect(b).toHaveBeenCalledTimes(1)
      expect(a).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: '主' }))
      expect(a).toHaveBeenCalledTimes(1)
    })
  })

  describe('className & memo', () => {
    it('自定义 className 合并到外层容器', () => {
      const { container } = render(<EmptyState className="my-empty" />)
      const el = container.firstElementChild as HTMLElement
      expect(el.className).toContain('my-empty')
      expect(el.className).toContain('flex')
    })

    it('相同 props 二次 rerender 不抛异常 (memo)', () => {
      const { rerender } = render(<EmptyState title="标题" description="描述" />)
      expect(() => rerender(<EmptyState title="标题" description="描述" />)).not.toThrow()
      expect(screen.getByText('标题')).toBeInTheDocument()
    })
  })
})
