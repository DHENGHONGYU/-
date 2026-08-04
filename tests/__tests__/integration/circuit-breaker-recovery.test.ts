/**
 * R2 组：熔断器状态机 + 恢复探测集成测试
 *
 * 文件位置：tests/__tests__/integration/circuit-breaker-recovery.test.ts
 *
 * 覆盖范围（7 用例）：
 *   R2-1  连续 5 次失败 → closed 变为 open，第 6 次立即 reject CircuitOpenError
 *   R2-2  open 超时 → half-open，放行探测
 *   R2-3  half-open 连续 2 次成功 → closed（恢复）
 *   R2-4  half-open 1 次失败 → 回退 open（重置计时）
 *   R2-5  open 时 execute → 零次 fn 调用（快速失败）
 *   R2-6  half-open 探测：fn 内部重试后成功 → breaker 计 1 success，保持 half-open
 *   R2-7  连续 5 轮重试全失败 → 第 6 轮零 fn 执行 + 超时后探测恢复
 *
 * 相关文档：
 *   - ADR-011 熔断器与重试机制集成架构
 *   - R2 覆盖率报告 r2-coverage-report-2026-08-04.md
 */
import { describe, expect, it, vi } from 'vitest'
import {
  createCircuitBreaker,
  CircuitOpenError,
  type CircuitBreaker as ICircuitBreaker,
} from '@/services/resilience'

// ─── logger mock（resilience.ts 依赖）─────────────────────────────
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ─── eventBus mock（errorBus 依赖）───────────────────────────────
vi.mock('@/lib/eventBus', () => ({
  eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn(), once: vi.fn() },
  EVENT_TYPES: {},
}))

// ===============================================================
// R2: 熔断器状态机（4 用例）
// ===============================================================
describe('P1 · R2: 熔断器状态机（createCircuitBreaker）', () => {
  it('R2-1 连续 5 次失败 → closed 变为 open，第 6 次调用立即 reject CircuitOpenError', async () => {
    const mockNow = 0
    const breaker: ICircuitBreaker = createCircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      now: () => mockNow,
    })

    // 前 5 次失败
    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(async () => { throw new Error(`fail #${i + 1}`) }),
      ).rejects.toThrow()
    }

    expect(breaker.state).toBe('open')

    // 第 6 次调用应立即被熔断器拒绝（不执行 fn）
    const spy = vi.fn(async () => 'should-not-reach')
    await expect(breaker.execute(spy)).rejects.toBeInstanceOf(CircuitOpenError)
    expect(spy).not.toHaveBeenCalled()
    expect(breaker.state).toBe('open')
  })

  it('R2-2 open 状态超过 resetTimeoutMs → 变为 half-open，放行 1 次探测调用', async () => {
    let mockNow = 0
    const breaker: ICircuitBreaker = createCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 30_000,
      now: () => mockNow,
    })

    await expect(
      breaker.execute(async () => { throw new Error('trigger open') }),
    ).rejects.toThrow()
    expect(breaker.state).toBe('open')

    // 未超时 → 拒绝
    mockNow = 10_000
    await expect(breaker.execute(async () => 'x')).rejects.toBeInstanceOf(CircuitOpenError)
    expect(breaker.state).toBe('open')

    // 超时 → half-open，放行探测
    mockNow = 35_000
    const probeSpy = vi.fn(async () => 'probe-ok')
    const result = await breaker.execute(probeSpy)
    expect(result).toBe('probe-ok')
    expect(probeSpy).toHaveBeenCalledTimes(1)
    expect(breaker.state).toBe('half-open')
  })

  it('R2-3 half-open 下连续 2 次成功 → 变为 closed（完全恢复）', async () => {
    let mockNow = 0
    const breaker: ICircuitBreaker = createCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 30_000,
      successThreshold: 2,
      now: () => mockNow,
    })

    await expect(
      breaker.execute(async () => { throw new Error('open') }),
    ).rejects.toThrow()
    expect(breaker.state).toBe('open')

    mockNow = 35_000
    // 第 1 次成功：successes=1，未达 successThreshold=2
    expect(await breaker.execute(async () => 'success-1')).toBe('success-1')
    expect(breaker.state).toBe('half-open')

    // 第 2 次成功：successes=2 ≥ successThreshold → closed
    expect(await breaker.execute(async () => 'success-2')).toBe('success-2')
    expect(breaker.state).toBe('closed')

    // 恢复后正常直通
    expect(await breaker.execute(async () => 'normal')).toBe('normal')
    expect(breaker.state).toBe('closed')
  })

  it('R2-4 half-open 下 1 次失败 → 立即回退 open（重置等待计时）', async () => {
    let mockNow = 0
    const breaker: ICircuitBreaker = createCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 30_000,
      successThreshold: 2,
      now: () => mockNow,
    })

    await expect(
      breaker.execute(async () => { throw new Error('open') }),
    ).rejects.toThrow()
    expect(breaker.state).toBe('open')

    // 超时 → half-open，探测成功
    mockNow = 35_000
    expect(await breaker.execute(async () => 'probe-ok')).toBe('probe-ok')
    expect(breaker.state).toBe('half-open')

    // half-open 下失败 → 回退 open，openedAt 重置
    mockNow = 35_100
    await expect(
      breaker.execute(async () => { throw new Error('probe-fail') }),
    ).rejects.toThrow()
    expect(breaker.state).toBe('open')

    // openedAt 已重置：35100 + 20000 < 65000，仍被拒绝
    mockNow = 55_000
    await expect(breaker.execute(async () => 'x')).rejects.toBeInstanceOf(CircuitOpenError)
    expect(breaker.state).toBe('open')

    // 35100 + 30000 = 65100 后才能再次 half-open
    mockNow = 66_000
    expect(await breaker.execute(async () => 're-probe')).toBe('re-probe')
    expect(breaker.state).toBe('half-open')
  })
})

