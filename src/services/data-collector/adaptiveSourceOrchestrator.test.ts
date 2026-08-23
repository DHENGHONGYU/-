/**
 * @file adaptiveSourceOrchestrator.test.ts — 自适应源编排纯函数单测
 *
 * 覆盖退避延迟唯一真相源（2026-08-23 卫生整改后）：
 * - computeRetryDelayMs：指数退避 + 抖动上限 + maxDelayMs 封顶
 * - computePolicyBackoffMs：RetryPolicy → AdaptiveSourceConfig 适配（dataSourceOrchestrator 消费）
 *
 * 本文件不触网、不依赖 IndexedDB，纯函数断言。
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import {
  computeRetryDelayMs,
  computePolicyBackoffMs,
  DEFAULT_ADAPTIVE_CONFIG,
  type AdaptiveSourceConfig,
} from './adaptiveSourceOrchestrator'
import type { RetryPolicy } from '@/types/modules/collection.types'

/** 无抖动确定性配置（jitterRatio=0 → delay 恒等于 capped） */
const FIXED_CONFIG: AdaptiveSourceConfig = {
  ...DEFAULT_ADAPTIVE_CONFIG,
  retry: { baseDelayMs: 100, maxDelayMs: 1000, factor: 2, jitterRatio: 0 },
}

describe('computeRetryDelayMs（统一退避延迟）', () => {
  it('jitterRatio=0 时退化为固定指数退避：base × factor^attempt', () => {
    expect(computeRetryDelayMs(0, FIXED_CONFIG)).toBe(100)
    expect(computeRetryDelayMs(1, FIXED_CONFIG)).toBe(200)
    expect(computeRetryDelayMs(3, FIXED_CONFIG)).toBe(800)
  })

  it('attempt 超过封顶后恒为 maxDelayMs', () => {
    expect(computeRetryDelayMs(10, FIXED_CONFIG)).toBe(1000)
    expect(computeRetryDelayMs(100, FIXED_CONFIG)).toBe(1000)
  })

  it('全抖动（默认配置）下 delay 落在 [0, capped] 区间', () => {
    for (let i = 0; i < 50; i++) {
      const delay = computeRetryDelayMs(2) // capped = 500×2² = 2000
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(2000)
    }
  })

  it('负数 attempt 不退化崩溃（按 0 处理）', () => {
    const delay = computeRetryDelayMs(-3, FIXED_CONFIG)
    expect(delay).toBe(100)
  })
})

describe('computePolicyBackoffMs（RetryPolicy 适配，退避唯一入口）', () => {
  const policy: RetryPolicy = { maxRetries: 2, initialDelayMs: 500, backoffMultiplier: 2 }

  it('字段映射正确：delay 上界 = initialDelayMs × backoffMultiplier^attempt', () => {
    for (let i = 0; i < 50; i++) {
      const attempt0 = computePolicyBackoffMs(policy, 0)
      expect(attempt0).toBeGreaterThanOrEqual(0)
      expect(attempt0).toBeLessThanOrEqual(500)
      const attempt2 = computePolicyBackoffMs(policy, 2)
      expect(attempt2).toBeLessThanOrEqual(2000)
    }
  })

  it('延迟上界受 DEFAULT_ADAPTIVE_CONFIG.retry.maxDelayMs 封顶', () => {
    const huge: RetryPolicy = { maxRetries: 5, initialDelayMs: 1_000_000, backoffMultiplier: 10 }
    for (let i = 0; i < 20; i++) {
      expect(computePolicyBackoffMs(huge, 3)).toBeLessThanOrEqual(DEFAULT_ADAPTIVE_CONFIG.retry.maxDelayMs)
    }
  })

  it('退化策略（零初始延迟/小数倍率）不崩溃且非负', () => {
    const degenerate: RetryPolicy = { maxRetries: 1, initialDelayMs: 0, backoffMultiplier: 0.5 }
    const delay = computePolicyBackoffMs(degenerate, 4)
    expect(delay).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(delay)).toBe(true)
  })
})
