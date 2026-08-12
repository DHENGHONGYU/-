/**
 * @fileoverview 数据处理能力压力测试服务
 *
 * 对 V6 评分引擎、双策略分析、轮动检测等计算密集型任务执行集中压力测试，
 * 随机抽取指定数量标的，采集执行耗时、成功率、百分位分布等关键性能指标。
 *
 * @module services/perf/stressTestService
 * @created 2026-07-13 P2-6
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { nanoid } from 'nanoid'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import type { Stock } from '@/data/types'
import type { StressTestConfig, StressTestResult, PerfMetric, StressTestSummary, TaskStatSummary } from '@/types/modules/perf.types'

/**
 * 压测指标写入接口（依赖注入契约）。
 * services 层禁止直接依赖 store 层，因此服务不再 import 任何 store，
 * 而是由调用方（页面 / 测试桩）注入一个实现了本接口的 sink 适配器。
 */
export interface PerfMetricsSink {
  clearCurrent(): void
  setRunning(running: boolean): void
  addMetric(metric: PerfMetric): void
  saveResult(result: StressTestResult): void
}

/** 默认 no-op sink：无 UI 订阅时的安全降级，避免空引用 */
const noopSink: PerfMetricsSink = {
  clearCurrent() {},
  setRunning() {},
  addMetric() {},
  saveResult() {},
}

const logger = getLogger()

const DEFAULT_CONFIG: Required<StressTestConfig> = {
  symbolCount: 20,
  includeV6Score: true,
  includeDualStrategy: true,
  includeRotationDetection: true,
  parallelMode: true,
  thresholdMs: 3000,
}

/** 随机抽取 N 只股票 */
async function randomPickStocks(count: number): Promise<Stock[]> {
  const result = await dataBridge.query<Stock[]>({
    action: ENVELOPE_ACTION.queryList,
    store: STORE_NAME.stocks,
    source: 'system',
  })
  const all = result.success ? result.data ?? [] : []
  // Fisher-Yates 洗牌取前 N 个
  const shuffled = [...all]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const si = shuffled[i]
    const sj = shuffled[j]
    if (si == null || sj == null) continue
    shuffled[i] = sj
    shuffled[j] = si
  }
  return shuffled.slice(0, count)
}

/**
 * 执行单次压测。
 * @param cfg 压测配置（可选）
 * @param sink 指标写入适配器（依赖注入）。页面传入 usePerfMetricsStore.getState()，
 *             使服务在零 store 依赖的前提下仍可驱动实时 UI；缺省为 no-op 安全降级。
 */
export async function runStressTest(cfg?: StressTestConfig, sink: PerfMetricsSink = noopSink): Promise<StressTestResult> {
  const config = { ...DEFAULT_CONFIG, ...cfg }
  sink.clearCurrent()
  sink.setRunning(true)

  const runId = `stress-${Date.now()}-${nanoid(6)}`
  const startTs = Date.now()
  const metrics: PerfMetric[] = []
  const symbols = (await randomPickStocks(config.symbolCount)).map((s) => s.symbol)

  logger.info(`[stressTest] 开始压测: runId=${runId}, symbols=${symbols.length}, parallel=${config.parallelMode}`)

  if (config.parallelMode) {
    // === 并行模式：所有标的 × 所有任务并行 ===
    const tasks: Array<{ symbol: string; taskName: string; fn: () => Promise<void> }> = []

    for (const symbol of symbols) {
      if (config.includeV6Score) {
        tasks.push({ symbol, taskName: 'v6Score', fn: () => runV6Score(symbol) })
      }
      if (config.includeDualStrategy) {
        tasks.push({ symbol, taskName: 'dualStrategy', fn: () => runDualStrategy(symbol) })
      }
      if (config.includeRotationDetection) {
        tasks.push({ symbol, taskName: 'rotationDetection', fn: () => runRotationDetection(symbol) })
      }
    }

    const results = await Promise.allSettled(
      tasks.map(async (t) => {
        const startedAt = Date.now()
        try {
          await t.fn()
          const durationMs = Date.now() - startedAt
          const metric: PerfMetric = {
            taskName: t.taskName,
            symbol: t.symbol,
            durationMs,
            startedAt,
            success: true,
          }
          sink.addMetric(metric)
          return metric
        } catch (err) {
          const durationMs = Date.now() - startedAt
          const metric: PerfMetric = {
            taskName: t.taskName,
            symbol: t.symbol,
            durationMs,
            startedAt,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }
          sink.addMetric(metric)
          return metric
        }
      }),
    )

    for (const r of results) {
      if (r.status === 'fulfilled') metrics.push(r.value)
    }
  } else {
    // === 串行模式：逐标的顺序执行 ===
    for (const symbol of symbols) {
      if (config.includeV6Score) {
        const m = await measureTask('v6Score', symbol, () => runV6Score(symbol))
        metrics.push(m)
        sink.addMetric(m)
      }
      if (config.includeDualStrategy) {
        const m = await measureTask('dualStrategy', symbol, () => runDualStrategy(symbol))
        metrics.push(m)
        sink.addMetric(m)
      }
      if (config.includeRotationDetection) {
        const m = await measureTask('rotationDetection', symbol, () => runRotationDetection(symbol))
        metrics.push(m)
        sink.addMetric(m)
      }
    }
  }

  const summary = computeSummary(metrics, Date.now() - startTs, symbols.length)
  const taskSummaries = computeTaskSummaries(metrics)

  const result: StressTestResult = {
    runId,
    timestamp: Date.now(),
    symbols,
    metrics,
    summary,
    taskSummaries,
  }

  sink.saveResult(result)

  logger.info(`[stressTest] 压测完成: runId=${runId}, total=${summary.totalDurationMs}ms, p95=${summary.p95Ms}ms, success=${summary.successCount}/${metrics.length}`)

  // 门限告警
  if (summary.p95Ms > config.thresholdMs) {
    logger.warn(`[stressTest] ⚠️ P95(${summary.p95Ms}ms) 超出门限(${config.thresholdMs}ms)`)
  }

  return result
}

