#!/usr/bin/env node
/**
 * @module scripts/changelog-query
 * @description 更新日志查询 CLI — 支持按日期、任务类型、参与者快速检索 changelogs
 *
 * 用法：
 *   npx tsx scripts/changelog-query.ts [选项]
 *
 * 选项：
 *   --date=<YYYY-MM-DD>          按日期过滤（精确匹配，支持前缀如 --date=2026-07）
 *   --since=<YYYY-MM-DD>         按起始日期过滤（包含该日期）
 *   --until=<YYYY-MM-DD>         按结束日期过滤（包含该日期）
 *   --type=<task_type>           按任务类型过滤（精确匹配）
 *   --participant=<name>         按参与者过滤（模糊匹配，不区分大小写）
 *   --status=<status>            按状态过滤（completed / in_progress / failed）
 *   --keyword=<keyword>          按标题/内容关键词搜索（模糊匹配，不区分大小写）
 *   --all                        列出所有日志条目
 *   --detail=<task_id>           显示指定任务的完整详情
 *   --summary                    输出统计摘要（按类型/状态/月份分组）
 *   --json                       以 JSON 格式输出（便于管道处理）
 *   --help                       显示帮助信息
 *
 * 示例：
 *   npx tsx scripts/changelog-query.ts --date=2026-07-04
 *   npx tsx scripts/changelog-query.ts --since=2026-07-01 --until=2026-07-31
 *   npx tsx scripts/changelog-query.ts --type=code_refactor --status=completed
 *   npx tsx scripts/changelog-query.ts --participant=架构师
 *   npx tsx scripts/changelog-query.ts --keyword=评分
 *   npx tsx scripts/changelog-query.ts --detail=TASK-2026-07-04-001
 *   npx tsx scripts/changelog-query.ts --summary
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

// ─── 常量 ────────────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const CHANGELOGS_DIR = join(ROOT, 'docs', 'changelogs')
const INDEX_FILE = join(CHANGELOGS_DIR, 'index.json')

// ANSI 颜色码
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
} as const

// 状态徽章
const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  completed: { label: '✓ 完成', color: C.green },
  in_progress: { label: '◐ 进行中', color: C.yellow },
  failed: { label: '✗ 失败', color: C.red },
}

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

interface HumanInteraction {
  time: string
  type: string
  participant: string
  content: string
  decision?: string
  rationale?: string
}

interface FileChange {
  path: string
  description: string
  lines?: number
  lines_added?: number
  lines_removed?: number
}

interface Decision {
  time: string
  type: string
  context: string
  options_evaluated: string[]
  final_decision: string
  rationale: string
}

interface ChangelogEntry {
  timestamp: string
  task_id: string
  task_type: string
  task_status: string
  progress: number
  title: string
  human_interactions: HumanInteraction[]
  changes: {
    files_added: FileChange[]
    files_modified: FileChange[]
    files_deleted: FileChange[]
    docs_updated: FileChange[]
  }
  quality_metrics: Record<string, string | number>
  decisions: Decision[]
  deliverables?: Array<{ name: string; path: string; description: string }>
  next_steps?: string[]
}

interface IndexEntry {
  date: string
  task_id: string
  task_type: string
  title: string
  file: string
  status: string
}

interface ChangelogIndex {
  version: string
  description: string
  entries: IndexEntry[]
}

// ─── 参数解析 ─────────────────────────────────────────────────────────────────

interface CliArgs {
  date?: string
  since?: string
  until?: string
  type?: string
  participant?: string
  status?: string
  keyword?: string
  all: boolean
  detail?: string
  summary: boolean
  json: boolean
  export?: 'markdown'
  output?: string
  help: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { all: false, summary: false, json: false, help: false }

  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      args.help = true
    } else if (arg === '--all') {
      args.all = true
    } else if (arg === '--summary') {
      args.summary = true
    } else if (arg === '--json') {
      args.json = true
    } else if (arg.startsWith('--date=')) {
      args.date = arg.slice('--date='.length)
    } else if (arg.startsWith('--since=')) {
      args.since = arg.slice('--since='.length)
    } else if (arg.startsWith('--until=')) {
      args.until = arg.slice('--until='.length)
    } else if (arg.startsWith('--type=')) {
      args.type = arg.slice('--type='.length)
    } else if (arg.startsWith('--participant=')) {
      args.participant = arg.slice('--participant='.length)
    } else if (arg.startsWith('--status=')) {
      args.status = arg.slice('--status='.length)
    } else if (arg.startsWith('--keyword=')) {
      args.keyword = arg.slice('--keyword='.length)
    } else if (arg.startsWith('--detail=')) {
      args.detail = arg.slice('--detail='.length)
    } else if (arg.startsWith('--export=')) {
      const format = arg.slice('--export='.length)
      if (format !== 'markdown') {
        console.error(`${C.red}不支持的导出格式: ${format}（目前仅支持 markdown）${C.reset}`)
        process.exit(1)
      }
      args.export = format as 'markdown'
    } else if (arg.startsWith('--output=')) {
      args.output = arg.slice('--output='.length)
    } else {
      console.error(`${C.red}未知参数: ${arg}${C.reset}`)
      console.error('使用 --help 查看帮助')
      process.exit(1)
    }
  }

  return args
}

// ─── 数据加载 ─────────────────────────────────────────────────────────────────

/** 递归收集目录下所有 .json 文件（排除 index.json） */
function collectJsonFiles(dir: string): string[] {
  const results: string[] = []
  if (!statSync(dir, { throwIfNoExists: false })?.isDirectory()) return results

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...collectJsonFiles(fullPath))
    } else if (entry.endsWith('.json') && entry !== 'index.json') {
      results.push(fullPath)
    }
  }
  return results
}

