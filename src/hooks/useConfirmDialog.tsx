import { useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'

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

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen && resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }
  }, [])

  const handleConfirm = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(true)
      resolverRef.current = null
    }
    setOpen(false)
  }, [])

  const handleCancel = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }
    setOpen(false)
  }, [])

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
