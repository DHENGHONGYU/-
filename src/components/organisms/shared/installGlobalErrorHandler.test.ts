/**
 * @test_id V9-TEST-ST-010
 * installGlobalErrorHandler 单元测试
 *
 * 验证两类逃逸出 React 错误边界的运行时异常经 captureError 上报到错误总线，
 * 且返回的清理函数能正确移除监听。
  * @covers_docs []
*/

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/services/errorBus', () => ({
  captureError: vi.fn(),
}))

const { captureError } = await import('@/services/errorBus')
const { installGlobalErrorHandler } = await import('@/components/organisms/shared/installGlobalErrorHandler')

function makeErrorEvent(error: Error): Event {
  const e = new Event('error')
  Object.defineProperty(e, 'error', { value: error, configurable: true })
  Object.defineProperty(e, 'message', { value: error.message, configurable: true })
  Object.defineProperty(e, 'filename', { value: 'app.ts', configurable: true })
  Object.defineProperty(e, 'lineno', { value: 12, configurable: true })
  Object.defineProperty(e, 'colno', { value: 4, configurable: true })
  return e
}

function makeRejectionEvent(reason: unknown): Event {
  const e = new Event('unhandledrejection')
  Object.defineProperty(e, 'reason', { value: reason, configurable: true })
  return e
}

describe('installGlobalErrorHandler', () => {
  let cleanup: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    // 每个用例独立安装，并在 afterEach 中清理，避免监听器跨用例累加
    cleanup = installGlobalErrorHandler()
  })

  afterEach(() => {
    cleanup?.()
    cleanup = null
  })

  it('window error 事件经 captureError 上报（source=window, operation=onerror）', () => {
    const err = new Error('boom')
    window.dispatchEvent(makeErrorEvent(err))

    expect(captureError).toHaveBeenCalledTimes(1)
    expect(captureError).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ source: 'window', operation: 'onerror' }),
    )
  })

  it('unhandledrejection 经 captureError 上报（operation=unhandledrejection）', () => {
    const reason = new Error('rejected')
    window.dispatchEvent(makeRejectionEvent(reason))

    expect(captureError).toHaveBeenCalledTimes(1)
    expect(captureError).toHaveBeenCalledWith(
      reason,
      expect.objectContaining({ source: 'window', operation: 'unhandledrejection' }),
    )
  })

  it('reason 非 Error 时也能被收敛上报', () => {
    window.dispatchEvent(makeRejectionEvent('plain string rejection'))

    expect(captureError).toHaveBeenCalledTimes(1)
    expect(captureError).toHaveBeenCalledWith(
      'plain string rejection',
      expect.objectContaining({ source: 'window' }),
    )
  })

  it('返回的清理函数移除监听后不再上报', () => {
    // 移除 beforeEach 安装的监听
    cleanup?.()

    // 派发不带 error 属性的纯 error 事件：无监听器时不应触发 captureError，
    // 且不会因携带 Error 对象被 jsdom 作为未捕获异常上报
    window.dispatchEvent(new Event('error'))
    expect(captureError).not.toHaveBeenCalled()
  })
})