// ===============================================================
// R2 恢复探测：熔断器与重试循环联合场景（3 用例）
// ===============================================================
describe('P1 · R2 恢复探测：熔断器 open 时零 fetch + half-open 探测经重试', () => {
  it('R2-5 熔断器 open 时调用 execute → 零次 fn 调用，直接 reject CircuitOpenError', async () => {
    const mockNow = 0
    const breaker: ICircuitBreaker = createCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 60_000,
      now: () => mockNow,
    })

    // 1 次失败触发 open
    const failingFn = vi.fn(async () => { throw new Error('network down') })
    await expect(breaker.execute(failingFn)).rejects.toThrow()
    expect(breaker.state).toBe('open')
    expect(failingFn).toHaveBeenCalledTimes(1)

    // 熔断器 open → fn 不执行，直接 reject
    const probeFn = vi.fn(async () => 'should-not-reach')
    await expect(breaker.execute(probeFn)).rejects.toBeInstanceOf(CircuitOpenError)
    expect(probeFn).not.toHaveBeenCalled()
    expect(breaker.state).toBe('open')
  })

  it('R2-6 half-open 探测：fn 内部重试（第 1 次失败第 2 次成功）→ 探测成功，breaker 保持 half-open', async () => {
    let mockNow = 0
    const breaker: ICircuitBreaker = createCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 30_000,
      successThreshold: 2,
      now: () => mockNow,
    })

    await expect(
      breaker.execute(async () => { throw new Error('open') }),
    ).rejects.toThrow()
    expect(breaker.state).toBe('open')

    mockNow = 35_000

    // 探测函数内部模拟 fetcherClient 重试循环：attempt 1 失败 → attempt 2 成功
    // 关键：重试发生在 fn 内部（非 spy 递归），breaker 只调用 spy 1 次
    let innerAttempts = 0
    const innerRetry = async (): Promise<string> => {
      innerAttempts++
      if (innerAttempts < 2) {
        return innerRetry()
      }
      return 'recovered'
    }
    const probeFn = vi.fn(innerRetry)

    const result = await breaker.execute(probeFn)
    expect(result).toBe('recovered')
    expect(probeFn).toHaveBeenCalledTimes(1) // breaker 只调用 1 次
    expect(innerAttempts).toBe(2) // 内部重试 2 次
    expect(breaker.state).toBe('half-open') // successThreshold=2 未达标
  })

  it('R2-7 连续 5 轮重试全失败 → 第 6 轮调用零 fn 执行（模拟 fetcherClient 集成场景）', async () => {
    let mockNow = 0
    const breaker: ICircuitBreaker = createCircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60_000,
      now: () => mockNow,
    })

    // 模拟 fetcherClient 集成：每轮 execute 内部重试 4 次后全失败
    const mockRetryLoop = vi.fn(async () => {
      throw new Error('4 次重试全失败：服务未启动或无法连接')
    })

    // 前 5 轮：每轮 execute → retryLoop reject → breaker.failures++
    for (let round = 1; round <= 5; round++) {
      await expect(breaker.execute(mockRetryLoop)).rejects.toThrow()
    }

    expect(breaker.state).toBe('open')
    expect(mockRetryLoop).toHaveBeenCalledTimes(5)

    // 第 6 轮：熔断器 open → mockRetryLoop 零调用，直接 reject CircuitOpenError
    await expect(breaker.execute(mockRetryLoop)).rejects.toBeInstanceOf(CircuitOpenError)
    expect(mockRetryLoop).toHaveBeenCalledTimes(5) // 仍 5 次，未增加
    expect(breaker.state).toBe('open')

    // 超时后 half-open → 第 7 轮探测成功
    mockNow = 65_000
    const successFn = vi.fn(async () => 'service-recovered')
    const result = await breaker.execute(successFn)
    expect(result).toBe('service-recovered')
    expect(successFn).toHaveBeenCalledTimes(1)
    expect(breaker.state).toBe('half-open')
  })
})
