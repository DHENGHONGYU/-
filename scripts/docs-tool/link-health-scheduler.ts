#!/usr/bin/env node
/**
 * @module scripts/docs-tool/link-health-scheduler
 * @description 文档链接健康度调度器 — 封装 link-health-checker，提供调度、历史追踪和摘要功能
 *
 * 功能：
 * - --dry-run：仅扫描不修复
 * - --ci：CI 模式，P0 残留则 exit 1
 * - --summary [N]：输出最近 N 次执行摘要表格（默认 10）
 * - 历史记录保存到 docs/reports/audit/link-health-history.json（保留最近 100 条）
 *
 * 用法：
 *   npx tsx scripts/docs-tool/link-health-scheduler.ts [--dry-run] [--ci] [--summary [N]]
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// === 路径常量 ===
const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const HISTORY_FILE = resolve(PROJECT_ROOT, 'docs', 'reports', 'audit', 'link-health-history.json')
const CHECKER_SCRIPT = resolve(__dirname, 'link-health-checker.ts')
const HISTORY_MAX_ENTRIES = 100

// === 历史记录条目 ===
interface HistoryEntry {
  timestamp: string        // 执行时间戳
  mode: 'dry-run' | 'fix' | 'ci'  // 执行模式
  totalFiles: number       // 扫描文件数
  totalLinks: number       // 总链接数
  totalIssues: number      // 总问题数
  p0Before: number         // 执行前 P0 数
  p0After: number          // 执行后 P0 数
  fixedCount: number       // 已修复数
  p2Count: number          // P2 问题数
  exitCode: number         // 退出码
  reportPath: string       // 报告文件路径
}

// === 历史记录文件结构 ===
interface HistoryData {
  entries: HistoryEntry[]
  firstRun: string
  lastRun: string
  totalP0Fixed: number
}

// === 解析命令行参数 ===
function parseArgs(): { dryRun: boolean; ci: boolean; summary: boolean; summaryCount: number } {
  const args = process.argv.slice(2)
  const summaryIdx = args.indexOf('--summary')
  const summary = summaryIdx !== -1
  // --summary 后可选跟数字 N
  let summaryCount = 10
  if (summary && summaryIdx + 1 < args.length) {
    const n = parseInt(args[summaryIdx + 1], 10)
    if (!isNaN(n) && n > 0) {
      summaryCount = n
    }
  }
  return {
    dryRun: args.includes('--dry-run'),
    ci: args.includes('--ci'),
    summary,
    summaryCount
  }
}

// === 加载历史记录 ===
function loadHistory(): HistoryData {
  if (!existsSync(HISTORY_FILE)) {
    return {
      entries: [],
      firstRun: '',
      lastRun: '',
      totalP0Fixed: 0
    }
  }
  try {
    const content = readFileSync(HISTORY_FILE, 'utf-8')
    const data = JSON.parse(content) as HistoryData
    if (!data.entries) data.entries = []
    if (!data.firstRun) data.firstRun = ''
    if (!data.lastRun) data.lastRun = ''
    if (typeof data.totalP0Fixed !== 'number') data.totalP0Fixed = 0
    return data
  } catch {
    return {
      entries: [],
      firstRun: '',
      lastRun: '',
      totalP0Fixed: 0
    }
  }
}

// === 保存历史记录（保留最近 100 条）===
function saveHistory(data: HistoryData): void {
  // 确保目录存在
  const dir = resolve(HISTORY_FILE, '..')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  // 保留最近 HISTORY_MAX_ENTRIES 条
  if (data.entries.length > HISTORY_MAX_ENTRIES) {
    data.entries = data.entries.slice(-HISTORY_MAX_ENTRIES)
  }
  writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// === 运行检查器，返回报告和退出码 ===
function runChecker(mode: 'dry-run' | 'fix' | 'ci'): { report: any; exitCode: number } {
  // 根据模式构建命令参数
  const flags: string[] = ['--json']
  if (mode === 'fix') {
    flags.push('--fix')
  } else if (mode === 'ci') {
    flags.push('--ci')
  }
  // dry-run 模式不加额外标志（仅 --json）

  const cmd = `npx tsx "${CHECKER_SCRIPT}" ${flags.join(' ')}`

  let exitCode = 0
  let output = ''
  try {
    output = execSync(cmd, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 180000 // 3 分钟超时
    })
  } catch (error: any) {
    exitCode = error.status || 1
    output = error.stdout || ''
  }

  // 解析 JSON 输出
  let report: any = null
  try {
    report = JSON.parse(output)
  } catch {
    // JSON 解析失败，report 保持 null
  }

  return { report, exitCode }
}

// === 从报告生成历史条目 ===
function createHistoryEntry(report: any, mode: 'dry-run' | 'fix' | 'ci', exitCode: number): HistoryEntry {
  const byType = report?.byType || {}
  const byStatus = report?.byStatus || {}

  const p0Before = byType['file-absolute'] || 0
  const fixedCount = report?.fixedCount || 0
  const p0After = mode === 'fix' ? Math.max(0, p0Before - fixedCount) : p0Before

  // P2 问题数 = 总问题数 - P0 问题数
  const totalIssues = report?.totalIssues || 0
  const p2Count = Math.max(0, totalIssues - p0Before)

  // 报告路径
  const timestamp = report?.timestamp || new Date().toISOString()
  const filename = timestamp.replace(/:/g, '-')
  const reportPath = join(resolve(PROJECT_ROOT, 'docs', 'reports', 'audit'), `link-health-${filename}.json`)

  return {
    timestamp,
    mode,
    totalFiles: report?.totalFiles || 0,
    totalLinks: report?.totalLinks || 0,
    totalIssues,
    p0Before,
    p0After,
    fixedCount,
    p2Count,
    exitCode,
    reportPath
  }
}

// === 输出摘要表格 ===
function printSummary(data: HistoryData, count: number): void {
  const entries = data.entries.slice(-count).reverse()
  if (entries.length === 0) {
    console.log('\n📭 暂无历史记录')
    return
  }

  console.log(`\n📊 文档链接健康度执行摘要（最近 ${entries.length} 次）`)
  console.log('═'.repeat(120))
  // 表头
  const header = formatRow(
    ['时间', '模式', '文件数', '链接数', '问题数', 'P0前', 'P0后', '修复数', '退出码'],
    [24, 8, 8, 8, 8, 6, 6, 8, 8]
  )
  console.log(header)
  console.log('─'.repeat(120))

  for (const entry of entries) {
    const row = formatRow(
      [
        entry.timestamp,
        entry.mode,
        String(entry.totalFiles),
        String(entry.totalLinks),
        String(entry.totalIssues),
        String(entry.p0Before),
        String(entry.p0After),
        String(entry.fixedCount),
        String(entry.exitCode)
      ],
      [24, 8, 8, 8, 8, 6, 6, 8, 8]
    )
    console.log(row)
  }
  console.log('═'.repeat(120))
  console.log(`首次运行: ${data.firstRun || 'N/A'}`)
  console.log(`最近运行: ${data.lastRun || 'N/A'}`)
  console.log(`累计修复 P0: ${data.totalP0Fixed}`)
}

// === 格式化表格行 ===
function formatRow(values: string[], widths: number[]): string {
  const parts = values.map((val, i) => {
    const width = widths[i] || 10
    // 中文字符占两个位置，需要补齐
    const displayLen = getDisplayLength(val)
    const padding = Math.max(0, width - displayLen)
    return val + ' '.repeat(padding)
  })
  return ' ' + parts.join('  ')
}

// === 计算字符串显示长度（中文字符占 2 位）===
function getDisplayLength(str: string): number {
  let len = 0
  for (const ch of str) {
    // 中文字符范围（简单判断）
    if (ch.charCodeAt(0) > 127) {
      len += 2
    } else {
      len += 1
    }
  }
  return len
}

// === 主函数 ===
function main(): void {
  const args = parseArgs()

  // --summary 模式：输出摘要表格后退出
  if (args.summary) {
    const data = loadHistory()
    printSummary(data, args.summaryCount)
    return
  }

  // 确定执行模式
  let mode: 'dry-run' | 'fix' | 'ci'
  if (args.ci) {
    mode = 'ci'
  } else if (args.dryRun) {
    mode = 'dry-run'
  } else {
    // 默认模式：先修复再验证
    mode = 'fix'
  }

  console.log(`\n🚀 文档链接健康度调度器启动（模式: ${mode}）`)
  console.log('─'.repeat(60))

  // 运行检查器
  const { report, exitCode } = runChecker(mode)

  if (!report) {
    console.error('❌ 检查器输出解析失败，无法生成历史记录')
    process.exit(1)
  }

  // 创建历史条目
  const entry = createHistoryEntry(report, mode, exitCode)

  // 加载并更新历史记录
  const history = loadHistory()
  history.entries.push(entry)
  if (!history.firstRun) {
    history.firstRun = entry.timestamp
  }
  history.lastRun = entry.timestamp
  history.totalP0Fixed += entry.fixedCount
  saveHistory(history)

  // 输出执行结果
  console.log('─'.repeat(60))
  console.log(`✅ 执行完成`)
  console.log(`  扫描文件数: ${entry.totalFiles}`)
  console.log(`  总链接数:   ${entry.totalLinks}`)
  console.log(`  总问题数:   ${entry.totalIssues}`)
  console.log(`  P0 前:      ${entry.p0Before}`)
  console.log(`  P0 后:      ${entry.p0After}`)
  console.log(`  已修复数:   ${entry.fixedCount}`)
  console.log(`  P2 问题数:  ${entry.p2Count}`)
  console.log(`  退出码:     ${entry.exitCode}`)
  console.log(`  报告路径:   ${entry.reportPath}`)
  console.log(`  历史记录:   ${HISTORY_FILE}`)

  // CI 模式：P0 残留则退出 1
  if (args.ci && entry.p0After > 0) {
    console.error(`\n❌ CI 检查失败: P0 残留 ${entry.p0After} 个`)
    process.exit(1)
  }

  if (!args.ci) {
    console.log(`\n✅ 所有检查通过`)
  }
}

main()