/** 加载所有日志条目 */
function loadAllEntries(): ChangelogEntry[] {
  const files = collectJsonFiles(CHANGELOGS_DIR)
  const entries: ChangelogEntry[] = []

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8')
      const entry = JSON.parse(content) as ChangelogEntry
      entries.push(entry)
    } catch (err) {
      const relPath = relative(ROOT, file)
      console.error(`${C.yellow}警告: 无法解析 ${relPath} — ${err instanceof Error ? err.message : String(err)}${C.reset}`)
    }
  }

  // 按时间戳降序排列
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return entries
}

// ─── 过滤逻辑 ─────────────────────────────────────────────────────────────────

function filterEntries(entries: ChangelogEntry[], args: CliArgs): ChangelogEntry[] {
  let result = entries

  if (args.date) {
    result = result.filter((e) => {
      // 支持前缀匹配（如 --date=2026-07 匹配整个月）
      const entryDate = e.timestamp.slice(0, 10)
      return entryDate === args.date || entryDate.startsWith(args.date)
    })
  }

  if (args.since) {
    result = result.filter((e) => {
      const entryDate = e.timestamp.slice(0, 10)
      return entryDate >= args.since!
    })
  }

  if (args.until) {
    result = result.filter((e) => {
      const entryDate = e.timestamp.slice(0, 10)
      return entryDate <= args.until!
    })
  }

  if (args.type) {
    result = result.filter((e) => e.task_type === args.type)
  }

  if (args.status) {
    result = result.filter((e) => e.task_status === args.status)
  }

  if (args.participant) {
    const pLower = args.participant.toLowerCase()
    result = result.filter((e) =>
      e.human_interactions.some(
        (h) =>
          h.participant.toLowerCase().includes(pLower) ||
          h.content.toLowerCase().includes(pLower),
      ),
    )
  }

  if (args.keyword) {
    const kwLower = args.keyword.toLowerCase()
    result = result.filter((e) => {
      // 搜索标题
      if (e.title.toLowerCase().includes(kwLower)) return true
      // 搜索文件变更描述
      const allChanges = [
        ...e.changes.files_added,
        ...e.changes.files_modified,
        ...e.changes.files_deleted,
        ...e.changes.docs_updated,
      ]
      if (allChanges.some((c) => c.description.toLowerCase().includes(kwLower))) return true
      // 搜索决策上下文
      if (e.decisions.some((d) => d.context.toLowerCase().includes(kwLower))) return true
      // 搜索交付物
      if (e.deliverables?.some((d) => d.name.toLowerCase().includes(kwLower) || d.description.toLowerCase().includes(kwLower))) return true
      return false
    })
  }

  return result
}

