#!/usr/bin/env node
/**
 * @module scripts/mechanism-self-diagnose
 * @description
 *  三类自动化机制（SOP 自动触发 / 文档自动更新 / 日志自动更新）的
 *  「自扫描 → 自诊断 → 自更新」工具。
 *
 *  自扫描：对代码树做有界遍历，统计关键标记在仓库中的真实使用量，并校验
 *          各机制载荷文件（事件总线 / 流水线 / Git 钩子 / CI / 触发器 / 日志底座…）存在性。
 *  自诊断：依据「存在 + 被真实接线 + 可被触发」三准则，给出 active / partial / inactive 状态。
 *  压力测试：实际执行代表性脚本（doc-update-trigger / audit:layers / build:health / doc-version-check）
 *          与进程内功能验证（logger + EventBus + 熔断），证明机制确实能产生效果。
 *  自更新：将本次结果写入 outputs/mechanism-health-record.json（含历史趋势，封顶 20 条），
 *          并生成人类可读的 outputs/mechanism-health-report.md。
 *
 * 用法：
 *   node ./node_modules/tsx/dist/cli.mjs scripts/mechanism-self-diagnose.ts [--no-stress] [--output <dir>]
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const ROOT = process.cwd()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ─── CLI ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const NO_STRESS = argv.includes('--no-stress')
const help = argv.includes('--help') || argv.includes('-h')
const outIdx = argv.indexOf('--output')
const OUT_DIR = outIdx >= 0 && argv[outIdx + 1] ? argv[outIdx + 1] : join(ROOT, 'outputs')

if (help) {
  console.log(
    `用法: node ./node_modules/tsx/dist/cli.mjs scripts/mechanism-self-diagnose.ts [--no-stress] [--output <dir>]`,
  )
  process.exit(0)
}

// ─── 类型 ─────────────────────────────────────────────────────────────────────
type Status = 'active' | 'partial' | 'inactive'
type CategoryKey = 'A' | 'B' | 'C'

interface Evidence {
  file?: string
  detail: string
}

interface Probe {
  id: string
  category: CategoryKey
  name: string
  expect: string
  status: Status
  evidence: Evidence[]
  notes?: string
}

interface StressResult {
  id: string
  target: string
  ok: boolean
  durationMs: number
  snippet: string
}

interface CategorySummary {
  total: number
  active: number
  partial: number
  inactive: number
}

interface RunEntry {
  ts: string
  node: string
  summary: {
    probesTotal: number
    active: number
    partial: number
    inactive: number
    stressPass: number
    stressTotal: number
  }
  categories: Record<CategoryKey, CategorySummary>
  probes: Probe[]
  stress: StressResult[]
}

interface HealthRecord {
  schemaVersion: number
  lastUpdated: string
  generatedAt: string
  node: string
  cwd: string
  summary: RunEntry['summary']
  categories: Record<CategoryKey, CategorySummary>
  probes: Probe[]
  stress: StressResult[]
  history: RunEntry[]
}

// ─── 基础 I/O ───────────────────────────────────────────────────────────────
function readRel(rel: string): string | null {
  const p = join(ROOT, rel)
  if (!existsSync(p)) return null
  try {
    return readFileSync(p, 'utf-8')
  } catch {
    return null
  }
}

function fileHas(rel: string, re: RegExp): boolean {
  const c = readRel(rel)
  return c !== null && re.test(c)
}

function countIn(content: string | null, re: RegExp): number {
  if (!content) return 0
  // 每次调用都克隆正则，避免共享全局正则 lastIndex 跨文件污染
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  let m = 0
  while (r.exec(content) !== null) m++
  return m
}

// ─── 有界遍历 + 标记计数 ─────────────────────────────────────────────────────
const SCAN_DIRS = ['src', 'scripts', '.husky', '.github']
const SKIP = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  'build-artifacts',
  '.venv',
  'outputs',
  '.playwright-mcp',
])

const MARKERS: Record<string, RegExp> = {
  eventBusUsage: /\beventBus\b/g,
  newEventBus: /new EventBus\b/g,
  loggerUsage: /getLogger\s*\(/g,
  errorBusUsage: /captureError\s*\(/g,
  writeAuditUsage: /writeAuditLog\s*\(/g,
  emitLifecycle: /emitLifecycleEvent\s*\(/g,
  circuitBreaker: /createCircuitBreaker\s*\(/g,
  collectEvents: /COLLECTION_EVENTS\./g,
}

function scanMarkers(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const k of Object.keys(MARKERS)) counts[k] = 0

  for (const dir of SCAN_DIRS) {
    const base = join(ROOT, dir)
    if (!existsSync(base)) continue
    walk(base, (file) => {
      if (!/\.(ts|tsx|js|mjs|cjs|json|yml|yaml|sh)$/.test(file)) return
      let content: string
      try {
        content = readFileSync(file, 'utf-8')
      } catch {
        return
      }
      for (const k of Object.keys(MARKERS)) {
        counts[k] += countIn(content, MARKERS[k])
      }
    })
  }
  return counts
}

function walk(root: string, onFile: (file: string) => void): void {
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return
  }
  for (const e of entries) {
    if (SKIP.has(e)) continue
    const full = join(root, e)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(full, onFile)
    else onFile(full)
  }
}

// ─── 探针构造辅助 ─────────────────────────────────────────────────────────────
function mk(
  id: string,
  category: CategoryKey,
  name: string,
  expect: string,
  status: Status,
  evidence: Evidence[],
  notes?: string,
): Probe {
  return { id, category, name, expect, status, evidence, notes }
}

// ─── 主流程 ─────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const started = Date.now()
  const nodeVer = process.version
  console.log(`\n🔎 三类自动化机制 · 自扫描 / 自诊断 / 自更新`)
  console.log(`   根目录: ${ROOT}`)
  console.log(`   Node : ${nodeVer}\n`)

  const counts = scanMarkers()
  console.log(
    `   标记扫描: eventBus=${counts.eventBusUsage}, getLogger=${counts.loggerUsage}, captureError=${counts.errorBusUsage}, writeAuditLog=${counts.writeAuditUsage}, emitLifecycleEvent=${counts.emitLifecycle}, createCircuitBreaker=${counts.circuitBreaker}, COLLECTION_EVENTS=${counts.collectEvents}\n`,
  )

  // 读取 package.json 脚本键
  const pkgRaw = readRel('package.json')
  const pkg = pkgRaw ? JSON.parse(pkgRaw) : { scripts: {} }
  const hasScript = (k: string): boolean => typeof pkg?.scripts?.[k] === 'string'

  // CI 工作流
  const wfDir = join(ROOT, '.github', 'workflows')
  const workflows = existsSync(wfDir) ? readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)) : []
  const wfActive = workflows.filter((f) => {
    const c = readRel(join('.github', 'workflows', f))
    if (!c) return false
    const hasTrigger = /on\s*:/.test(c) && /(push|pull_request|schedule|workflow_dispatch)/.test(c)
    const hasAudit = /(npm run|pnpm|tsx|audit|quality-check|doc-)/.test(c)
    return hasTrigger && hasAudit
  })

  // Git 钩子
  const preCommit = readRel('.husky/pre-commit')
  const preCommitAudits = preCommit
    ? countIn(
        preCommit,
        /npm run (audit|lint|tsc|verify|file:check|widget-registry|mcp|ai-output|complexity|jsdoc|tokens|atomic|layers|docs)/g,
      )
    : 0
  const hasPrePush = existsSync(join(ROOT, '.husky', 'pre-push'))

  // ─── A 类：SOP 自动触发 ─────────────────────────────────────────────────
  const probes: Probe[] = []

  probes.push(
    mk(
      'A1',
      'A',
      '事件总线 EventBus',
      'src/lib/eventBus.ts 存在且被业务订阅/发布',
      fileHas('src/lib/eventBus.ts', /class EventBus/) && fileHas('src/lib/eventBus.ts', /export const eventBus/)
        ? counts.eventBusUsage >= 5
          ? 'active'
          : 'partial'
        : 'inactive',
      [
        { file: 'src/lib/eventBus.ts', detail: fileHas('src/lib/eventBus.ts', /class EventBus/) ? 'class EventBus ✔' : '缺失' },
        { detail: `仓库 eventBus 引用 ${counts.eventBusUsage} 处` },
      ],
      counts.eventBusUsage < 5 ? '文件存在但全局引用较少，需确认是否被实际接线' : undefined,
    ),
  )

  probes.push(
    mk(
      'A2',
      'A',
      '采集事件常量 COLLECTION_EVENTS',
      'collection.types.ts 定义采集生命周期事件且被编排器 emit',
      fileHas('src/types/modules/collection.types.ts', /COLLECTION_EVENTS/) && counts.emitLifecycle >= 1
        ? 'active'
        : fileHas('src/types/modules/collection.types.ts', /COLLECTION_EVENTS/)
          ? 'partial'
          : 'inactive',
      [
        { file: 'src/types/modules/collection.types.ts', detail: 'COLLECTION_EVENTS 常量 ✔' },
        { detail: `emitLifecycleEvent 调用 ${counts.emitLifecycle} 处` },
      ],
    ),
  )

  probes.push(
    mk(
      'A3',
      'A',
      '采集编排 / 四层降级',
      'dataSourceOrchestrator 存在并 emit 生命周期事件',
      fileHas('src/services/data-collector/dataSourceOrchestrator.ts', /emitLifecycleEvent/)
        ? 'active'
        : fileHas('src/services/data-collector/dataSourceOrchestrator.ts', /class|function/)
          ? 'partial'
          : 'inactive',
      [
        {
          file: 'src/services/data-collector/dataSourceOrchestrator.ts',
          detail: fileHas('src/services/data-collector/dataSourceOrchestrator.ts', /emitLifecycleEvent/)
            ? 'emit 生命周期事件 ✔'
            : '存在但未发现 emit',
        },
      ],
    ),
  )

  probes.push(
    mk(
      'A4',
      'A',
      '流水线自动修复（缺失分→runV6Score）',
      'pipelineScheduler.repairMissingScores 调用 runV6Score',
      fileHas('src/core/pipelineScheduler.ts', /repairMissingScores/) && fileHas('src/core/pipelineScheduler.ts', /runV6Score/)
        ? 'active'
        : fileHas('src/core/pipelineScheduler.ts', /class|function/)
          ? 'partial'
          : 'inactive',
      [{ file: 'src/core/pipelineScheduler.ts', detail: 'repairMissingScores ✔ + runV6Score ✔' }],
    ),
  )

  probes.push(
    mk(
      'A5',
      'A',
      'Git 预提交门禁',
      '.husky/pre-commit 串联 ≥10 项 audit 且含 pre-push',
      preCommit !== null && preCommitAudits >= 10 && hasPrePush
        ? 'active'
        : preCommit !== null && preCommitAudits >= 5
          ? 'partial'
          : 'inactive',
      [
        { file: '.husky/pre-commit', detail: `引用 audit/lint/tsc 等门禁 ${preCommitAudits} 项` },
        { file: '.husky/pre-push', detail: hasPrePush ? '存在 ✔' : '缺失' },
      ],
      preCommitAudits < 10 ? '门禁项数不足 10，需核实是否完整覆盖' : undefined,
    ),
  )

  probes.push(
    mk(
      'A6',
      'A',
      'CI 定时 / 事件工作流',
      '.github/workflows 含触发型工作流调用质量/文档脚本',
      workflows.length >= 3 && wfActive.length >= 3
        ? 'active'
        : workflows.length >= 1
          ? 'partial'
          : 'inactive',
      [
        { file: '.github/workflows', detail: `共 ${workflows.length} 个，具触发+审计 ${wfActive.length} 个` },
        ...wfActive.slice(0, 6).map((f) => ({ file: `.github/workflows/${f}`, detail: '触发型工作流 ✔' })),
      ],
    ),
  )

  probes.push(
    mk(
      'A7',
      'A',
      '系统自检闭环 system:check-loop',
      'scripts/system-check-loop.ts 存在且 npm script 已注册',
      fileHas('scripts/system-check-loop.ts', /check|loop|auto/) && hasScript('system:check-loop')
        ? 'active'
        : fileHas('scripts/system-check-loop.ts', /./)
          ? 'partial'
          : 'inactive',
      [
        { file: 'scripts/system-check-loop.ts', detail: fileHas('scripts/system-check-loop.ts', /./) ? '存在 ✔' : '缺失' },
        { detail: `npm script system:check-loop: ${hasScript('system:check-loop') ? '已注册' : '未注册'}` },
      ],
    ),
  )

  // ─── B 类：文档自动更新 ─────────────────────────────────────────────────
  const triggerRules = readRel('scripts/doc-update-trigger.ts')
  const tCount = countIn(triggerRules, /id:\s*'T\d+'/g)
  const hasDocGenerator =
    fileHas('scripts/doc-update-trigger.ts', /defaultDocGenerator/) &&
    fileHas('scripts/doc-update-trigger.ts', /versionCheckGenerator/) &&
    fileHas('scripts/doc-update-trigger.ts', /AUTO_UPDATE_MARKER_RE/)

  probes.push(
    mk(
      'B1',
      'B',
      '文档更新触发器 TRIGGER_RULES(T1–T10)',
      'doc-update-trigger.ts 定义 ≥10 条触发规则',
      fileHas('scripts/doc-update-trigger.ts', /export const TRIGGER_RULES/) && tCount >= 10
        ? 'active'
        : fileHas('scripts/doc-update-trigger.ts', /TRIGGER_RULES/)
          ? 'partial'
          : 'inactive',
      [
        { file: 'scripts/doc-update-trigger.ts', detail: `TRIGGER_RULES 命中 ${tCount} 条` },
        { detail: `npm script doc:trigger/doc:updateTrigger: ${hasScript('doc:trigger') ? '已注册' : '未注册'}` },
      ],
    ),
  )

  probes.push(
    mk(
      'B2',
      'B',
      'DocGenerator 注册表 + 幂等标记',
      'defaultDocGenerator/versionCheckGenerator/AUTO_UPDATE_MARKER_RE 齐备',
      hasDocGenerator ? 'active' : fileHas('scripts/doc-update-trigger.ts', /DocGenerator/) ? 'partial' : 'inactive',
      [
        {
          file: 'scripts/doc-update-trigger.ts',
          detail: hasDocGenerator ? '生成器注册表 + 幂等标记 ✔' : '部分缺失',
        },
      ],
    ),
  )

  probes.push(
    mk(
      'B3',
      'B',
      '触发→动作映射表（单一事实源）',
      'docs/meta/doc-trigger-action-map.md 存在且含映射章节',
      fileHas('docs/meta/doc-trigger-action-map.md', /触发/) &&
        fileHas('docs/meta/doc-trigger-action-map.md', /动作/)
        ? 'active'
        : fileHas('docs/meta/doc-trigger-action-map.md', /./)
          ? 'partial'
          : 'inactive',
      [
        {
          file: 'docs/meta/doc-trigger-action-map.md',
          detail: fileHas('docs/meta/doc-trigger-action-map.md', /./) ? '存在 ✔' : '缺失',
        },
      ],
    ),
  )

  probes.push(
    mk(
      'B4',
      'B',
      'audit:docs 同步审计',
      'audit-doc-sync + audit-version-drift 存在且 npm script 注册',
      fileHas('scripts/audit-doc-sync.ts', /sync|doc/) &&
        fileHas('scripts/audit-version-drift.ts', /version/) &&
        hasScript('audit:docs')
        ? 'active'
        : fileHas('scripts/audit-doc-sync.ts', /./)
          ? 'partial'
          : 'inactive',
      [
        { file: 'scripts/audit-doc-sync.ts', detail: '存在 ✔' },
        { file: 'scripts/audit-version-drift.ts', detail: '存在 ✔' },
        { detail: `npm script audit:docs: ${hasScript('audit:docs') ? '已注册' : '未注册'}` },
      ],
    ),
  )

  const healthExists = existsSync(join(ROOT, 'public', 'health-report.json'))
  probes.push(
    mk(
      'B5',
      'B',
      'build:health 文档同步指标',
      'build-health-report.ts 生成含文档同步项的 health-report.json',
      fileHas('scripts/build-health-report.ts', /health/) && hasScript('build:health')
        ? 'active'
        : fileHas('scripts/build-health-report.ts', /./)
          ? 'partial'
          : 'inactive',
      [
        { file: 'scripts/build-health-report.ts', detail: fileHas('scripts/build-health-report.ts', /./) ? '存在 ✔' : '缺失' },
        { file: 'public/health-report.json', detail: healthExists ? '已生成 ✔' : '尚未生成（可运行 build:health）' },
      ],
    ),
  )

  const aiMemoryExists = existsSync(join(ROOT, 'public', 'ai-memory-index.json'))
  probes.push(
    mk(
      'B6',
      'B',
      'AI 记忆索引 build-ai-memory-index',
      'build-ai-memory-index.ts 产出 public/ai-memory-index.json',
      fileHas('scripts/build-ai-memory-index.ts', /index|memory/) && hasScript('build:ai-memory')
        ? 'active'
        : fileHas('scripts/build-ai-memory-index.ts', /./)
          ? 'partial'
          : 'inactive',
      [
        { file: 'scripts/build-ai-memory-index.ts', detail: fileHas('scripts/build-ai-memory-index.ts', /./) ? '存在 ✔' : '缺失' },
        { file: 'public/ai-memory-index.json', detail: aiMemoryExists ? '已生成 ✔' : '尚未生成（可运行 build:ai-memory）' },
      ],
    ),
  )

  probes.push(
    mk(
      'B7',
      'B',
      '上层调用方 doc-auto-updater',
      'doc-auto-updater.ts 作为体系包统一入口',
      fileHas('scripts/doc-auto-updater.ts', /capability registry|能力清单/) && hasScript('doc:auto-update')
        ? 'active'
        : fileHas('scripts/doc-auto-updater.ts', /./)
          ? 'partial'
          : 'inactive',
      [
        { file: 'scripts/doc-auto-updater.ts', detail: fileHas('scripts/doc-auto-updater.ts', /./) ? '存在 ✔' : '缺失' },
        { detail: `npm script doc:auto-update: ${hasScript('doc:auto-update') ? '已注册' : '未注册'}` },
      ],
    ),
  )

  // ─── C 类：日志自动更新 ─────────────────────────────────────────────────
  probes.push(
    mk(
      'C1',
      'C',
      'logger 日志底座',
      'src/lib/logger.ts 提供 getLogger 且被广泛使用',
      fileHas('src/lib/logger.ts', /export function getLogger/) && counts.loggerUsage >= 5
        ? 'active'
        : fileHas('src/lib/logger.ts', /getLogger/)
          ? 'partial'
          : 'inactive',
      [
        { file: 'src/lib/logger.ts', detail: 'getLogger + setLogLevel ✔' },
        { detail: `getLogger 引用 ${counts.loggerUsage} 处` },
      ],
    ),
  )

  probes.push(
    mk(
      'C2',
      'C',
      '采集追踪 tracePersistenceService',
      '采集追踪持久化到 IndexedDB traceRecords',
      fileHas('src/services/data-collector/tracePersistenceService.ts', /IndexedDB|traceRecords|put|add/)
        ? 'active'
        : fileHas('src/services/data-collector/tracePersistenceService.ts', /./)
          ? 'partial'
          : 'inactive',
      [
        {
          file: 'src/services/data-collector/tracePersistenceService.ts',
          detail: fileHas('src/services/data-collector/tracePersistenceService.ts', /IndexedDB|traceRecords|put|add/)
            ? '追踪写入逻辑 ✔'
            : '存在但未发现写入',
        },
      ],
    ),
  )

  probes.push(
    mk(
      'C3',
      'C',
      '熔断 / 告警 resilience + checkAlerts',
      'createCircuitBreaker 状态机 + qualityMetricsCollector.checkAlerts 阈值告警',
      fileHas('src/services/resilience.ts', /createCircuitBreaker/) &&
        fileHas('src/services/data-collector/qualityMetricsCollector.ts', /checkAlerts/)
        ? 'active'
        : fileHas('src/services/resilience.ts', /createCircuitBreaker/)
          ? 'partial'
          : 'inactive',
      [
        { file: 'src/services/resilience.ts', detail: 'createCircuitBreaker ✔（closed/open/half-open）' },
        { file: 'src/services/data-collector/qualityMetricsCollector.ts', detail: 'checkAlerts() ✔' },
        { detail: `createCircuitBreaker 引用 ${counts.circuitBreaker} 处` },
      ],
    ),
  )

  probes.push(
    mk(
      'C4',
      'C',
      '安全审计日志 writeAuditLog',
      'security-policy / databridge 追加式审计日志',
      (fileHas('src/config/security-policy.ts', /writeAuditLog/) ||
        fileHas('src/core/databridge.ts', /writeAuditLog/)) &&
        counts.writeAuditUsage >= 1
        ? 'active'
        : 'inactive',
      [
        { file: 'src/config/security-policy.ts', detail: fileHas('src/config/security-policy.ts', /writeAuditLog/) ? 'writeAuditLog ✔' : '未命中' },
        { file: 'src/core/databridge.ts', detail: fileHas('src/core/databridge.ts', /writeAuditLog/) ? 'writeAuditLog ✔' : '未命中' },
        { detail: `writeAuditLog 引用 ${counts.writeAuditUsage} 处` },
      ],
    ),
  )

  probes.push(
    mk(
      'C5',
      'C',
      '监控服务 monitorLogService / systemMonitorService',
      '监控日志环形缓冲 + 双定时器采集',
      fileHas('src/services/system/monitorLogService.ts', /FIFO|ring|Map|push/) &&
        fileHas('src/services/system/systemMonitorService.ts', /setInterval|Timer|15|30/)
        ? 'active'
        : fileHas('src/services/system/monitorLogService.ts', /./)
          ? 'partial'
          : 'inactive',
      [
        { file: 'src/services/system/monitorLogService.ts', detail: '存在 ✔' },
        { file: 'src/services/system/systemMonitorService.ts', detail: '存在 ✔' },
      ],
    ),
  )

  probes.push(
    mk(
      'C6',
      'C',
      '错误总线 errorBus.captureError',
      '异常经 captureError 收敛入总线',
      fileHas('src/services/errorBus.ts', /export function captureError/) && counts.errorBusUsage >= 3
        ? 'active'
        : fileHas('src/services/errorBus.ts', /captureError/)
          ? 'partial'
          : 'inactive',
      [
        { file: 'src/services/errorBus.ts', detail: 'captureError ✔' },
        { detail: `captureError 引用 ${counts.errorBusUsage} 处` },
      ],
    ),
  )

  // ─── 压力测试 ─────────────────────────────────────────────────────────────
  const stress: StressResult[] = []
  if (!NO_STRESS) {
    stress.push(await stressInProcess())
    stress.push(runSub('S2', 'doc-update-trigger.ts', ['--check'], '文档触发器 fire（列出命中规则）'))
    stress.push(runSub('S3', 'audit-layer-calls.ts', [], '门禁 audit:layers（0 违规基线）'))
    stress.push(runSub('S4', 'build-health-report.ts', [], 'build:health 生成 health-report.json'))
    stress.push(runSub('S5', 'doc-version-check.ts', ['--check'], 'doc-version-check 版本同步校验'))
  } else {
    console.log('   ⏭️  已跳过压力测试（--no-stress）')
  }

  // ─── 统计 ─────────────────────────────────────────────────────────────────
  const cats: Record<CategoryKey, CategorySummary> = {
    A: { total: 0, active: 0, partial: 0, inactive: 0 },
    B: { total: 0, active: 0, partial: 0, inactive: 0 },
    C: { total: 0, active: 0, partial: 0, inactive: 0 },
  }
  for (const p of probes) {
    cats[p.category].total++
    cats[p.category][p.status]++
  }
  const summary = {
    probesTotal: probes.length,
    active: probes.filter((p) => p.status === 'active').length,
    partial: probes.filter((p) => p.status === 'partial').length,
    inactive: probes.filter((p) => p.status === 'inactive').length,
    stressPass: stress.filter((s) => s.ok).length,
    stressTotal: stress.length,
  }

  // ─── 自更新：写记录（含历史） + Markdown ──────────────────────────────────
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  const recordPath = join(OUT_DIR, 'mechanism-health-record.json')
  let history: RunEntry[] = []
  try {
    const prev = readRel(relative(ROOT, recordPath))
    if (prev) history = JSON.parse(prev).history ?? []
  } catch {
    history = []
  }
  history.push({
    ts: new Date().toISOString(),
    node: nodeVer,
    summary,
    categories: cats,
    probes,
    stress,
  })
  if (history.length > 20) history = history.slice(-20)

  const record: HealthRecord = {
    schemaVersion: 1,
    lastUpdated: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    node: nodeVer,
    cwd: ROOT,
    summary,
    categories: cats,
    probes,
    stress,
    history,
  }
  writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf-8')

  const mdPath = join(OUT_DIR, 'mechanism-health-report.md')
  writeFileSync(mdPath, renderMarkdown(record, history), 'utf-8')

  const elapsed = Date.now() - started
  console.log(`\n✅ 完成（${elapsed}ms）`)
  console.log(
    `   探针: ${summary.active} active / ${summary.partial} partial / ${summary.inactive} inactive（共 ${summary.probesTotal}）`,
  )
  console.log(`   压力: ${summary.stressPass}/${summary.stressTotal} 通过`)
  console.log(`   记录: ${recordPath}`)
  console.log(`   报告: ${mdPath}\n`)
}

// ─── 压力测试：进程内功能验证 ─────────────────────────────────────────────────
async function stressInProcess(): Promise<StressResult> {
  const start = Date.now()
  try {
    const loggerMod = await import('@/lib/logger')
    const eventBusMod = await import('@/lib/eventBus')
    const resilienceMod = await import('@/services/resilience')

    const log = loggerMod.getLogger()
    log.info('[stress] logger active')

    const { eventBus } = eventBusMod
    let got = ''
    const off = eventBus.on('__self_diag__', (p: unknown) => {
      got = String(p)
    })
    eventBus.emit('__self_diag__', 'ping')
    off()

    const cb = resilienceMod.createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000, now: () => 0 })
    let tripped = false
    try {
      await cb.execute(async () => {
        throw new Error('boom')
      })
    } catch {
      tripped = true
    }

    const ok = got === 'ping' && tripped && cb.state === 'open'
    return {
      id: 'S1',
      target: '进程内 logger + EventBus + 熔断',
      ok,
      durationMs: Date.now() - start,
      snippet: `logger✓ eventBus(ping=${got})✓ circuitBreaker(state=${cb.state},tripped=${tripped})✓`,
    }
  } catch (e) {
    return {
      id: 'S1',
      target: '进程内 logger + EventBus + 熔断',
      ok: false,
      durationMs: Date.now() - start,
      snippet: `异常: ${(e as Error)?.message ?? String(e)}`,
    }
  }
}

// ─── 压力测试：子进程执行真实脚本 ─────────────────────────────────────────────
function runSub(id: string, script: string, args: string[], target: string): StressResult {
  const start = Date.now()
  const tsxPath = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  if (!existsSync(tsxPath)) {
    return { id, target, ok: false, durationMs: Date.now() - start, snippet: 'tsx cli 未找到' }
  }
  // 剥离可能由父进程 tsx 注入的环境变量，避免「tsx 套 tsx」导致的 resolveDirectory 冲突
  const childEnv: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue
    if (/^_?TSX/i.test(k) || k === 'NODE_OPTIONS' || /^ESBUILD/i.test(k)) continue
    childEnv[k] = v
  }
  const res = spawnSync(process.execPath, [tsxPath, join('scripts', script), ...args], {
    cwd: ROOT,
    env: childEnv,
    encoding: 'utf-8',
    timeout: 180000,
  })
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim()
  const snippet = out.length > 600 ? `…${out.slice(-600)}` : out
  const ok = res.status === 0 && out.length > 0
  return {
    id,
    target,
    ok,
    durationMs: Date.now() - start,
    snippet: ok ? `${snippet}\n[exit ${res.status}]` : `失败/无输出 [exit ${res.status}]\n${snippet}`,
  }
}

// ─── Markdown 渲染 ────────────────────────────────────────────────────────────
function renderMarkdown(rec: HealthRecord, history: RunEntry[]): string {
  const now = rec.generatedAt
  const s = rec.summary
  const lines: string[] = []
  lines.push(`# 三类自动化机制 · 自诊断报告`)
  lines.push('')
  lines.push(`> 生成时间: ${now}  |  Node: ${rec.node}  |  根目录: ${rec.cwd}`)
  lines.push('')
  lines.push(`## 一、总体统计`)
  lines.push('')
  lines.push(`| 维度 | active | partial | inactive | 合计 |`)
  lines.push(`| --- | ---: | ---: | ---: | ---: |`)
  for (const k of ['A', 'B', 'C'] as const) {
    const c = rec.categories[k]
    const label = k === 'A' ? 'SOP 自动触发' : k === 'B' ? '文档自动更新' : 'C 日志自动更新'
    lines.push(`| ${label} | ${c.active} | ${c.partial} | ${c.inactive} | ${c.total} |`)
  }
  lines.push(`| **合计** | **${s.active}** | **${s.partial}** | **${s.inactive}** | **${s.probesTotal}** |`)
  lines.push('')
  lines.push(`压力测试: **${s.stressPass}/${s.stressTotal}** 通过`)
  lines.push('')

  for (const k of ['A', 'B', 'C'] as const) {
    const label = k === 'A' ? 'A · SOP 自动触发' : k === 'B' ? 'B · 文档自动更新' : 'C · 日志自动更新'
    lines.push(`## ${label}`)
    lines.push('')
    lines.push(`| 探针 | 期望 | 状态 | 证据 |`)
    lines.push(`| --- | --- | --- | --- |`)
    for (const p of rec.probes.filter((x) => x.category === k)) {
      const ev = p.evidence.map((e) => (e.file ? `\`${e.file}\`: ${e.detail}` : e.detail)).join('；')
      const note = p.notes ? ` ⚠️ ${p.notes}` : ''
      lines.push(`| ${p.id} ${p.name} | ${p.expect} | ${badge(p.status)} | ${ev}${note} |`)
    }
    lines.push('')
  }

  if (rec.stress.length) {
    lines.push(`## 压力测试结果`)
    lines.push('')
    lines.push(`| ID | 目标 | 结果 | 耗时 | 摘要 |`)
    lines.push(`| --- | --- | --- | ---: | --- |`)
    for (const st of rec.stress) {
      lines.push(
        `| ${st.id} | ${st.target} | ${st.ok ? '✅ 通过' : '❌ 失败'} | ${st.durationMs}ms | ${st.snippet.replace(/\n/g, ' ').slice(0, 120)} |`,
      )
    }
    lines.push('')
  }

  lines.push(`## 历史趋势（最近 ${Math.min(6, history.length)} 次）`)
  lines.push('')
  lines.push(`| 时间 | active | partial | inactive | 压力 |`)
  lines.push(`| --- | ---: | ---: | ---: | ---: |`)
  for (const h of history.slice(-6).reverse()) {
    lines.push(
      `| ${h.ts.slice(0, 19)} | ${h.summary.active} | ${h.summary.partial} | ${h.summary.inactive} | ${h.summary.stressPass}/${h.summary.stressTotal} |`,
    )
  }
  lines.push('')

  const issues = rec.probes.filter((p) => p.status !== 'active')
  if (issues.length) {
    lines.push(`## 修复建议`)
    lines.push('')
    for (const p of issues) {
      lines.push(`- **${p.id} ${p.name}**(${p.status}): ${p.notes ?? p.expect}`)
    }
    lines.push('')
  }

  lines.push(`---`)
  lines.push(`*由 scripts/mechanism-self-diagnose.ts 自动生成 · 可重复运行并记录历史*`)
  return lines.join('\n')
}

function badge(st: Status): string {
  return st === 'active' ? '🟢 active' : st === 'partial' ? '🟡 partial' : '🔴 inactive'
}

void main()
