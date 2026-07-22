/**
 * @test_id V9-TEST-ST-204
 * perfMetricsStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. addMetric 后 reset() 回到初始值
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

vi.mock('@/lib/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: {},
}))

// ============================================================
// Imports
// ============================================================

import { usePerfMetricsStore } from './perfMetricsStore'
import type { PerfMetric } from '@/types/modules/perf.types'

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  usePerfMetricsStore.getState().reset()
})

// ============================================================
// usePerfMetricsStore
// ============================================================

describe('usePerfMetricsStore', () => {
  // ---------- 初始状态 ----------

  it('初始状态验证', () => {
    const state = usePerfMetricsStore.getState()
    expect(state.results).toEqual([])
    expect(state.running).toBe(false)
    expect(state.currentMetrics).toEqual([])
    expect(state.lastRunId).toBeUndefined()
  })

  // ---------- reset ----------

  it('addMetric 后 reset() 回到初始值', () => {
    const metric: PerfMetric = {
      name: 'cpu',
      value: 80,
      unit: '%',
      timestamp: Date.now(),
    }

    usePerfMetricsStore.getState().addMetric(metric)
    usePerfMetricsStore.getState().setRunning(true)

    expect(usePerfMetricsStore.getState().currentMetrics).toHaveLength(1)
    expect(usePerfMetricsStore.getState().running).toBe(true)

    usePerfMetricsStore.getState().reset()

    const state = usePerfMetricsStore.getState()
    expect(state.currentMetrics).toEqual([])
    expect(state.results).toEqual([])
    expect(state.running).toBe(false)
    expect(state.lastRunId).toBeUndefined()
  })
})