// ─── 输出格式化 ───────────────────────────────────────────────────────────────

function formatDate(ts: string): string {
  return ts.slice(0, 10)
}

function formatTime(ts: string): string {
  return ts.slice(11, 19)
}

function formatStatus(status: string): string {
  const badge = STATUS_BADGE[status] ?? { label: status, color: C.dim }
  return `${badge.color}${badge.label}${C.reset}`
}

function printTable(entries: ChangelogEntry[]): void {
  if (entries.length === 0) {
    console.log(`${C.dim}未找到匹配的日志条目${C.reset}`)
    return
  }

  // 表头
  console.log('')
  console.log(
    `${C.bold}${'日期'.padEnd(12)} ${'任务ID'.padEnd(26)} ${'类型'.padEnd(18)} ${'状态'.padEnd(12)} ${'标题'}${C.reset}`,
  )
  console.log(`${C.dim}${'─'.repeat(100)}${C.reset}`)

  for (const entry of entries) {
    const date = formatDate(entry.timestamp)
    const taskId = entry.task_id.padEnd(26)
    const taskType = entry.task_type.padEnd(18)
    const status = formatStatus(entry.task_status)
    const statusPadding = status.length - entry.task_status.length
    const title = entry.title

    console.log(
      `${C.cyan}${date}${C.reset}  ${taskId} ${taskType} ${status}${' '.repeat(Math.max(0, 12 - statusPadding))} ${title}`,
    )
  }

  console.log('')
  console.log(`${C.dim}共 ${entries.length} 条记录${C.reset}`)
}

