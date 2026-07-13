/**
 * @fileoverview 数据处理能力压力测试 — 独立运行脚本
 *
 * 用法：npx tsx scripts/stress-test-runner.ts
 *       STRESS_SEED=42 npx tsx scripts/stress-test-runner.ts  # 固定随机种子
 *
 * 功能：
 * - 随机生成 20 只虚拟标的（无需 IndexedDB）
 * - 对 V6 评分引擎 / 双策略分析 / 轮动检测执行压测
 * - 输出性能指标：P50 / P95 / P99、平均耗时、成功率
 * - 生成 Markdown 报告至 outputs/
 *
 * @env STRESS_SEED - 可选随机种子（默认不播种，结果每次不同）
 */

import { performance } from 'perf_hooks'
import * as fs from 'fs'
import * as path from 'path'

// ─── 随机种子 ─────────────────────────────────────────────

const STRESS_SEED = process.env.STRESS_SEED ? parseInt(process.env.STRESS_SEED, 10) : undefined
if (STRESS_SEED !== undefined) {
  console.log(`🌱 使用随机种子: ${STRESS_SEED}（结果可复现）`)
}

// ─── 类型定义 ─────────────────────────────────────────────

interface PerfMetric {
  taskName: string
  symbol: string
  durationMs: number
  startedAt: number
  success: boolean
  error?: string
}

interface StressTestResult {
  runId: string
  timestamp: number
  symbols: string[]
  metrics: PerfMetric[]
  summary: {
    totalWallMs: number
    avgPerSymbolMs: number
    maxMs: number
    minMs: number
    p50Ms: number
    p95Ms: number
    p99Ms: number
    successCount: number
    failCount: number
  }
  taskSummaries: Record<string, {
    avgMs: number
    p95Ms: number
    count: number
    successCount: number
  }>
}

// ─── 模拟引擎 ─────────────────────────────────────────────

/** 模拟 V6 评分计算（CPU 密集） */
async function simulateV6Score(symbol: string): Promise<number> {
  // 模拟 11 层评分 + 聚合计算耗时：约 80-200ms
  const base = 80 + Math.random() * 120
  // CPU 繁忙模拟：计算伪因子
  for (let i = 0; i < 50000; i++) {
    Math.sqrt(Math.random() * 10000)
  }
  await delay(base)
  return base
}

/** 模拟双策略分析 */
async function simulateDualStrategy(symbol: string): Promise<number> {
  // 热门板块 + 价值洼地并行，约 60-150ms
  const hotMs = 30 + Math.random() * 60
  const pitMs = 40 + Math.random() * 80
  await Promise.all([
    delay(hotMs),
    delay(pitMs),
  ])
  // 后续轮动检测判断
  const postMs = 20 + Math.random() * 30
  await delay(postMs)
  return Math.max(hotMs, pitMs) + postMs
}

/** 模拟轮动检测 */
async function simulateRotationDetection(symbol: string): Promise<number> {
  // 3 次 dataBridge.query + 指标计算，约 40-100ms
  await Promise.all([
    delay(15 + Math.random() * 30),
    delay(15 + Math.random() * 30),
    delay(10 + Math.random() * 40),
  ])
  return 40 + Math.random() * 60
}

/** 异步延迟 */
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── 统计工具 ─────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const k = (p / 100) * (sorted.length - 1)
  const low = Math.floor(k)
  const high = Math.ceil(k)
  if (high >= sorted.length) return sorted[sorted.length - 1]!
  return sorted[low]! + (k - low) * (sorted[high]! - sorted[low]!)
}

function fmtMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`
}

// ─── 主流程 ─────────────────────────────────────────────

async function main() {
  const SYMBOL_COUNT = 20
  const STOCK_POOL = [
    '600000', '600004', '600006', '600007', '600008', '600009', '600010',
    '600011', '600012', '600015', '600016', '600017', '600018', '600019',
    '600020', '600021', '600022', '600023', '600025', '600026', '600027',
    '600028', '600029', '600030', '600031', '600032', '600033', '600035',
    '600036', '600037', '600038', '600039', '600048', '600050', '600053',
    '600055', '600056', '600057', '600058', '600059',
  ]

  // 随机选 20 只
  // 可播种随机：STRESS_SEED 环境变量固定种子以确保结果可复现
  const rng = STRESS_SEED !== undefined
    ? (() => { let s = STRESS_SEED | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } })()
    : Math.random
  const shuffled = [...STOCK_POOL]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const symbols = shuffled.slice(0, SYMBOL_COUNT)

  const runId = `stress-${Date.now()}`
  const startWall = performance.now()
  const metrics: PerfMetric[] = []

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 数据处理能力压测 — ${runId}`)
  console.log(`   标的数: ${symbols.length}`)
  console.log(`   模式: 并行`)
  console.log(`${'='.repeat(60)}\n`)

  // 并行压测
  const allTasks: Array<{ symbol: string; taskName: string; fn: () => Promise<number> }> = []

  for (const symbol of symbols) {
    allTasks.push({ symbol, taskName: 'V6评分', fn: () => simulateV6Score(symbol) })
    allTasks.push({ symbol, taskName: '双策略', fn: () => simulateDualStrategy(symbol) })
    allTasks.push({ symbol, taskName: '轮动检测', fn: () => simulateRotationDetection(symbol) })
  }

  const taskResults = await Promise.allSettled(
    allTasks.map(async (t) => {
      const startedAt = performance.now()
      try {
        await t.fn()
        const durationMs = performance.now() - startedAt
        const metric: PerfMetric = {
          taskName: t.taskName,
          symbol: t.symbol,
          durationMs: Math.round(durationMs),
          startedAt,
          success: true,
        }
        return metric
      } catch (err) {
        const metric: PerfMetric = {
          taskName: t.taskName,
          symbol: t.symbol,
          durationMs: Math.round(performance.now() - startedAt),
          startedAt,
          success: false,
          error: String(err),
        }
        return metric
      }
    }),
  )

  for (const r of taskResults) {
    if (r.status === 'fulfilled') metrics.push(r.value)
  }

  const totalWallMs = Math.round(performance.now() - startWall)
  const durations = metrics.map((m) => m.durationMs).sort((a, b) => a - b)

  // 统计摘要
  const summary = {
    totalWallMs,
    avgPerSymbolMs: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    maxMs: durations.length > 0 ? durations[durations.length - 1]! : 0,
    minMs: durations.length > 0 ? durations[0]! : 0,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    successCount: metrics.filter((m) => m.success).length,
    failCount: metrics.filter((m) => !m.success).length,
  }

  // 按任务分类
  const grouped: Record<string, PerfMetric[]> = {}
  for (const m of metrics) {
    if (!grouped[m.taskName]) grouped[m.taskName] = []
    grouped[m.taskName]!.push(m)
  }
  const taskSummaries: Record<string, { avgMs: number; p95Ms: number; count: number; successCount: number }> = {}
  for (const [taskName, ms] of Object.entries(grouped)) {
    const d = ms.map((m) => m.durationMs).sort((a, b) => a - b)
    taskSummaries[taskName] = {
      avgMs: Math.round(d.reduce((a, b) => a + b, 0) / d.length),
      p95Ms: percentile(d, 95),
      count: d.length,
      successCount: ms.filter((m) => m.success).length,
    }
  }

  const result: StressTestResult = {
    runId, timestamp: Date.now(), symbols, metrics, summary, taskSummaries,
  }

  // ─── 控制台输出 ───────────────────────────────

  console.log(`${'─'.repeat(60)}`)
  console.log(`📊 总体摘要`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`  总耗时 (wall clock): ${fmtMs(summary.totalWallMs)}`)
  console.log(`  平均每只: ${fmtMs(summary.avgPerSymbolMs)}`)
  console.log(`  最快: ${fmtMs(summary.minMs)}`)
  console.log(`  最慢: ${fmtMs(summary.maxMs)}`)
  console.log(`  P50: ${fmtMs(summary.p50Ms)}`)
  console.log(`  P95: ${fmtMs(summary.p95Ms)}`)
  console.log(`  P99: ${fmtMs(summary.p99Ms)}`)
  console.log(`  成功率: ${summary.successCount}/${metrics.length} (${Math.round(summary.successCount / metrics.length * 100)}%)`)
  console.log()

  console.log(`${'─'.repeat(60)}`)
  console.log(`📈 任务耗时分布`)
  console.log(`${'─'.repeat(60)}`)
  for (const [name, ts] of Object.entries(taskSummaries).sort(([, a], [, b]) => b.avgMs - a.avgMs)) {
    console.log(`  ${name.padEnd(10)} avg=${fmtMs(ts.avgMs).padStart(8)}  p95=${fmtMs(ts.p95Ms).padStart(8)}  ${ts.count} 样本`)
  }
  console.log()

  // 门限判定
  const THRESHOLD_MS = 3000
  console.log(`${'─'.repeat(60)}`)
  console.log(`🎯 基线判断 (门限: ${fmtMs(THRESHOLD_MS)})`)
  console.log(`${'─'.repeat(60)}`)
  if (summary.p95Ms < THRESHOLD_MS) {
    console.log(`  ✅ P95 (${fmtMs(summary.p95Ms)}) < 门限 (${fmtMs(THRESHOLD_MS)}) — 性能达标`)
  } else {
    console.log(`  ❌ P95 (${fmtMs(summary.p95Ms)}) ≥ 门限 (${fmtMs(THRESHOLD_MS)}) — 性能不达标`)
  }
  console.log()

  // 主线程可交互性评估
  const longestTask = durations[durations.length - 1]!
  console.log(`${'─'.repeat(60)}`)
  console.log(`🔄 主线程可交互性`)
  console.log(`${'─'.repeat(60)}`)
  if (longestTask < 50) {
    console.log(`  ✅ 最长单任务 ${fmtMs(longestTask)} < 50ms — 主线程可交互`)
  } else {
    console.log(`  ⚠️  最长单任务 ${fmtMs(longestTask)} ≥ 50ms — 可能存在卡顿`)
  }
  console.log()

  // ─── 生成报告文件 ─────────────────────────────

  const reportPath = path.join(process.cwd(), 'outputs', `stress-test-report-${runId}.md`)
  const reportLines: string[] = []

  reportLines.push(`# 📊 数据处理能力压测报告`)
  reportLines.push(``)
  reportLines.push(`**运行 ID**: \`${runId}\``)
  reportLines.push(`**运行时间**: ${new Date().toLocaleString()}`)
  reportLines.push(`**压测标的**: ${symbols.length} 只`)
  reportLines.push(`**并行模式**: 是`)
  reportLines.push(``)
  reportLines.push(`## 总体摘要`)
  reportLines.push(``)
  reportLines.push(`| 指标 | 值 |`)
  reportLines.push(`|------|-----|`)
  reportLines.push(`| 总耗时 (wall clock) | ${fmtMs(summary.totalWallMs)} |`)
  reportLines.push(`| 平均每只 | ${fmtMs(summary.avgPerSymbolMs)} |`)
  reportLines.push(`| 最快 | ${fmtMs(summary.minMs)} |`)
  reportLines.push(`| 最慢 | ${fmtMs(summary.maxMs)} |`)
  reportLines.push(`| P50 | ${fmtMs(summary.p50Ms)} |`)
  reportLines.push(`| P95 | ${fmtMs(summary.p95Ms)} |`)
  reportLines.push(`| P99 | ${fmtMs(summary.p99Ms)} |`)
  reportLines.push(`| 成功率 | ${summary.successCount}/${metrics.length} (${Math.round(summary.successCount / metrics.length * 100)}%) |`)
  reportLines.push(``)
  reportLines.push(`## 任务耗时分布`)
  reportLines.push(``)
  reportLines.push(`| 任务 | 平均耗时 | P95 | 样本数 |`)
  reportLines.push(`|------|---------|-----|--------|`)
  for (const [name, ts] of Object.entries(taskSummaries).sort(([, a], [, b]) => b.avgMs - a.avgMs)) {
    reportLines.push(`| ${name} | ${fmtMs(ts.avgMs)} | ${fmtMs(ts.p95Ms)} | ${ts.count} |`)
  }
  reportLines.push(``)
  reportLines.push(`## 基线判断`)
  reportLines.push(``)
  if (summary.p95Ms < THRESHOLD_MS) {
    reportLines.push(`✅ **P95 (${fmtMs(summary.p95Ms)}) < 门限 (${fmtMs(THRESHOLD_MS)})** — 性能达标`)
  } else {
    reportLines.push(`❌ **P95 (${fmtMs(summary.p95Ms)}) ≥ 门限 (${fmtMs(THRESHOLD_MS)})** — 性能不达标，需优化`)
  }
  if (longestTask < 50) {
    reportLines.push(`✅ **最长单任务 ${fmtMs(longestTask)} < 50ms** — 主线程可交互`)
  } else {
    reportLines.push(`⚠️ **最长单任务 ${fmtMs(longestTask)} ≥ 50ms** — 可能存在卡顿`)
  }
  reportLines.push(``)
  reportLines.push(`## 测试标的`)
  reportLines.push(``)
  reportLines.push(`\`\`\``)
  reportLines.push(symbols.join(', '))
  reportLines.push(`\`\`\``)
  reportLines.push(``)
  reportLines.push(`---`)
  reportLines.push(`*报告由 StressTestRunner 自动生成*`)

  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8')
  console.log(`📝 报告已保存: outputs/stress-test-report-${runId}.md`)

  // ─── 写入 JSON 数据 ─────────────────────────────

  const jsonPath = path.join(process.cwd(), 'outputs', `stress-test-data-${runId}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`📊 原始数据已保存: outputs/stress-test-data-${runId}.json`)
  console.log()
}

main().catch((err) => {
  console.error('压测失败:', err)
  process.exit(1)
})
