/**
 * @fileoverview 性能度量 Store（Zustand）
 *
 * 采集数据处理能力测算页的时序指标，支撑瓶颈定位与性能基线管理。
 *
 * @module store/perfMetricsStore
 * @created 2026-07-13 P2-6
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { withBroadcast } from '@/lib/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import type { PerfMetric, StressTestResult } from '@/types/modules/perf.types'

const logger = getLogger()

interface PerfMetricsState {
  /** 历史压测结果列表 */
  results: StressTestResult[]
  /** 最近一次压测 ID */
  lastRunId: string | undefined
  /** 是否正在运行 */
  running: boolean
  /** 指标明细（实时） */
  currentMetrics: PerfMetric[]
  /** 添加指标 */
  addMetric: (metric: PerfMetric) => void
  /** 保存结果 */
  saveResult: (result: StressTestResult) => void
  /** 清空当前指标 */
  clearCurrent: () => void
  /** 设置运行状态 */
  setRunning: (running: boolean) => void
}

/**
 * usePerfMetricsStore
 */
export const usePerfMetricsStore = create<PerfMetricsState>((set) => ({
  results: [],
  lastRunId: undefined,
  running: false,
  currentMetrics: [],

  addMetric: (metric) => {
    set((s) => ({ currentMetrics: [...s.currentMetrics, metric] }))
  },

  saveResult: (result) => {
    set((s) => ({
      results: [...s.results.slice(-19), result], // 保留最近 20 条
      lastRunId: result.runId,
      running: false,
    }))
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { type: 'perf:result', runId: result.runId })
    logger.info(`[perfMetricsStore] 压测结果已保存: runId=${result.runId}, total=${result.summary.totalDurationMs}ms`)
  },

  clearCurrent: () => {
    set({ currentMetrics: [] })
  },

  setRunning: (running) => {
    set({ running })
  },
}))

/**
 * PERF_METRICS_STORE_VERSION
 */
export const PERF_METRICS_STORE_VERSION = 1