function printDetail(entry: ChangelogEntry): void {
  console.log('')
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.cyan}║  任务详情: ${entry.task_id}${C.reset}`)
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')

  // 基本信息
  console.log(`${C.bold}基本信息${C.reset}`)
  console.log(`  标题:     ${entry.title}`)
  console.log(`  任务ID:   ${entry.task_id}`)
  console.log(`  类型:     ${entry.task_type}`)
  console.log(`  状态:     ${formatStatus(entry.task_status)}`)
  console.log(`  进度:     ${entry.progress}%`)
  console.log(`  时间:     ${formatDate(entry.timestamp)} ${formatTime(entry.timestamp)}`)
  console.log('')

  // 人机交互
  if (entry.human_interactions.length > 0) {
    console.log(`${C.bold}人机交互 (${entry.human_interactions.length})${C.reset}`)
    for (const h of entry.human_interactions) {
      console.log(`  ${C.dim}[${formatTime(h.time)}]${C.reset} ${C.bold}${h.participant}${C.reset} (${h.type})`)
      console.log(`    内容: ${h.content}`)
      if (h.decision) console.log(`    决策: ${C.green}${h.decision}${C.reset}`)
      if (h.rationale) console.log(`    依据: ${C.dim}${h.rationale}${C.reset}`)
    }
    console.log('')
  }

  // 文件变更
  const { files_added, files_modified, files_deleted, docs_updated } = entry.changes
  const totalChanges = files_added.length + files_modified.length + files_deleted.length + docs_updated.length

  if (totalChanges > 0) {
    console.log(`${C.bold}文件变更 (${totalChanges})${C.reset}`)

    if (files_added.length > 0) {
      console.log(`  ${C.green}新增 (${files_added.length}):${C.reset}`)
      for (const f of files_added) {
        const lines = f.lines != null ? ` (${f.lines}行)` : ''
        console.log(`    ${C.green}+${C.reset} ${f.path}${lines}`)
        if (f.description) console.log(`      ${C.dim}${f.description}${C.reset}`)
      }
    }

    if (files_modified.length > 0) {
      console.log(`  ${C.yellow}修改 (${files_modified.length}):${C.reset}`)
      for (const f of files_modified) {
        const diff =
          f.lines_added != null && f.lines_removed != null
            ? ` (+${f.lines_added}/-${f.lines_removed})`
            : f.lines != null
              ? ` (${f.lines}行)`
              : ''
        console.log(`    ${C.yellow}~${C.reset} ${f.path}${diff}`)
        if (f.description) console.log(`      ${C.dim}${f.description}${C.reset}`)
      }
    }

    if (files_deleted.length > 0) {
      console.log(`  ${C.red}删除 (${files_deleted.length}):${C.reset}`)
      for (const f of files_deleted) {
        console.log(`    ${C.red}-${C.reset} ${f.path}`)
        if (f.description) console.log(`      ${C.dim}${f.description}${C.reset}`)
      }
    }

    if (docs_updated.length > 0) {
      console.log(`  ${C.blue}文档更新 (${docs_updated.length}):${C.reset}`)
      for (const f of docs_updated) {
        const ver = 'version' in f ? ` [${(f as FileChange & { version: string }).version}]` : ''
        console.log(`    ${C.blue}D${C.reset} ${f.path}${ver}`)
        if (f.description) console.log(`      ${C.dim}${f.description}${C.reset}`)
      }
    }
    console.log('')
  }

  // 决策记录
  if (entry.decisions.length > 0) {
    console.log(`${C.bold}决策记录 (${entry.decisions.length})${C.reset}`)
    for (const d of entry.decisions) {
      console.log(`  ${C.dim}[${formatTime(d.time)}]${C.reset} ${C.bold}${d.context}${C.reset}`)
      console.log(`    候选方案:`)
      for (const opt of d.options_evaluated) {
        console.log(`      ${C.dim}• ${opt}${C.reset}`)
      }
      console.log(`    最终决策: ${C.green}${d.final_decision}${C.reset}`)
      console.log(`    决策依据: ${C.dim}${d.rationale}${C.reset}`)
    }
    console.log('')
  }

  // 交付物
  if (entry.deliverables && entry.deliverables.length > 0) {
    console.log(`${C.bold}交付物 (${entry.deliverables.length})${C.reset}`)
    for (const d of entry.deliverables) {
      console.log(`  ${C.green}◆${C.reset} ${d.name}`)
      console.log(`    路径: ${d.path}`)
      console.log(`    ${C.dim}${d.description}${C.reset}`)
    }
    console.log('')
  }

  // 质量指标
  const metrics = entry.quality_metrics
  const metricEntries = Object.entries(metrics).filter(([, v]) => v !== 'N/A' && v !== 'skipped')
  if (metricEntries.length > 0) {
    console.log(`${C.bold}质量指标${C.reset}`)
    for (const [key, value] of metricEntries) {
      const pass = String(value).includes('passed') || String(value) === '0 violations'
      const color = pass ? C.green : C.yellow
      console.log(`  ${key}: ${color}${value}${C.reset}`)
    }
    console.log('')
  }

  // 后续步骤
  if (entry.next_steps && entry.next_steps.length > 0) {
    console.log(`${C.bold}后续步骤${C.reset}`)
    for (const step of entry.next_steps) {
      console.log(`  ${C.cyan}→${C.reset} ${step}`)
    }
    console.log('')
  }
}

function printSummary(entries: ChangelogEntry[]): void {
  console.log('')
  console.log(`${C.bold}${C.cyan}═══ 日志统计摘要 ═══${C.reset}`)
  console.log('')

  // 总计
  console.log(`${C.bold}总计: ${entries.length} 条记录${C.reset}`)
  console.log('')

  // 按状态分组
  const byStatus = new Map<string, number>()
  for (const e of entries) {
    byStatus.set(e.task_status, (byStatus.get(e.task_status) ?? 0) + 1)
  }
  console.log(`${C.bold}按状态:${C.reset}`)
  for (const [status, count] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.min(count, 30))
    console.log(`  ${formatStatus(status).padEnd(20)} ${String(count).padStart(4)} ${C.dim}${bar}${C.reset}`)
  }
  console.log('')

  // 按类型分组
  const byType = new Map<string, number>()
  for (const e of entries) {
    byType.set(e.task_type, (byType.get(e.task_type) ?? 0) + 1)
  }
  console.log(`${C.bold}按类型:${C.reset}`)
  for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.min(count, 30))
    console.log(`  ${type.padEnd(24)} ${String(count).padStart(4)} ${C.dim}${bar}${C.reset}`)
  }
  console.log('')

  // 按月份分组
  const byMonth = new Map<string, number>()
  for (const e of entries) {
    const month = e.timestamp.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1)
  }
  console.log(`${C.bold}按月份:${C.reset}`)
  for (const [month, count] of [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    const bar = '█'.repeat(Math.min(count, 30))
    console.log(`  ${month.padEnd(24)} ${String(count).padStart(4)} ${C.dim}${bar}${C.reset}`)
  }
  console.log('')

  // 参与者统计
  const byParticipant = new Map<string, number>()
  for (const e of entries) {
    for (const h of e.human_interactions) {
      byParticipant.set(h.participant, (byParticipant.get(h.participant) ?? 0) + 1)
    }
  }
  if (byParticipant.size > 0) {
    console.log(`${C.bold}按参与者:${C.reset}`)
    for (const [name, count] of [...byParticipant.entries()].sort((a, b) => b[1] - a[1])) {
      const bar = '█'.repeat(Math.min(count, 30))
      console.log(`  ${name.padEnd(24)} ${String(count).padStart(4)} ${C.dim}${bar}${C.reset}`)
    }
    console.log('')
  }

  // 文件变更统计
  let totalAdded = 0
  let totalModified = 0
  let totalDeleted = 0
  let totalDocs = 0
  for (const e of entries) {
    totalAdded += e.changes.files_added.length
    totalModified += e.changes.files_modified.length
    totalDeleted += e.changes.files_deleted.length
    totalDocs += e.changes.docs_updated.length
  }
  console.log(`${C.bold}文件变更统计:${C.reset}`)
  console.log(`  ${C.green}+ 新增:  ${totalAdded}${C.reset}`)
  console.log(`  ${C.yellow}~ 修改:  ${totalModified}${C.reset}`)
  console.log(`  ${C.red}- 删除:  ${totalDeleted}${C.reset}`)
  console.log(`  ${C.blue}D 文档:  ${totalDocs}${C.reset}`)
  console.log('')
}

function printHelp(): void {
  console.log(`
