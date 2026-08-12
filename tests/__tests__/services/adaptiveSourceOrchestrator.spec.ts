/**
 * adaptiveSourceOrchestrator 单元测试
 *
 * 覆盖：
 *   1. 令牌桶：容量耗尽后拒绝 / acquire 等待语义
 *   2. 熔断器：closed → open → half-open → closed 状态机
 *   3. 自适应排序：高质量低延迟源排在低质量高延迟源前
 *   4. 自适应排序：熔断 open 源沉底
 *   5. 退避：延迟上限随 attempt 单调增长且不超 maxDelayMs，抖动有界
 *
 * @module tests/__tests__/services/adaptiveSourceOrchestrator.spec
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import {
  TokenBucketLimiter,
  SourceCircuitBreaker,
  recordSourceResult,
  getSourceMetrics,
  resetAdaptiveOrchestrator,
  computeCombinedScore,
  orderChainAdaptive,
  computeRetryDelayMs,
  DEFAULT_ADAPTIVE_CONFIG,
} from '@/services/data-collector/adaptiveSourceOrchestrator'
import type { AdaptiveSourceConfig } from '@/services/data-collector/adaptiveSourceOrchestrator'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

beforeEach(() => {
  resetAdaptiveOrchestrator()
})

// ─── 1. 令牌桶限流器 ─────────────────────────────────────────

describe('TokenBucketLimiter', () => {
  it('容量耗尽后 tryAcquire 拒绝', () => {
    const limiter = new TokenBucketLimiter(2, 0.001)
    expect(limiter.tryAcquire('sina')).toBe(true)
    expect(limiter.tryAcquire('sina')).toBe(true)
    expect(limiter.tryAcquire('sina')).toBe(false)
  })

  it('不同源 id 的桶相互隔离', () => {
    const limiter = new TokenBucketLimiter(1, 0.001)
    expect(limiter.tryAcquire('a')).toBe(true)
    expect(limiter.tryAcquire('a')).toBe(false)
    expect(limiter.tryAcquire('b')).toBe(true)
  })

  it('acquire 等待语义：令牌补充后最终放行', async () => {
    const limiter = new TokenBucketLimiter(1, 100) // 每 10ms 补 1 个
    expect(limiter.tryAcquire('tencent')).toBe(true)
    expect(limiter.tryAcquire('tencent')).toBe(false)
    await limiter.acquire('tencent')
    // acquire 返回即代表已取到令牌
    expect(limiter.tryAcquire('tencent')).toBe(false)
  })

  it('getAvailabilityRatio 随消耗下降', () => {
    const limiter = new TokenBucketLimiter(4, 0.001)
    expect(limiter.getAvailabilityRatio('x')).toBe(1)
    limiter.tryAcquire('x')
    limiter.tryAcquire('x')
    expect(limiter.getAvailabilityRatio('x')).toBeCloseTo(0.5, 5)
  })
})

// ─── 2. 熔断器状态机 ─────────────────────────────────────────

describe('SourceCircuitBreaker', () => {
  it('closed → open → half-open → closed 完整状态机', async () => {
    const breaker = new SourceCircuitBreaker(2, 30, 2)

    // closed：初始放行
    expect(breaker.canExecute('tushare')).toBe(true)
    expect(breaker.getCircuitState('tushare')).toBe('closed')

    // 连续失败达阈值 → open，拒绝执行
    breaker.onFailure('tushare')
    expect(breaker.getCircuitState('tushare')).toBe('closed')
    breaker.onFailure('tushare')
    expect(breaker.getCircuitState('tushare')).toBe('open')
    expect(breaker.canExecute('tushare')).toBe(false)

    // resetTimeout 后 → half-open，放行探测
    await sleep(40)
    expect(breaker.canExecute('tushare')).toBe(true)
    expect(breaker.getCircuitState('tushare')).toBe('half-open')

    // 探测成功不足次数仍保持 half-open
    breaker.onSuccess('tushare')
    expect(breaker.getCircuitState('tushare')).toBe('half-open')

    // 探测成功达标 → closed
    breaker.onSuccess('tushare')
    expect(breaker.getCircuitState('tushare')).toBe('closed')
    expect(breaker.canExecute('tushare')).toBe(true)
  })

  it('half-open 下失败立即回到 open', async () => {
    const breaker = new SourceCircuitBreaker(1, 20, 2)
    breaker.onFailure('sina')
    expect(breaker.getCircuitState('sina')).toBe('open')

    await sleep(30)
    expect(breaker.getCircuitState('sina')).toBe('half-open')

    breaker.onFailure('sina')
    expect(breaker.getCircuitState('sina')).toBe('open')
    expect(breaker.canExecute('sina')).toBe(false)
  })

  it('closed 下成功会重置连续失败计数', () => {
    const breaker = new SourceCircuitBreaker(3, 1000, 1)
    breaker.onFailure('netease')
    breaker.onFailure('netease')
    expect(breaker.getConsecutiveFailures('netease')).toBe(2)
    breaker.onSuccess('netease')
    expect(breaker.getConsecutiveFailures('netease')).toBe(0)
    breaker.onFailure('netease')
    expect(breaker.getCircuitState('netease')).toBe('closed')
  })
})

// ─── 3. EWMA 记录与综合评分 ──────────────────────────────────

describe('recordSourceResult / computeCombinedScore', () => {
  it('记录后 EWMA 延迟与成功率被更新', () => {
    recordSourceResult('tushare', { success: true, isMock: false, latencyMs: 200, completeness: 1 })
    const m = getSourceMetrics('tushare')
    expect(m.ewmaLatencyMs).toBeGreaterThan(0)
    expect(m.ewmaLatencyMs).toBeLessThan(200) // 初始 0 向 200 收敛
    expect(m.realSuccessRate).toBe(1)
    expect(m.completenessRate).toBe(1)
    expect(m.mockRatio).toBe(0)
  })

  it('mock 成功不计入真实成功率', () => {
    recordSourceResult('mock', { success: true, isMock: true, latencyMs: 10, completeness: 1 })
    const m = getSourceMetrics('mock')
    expect(m.successRate).toBe(1)
    expect(m.realSuccessRate).toBeLessThan(1)
    expect(m.mockRatio).toBeGreaterThan(0)
  })

  it('高质量低延迟源综合分高于低质量高延迟源', () => {
    const good = { success: true, isMock: false, latencyMs: 100, completeness: 1 }
    const bad = { success: false, isMock: false, latencyMs: 8000, completeness: 0.2 }
    for (let i = 0; i < 5; i += 1) {
      recordSourceResult('good-src', good)
      recordSourceResult('bad-src', bad)
    }
    const goodScore = getSourceMetrics('good-src').combinedScore
    const badScore = getSourceMetrics('bad-src').combinedScore
    expect(goodScore).toBeGreaterThan(badScore)
  })

  it('熔断 open 的源 computeCombinedScore 恒为 0', () => {
    const config = DEFAULT_ADAPTIVE_CONFIG
    for (let i = 0; i < config.circuitBreaker.failureThreshold; i += 1) {
      recordSourceResult('fragile', { success: false, isMock: false, latencyMs: 500, completeness: 0 })
    }
    const m = getSourceMetrics('fragile')
    expect(m.circuitState).toBe('open')
    expect(m.combinedScore).toBe(0)
    expect(computeCombinedScore(m, config)).toBe(0)
  })
})

// ─── 4. 自适应链排序 ─────────────────────────────────────────

describe('orderChainAdaptive', () => {
  it('高质量低延迟源排在低质量高延迟源前面', () => {
    const good = { success: true, isMock: false, latencyMs: 100, completeness: 1 }
    const bad = { success: false, isMock: false, latencyMs: 8000, completeness: 0.2 }
    for (let i = 0; i < 5; i += 1) {
      recordSourceResult('good-src', good)
      recordSourceResult('bad-src', bad)
    }
    const ordered = orderChainAdaptive(['bad-src', 'good-src'])
    expect(ordered[0]).toBe('good-src')
    expect(ordered[1]).toBe('bad-src')
  })

  it('熔断 open 的源沉底', () => {
    const threshold = DEFAULT_ADAPTIVE_CONFIG.circuitBreaker.failureThreshold
    for (let i = 0; i < threshold; i += 1) {
      recordSourceResult('open-src', { success: false, isMock: false, latencyMs: 300, completeness: 0 })
    }
    expect(getSourceMetrics('open-src').circuitState).toBe('open')

    // open-src 初始在链首，重排后应沉底；未观测源持乐观初始分在前
    const ordered = orderChainAdaptive(['open-src', 'fresh-a', 'fresh-b'])
    expect(ordered[ordered.length - 1]).toBe('open-src')
    expect(ordered.slice(0, 2)).toEqual(['fresh-a', 'fresh-b'])
  })

  it('不修改入参数组', () => {
    const chain = ['a', 'b', 'c']
    orderChainAdaptive(chain)
    expect(chain).toEqual(['a', 'b', 'c'])
  })

  it('冷启动（全部源无历史指标）退化为原顺序', () => {
    expect(orderChainAdaptive(['tushare', 'tencent', 'sina', 'mock'])).toEqual([
      'tushare',
      'tencent',
      'sina',
      'mock',
    ])
  })
})

// ─── 5. 退避延迟 ─────────────────────────────────────────────

describe('computeRetryDelayMs', () => {
  const config: AdaptiveSourceConfig = {
    ...DEFAULT_ADAPTIVE_CONFIG,
    retry: { baseDelayMs: 100, maxDelayMs: 1000, factor: 2, jitterRatio: 1 },
  }
  const cap = (attempt: number): number =>
    Math.min(config.retry.baseDelayMs * Math.pow(config.retry.factor, attempt), config.retry.maxDelayMs)

  it('延迟上限随 attempt 单调增长直至 maxDelayMs', () => {
    const caps = [0, 1, 2, 3, 4, 5, 10].map(cap)
    caps.reduce((prev, curr) => {
      expect(curr).toBeGreaterThanOrEqual(prev)
      return curr
    })
    expect(caps[caps.length - 1]).toBe(config.retry.maxDelayMs)
  })

  it('全抖动下延迟恒在 [0, capped] 有界区间', () => {
    for (let attempt = 0; attempt <= 6; attempt += 1) {
      for (let sample = 0; sample < 200; sample += 1) {
        const delay = computeRetryDelayMs(attempt, config)
        expect(delay).toBeGreaterThanOrEqual(0)
        expect(delay).toBeLessThanOrEqual(cap(attempt))
      }
    }
  })

  it('jitterRatio=0 时退化为固定指数退避上限', () => {
    const noJitter: AdaptiveSourceConfig = {
      ...config,
      retry: { ...config.retry, jitterRatio: 0 },
    }
    expect(computeRetryDelayMs(0, noJitter)).toBe(100)
    expect(computeRetryDelayMs(2, noJitter)).toBe(400)
    expect(computeRetryDelayMs(10, noJitter)).toBe(1000) // 触顶 maxDelayMs
  })
})
