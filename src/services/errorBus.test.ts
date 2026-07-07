import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  captureError,
  onErrorCaptured,
  ERROR_CAPTURED_EVENT,
  type ErrorCapturedPayload,
} from '@/services/errorBus'
import { V9Error, ValidationError, isV9Error } from '@/lib/errors'
import { eventBus } from '@/lib/eventBus'

describe('errorBus / captureError', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('原始 Error 被收敛为 V9Error（默认 category=system）', () => {
    const err = captureError(new Error('boom'))
    expect(isV9Error(err)).toBe(true)
    expect(err.message).toBe('boom')
    expect(err.category).toBe('system')
  })

  it('非 Error 值（字符串）被安全包装', () => {
    const err = captureError('plain string failure')
    expect(isV9Error(err)).toBe(true)
    expect(err.message).toContain('plain string failure')
  })

  it('已为 V9Error 子类时原样保留（含 code/field）', () => {
    const original = new ValidationError('bad', 'symbol')
    const err = captureError(original)
    expect(err).toBe(original)
    expect(err).toBeInstanceOf(ValidationError)
    expect((err as ValidationError).field).toBe('symbol')
  })

  it('发布到全局错误总线，订阅者收到 payload', () => {
    const received: ErrorCapturedPayload[] = []
    const off = onErrorCaptured((p) => received.push(p))

    captureError(new Error('x'), { source: 'svcA', operation: 'doX', meta: { id: 1 } })

    expect(received).toHaveLength(1)
    const p = received[0]!
    expect(p.error.message).toBe('x')
    expect(p.context.source).toBe('svcA')
    expect(p.context.operation).toBe('doX')
    expect(p.context.meta).toEqual({ id: 1 })
    expect(typeof p.timestamp).toBe('number')

    off()
  })

  it('onErrorCaptured 返回的取消函数可正确解订阅', () => {
    const cb = vi.fn()
    const off = onErrorCaptured(cb)
    expect(typeof off).toBe('function')
    off()
    captureError(new V9Error('after unsub'))
    expect(cb).not.toHaveBeenCalled()
  })

  it('事件名常量稳定，供 UI 层（A-03）订阅', () => {
    expect(ERROR_CAPTURED_EVENT).toBe('v9:error:captured')
    // 直接经 eventBus 订阅等价路径仍可达
    const spy = vi.fn()
    const unsub = eventBus.on(ERROR_CAPTURED_EVENT, spy)
    captureError(new V9Error('via-bus'))
    expect(spy).toHaveBeenCalledTimes(1)
    unsub()
  })
})
