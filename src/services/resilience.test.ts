/**
 * @test_id V9-TEST-ST-061
 * @covers_docs []
 */
import { describe, it, expect, vi } from 'vitest'
import {
  withRetry,
  withFallback,
  createCircuitBreaker,
  withResilience,
  CircuitOpenError,
  type CircuitBreaker,
} from '@/services/resilience'
import { V9Error } from '@/lib/errors'

const noopSleep = () => Promise.resolve()

describe('resilience / withRetry', () => {
  it('首次成功不重试', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const onRetry = vi.fn()
    const res = await withRetry(fn, { maxAttempts: 3, sleep: noopSleep, onRetry })
    expect(res).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('失败后按退避重试，最终成功', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('recovered')
    const res = await withRetry(fn, { maxAttempts: 3, sleep: noopSleep })
    expect(res).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('shouldRetry 返回 false 时立即停止重试', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'))
    const onRetry = vi.fn()
    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        sleep: noopSleep,
        onRetry,
        shouldRetry: () => false,
      }),
    ).rejects.toBeInstanceOf(V9Error)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('耗尽重试后抛出经收敛的 V9Error（含 code）', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always'))
    let caught: unknown
    try {
      await withRetry(fn, { maxAttempts: 2, sleep: noopSleep, context: { source: 'svc', operation: 'op' } })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(V9Error)
    expect((caught as V9Error).code).toBe('V9_UNKNOWN')
  })
})

describe('resilience / createCircuitBreaker', () => {
  it('closed 状态直通成功', async () => {
    const cb: CircuitBreaker = createCircuitBreaker({ now: () => 0 })
    const res = await cb.execute(async () => 'value')
    expect(res).toBe('value')
    expect(cb.state).toBe('closed')
  })

  it('连续失败达到阈值后熔断为 open', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 3, now: () => 0 })
    const fail = () => cb.execute(async () => { throw new Error('x') })
    await expect(fail()).rejects.toThrow()
    await expect(fail()).rejects.toThrow()
    await expect(fail()).rejects.toThrow()
    expect(cb.state).toBe('open')
  })

  it('open 状态直接拒绝（CircuitOpenError），resetTimeout 内不探测', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000, now: () => 0 })
    await expect(cb.execute(async () => { throw new Error('x') })).rejects.toThrow()
    expect(cb.state).toBe('open')
    await expect(cb.execute(async () => 'v')).rejects.toBeInstanceOf(CircuitOpenError)
    expect(cb.state).toBe('open')
  })

  it('open 超时后进入 half-open，连续成功恢复为 closed', async () => {
    let t = 0
    const cb = createCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      successThreshold: 2,
      now: () => t,
    })
    await expect(cb.execute(async () => { throw new Error('x') })).rejects.toThrow()
    expect(cb.state).toBe('open')
    // 推进时间越过 resetTimeout，触发 half-open
    t = 1500
    expect(await cb.execute(async () => 'a')).toBe('a')
    expect(cb.state).toBe('half-open')
    expect(await cb.execute(async () => 'b')).toBe('b')
    expect(cb.state).toBe('closed')
  })

  it('half-open 探测失败重新熔断', async () => {
    let t = 0
    const cb = createCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      now: () => t,
    })
    await expect(cb.execute(async () => { throw new Error('x') })).rejects.toThrow()
    t = 1500
    await expect(cb.execute(async () => 'a')).resolves.toBe('a') // half-open probe ok
    // 再次失败触发 open
    await expect(cb.execute(async () => { throw new Error('y') })).rejects.toThrow()
    expect(cb.state).toBe('open')
  })

  it('reset 清除状态回到 closed', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 1, now: () => 0 })
    await expect(cb.execute(async () => { throw new Error('x') })).rejects.toThrow()
    expect(cb.state).toBe('open')
    cb.reset()
    expect(cb.state).toBe('closed')
    expect(await cb.execute(async () => 'ok')).toBe('ok')
  })
})

describe('resilience / withFallback', () => {
  it('成功时返回原值', async () => {
    const res = await withFallback(async () => 'real', 'backup')
    expect(res).toBe('real')
  })

  it('失败时返回兜底值（常量）', async () => {
    const res = await withFallback(async () => { throw new Error('x') }, 'backup', { source: 's' })
    expect(res).toBe('backup')
  })

  it('失败时支持函数兜底', async () => {
    const res = await withFallback(
      async () => { throw new Error('x') },
      () => 'from-fn',
    )
    expect(res).toBe('from-fn')
  })
})

describe('resilience / withResilience 组合', () => {
  it('熔断 + 重试 + 降级：首次失败即熔断后走降级兜底', async () => {
    const res = await withResilience(
      async () => { throw new Error('y') },
      {
        circuitBreaker: { failureThreshold: 1, resetTimeoutMs: 1000, now: () => 0 },
        maxAttempts: 1,
        sleep: noopSleep,
        fallback: 'degraded',
      },
    )
    expect(res).toBe('degraded')
  })

  it('无 breaker、仅重试+降级：最终降级返回兜底', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always'))
    const res = await withResilience(fn, { maxAttempts: 2, sleep: noopSleep, fallback: 'fb' })
    expect(res).toBe('fb')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('无 breaker、无降级：重试耗尽抛出 V9Error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always'))
    await expect(
      withResilience(fn, { maxAttempts: 2, sleep: noopSleep }),
    ).rejects.toBeInstanceOf(V9Error)
  })
})
