/**
 * usePerfTrace - 组件渲染耗时追踪 Hook
 *
 * 测量组件「渲染 + 提交（commit）」阶段的耗时，写入 [PERF] 日志与内存采样聚合，
 * 为图表渲染等关键路径建立真实性能数据。
 *
 * 用法（在组件函数顶部无条件调用）：
 *   usePerfTrace('LineChart', { points: data.length, series: lines.length })
 *
 * 采样结果可通过 getPerfStats() 实时聚合查看。
 */

import { useLayoutEffect, useRef } from 'react'
import { recordPerf } from '@/lib/perf'

/**
 * 追踪组件渲染耗时。
 * @param name 组件标识，最终标签为 `render:${name}`
 * @param meta 附加上下文（如数据点数量、系列数量），写入 [PERF] 日志
 */
export function usePerfTrace(name: string, meta?: Record<string, unknown>): void {
  const startRef = useRef(0)
  // 在渲染开始时记录时间戳（每次渲染刷新）
  startRef.current = performance.now()
  useLayoutEffect(() => {
    const durationMs = performance.now() - startRef.current
    recordPerf(`render:${name}`, durationMs, true, meta)
  })
}
