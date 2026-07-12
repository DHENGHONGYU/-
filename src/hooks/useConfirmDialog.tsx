/**
 * @module hooks/useConfirmDialog
 * @description 命令式确认对话框 Hook
 *
 * 替代原生 `window.confirm()`，基于 `&lt;Dialog&gt;` 组件实现，
 * 在 iframe / 沙箱环境下正常工作（不依赖浏览器原生弹窗）。
 *
 * 设计原则：
 *   1. 命令式调用：通过 Promise 方式调用，替代声明式的条件渲染
 *   2. 类型安全：完整的 TypeScript 类型定义
 *   3. 可定制：支持自定义标题、描述、按钮文字和变体
 *   4. 无障碍：基于 Dialog 组件，符合 ARIA 无障碍规范
 *   5. 沙箱兼容：不依赖 window.confirm，适用于受限环境
 *
 * @compliance AGENTS.md §三 颜色令牌规范：使用 UI 组件而非硬编码样式
 */

import { useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/molecules/Dialog'
import { Button } from '@/components/atoms/Button'

/**
 * 确认对话框选项
 *
 * @interface ConfirmOptions
 * @property {string} title - 对话框标题
 * @property {string} description - 对话框描述（副标题）
 * @property {string} [confirmLabel='确认'] - 确认按钮文字
 * @property {string} [cancelLabel='取消'] - 取消按钮文字
 * @property {'default' | 'danger'} [variant='default'] - 确认按钮变体
 */
interface ConfirmOptions {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
}

/**
 * 命令式确认对话框 hook
 *
 * 替代原生 window.confirm()，基于 <dialog> 元素实现，
 * 在 iframe / 沙箱环境下正常工作（不依赖浏览器原生弹窗）。
 *
 * @example
 * ```tsx
 * const { confirm, ConfirmDialog } = useConfirmDialog()
 *
 * const handleClick = async () => {
 *   const ok = await confirm({ title: '确认删除？', description: '此操作不可恢复' })
 *   if (ok) { ... }
 * }
 *
 * return <>{ConfirmDialog}</>
 * ```
/**
 * useConfirmDialog
 */
export function useConfirmDialog() {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    description: '',
  })
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const resolveAndClear = useCallback((value: boolean): void => {
    if (resolverRef.current) {
      resolverRef.current(value)
      resolverRef.current = null
    }
  }, [])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) resolveAndClear(false)
  }, [resolveAndClear])

  const handleConfirm = useCallback(() => {
    resolveAndClear(true)
    setOpen(false)
  }, [resolveAndClear])

  const handleCancel = useCallback(() => {
    resolveAndClear(false)
    setOpen(false)
  }, [resolveAndClear])

  const ConfirmDialog = (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          <DialogDescription>{options.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {options.cancelLabel ?? '取消'}
          </Button>
          <Button
            variant={options.variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
          >
            {options.confirmLabel ?? '确认'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { confirm, ConfirmDialog }
}
