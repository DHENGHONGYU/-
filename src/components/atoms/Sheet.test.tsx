/**
 * Sheet 组件族单元测试
 *
 * 覆盖场景：
 * 1. open=false 时不渲染任何内容
 * 2. open=true 时渲染 overlay + panel
 * 3. 4 种 side (left/right/top/bottom) 应用不同样式
 * 4. 点击 overlay 触发 onOpenChange(false)
 * 5. 按 Escape 键触发 onOpenChange(false)
 * 6. SheetContent / SheetHeader / SheetFooter / SheetTitle / SheetDescription 渲染
 * 7. SheetClose 点击触发 onClick
 * 8. ref 转发
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/atoms/Sheet'

describe('Sheet 组件族', () => {
  it('open=false 时不渲染任何内容', () => {
    const { container } = render(
      <Sheet open={false}>
        <SheetContent>内容</SheetContent>
      </Sheet>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('open=true 时渲染 overlay 和 panel', () => {
    render(
      <Sheet open={true}>
        <SheetContent>
          <SheetTitle>标题</SheetTitle>
          主要内容
        </SheetContent>
      </Sheet>,
    )
    expect(screen.getByTestId('sheet-overlay')).toBeInTheDocument()
    expect(screen.getByText('主要内容')).toBeInTheDocument()
  })

  it('side=left 应用 left 定位样式', () => {
    render(
      <Sheet open={true} side="left">
        <div>左侧内容</div>
      </Sheet>,
    )
    const panel = document.querySelector('[data-state="open"]')!
    expect(panel).toHaveClass('left-0')
  })

  it('side=right 应用 right 定位样式（默认）', () => {
    render(
      <Sheet open={true}>
        <div>右侧内容</div>
      </Sheet>,
    )
    const panel = document.querySelector('[data-state="open"]')!
    expect(panel).toHaveClass('right-0')
  })

  it('side=top 应用 top 定位样式', () => {
    render(
      <Sheet open={true} side="top">
        <div>顶部内容</div>
      </Sheet>,
    )
    const panel = document.querySelector('[data-state="open"]')!
    expect(panel).toHaveClass('top-0')
  })

  it('side=bottom 应用 bottom 定位样式', () => {
    render(
      <Sheet open={true} side="bottom">
        <div>底部内容</div>
      </Sheet>,
    )
    const panel = document.querySelector('[data-state="open"]')!
    expect(panel).toHaveClass('bottom-0')
  })

  it('点击 overlay 触发 onOpenChange(false)', () => {
    const handleOpenChange = vi.fn()
    render(
      <Sheet open={true} onOpenChange={handleOpenChange}>
        <div>内容</div>
      </Sheet>,
    )
    fireEvent.click(screen.getByTestId('sheet-overlay'))
    expect(handleOpenChange).toHaveBeenCalledWith(false)
  })

  it('按 Escape 键触发 onOpenChange(false)', () => {
    const handleOpenChange = vi.fn()
    render(
      <Sheet open={true} onOpenChange={handleOpenChange}>
        <div>内容</div>
      </Sheet>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(handleOpenChange).toHaveBeenCalledWith(false)
  })

  it('open=false 时按 Escape 不触发 onOpenChange', () => {
    const handleOpenChange = vi.fn()
    render(
      <Sheet open={false} onOpenChange={handleOpenChange}>
        <div>内容</div>
      </Sheet>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(handleOpenChange).not.toHaveBeenCalled()
  })

  it('SheetContent 渲染 children', () => {
    render(
      <Sheet open={true}>
        <SheetContent>子内容</SheetContent>
      </Sheet>,
    )
    expect(screen.getByText('子内容')).toBeInTheDocument()
  })

  it('SheetHeader / SheetFooter 渲染', () => {
    render(
      <Sheet open={true}>
        <SheetContent>
          <SheetHeader>头部</SheetHeader>
          <SheetFooter>底部</SheetFooter>
        </SheetContent>
      </Sheet>,
    )
    expect(screen.getByText('头部')).toBeInTheDocument()
    expect(screen.getByText('底部')).toBeInTheDocument()
  })

  it('SheetTitle 渲染为 h2', () => {
    render(
      <Sheet open={true}>
        <SheetTitle>抽屉标题</SheetTitle>
      </Sheet>,
    )
    const title = screen.getByText('抽屉标题')
    expect(title.tagName).toBe('H2')
  })

  it('SheetDescription 渲染为 p', () => {
    render(
      <Sheet open={true}>
        <SheetDescription>抽屉描述</SheetDescription>
      </Sheet>,
    )
    const desc = screen.getByText('抽屉描述')
    expect(desc.tagName).toBe('P')
  })

  it('SheetClose 渲染关闭按钮，点击触发 onClick', () => {
    const handleClose = vi.fn()
    render(
      <Sheet open={true}>
        <SheetContent>
          <SheetClose onClick={handleClose} />
        </SheetContent>
      </Sheet>,
    )
    // SheetClose 是 button，包含 X 图标和 sr-only "Close"
    const closeBtn = screen.getByRole('button', { name: /close/i })
    expect(closeBtn).toBeInTheDocument()
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('Sheet 透传自定义 className', () => {
    render(
      <Sheet open={true} className="my-sheet" data-testid="sheet">
        <div>内容</div>
      </Sheet>,
    )
    // className 应用于内部 panel
    const panel = document.querySelector('[data-state="open"]')!
    expect(panel).toHaveClass('my-sheet')
    expect(screen.getByTestId('sheet')).toBe(panel)
  })

  it('Sheet ref 转发到 panel div 元素', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Sheet ref={ref} open={true}>
        <div>ref 测试</div>
      </Sheet>,
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})