${C.bold}changelog-query${C.reset} — V9 更新日志查询工具

${C.bold}用法:${C.reset}
  npx tsx scripts/changelog-query.ts [选项]

${C.bold}选项:${C.reset}
  ${C.cyan}--date=<YYYY-MM-DD>${C.reset}          按日期过滤（支持前缀如 --date=2026-07）
  ${C.cyan}--since=<YYYY-MM-DD>${C.reset}         按起始日期过滤（包含该日期）
  ${C.cyan}--until=<YYYY-MM-DD>${C.reset}         按结束日期过滤（包含该日期）
  ${C.cyan}--type=<task_type>${C.reset}           按任务类型过滤
  ${C.cyan}--participant=<name>${C.reset}         按参与者过滤（模糊匹配）
  ${C.cyan}--status=<status>${C.reset}            按状态过滤（completed / in_progress / failed）
  ${C.cyan}--keyword=<keyword>${C.reset}          按关键词搜索标题/描述/决策
  ${C.cyan}--all${C.reset}                        列出所有日志条目
  ${C.cyan}--detail=<task_id>${C.reset}           显示指定任务的完整详情
  ${C.cyan}--summary${C.reset}                    输出统计摘要
  ${C.cyan}--json${C.reset}                       以 JSON 格式输出
  ${C.cyan}--export=markdown${C.reset}            导出为 Markdown 格式报告
  ${C.cyan}--output=<path>${C.reset}              指定导出文件路径（配合 --export 使用）
  ${C.cyan}--help${C.reset}                       显示此帮助信息

${C.bold}示例:${C.reset}
  npx tsx scripts/changelog-query.ts --date=2026-07-04
  npx tsx scripts/changelog-query.ts --since=2026-07-01 --until=2026-07-31
  npx tsx scripts/changelog-query.ts --type=code_refactor --status=completed
  npx tsx scripts/changelog-query.ts --participant=架构师
  npx tsx scripts/changelog-query.ts --keyword=评分
  npx tsx scripts/changelog-query.ts --detail=TASK-2026-07-04-001
  npx tsx scripts/changelog-query.ts --summary
  npx tsx scripts/changelog-query.ts --all --json
  npx tsx scripts/changelog-query.ts --all --export=markdown
  npx tsx scripts/changelog-query.ts --date=2026-07 --export=markdown --output=docs/reports/2026-07.md

