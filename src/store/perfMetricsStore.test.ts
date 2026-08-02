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
import type { PerfMetric, StressTestResult } from '@/types/modules/perf.types'

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
      taskName: 'cpu',
      symbol: 'TEST',
      durationMs: 80,
      startedAt: Date.now(),
      success: true,
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

  // ---------- saveResult ----------

  it('saveResult: addMetric 后 saveResult 断言 results 增加且 lastRunId 非空', () => {
    const metric: PerfMetric = {
      taskName: 'cpu',
      symbol: 'TEST',
      durationMs: 80,
      startedAt: Date.now(),
      success: true,
    }

    usePerfMetricsStore.getState().addMetric(metric)

    const result: StressTestResult = {
      runId: 'run-001',
      timestamp: Date.now(),
      symbols: ['600519.SH', '000858.SZ'],
      metrics: [],
      summary: {
        totalDurationMs: 1200,
        avgPerStockMs: 600,
        maxMs: 800,
        minMs: 400,
        p50Ms: 600,
        p95Ms: 750,
        p99Ms: 790,
        successCount: 2,
        failCount: 0,
        avgV6ScoreMs: 300,
        avgDualStrategyMs: 200,
        avgRotationDetectionMs: 100,
      },
      taskSummaries: {},
    }

    usePerfMetricsStore.getState().saveResult(result)

    const state = usePerfMetricsStore.getState()
    expect(state.results).toHaveLength(1)
    expect(state.results[0]!.runId).toBe('run-001')
    expect(state.lastRunId).toBe('run-001')
    expect(state.running).toBe(false)
  })

  it('saveResult: 保留最近 20 条结果', () => {
    for (let i = 1; i <= 25; i++) {
      const result: StressTestResult = {
        runId: `run-${String(i).padStart(3, '0')}`,
        timestamp: Date.now(),
        symbols: [],
        metrics: [],
        summary: {
          totalDurationMs: 100,
          avgPerStockMs: 50,
          maxMs: 80,
          minMs: 20,
          p50Ms: 50,
          p95Ms: 75,
          p99Ms: 79,
          successCount: 0,
          failCount: 0,
          avgV6ScoreMs: 0,
          avgDualStrategyMs: 0,
          avgRotationDetectionMs: 0,
        },
        taskSummaries: {},
      }
      usePerfMetricsStore.getState().saveResult(result)
    }

    const state = usePerfMetricsStore.getState()
    expect(state.results).toHaveLength(20)
    expect(state.results[0]!.runId).toBe('run-006') // 最早的被裁掉
    expect(state.results[19]!.runId).toBe('run-025') // 最新保留
  })

  // ---------- setRunning ----------

  it('setRunning: 断言 running 状态切换', () => {
    expect(usePerfMetricsStore.getState().running).toBe(false)

    usePerfMetricsStore.getState().setRunning(true)
    expect(usePerfMetricsStore.getState().running).toBe(true)

    usePerfMetricsStore.getState().setRunning(false)
    expect(usePerfMetricsStore.getState().running).toBe(false)
  })
})
