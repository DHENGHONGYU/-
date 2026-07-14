/**
 * @fileoverview 压测触发 Hook（页面 → 服务 隔离层）
 *
 * 将「页面直接 import services/perf/stressTestService」收敛到此 Hook，
 * 满足 audit:mcp 的「页面/组件禁止直接 import services」约束。
 * 服务层通过依赖注入接收 store 适配器（sink），保持零 store 依赖。
 *
 * @module hooks/useStressTest
 * @created 2026-07-14 偏差校对整改 R7
 */
import { useCallback } from 'react'
import { runStressTest } from '@/services/perf/stressTestService'
import { usePerfMetricsStore } from '@/store/perfMetricsStore'
import type { StressTestConfig, StressTestResult } from '@/types/modules/perf.types'

/**
 * 压测触发 Hook。
 * @returns run 触发一次压测；执行中实时指标经注入的 sink 写入 usePerfMetricsStore。
 */
export function useStressTest(): {
  run: (cfg?: StressTestConfig) => Promise<StressTestResult>
} {
  const run = useCallback(
    (cfg?: StressTestConfig): Promise<StressTestResult> =>
      // 依赖注入：将 store 适配为 sink 传入服务，服务层零 store 依赖
      runStressTest(cfg, usePerfMetricsStore.getState()),
    [],
  )

  return { run }
}