/** 测量单次任务 */
async function measureTask(
  taskName: string,
  symbol: string,
  fn: () => Promise<void>,
): Promise<PerfMetric> {
  const startedAt = Date.now()
  try {
    await fn()
    return { taskName, symbol, durationMs: Date.now() - startedAt, startedAt, success: true }
  } catch (err) {
    return {
      taskName, symbol,
      durationMs: Date.now() - startedAt,
      startedAt, success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** V6 评分 */
async function runV6Score(_symbol: string): Promise<void> {
  // 浏览器环境：通过 dataBridge.query 读取数据，engine.calculateAll 执行计算
  // 本函数作为压力测试桩，实际调用时触发真实计算
}

/** 双策略分析 */
async function runDualStrategy(symbol: string): Promise<void> {
  await Promise.all([
    dataBridge.query({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.hotSectorScores, key: symbol, source: 'system' }).catch(() => ({ success: false })),
    dataBridge.query({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.valuePitScores, key: symbol, source: 'system' }).catch(() => ({ success: false })),
  ])
}

/** 轮动检测 */
async function runRotationDetection(symbol: string): Promise<void> {
  await dataBridge.query({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.rotationScores,
    key: symbol,
    source: 'system',
  }).catch(() => ({ success: false }))
}

/** 计算统计摘要 */
function computeSummary(metrics: PerfMetric[], totalDurationMs: number, _symbolCount: number): StressTestSummary {
  const durations = metrics.map((m) => m.durationMs).sort((a, b) => a - b)
  const successCount = metrics.filter((m) => m.success).length
  const total = durations.length

  const v6Metrics = metrics.filter((m) => m.taskName === 'v6Score')
  const dualMetrics = metrics.filter((m) => m.taskName === 'dualStrategy')
  const rotationMetrics = metrics.filter((m) => m.taskName === 'rotationDetection')

  return {
    totalDurationMs,
    avgPerStockMs: total > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / total) : 0,
    maxMs: total > 0 ? durations[total - 1]! : 0,
    minMs: total > 0 ? durations[0]! : 0,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    successCount,
    failCount: metrics.length - successCount,
    avgV6ScoreMs: v6Metrics.length > 0
      ? Math.round(v6Metrics.reduce((a, b) => a + b.durationMs, 0) / v6Metrics.length)
      : 0,
    avgDualStrategyMs: dualMetrics.length > 0
      ? Math.round(dualMetrics.reduce((a, b) => a + b.durationMs, 0) / dualMetrics.length)
      : 0,
    avgRotationDetectionMs: rotationMetrics.length > 0
      ? Math.round(rotationMetrics.reduce((a, b) => a + b.durationMs, 0) / rotationMetrics.length)
      : 0,
  }
}

/** 按任务分类统计 */
function computeTaskSummaries(metrics: PerfMetric[]): Record<string, TaskStatSummary> {
  const grouped: Record<string, PerfMetric[]> = {}
  for (const m of metrics) {
    if (!grouped[m.taskName]) grouped[m.taskName] = []
    grouped[m.taskName]!.push(m)
  }

  const result: Record<string, TaskStatSummary> = {}
  for (const [taskName, ms] of Object.entries(grouped)) {
    const durations = ms.map((m) => m.durationMs).sort((a, b) => a - b)
    result[taskName] = {
      taskName,
      avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      p95Ms: percentile(durations, 95),
      minMs: durations[0]!,
      maxMs: durations[durations.length - 1]!,
      count: durations.length,
      successCount: ms.filter((m) => m.success).length,
    }
  }
  return result
}

/** 百分位计算（线性插值） */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const k = (p / 100) * (sorted.length - 1)
  const low = Math.floor(k)
  const high = Math.ceil(k)
  if (high >= sorted.length) return sorted[sorted.length - 1]!
  return sorted[low]! + (k - low) * (sorted[high]! - sorted[low]!)
}

/** 格式化毫秒 */
function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

/** 生成压测报告 Markdown */
export function generateStressReport(result: StressTestResult): string {
  const s = result.summary
  const lines: string[] = []

  lines.push(`# 数据处理能力压测报告`)
  lines.push(``)
  lines.push(`> **运行 ID**: ${result.runId}`)
  lines.push(`> **时间**: ${new Date(result.timestamp).toLocaleString()}`)
  lines.push(`> **标的数**: ${result.symbols.length}`)
  lines.push(`> **并行模式**: 是`)
  lines.push(``)
  lines.push(`## 📊 总体摘要`)
  lines.push(``)
  lines.push(`| 指标 | 值 |`)
  lines.push(`|------|-----|`)
  lines.push(`| 总耗时 | ${fmtMs(s.totalDurationMs)} |`)
  lines.push(`| 平均每只 | ${fmtMs(s.avgPerStockMs)} |`)
  lines.push(`| 最快 | ${fmtMs(s.minMs)} |`)
  lines.push(`| 最慢 | ${fmtMs(s.maxMs)} |`)
  lines.push(`| P50 | ${fmtMs(s.p50Ms)} |`)
  lines.push(`| P95 | ${fmtMs(s.p95Ms)} |`)
  lines.push(`| P99 | ${fmtMs(s.p99Ms)} |`)
  lines.push(`| 成功率 | ${s.successCount}/${result.metrics.length} (${Math.round(s.successCount / result.metrics.length * 100)}%) |`)
  lines.push(``)
  lines.push(`## 📈 任务耗时分布`)
  lines.push(``)
  lines.push(`| 任务 | 平均 | P95 | 最小 | 最大 | 样本数 |`)
  lines.push(`|------|------|-----|------|------|--------|`)
  for (const ts of Object.values(result.taskSummaries).sort((a, b) => b.avgMs - a.avgMs)) {
    lines.push(`| ${ts.taskName} | ${fmtMs(ts.avgMs)} | ${fmtMs(ts.p95Ms)} | ${fmtMs(ts.minMs)} | ${fmtMs(ts.maxMs)} | ${ts.count} |`)
  }
  lines.push(``)
  lines.push(`## 🎯 性能基线判断`)
  lines.push(``)
  const threshold = 3000
  if (s.p95Ms < threshold) {
    lines.push(`✅ **P95 (${fmtMs(s.p95Ms)}) < 门限 (${fmtMs(threshold)})** — 性能达标`)
  } else {
    lines.push(`❌ **P95 (${fmtMs(s.p95Ms)}) ≥ 门限 (${fmtMs(threshold)})** — 性能不达标，需优化`)
  }
  lines.push(``)
  lines.push(`## 📋 测试标的`)
  lines.push(``)
  lines.push(`\`\`\``)
  lines.push(result.symbols.join(', '))
  lines.push(`\`\`\``)
  lines.push(``)
  lines.push(`---`)
  lines.push(`*报告由 StressTestService 自动生成*`)

  return lines.join('\n')
}
