/**
 * @module components/molecules/ConfirmDialog
 * @description 命令式确认对话框的展示组件（无状态）
 *
 * 与 `hooks/useConfirmDialog` 配合：hook 负责状态与 Promise 解析逻辑（不依赖 UI 组件），
 * 本组件仅负责渲染。两者通过 `dialogProps` 解耦，维持「组件依赖 hooks」单向流。
 *
 * @compliance AGENTS.md §三 颜色令牌规范：使用 UI 组件而非硬编码样式
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/molecules/Dialog'
import { Button } from '@/components/atoms/Button'
import type { ConfirmOptions } from '@/hooks/useConfirmDialog'

/** ConfirmDialog 展示组件所需的 props（由 useConfirmDialog 的 dialogProps 提供） */
export interface ConfirmDialogProps {
  open: boolean
  options: ConfirmOptions
  onConfirm: () => void
  onCancel: () => void
  onOpenChange: (open: boolean) => void
}

/**
 * 确认对话框展示组件
 *
 * 纯展示层：接收 open / options / 回调，不持有任何状态，不解析 Promise。
 * 命令式状态（isOpen、resolver）由 `useConfirmDialog` 管理。
 */
export function ConfirmDialog({
  open,
  options,
  onConfirm,
  onCancel,
  onOpenChange,
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          <DialogDescription>{options.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {options.cancelLabel ?? '取消'}
          </Button>
          <Button
            variant={options.variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {options.confirmLabel ?? '确认'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
