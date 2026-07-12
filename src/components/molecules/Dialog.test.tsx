/**
 * Dialog 组件族单元测试
 *
 * 覆盖场景：
 * 1. open=true 时调用 dialog.showModal()
 * 2. open=false 时调用 dialog.close()
 * 3. onOpenChange 在 dialog 关闭事件触发
 * 4. DialogContent 渲染内容
 * 5. DialogHeader / DialogFooter / DialogTitle / DialogDescription 渲染
 * 6. DialogClose 点击触发 onClick
 * 7. showCloseButton=false 时不渲染关闭按钮
 * 8. ref 转发
 * 9. className 合并
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { UI_TEXT } from '@/constants/uiText'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/molecules/Dialog'

/**
 * @status known-failing
 * @tracked-in package.json test:known 脚本
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 * @skip-reason 此测试为已知失败，已通过 vitest --exclude 跳过；
 *               修复后请移除 .skip 标记并从 test:clean 的 --exclude 列表中删除
 */
describe('Dialog 组件族', () => {
  beforeEach(() => {
    // jsdom 不支持 HTMLDialogElement API
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true
    })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
    })
  })

  it('open=true 时调用 dialog.showModal()', () => {
    render(
      <Dialog open={true}>
        <DialogContent>内容</DialogContent>
      </Dialog>,
    )
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
  })

  it('open=false 时调用 dialog.close()', () => {
    const { rerender } = render(
      <Dialog open={true}>
        <DialogContent>内容</DialogContent>
      </Dialog>,
    )
    rerender(
      <Dialog open={false}>
        <DialogContent>内容</DialogContent>
      </Dialog>,
    )
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
  })

  it('dialog 原生 close 事件触发 onOpenChange(false)', () => {
    const handleOpenChange = vi.fn()
    render(
      <Dialog open={true} onOpenChange={handleOpenChange}>
        <DialogContent>内容</DialogContent>
      </Dialog>,
    )
    // 模拟 dialog 原生 close 事件（fireEvent.close 在 testing-library 中不存在）
    const dialog = document.querySelector('dialog')!
    dialog.dispatchEvent(new Event('close'))
    expect(handleOpenChange).toHaveBeenCalledWith(false)
  })

  it('DialogContent 渲染 children', () => {
    render(
      <Dialog open={true}>
        <DialogContent>主要内容</DialogContent>
      </Dialog>,
    )
    expect(screen.getByText('主要内容')).toBeInTheDocument()
  })

  it('DialogContent 默认显示关闭按钮（X icon）', () => {
    render(
      <Dialog open={true}>
        <DialogContent>内容</DialogContent>
      </Dialog>,
    )
    expect(screen.getByText('Close')).toBeInTheDocument()
  })

  it('DialogContent showCloseButton=false 时不显示关闭按钮', () => {
    render(
      <Dialog open={true}>
        <DialogContent showCloseButton={false}>内容</DialogContent>
      </Dialog>,
    )
    expect(screen.queryByText('Close')).not.toBeInTheDocument()
  })

  it('DialogHeader / DialogFooter 渲染', () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogHeader>头部</DialogHeader>
          <DialogFooter>底部</DialogFooter>
        </DialogContent>
      </Dialog>,
    )
    expect(screen.getByText('头部')).toBeInTheDocument()
    expect(screen.getByText('底部')).toBeInTheDocument()
  })

  it('DialogTitle 渲染为 h2', () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogTitle>对话框标题</DialogTitle>
        </DialogContent>
      </Dialog>,
    )
    const title = screen.getByText('对话框标题')
    expect(title.tagName).toBe('H2')
  })

  it('DialogDescription 渲染为 p', () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogDescription>对话框描述</DialogDescription>
        </DialogContent>
      </Dialog>,
    )
    const desc = screen.getByText('对话框描述')
    expect(desc.tagName).toBe('P')
  })

  it('DialogClose 渲染关闭按钮，点击触发 onClick', () => {
    const handleClose = vi.fn()
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogClose onClick={handleClose}>关闭</DialogClose>
        </DialogContent>
      </Dialog>,
    )
    const closeBtn = screen.getByText(UI_TEXT.common.close)
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('Dialog 透传自定义 className', () => {
    render(
      <Dialog open={true} className="my-dialog" data-testid="dialog">
        <DialogContent>内容</DialogContent>
      </Dialog>,
    )
    const dialog = screen.getByTestId('dialog')
    expect(dialog).toHaveClass('my-dialog')
  })

  it('Dialog ref 转发到 dialog 元素', () => {
    const ref = createRef<HTMLDialogElement>()
    render(
      <Dialog ref={ref} open={true}>
        <DialogContent>ref</DialogContent>
      </Dialog>,
    )
    expect(ref.current).toBeInstanceOf(HTMLDialogElement)
  })

  it('DialogTitle ref 转发到 h2 元素', () => {
    const ref = createRef<HTMLHeadingElement>()
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogTitle ref={ref}>标题 ref</DialogTitle>
        </DialogContent>
      </Dialog>,
    )
    expect(ref.current).toBeInstanceOf(HTMLHeadingElement)
  })
})
