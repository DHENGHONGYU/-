/**
 * 性能监控工具
 *
 * 在关键路径（数据获取 / 评分计算 / 图表渲染）补充耗时测量，
 * 同时写入结构化日志（[PERF] 前缀）与内存采样聚合，建立真实性能数据。
 *
 * 用法：
 *   const data = await measureAsync(PERF.DATA_FETCH_REQUEST, () => fetchQuote())
 *   const score = measureSync('scoring:layer', () => calc())
 * 组件渲染耗时（在组件顶部调用）：
 *   usePerfTrace('LineChart', { points: data.length })
 *
 * 实时聚合：getPerfStats() 返回各标签的 count / avg / p50 / p95 / max。
  * @doc [V9-DOC-FRONT-037]
*/

import { getLogger } from './logger'

const logger = getLogger()

/** 性能采样上限，防止长期运行内存膨胀 */
const MAX_SAMPLES = 1000

/** 关键路径标签常量，避免散落字符串 */
export const PERF = {
  DATA_FETCH_REQUEST: 'data-fetch:request',
  SCORING_CALCULATE_ALL: 'scoring:calculateAll',
} as const

export interface PerfSample {
  /** 操作标签，如 data-fetch:request / scoring:calculateAll / render:LineChart */
  label: string
  /** 耗时（毫秒） */
  durationMs: number
  /** 是否成功完成 */
  ok: boolean
  /** 采样时间戳（ms） */
  at: number
}

export type PerfMeta = Record<string, unknown>

const samples: PerfSample[] = []

/**
 * 记录一条性能采样（内部使用，同时输出 [PERF] 结构化日志）。
 */
export function recordPerf(label: string, durationMs: number, ok: boolean, meta?: PerfMeta): void {
  const rounded = Math.round(durationMs * 100) / 100
  samples.push({ label, durationMs: rounded, ok, at: Date.now() })
  if (samples.length > MAX_SAMPLES) {
    samples.splice(0, samples.length - MAX_SAMPLES)
  }
  const logContext = { durationMs: rounded, ...(meta ?? {}) }
  if (ok) {
    logger.info(`[PERF] ${label} 完成`, logContext)
  } else {
    logger.error(`[PERF] ${label} 失败`, logContext)
  }
}

/**
 * 测量异步函数耗时。失败时会以相同标签记录错误采样并重新抛出。
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
  meta?: PerfMeta,
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    recordPerf(label, performance.now() - start, true, meta)
    return result
  } catch (err) {
    recordPerf(label, performance.now() - start, false, {
      error: err instanceof Error ? err.message : String(err),
      ...(meta ?? {}),
    })
    throw err
  }
}

/**
 * 测量同步函数耗时。失败时会以相同标签记录错误采样并重新抛出。
 */
export function measureSync<T>(label: string, fn: () => T, meta?: PerfMeta): T {
  const start = performance.now()
  try {
    const result = fn()
    recordPerf(label, performance.now() - start, true, meta)
    return result
  } catch (err) {
    recordPerf(label, performance.now() - start, false, {
      error: err instanceof Error ? err.message : String(err),
      ...(meta ?? {}),
    })
    throw err
  }
}

export interface PerfStats {
  label: string
  count: number
  okCount: number
  failCount: number
  avgMs: number
  p50Ms: number
  p95Ms: number
  maxMs: number
  lastMs: number
}

function percentile(sorted: number[], p: number): number {
  // percentile 仅由 getPerfStats 调用，sorted 来自非空 durations。空数组时 ?? 0 兜底返回 0。
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? 0
}

/**
 * 聚合各标签的性能统计，用于实时查看真实性能数据。
 * 按平均耗时降序返回，便于快速定位热点。
 */
export function getPerfStats(): PerfStats[] {
  const durations = new Map<string, number[]>()
  const okMap = new Map<string, number>()
  const failMap = new Map<string, number>()
  const lastMap = new Map<string, number>()
  for (const s of samples) {
    const arr = durations.get(s.label) ?? []
    arr.push(s.durationMs)
    durations.set(s.label, arr)
    if (s.ok) okMap.set(s.label, (okMap.get(s.label) ?? 0) + 1)
    else failMap.set(s.label, (failMap.get(s.label) ?? 0) + 1)
    lastMap.set(s.label, s.durationMs)
  }
  const stats: PerfStats[] = []
  for (const [label, arr] of durations) {
    const sorted = [...arr].sort((a, b) => a - b)
    const avg = arr.reduce((sum, v) => sum + v, 0) / arr.length
    stats.push({
      label,
      count: arr.length,
      okCount: okMap.get(label) ?? 0,
      failCount: failMap.get(label) ?? 0,
      avgMs: Math.round(avg * 100) / 100,
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
      maxMs: sorted[sorted.length - 1] ?? /* istanbul ignore next: sorted 非空 */ 0,
      lastMs: lastMap.get(label) ?? /* istanbul ignore next: label 在 lastMap 中 */ 0,
    })
  }
  return stats.sort((a, b) => b.avgMs - a.avgMs)
}

/**
 * 获取所有性能采样数据（只读）。
 * @returns 只读性能采样数组
 */
export function getPerfSamples(): readonly PerfSample[] {
  return samples
}

/**
 * 清空所有性能采样数据。
 */
export function clearPerf(): void {
  samples.length = 0
}
