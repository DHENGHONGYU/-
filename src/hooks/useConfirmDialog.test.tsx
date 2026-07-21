import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConfirmDialog } from './useConfirmDialog'

describe('useConfirmDialog', () => {
  describe('初始状态', () => {
    it('初始状态：open=false，options 为空', () => {
      const { result } = renderHook(() => useConfirmDialog())

      expect(result.current.dialogProps.open).toBe(false)
      expect(result.current.dialogProps.options.title).toBe('')
      expect(result.current.dialogProps.options.description).toBe('')
      expect(typeof result.current.confirm).toBe('function')
    })

    it('返回结构包含 confirm 和 dialogProps', () => {
      const { result } = renderHook(() => useConfirmDialog())

      expect(result.current).toHaveProperty('confirm')
      expect(result.current).toHaveProperty('dialogProps')
      expect(result.current.dialogProps).toHaveProperty('open')
      expect(result.current.dialogProps).toHaveProperty('options')
      expect(result.current.dialogProps).toHaveProperty('onConfirm')
      expect(result.current.dialogProps).toHaveProperty('onCancel')
      expect(result.current.dialogProps).toHaveProperty('onOpenChange')
    })
  })

  describe('confirm 打开对话框', () => {
    it('confirm 调用后打开对话框并设置 options', () => {
      const { result } = renderHook(() => useConfirmDialog())

      act(() => {
        result.current.confirm({
          title: '确认删除？',
          description: '此操作不可恢复',
        })
      })

      expect(result.current.dialogProps.open).toBe(true)
      expect(result.current.dialogProps.options.title).toBe('确认删除？')
      expect(result.current.dialogProps.options.description).toBe('此操作不可恢复')
    })

    it('confirm 返回 Promise', () => {
      const { result } = renderHook(() => useConfirmDialog())

      let promise: Promise<boolean> | undefined
      act(() => {
        promise = result.current.confirm({
          title: '测试',
          description: '描述',
        })
      })

      expect(promise).toBeInstanceOf(Promise)
    })

    it('title 参数正确传递', () => {
      const { result } = renderHook(() => useConfirmDialog())

      act(() => {
        result.current.confirm({
          title: '自定义标题',
          description: '自定义描述',
        })
      })

      expect(result.current.dialogProps.options.title).toBe('自定义标题')
      expect(result.current.dialogProps.options.description).toBe('自定义描述')
    })

    it('confirmLabel / cancelLabel / variant 可选参数传递', () => {
      const { result } = renderHook(() => useConfirmDialog())

      act(() => {
        result.current.confirm({
          title: '危险操作',
          description: '确定要执行吗？',
          confirmLabel: '删除',
          cancelLabel: '再想想',
          variant: 'danger',
        })
      })

      expect(result.current.dialogProps.options.confirmLabel).toBe('删除')
      expect(result.current.dialogProps.options.cancelLabel).toBe('再想想')
      expect(result.current.dialogProps.options.variant).toBe('danger')
    })
  })

  describe('确认操作', () => {
    it('onConfirm 被调用时 resolve(true) 并关闭对话框', async () => {
      const { result } = renderHook(() => useConfirmDialog())

      let promise!: Promise<boolean>
      act(() => {
        promise = result.current.confirm({
          title: '确认？',
          description: '请确认',
        })
      })

      expect(result.current.dialogProps.open).toBe(true)

      act(() => {
        result.current.dialogProps.onConfirm()
      })

      const resolvedValue = await promise
      expect(resolvedValue).toBe(true)
      expect(result.current.dialogProps.open).toBe(false)
    })
  })

  describe('取消操作', () => {
    it('onCancel 被调用时 resolve(false) 并关闭对话框', async () => {
      const { result } = renderHook(() => useConfirmDialog())

      let promise!: Promise<boolean>
      act(() => {
        promise = result.current.confirm({
          title: '确认？',
          description: '请确认',
        })
      })

      act(() => {
        result.current.dialogProps.onCancel()
      })

      const resolvedValue = await promise
      expect(resolvedValue).toBe(false)
      expect(result.current.dialogProps.open).toBe(false)
    })

    it('onOpenChange(false) 会 resolve(false) 并关闭', async () => {
      const { result } = renderHook(() => useConfirmDialog())

      let promise!: Promise<boolean>
      act(() => {
        promise = result.current.confirm({
          title: '确认？',
          description: '请确认',
        })
      })

      act(() => {
        result.current.dialogProps.onOpenChange(false)
      })

      const resolvedValue = await promise
      expect(resolvedValue).toBe(false)
      expect(result.current.dialogProps.open).toBe(false)
    })

    it('onOpenChange(true) 仅打开，不 resolve', () => {
      const { result } = renderHook(() => useConfirmDialog())

      const onResolve = vi.fn()
      act(() => {
        result.current
          .confirm({ title: '测试', description: '描述' })
          .then(onResolve)
      })

      act(() => {
        result.current.dialogProps.onOpenChange(true)
      })

      // 由于 Promise 尚未 resolve，onResolve 不应被调用
      // 使用 flushPromises 验证
      expect(onResolve).not.toHaveBeenCalled()
      expect(result.current.dialogProps.open).toBe(true)
    })
  })

  describe('多次调用 confirm', () => {
    it('多次调用 confirm 覆盖前一次的配置', () => {
      const { result } = renderHook(() => useConfirmDialog())

      act(() => {
        result.current.confirm({
          title: '第一次',
          description: '第一次描述',
        })
      })

      expect(result.current.dialogProps.options.title).toBe('第一次')

      act(() => {
        result.current.confirm({
          title: '第二次',
          description: '第二次描述',
        })
      })

      expect(result.current.dialogProps.options.title).toBe('第二次')
      expect(result.current.dialogProps.options.description).toBe('第二次描述')
    })

    it('多次调用 confirm 后，只有最后一次 Promise 会 resolve', async () => {
      const { result } = renderHook(() => useConfirmDialog())

      const firstResolve = vi.fn()
      const secondResolve = vi.fn()

      act(() => {
        result.current
          .confirm({ title: '第一次', description: '描述1' })
          .then(firstResolve)
        result.current
          .confirm({ title: '第二次', description: '描述2' })
          .then(secondResolve)
      })

      act(() => {
        result.current.dialogProps.onConfirm()
      })

      // 等待所有 Promise 结算
      await Promise.resolve()
      await Promise.resolve()

      // 第一次的 Promise 应该被新的 resolver 覆盖，不会被 resolve
      // 实际上：第一次调用时 resolverRef.current 被设置为第一个 resolve
      // 第二次调用时 resolverRef.current 被覆盖为第二个 resolve
      // 所以第一次的 Promise 永远不会 resolve
      expect(firstResolve).not.toHaveBeenCalled()
      expect(secondResolve).toHaveBeenCalledWith(true)
    })
  })

  describe('组件卸载', () => {
    it('组件卸载后，未 resolve 的 Promise 不会导致错误', () => {
      const { result, unmount } = renderHook(() => useConfirmDialog())

      let promise!: Promise<boolean>
      act(() => {
        promise = result.current.confirm({
          title: '测试',
          description: '描述',
        })
      })

      // 卸载组件不应抛出错误
      expect(() => {
        unmount()
      }).not.toThrow()

      // Promise 仍然处于 pending 状态（没有被 resolve/reject）
      // 这是预期行为，因为 hook 不做清理（resolverRef 不会在卸载时 reject）
      const timeout = new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 10),
      )
      return Promise.race([promise, timeout]).then((val) => {
        // 如果超时返回 false，说明 promise 还在 pending
        expect(val).toBe(false)
      })
    })
  })

  describe('resolveAndClear 幂等性', () => {
    it('重复调用 onCancel 不会重复 resolve', async () => {
      const { result } = renderHook(() => useConfirmDialog())

      let resolveCount = 0
      act(() => {
        result.current
          .confirm({ title: '测试', description: '描述' })
          .then(() => {
            resolveCount++
          })
      })

      act(() => {
        result.current.dialogProps.onCancel()
      })
      act(() => {
        result.current.dialogProps.onCancel()
      })

      await Promise.resolve()
      await Promise.resolve()

      expect(resolveCount).toBe(1)
    })

    it('重复调用 onConfirm 不会重复 resolve', async () => {
      const { result } = renderHook(() => useConfirmDialog())

      let resolveCount = 0
      act(() => {
        result.current
          .confirm({ title: '测试', description: '描述' })
          .then(() => {
            resolveCount++
          })
      })

      act(() => {
        result.current.dialogProps.onConfirm()
      })
      act(() => {
        result.current.dialogProps.onConfirm()
      })

      await Promise.resolve()
      await Promise.resolve()

      expect(resolveCount).toBe(1)
    })
  })
})
