/**
 * ConfirmDialog 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 * 1. open=false 不呈现对话框可见内容
 * 2. open=true 渲染标题、描述、取消/确认按钮
 * 3. 自定义按钮文案 (confirmLabel/cancelLabel 默认值)
 * 4. variant=danger -> 确认按钮 variant=danger
 * 5. 回调绑定：onConfirm / onCancel
 *
 * 注：jsdom 不实现 HTMLDialogElement，所以本文件 beforeAll 内对 showModal/close 做 monkey-patch。
 */

import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'
import type { ConfirmOptions } from '@/hooks/useConfirmDialog'

const baseOptions: ConfirmOptions = {
  title: '确认操作？',
  description: '此操作不可逆，请谨慎执行',
}

describe('ConfirmDialog', () => {
  // jsdom 未实现 HTMLDialogElement
  let originalShowModal: typeof HTMLDialogElement.prototype.showModal | undefined
  let originalClose: typeof HTMLDialogElement.prototype.close | undefined

  beforeAll(() => {
    if (typeof HTMLDialogElement !== 'undefined') {
      originalShowModal = HTMLDialogElement.prototype.showModal
      originalClose = HTMLDialogElement.prototype.close
      HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        ;(this as { open: boolean }).open = true
      })
      HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        ;(this as { open: boolean }).open = false
      })
    }
  })

  afterAll(() => {
    if (typeof HTMLDialogElement !== 'undefined') {
      if (originalShowModal) HTMLDialogElement.prototype.showModal = originalShowModal
      if (originalClose) HTMLDialogElement.prototype.close = originalClose
    }
  })

  describe('open=false', () => {
    it('不显示对话框内容（标题/描述均不渲染为可见文本）', () => {
      render(
        <ConfirmDialog
          open={false}
          options={baseOptions}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          onOpenChange={vi.fn()}
        />
      )
      // open=false 时 Dialog 内部调用 dialog.close()，DialogContent 通过 hidden 类隐藏
      expect(screen.queryByText('确认操作？')).not.toBeVisible()
      expect(screen.queryByText('此操作不可逆，请谨慎执行')).not.toBeVisible()
    })
  })

  describe('open=true', () => {
    it('渲染标题与描述文本', () => {
      render(
        <ConfirmDialog
          open
          options={baseOptions}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          onOpenChange={vi.fn()}
        />
      )
      expect(screen.getByText('确认操作？')).toBeVisible()
      expect(screen.getByText('此操作不可逆，请谨慎执行')).toBeVisible()
    })

    it('默认按钮文案为 取消 / 确认', () => {
      render(
        <ConfirmDialog
          open
          options={baseOptions}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          onOpenChange={vi.fn()}
        />
      )
      expect(screen.getByRole('button', { name: '取消' })).toBeVisible()
      expect(screen.getByRole('button', { name: '确认' })).toBeVisible()
    })

    it('使用自定义 confirmLabel/cancelLabel', () => {
      const options: ConfirmOptions = {
        title: '删除',
        description: '确认删除？',
        confirmLabel: '删除它',
        cancelLabel: '我再想想',
      }
      render(
        <ConfirmDialog
          open
          options={options}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          onOpenChange={vi.fn()}
        />
      )
      expect(screen.getByRole('button', { name: '删除它' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '我再想想' })).toBeInTheDocument()
    })

    it('variant=default 确认按钮 variant 为 primary (bg-primary)', () => {
      const options: ConfirmOptions = { ...baseOptions, variant: 'default' }
      render(
        <ConfirmDialog
          open
          options={options}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          onOpenChange={vi.fn()}
        />
      )
      const confirmBtn = screen.getByRole('button', { name: '确认' })
      expect(confirmBtn.className).toContain('bg-primary')
    })

    it('variant=danger 确认按钮 variant 为 danger (bg-destructive)', () => {
      const options: ConfirmOptions = { ...baseOptions, variant: 'danger' }
      render(
        <ConfirmDialog
          open
          options={options}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          onOpenChange={vi.fn()}
        />
      )
      const confirmBtn = screen.getByRole('button', { name: '确认' })
      expect(confirmBtn.className).toContain('bg-destructive')
    })

    it('取消按钮使用 outline variant (border + bg-background)', () => {
      render(
        <ConfirmDialog
          open
          options={baseOptions}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          onOpenChange={vi.fn()}
        />
      )
      const cancelBtn = screen.getByRole('button', { name: '取消' })
      expect(cancelBtn.className).toContain('border')
      expect(cancelBtn.className).toContain('bg-background')
    })
  })

  describe('回调绑定', () => {
    it('点击取消按钮触发 onCancel', () => {
      const onCancel = vi.fn()
      render(
        <ConfirmDialog
          open
          options={baseOptions}
          onConfirm={vi.fn()}
          onCancel={onCancel}
          onOpenChange={vi.fn()}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: '取消' }))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('点击确认按钮触发 onConfirm', () => {
      const onConfirm = vi.fn()
      render(
        <ConfirmDialog
          open
          options={baseOptions}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
          onOpenChange={vi.fn()}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: '确认' }))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
  })
})