${C.bold}npm 脚本:${C.reset}
  npm run changelog:query -- --date=2026-07-04
  npm run changelog:summary
`)
}

// ─── Markdown 导出 ────────────────────────────────────────────────────────────

function generateMarkdown(entries: ChangelogEntry[], args: CliArgs): string {
  const lines: string[] = []
  
  // 标题
  lines.push('# V9 更新日志报告')
  lines.push('')
  
  // 生成时间
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  lines.push(`> 生成时间: ${now}`)
  lines.push('')
  
  // 过滤条件
  const filters: string[] = []
  if (args.date) filters.push(`日期: ${args.date}`)
  if (args.since) filters.push(`起始日期: ${args.since}`)
  if (args.until) filters.push(`结束日期: ${args.until}`)
  if (args.type) filters.push(`类型: ${args.type}`)
  if (args.participant) filters.push(`参与者: ${args.participant}`)
  if (args.status) filters.push(`状态: ${args.status}`)
  if (args.keyword) filters.push(`关键词: ${args.keyword}`)
  
  if (filters.length > 0) {
    lines.push('## 过滤条件')
    lines.push('')
    for (const f of filters) {
      lines.push(`- ${f}`)
    }
    lines.push('')
  }
  
  // 统计摘要
  lines.push('## 统计摘要')
  lines.push('')
  lines.push(`**总计**: ${entries.length} 条记录`)
  lines.push('')
  
  // 按状态统计
  const byStatus = new Map<string, number>()
  for (const e of entries) {
    byStatus.set(e.task_status, (byStatus.get(e.task_status) ?? 0) + 1)
  }
  lines.push('### 按状态')
  lines.push('')
  lines.push('| 状态 | 数量 |')
  lines.push('|------|------|')
  for (const [status, count] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
    const label = status === 'completed' ? '✓ 完成' : status === 'in_progress' ? '◐ 进行中' : status === 'failed' ? '✗ 失败' : status
    lines.push(`| ${label} | ${count} |`)
  }
  lines.push('')
  
  // 按类型统计
  const byType = new Map<string, number>()
  for (const e of entries) {
    byType.set(e.task_type, (byType.get(e.task_type) ?? 0) + 1)
  }
  lines.push('### 按类型')
  lines.push('')
  lines.push('| 类型 | 数量 |')
  lines.push('|------|------|')
  for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${type} | ${count} |`)
  }
  lines.push('')
  
  // 按月份统计
  const byMonth = new Map<string, number>()
  for (const e of entries) {
    const month = e.timestamp.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1)
  }
  lines.push('### 按月份')
  lines.push('')
  lines.push('| 月份 | 数量 |')
  lines.push('|------|------|')
  for (const [month, count] of [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    lines.push(`| ${month} | ${count} |`)
  }
  lines.push('')
  
  // 文件变更统计
  let totalAdded = 0
  let totalModified = 0
  let totalDeleted = 0
  let totalDocs = 0
  for (const e of entries) {
    totalAdded += e.changes.files_added.length
    totalModified += e.changes.files_modified.length
    totalDeleted += e.changes.files_deleted.length
    totalDocs += e.changes.docs_updated.length
  }
  lines.push('### 文件变更统计')
  lines.push('')
  lines.push(`- **新增**: ${totalAdded}`)
  lines.push(`- **修改**: ${totalModified}`)
  lines.push(`- **删除**: ${totalDeleted}`)
  lines.push(`- **文档更新**: ${totalDocs}`)
  lines.push('')
  
  // 详细记录
  lines.push('---')
  lines.push('')
  lines.push('## 详细记录')
  lines.push('')
  
  for (const entry of entries) {
    // 任务标题
    lines.push(`### ${entry.title}`)
    lines.push('')
    
    // 基本信息
    lines.push('**基本信息**')
    lines.push('')
    lines.push(`- **任务ID**: ${entry.task_id}`)
    lines.push(`- **类型**: ${entry.task_type}`)
    lines.push(`- **状态**: ${entry.task_status === 'completed' ? '✓ 完成' : entry.task_status === 'in_progress' ? '◐ 进行中' : entry.task_status === 'failed' ? '✗ 失败' : entry.task_status}`)
    lines.push(`- **进度**: ${entry.progress}%`)
    lines.push(`- **时间**: ${formatDate(entry.timestamp)} ${formatTime(entry.timestamp)}`)
    lines.push('')
    
    // 人机交互
    if (entry.human_interactions.length > 0) {
      lines.push('**人机交互**')
      lines.push('')
      for (const h of entry.human_interactions) {
        lines.push(`- **${h.participant}** (${h.type}) — ${formatTime(h.time)}`)
        lines.push(`  - 内容: ${h.content}`)
        if (h.decision) lines.push(`  - 决策: ${h.decision}`)
        if (h.rationale) lines.push(`  - 依据: ${h.rationale}`)
      }
      lines.push('')
    }
    
    // 文件变更
    const { files_added, files_modified, files_deleted, docs_updated } = entry.changes
    const totalChanges = files_added.length + files_modified.length + files_deleted.length + docs_updated.length
    
    if (totalChanges > 0) {
      lines.push('**文件变更**')
      lines.push('')
      
      if (files_added.length > 0) {
        lines.push(`*新增 (${files_added.length}):*`)
        lines.push('')
        for (const f of files_added) {
          const lines_info = f.lines != null ? ` (${f.lines}行)` : ''
          lines.push(`- \`+\` ${f.path}${lines_info}`)
          if (f.description) lines.push(`  - ${f.description}`)
        }
        lines.push('')
      }
      
      if (files_modified.length > 0) {
        lines.push(`*修改 (${files_modified.length}):*`)
        lines.push('')
        for (const f of files_modified) {
          const diff = f.lines_added != null && f.lines_removed != null
            ? ` (+${f.lines_added}/-${f.lines_removed})`
            : f.lines != null
              ? ` (${f.lines}行)`
              : ''
          lines.push(`- \`~\` ${f.path}${diff}`)
          if (f.description) lines.push(`  - ${f.description}`)
        }
        lines.push('')
      }
      
      if (files_deleted.length > 0) {
        lines.push(`*删除 (${files_deleted.length}):*`)
        lines.push('')
        for (const f of files_deleted) {
          lines.push(`- \`-\` ${f.path}`)
          if (f.description) lines.push(`  - ${f.description}`)
        }
        lines.push('')
      }
      
      if (docs_updated.length > 0) {
        lines.push(`*文档更新 (${docs_updated.length}):*`)
        lines.push('')
        for (const f of docs_updated) {
          const ver = 'version' in f ? ` [${(f as FileChange & { version: string }).version}]` : ''
          lines.push(`- \`D\` ${f.path}${ver}`)
          if (f.description) lines.push(`  - ${f.description}`)
        }
        lines.push('')
      }
    }
    
    // 决策记录
    if (entry.decisions.length > 0) {
      lines.push('**决策记录**')
      lines.push('')
      for (const d of entry.decisions) {
        lines.push(`*${d.context}* (${formatTime(d.time)})`)
        lines.push('')
        lines.push('候选方案:')
        lines.push('')
        for (const opt of d.options_evaluated) {
          lines.push(`- ${opt}`)
        }
        lines.push('')
        lines.push(`**最终决策**: ${d.final_decision}`)
        lines.push('')
        lines.push(`**决策依据**: ${d.rationale}`)
        lines.push('')
      }
    }
    
    // 交付物
    if (entry.deliverables && entry.deliverables.length > 0) {
      lines.push('**交付物**')
      lines.push('')
      for (const d of entry.deliverables) {
        lines.push(`- **${d.name}**`)
        lines.push(`  - 路径: \`${d.path}\``)
        lines.push(`  - ${d.description}`)
      }
      lines.push('')
    }
    
    // 质量指标
    const metrics = entry.quality_metrics
    const metricEntries = Object.entries(metrics).filter(([, v]) => v !== 'N/A' && v !== 'skipped')
    if (metricEntries.length > 0) {
      lines.push('**质量指标**')
      lines.push('')
      for (const [key, value] of metricEntries) {
        lines.push(`- ${key}: ${value}`)
      }
      lines.push('')
    }
    
    // 后续步骤
    if (entry.next_steps && entry.next_steps.length > 0) {
      lines.push('**后续步骤**')
      lines.push('')
      for (const step of entry.next_steps) {
        lines.push(`- ${step}`)
      }
      lines.push('')
    }
    
    lines.push('---')
    lines.push('')
  }
  
  return lines.join('\n')
}

