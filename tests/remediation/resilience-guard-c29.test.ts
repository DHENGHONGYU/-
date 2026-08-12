/**
 * @test_id V9-TEST-UT-078
 * C29 resilience guard — 熔断状态机回归测试
 *
 * 背景：复杂度整改中，29 处重复条件已清零。其中 C29
 * (`src/services/resilience.ts` 的 `createCircuitBreaker.guard`)
 * 两处 `if (state === 'half-open')` 属熔断状态机必需的分支（成功路径 /
 * 失败路径各一处），官方 `complexity-scan` 按「逐函数」计数并不计为重复，
 * 故**刻意保留、不予去重**。
 *
 * 本测试锁定该状态机语义：若将来有人误将两处守卫「合并去重」，
 * 状态机将崩坏，以下用例会失败。
  * @covers_docs []
*/

import { describe, it, expect, vi } from 'vitest'

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))
vi.mock('@/services/errorBus', () => ({ captureError: vi.fn() }))

import { createCircuitBreaker, CircuitOpenError } from '@/services/resilience'

describe('C29 resilience guard — 熔断状态机（刻意保留的重复条件）', () => {
  it('closed → 连续失败达到阈值 → open', async () => {
    const now = vi.fn(() => 0)
    const breaker = createCircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      successThreshold: 2,
      now,
    })
    expect(breaker.state).toBe('closed')

    const fail = () => Promise.reject(new Error('boom'))
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow('boom')
    }
    expect(breaker.state).toBe('open')
  })

  it('open 且未到 resetTimeout → 直接拒绝（CircuitOpenError）', async () => {
    const now = vi.fn(() => 0)
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      successThreshold: 2,
      now,
    })
    await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow()
    expect(breaker.state).toBe('open')

    // 仍在 open 窗口内，探测请求直接被拒
    await expect(breaker.execute(() => Promise.resolve(1))).rejects.toBeInstanceOf(CircuitOpenError)
  })

  it('open → 到达 resetTimeout → half-open → 成功达到阈值 → closed', async () => {
    let t = 0
    const now = vi.fn(() => t)
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      successThreshold: 2,
      now,
    })

    await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow()
    expect(breaker.state).toBe('open')

    // 推进时间越过 resetTimeout，下一次 execute 进入 half-open
    t = 2000
    await breaker.execute(() => Promise.resolve(1))
    expect(breaker.state).toBe('half-open')

    // 第二次成功达到 successThreshold → 闭合
    await breaker.execute(() => Promise.resolve(2))
    expect(breaker.state).toBe('closed')
  })

  it('half-open 探测失败 → 立即回到 open（验证失败路径的 half-open 守卫）', async () => {
    let t = 0
    const now = vi.fn(() => t)
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      successThreshold: 2,
      now,
    })

    await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow()
    t = 2000

    // 进入 half-open
    await breaker.execute(() => Promise.resolve(1))
    expect(breaker.state).toBe('half-open')

    // 探测失败：验证 .then 的 reject 分支中 `state === 'half-open'` 守卫
    await expect(breaker.execute(() => Promise.reject(new Error('probe-fail')))).rejects.toThrow('probe-fail')
    expect(breaker.state).toBe('open')
  })

  it('两次 half-open 成功之间仍保持 half-open（验证成功路径守卫不提前闭合）', async () => {
    let t = 0
    const now = vi.fn(() => t)
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      successThreshold: 3,
      now,
    })

    await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow()
    t = 2000

    await breaker.execute(() => Promise.resolve(1))
    expect(breaker.state).toBe('half-open') // 第 1 次成功，未达阈值
    await breaker.execute(() => Promise.resolve(2))
    expect(breaker.state).toBe('half-open') // 第 2 次成功，仍未达阈值
    await breaker.execute(() => Promise.resolve(3))
    expect(breaker.state).toBe('closed') // 第 3 次成功，达到阈值
  })
})
