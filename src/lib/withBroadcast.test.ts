/**
 * lib/withBroadcast — 单元测试
 *
 * 只增不删策略（TD-022 覆盖率增量）：新增独立测试文件，不编辑/不删除已有测试。
 * 覆盖：withBroadcast 成功路径 / withBroadcast emit 抛错兜底分支 / createBroadcaster 工厂函数
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withBroadcast, createBroadcaster } from './withBroadcast'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'

vi.mock('@/lib/eventBus', () => ({
  eventBus: { emit: vi.fn() },
}))
vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('lib/withBroadcast', () => {
  const mockEmit = vi.mocked(eventBus.emit)
  const logger = getLogger()
  const mockErrorLog = vi.mocked(logger.error)

  beforeEach(() => {
    mockEmit.mockReset()
    mockErrorLog.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('withBroadcast(eventName, payload?)', () => {
    it('成功路径：调用 eventBus.emit(eventName, payload)', () => {
      withBroadcast('TEST_EVENT_A', { value: 1 })
      expect(mockEmit).toHaveBeenCalledTimes(1)
      expect(mockEmit).toHaveBeenCalledWith('TEST_EVENT_A', { value: 1 })
      expect(mockErrorLog).not.toHaveBeenCalled()
    })

    it('payload 缺省时以 undefined 传递', () => {
      withBroadcast('TEST_EVENT_NO_PAYLOAD')
      expect(mockEmit).toHaveBeenCalledWith('TEST_EVENT_NO_PAYLOAD', undefined)
      expect(mockErrorLog).not.toHaveBeenCalled()
    })

    it('payload 为 null 时正常透传', () => {
      withBroadcast('TEST_NULL', null)
      expect(mockEmit).toHaveBeenCalledWith('TEST_NULL', null)
    })

    it('payload 为原始类型（字符串/数字/布尔）时正常透传', () => {
      withBroadcast('EV_STR', 'hello')
      withBroadcast('EV_NUM', 42)
      withBroadcast('EV_BOOL', false)
      expect(mockEmit).toHaveBeenNthCalledWith(1, 'EV_STR', 'hello')
      expect(mockEmit).toHaveBeenNthCalledWith(2, 'EV_NUM', 42)
      expect(mockEmit).toHaveBeenNthCalledWith(3, 'EV_BOOL', false)
    })

    it('兜底分支：当 eventBus.emit 抛出 Error 时，logger.error 记录且本身不抛', () => {
      const boom = new Error('emitter disconnect')
      mockEmit.mockImplementation(() => { throw boom })
      expect(() => withBroadcast('FAIL_EV', { foo: 'bar' })).not.toThrow()
      // emit 确实被调用过一次
      expect(mockEmit).toHaveBeenCalledWith('FAIL_EV', { foo: 'bar' })
      // logger.error 捕获了异常，并输出包含 event 名与 message 的日志
      expect(mockErrorLog).toHaveBeenCalledTimes(1)
      const msgArg = mockErrorLog.mock.calls[0]?.[0]
      expect(typeof msgArg).toBe('string')
      expect(msgArg).toContain('FAIL_EV')
      expect(msgArg).toContain('emitter disconnect')
    })

    it('兜底分支：当 emit 抛非 Error（字符串）时，也被 String(err) 化记录', () => {
      mockEmit.mockImplementation(() => { throw 'string-throw' })
      expect(() => withBroadcast('FAIL_STR')).not.toThrow()
      expect(mockErrorLog).toHaveBeenCalledTimes(1)
      const msgArg = mockErrorLog.mock.calls[0]?.[0] as string
      expect(msgArg).toContain('FAIL_STR')
      expect(msgArg).toContain('string-throw')
    })

    it('多次调用独立生效（无状态）', () => {
      withBroadcast('ev-a'); withBroadcast('ev-b'); withBroadcast('ev-c')
      expect(mockEmit).toHaveBeenCalledTimes(3)
      expect(mockEmit.mock.calls.map(c => c[0])).toEqual(['ev-a', 'ev-b', 'ev-c'])
    })
  })

  describe('createBroadcaster(eventName)', () => {
    it('返回一个函数', () => {
      const fn = createBroadcaster('MY_EVENT')
      expect(typeof fn).toBe('function')
    })

    it('返回的函数调用 withBroadcast 时会携带固定 eventName', () => {
      const broadcast = createBroadcaster('FIXED_EVENT')
      broadcast({ key: 'v' })
      expect(mockEmit).toHaveBeenCalledWith('FIXED_EVENT', { key: 'v' })
    })

    it('返回的函数不传 payload 时等同于 withBroadcast(eventName)', () => {
      const broadcast = createBroadcaster('NO_PAYLOAD_EVENT')
      broadcast()
      expect(mockEmit).toHaveBeenCalledWith('NO_PAYLOAD_EVENT', undefined)
    })

    it('独立 createBroadcaster 实例之间 eventName 互不干扰', () => {
      const b1 = createBroadcaster('EV1')
      const b2 = createBroadcaster('EV2')
      b1('a'); b2('b'); b1('c')
      expect(mockEmit.mock.calls).toEqual([
        ['EV1', 'a'],
        ['EV2', 'b'],
        ['EV1', 'c'],
      ])
    })

    it('返回的函数触发 emit 失败时同样走兜底 logger 分支', () => {
      mockEmit.mockImplementation(() => { throw new Error('fail in factory') })
      const b = createBroadcaster('SAFE_FAIL')
      expect(() => b({ payload: true })).not.toThrow()
      expect(mockErrorLog).toHaveBeenCalledTimes(1)
      const msg = mockErrorLog.mock.calls[0]?.[0] as string
      expect(msg).toContain('SAFE_FAIL')
      expect(msg).toContain('fail in factory')
    })
  })
})