function exportToMarkdown(entries: ChangelogEntry[], args: CliArgs): void {
  const markdown = generateMarkdown(entries, args)
  
  let outputPath: string
  if (args.output) {
    outputPath = join(ROOT, args.output)
  } else {
    // 生成默认文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    outputPath = join(ROOT, 'docs', 'reports', `changelog-${timestamp}.md`)
  }
  
  // 确保目录存在
  const outputDir = dirname(outputPath)
  mkdirSync(outputDir, { recursive: true })
  
  writeFileSync(outputPath, markdown, 'utf-8')
  
  const relPath = relative(ROOT, outputPath)
  console.log(`${C.green}✓ Markdown 报告已导出: ${relPath}${C.reset}`)
  console.log(`${C.dim}  包含 ${entries.length} 条记录${C.reset}`)
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv)

  if (args.help) {
    printHelp()
    return
  }

  // 检查 changelogs 目录是否存在
  if (!statSync(CHANGELOGS_DIR, { throwIfNoExists: false })?.isDirectory()) {
    console.error(`${C.red}错误: changelogs 目录不存在: ${relative(ROOT, CHANGELOGS_DIR)}${C.reset}`)
    console.error('请先创建 docs/changelogs/ 目录并添加日志文件')
    process.exit(1)
  }

  const allEntries = loadAllEntries()

  if (allEntries.length === 0) {
    console.log(`${C.yellow}changelogs 目录下未找到任何日志文件${C.reset}`)
    return
  }

  // --detail 模式：直接输出单个任务详情
  if (args.detail) {
    const entry = allEntries.find((e) => e.task_id === args.detail)
    if (!entry) {
      console.error(`${C.red}错误: 未找到任务 ${args.detail}${C.reset}`)
      console.error(`可用任务ID: ${allEntries.map((e) => e.task_id).join(', ')}`)
      process.exit(1)
    }
    if (args.json) {
      console.log(JSON.stringify(entry, null, 2))
    } else {
      printDetail(entry)
    }
    return
  }

  // --summary 模式
  if (args.summary) {
    const filtered = args.date || args.since || args.until || args.type || args.participant || args.status || args.keyword
      ? filterEntries(allEntries, args)
      : allEntries
    if (args.json) {
      // JSON 摘要
      const summary = {
        total: filtered.length,
        by_status: Object.fromEntries(
          filtered.reduce((m, e) => m.set(e.task_status, (m.get(e.task_status) ?? 0) + 1), new Map<string, number>()),
        ),
        by_type: Object.fromEntries(
          filtered.reduce((m, e) => m.set(e.task_type, (m.get(e.task_type) ?? 0) + 1), new Map<string, number>()),
        ),
        by_month: Object.fromEntries(
          filtered.reduce((m, e) => {
            const month = e.timestamp.slice(0, 7)
            return m.set(month, (m.get(month) ?? 0) + 1)
          }, new Map<string, number>()),
        ),
      }
      console.log(JSON.stringify(summary, null, 2))
    } else {
      printSummary(filtered)
    }
    return
  }

  // --export 模式
  if (args.export === 'markdown') {
    const hasFilter = args.date || args.since || args.until || args.type || args.participant || args.status || args.keyword
    const filtered = hasFilter ? filterEntries(allEntries, args) : allEntries
    exportToMarkdown(filtered, args)
    return
  }

  // --all 模式或带过滤条件
  const hasFilter = args.date || args.since || args.until || args.type || args.participant || args.status || args.keyword
  if (!args.all && !hasFilter) {
    console.log(`${C.yellow}未指定过滤条件，使用 --all 列出全部，或使用 --help 查看帮助${C.reset}`)
    return
  }

  const filtered = filterEntries(allEntries, args)

  if (args.json) {
    console.log(JSON.stringify(filtered, null, 2))
  } else {
    printTable(filtered)
  }
}

main()
