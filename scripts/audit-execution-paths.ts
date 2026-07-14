#!/usr/bin/env tsx
/**
 * audit-execution-paths.ts
 * 执行计划路径审计器 v1.0（白盒/透明管道）
 *
 * 检查目标：
 * 1. 禁止直接 `new ExecutionPlan()` 创建执行计划
 * 2. 禁止直接 `db.executionPlans.add()` 写入执行计划
 * 3. 禁止绕过 UseCase 的独立实现（如 `executionPlanService.createPlan()`）
 *
 * 允许的调用方式：
 * - Store: `executionStore.createPlan()` → 调用 UseCase
 * - MCP Server: `executionServer.createPlan()` → 调用 UseCase
 * - API: `/api/execution/create` → 调用 UseCase
 *
 * v1.0 实现（2026-07-06）：
 * - 采用白盒/透明管道模式：export scan() / formatReport() / main()
 * - stdout 输出 JSON 数据流（机器可读）
 * - stderr 输出诊断日志 + 人类可读报告
 * - 持久化报告到 docs/reports/audit/audit-execution-paths-{timestamp}.json
 * - 支持 CLI 参数：--json / --quiet / --output / --no-persist
 * - 测试可直接 import scan() 验证 Report 对象，无需解析字符串
 *
 * 输出契约：
 * - stdout：JSON 数据流（AuditReport 结构）
 * - stderr：诊断日志 + 人类可读报告
 * - 文件：docs/reports/audit/audit-execution-paths-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规, 2=执行错误
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runAuditPipeline, colorize, type AuditReport } from './_debug/_audit-pipeline'

/** 执行计划路径违规项 */
export interface Finding {
  file: string
  line: number
  column: number
  type: string
  message: string
  context: string
}

/** 执行计划路径审计报告 */
export interface Report extends AuditReport {
  violations: Finding[]
  summary: {
    totalFiles: number
    totalViolations: number
    byViolationType: Record<string, number>
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

// 禁止模式
const NEW_EXECUTION_PLAN_PATTERN = /\bnew\s+ExecutionPlan\s*\(/
const DB_EXECUTION_PLANS_ADD_PATTERN = /\bdb\.executionPlans\.(add|save)\s*\(/
const DATA_LAYER_EXECUTION_PLANS_ADD_PATTERN = /\bdataLayer\.executionPlans\.(add|save)\s*\(/
const EXECUTION_PLAN_SERVICE_CREATE_PATTERN = /\bexecutionPlanService\.createPlan\s*\(/

// 允许的文件（UseCase 本身）
const ALLOWED_FILES = [
  'src/services/useCase/createExecutionPlan.useCase.ts',
  'src/services/execution/executionPlanService.ts', // 该文件本身是旧实现，需要标记但不报错
]

function isTsFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx')
}

function collectFiles(dir: string): string[] {
  const files: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue
      files.push(...collectFiles(full))
    } else if (entry.isFile() && isTsFile(entry.name)) {
      files.push(full)
    }
  }
  return files
}

function relative(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, '/')
}

function isAllowedFile(rel: string): boolean {
  return ALLOWED_FILES.some(allowed => rel.includes(allowed))
}

function scanFile(file: string): Finding[] {
  const violations: Finding[] = []
  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')
  const rel = relative(file)

  // 跳过允许的文件
  if (isAllowedFile(rel)) {
    return violations
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw?.trim()!

    // 跳过注释
    if (trimmed!.startsWith('//') || trimmed!.startsWith('*') || trimmed!.startsWith('/*')) continue

    // 规则 1：禁止直接 new ExecutionPlan()
    const newMatch = raw?.match(NEW_EXECUTION_PLAN_PATTERN)
    if (newMatch) {
      violations.push({
        file: rel,
        line: i + 1,
        column: (newMatch.index ?? 0) + 1,
        type: '直接创建 ExecutionPlan',
        message: '禁止直接 new ExecutionPlan()，必须通过 createExecutionPlanUseCase',
        context: trimmed!.slice(0, 80),
      })
    }

    // 规则 2：禁止直接 db.executionPlans.add()
    const dbMatch = raw?.match(DB_EXECUTION_PLANS_ADD_PATTERN)
    if (dbMatch) {
      violations.push({
        file: rel,
        line: i + 1,
        column: (dbMatch.index ?? 0) + 1,
        type: '直接写入 executionPlans',
        message: '禁止直接 db.executionPlans.add()，必须通过 createExecutionPlanUseCase',
        context: trimmed!.slice(0, 80),
      })
    }

    // 规则 2b：禁止直接 dataLayer.executionPlans.add/save()
    const dataLayerMatch = raw?.match(DATA_LAYER_EXECUTION_PLANS_ADD_PATTERN)
    if (dataLayerMatch) {
      violations.push({
        file: rel,
        line: i + 1,
        column: (dataLayerMatch.index ?? 0) + 1,
        type: '直接写入 executionPlans',
        message: '禁止直接 dataLayer.executionPlans.add/save()，必须通过 createExecutionPlanUseCase',
        context: trimmed!.slice(0, 80),
      })
    }

    // 规则 3：禁止绕过 UseCase 的独立实现
    const serviceMatch = raw?.match(EXECUTION_PLAN_SERVICE_CREATE_PATTERN)
    if (serviceMatch) {
      violations.push({
        file: rel,
        line: i + 1,
        column: (serviceMatch.index ?? 0) + 1,
        type: '绕过 UseCase 调用',
        message: '禁止调用 executionPlanService.createPlan()，必须通过 createExecutionPlanUseCase',
        context: trimmed!.slice(0, 80),
      })
    }
  }

  return violations
}

/** 扫描函数（白盒导出，供测试和外部调用） */
export function scan(): Report {
  const files = collectFiles(SRC)
  const violations: Finding[] = []

  for (const file of files) {
    const result = scanFile(file)
    violations.push(...result)
  }

  const byViolationType: Record<string, number> = {}
  for (const v of violations) {
    byViolationType[v.type] = (byViolationType[v.type] ?? 0) + 1
  }

  return {
    violations,
    summary: {
      totalFiles: files.length,
      totalViolations: violations.length,
      byViolationType,
    },
  }
}

/** 格式化人类可读报告（输出到 stderr） */
export function formatReport(report: Report): string {
  const lines: string[] = []

  lines.push('╔════════════════════════════════════════════════════════════╗')
  lines.push('║  执行计划路径审计 — audit-execution-paths.ts v1.0         ║')
  lines.push('╚════════════════════════════════════════════════════════════╝')
  lines.push('')

  if (report.violations.length === 0) {
    lines.push(colorize('✅ 未发现执行计划路径违规', 'green'))
  } else {
    lines.push(colorize(`🔴 发现 ${report.violations.length} 处执行计划路径违规：`, 'red'))
    lines.push('')
    for (const item of report.violations) {
      lines.push(`  ${item.file}:${item.line}:${item.column}`)
      lines.push(`    [${item.type}] ${item.message}`)
      lines.push(`    ${item.context}`)
      lines.push('')
    }
    lines.push('按违规类型汇总：')
    for (const [type, count] of Object.entries(report.summary.byViolationType)) {
      lines.push(`  ${type}: ${count}`)
    }
    lines.push('')
  }

  lines.push('────────────────────────────────────────────────────────────')
  lines.push(`扫描文件数: ${report.summary.totalFiles}`)
  lines.push(`违规数: ${report.summary.totalViolations}`)
  lines.push('────────────────────────────────────────────────────────────')

  return lines.join('\n')
}

/** CLI 入口（编排：scan → stdout JSON → stderr 诊断 → 持久化 → exit） */
export function main(): void {
  const result = runAuditPipeline<Report>({
    scriptName: 'audit-execution-paths',
    version: '1.0',
    scanFn: scan,
    formatReportFn: formatReport,
  })
  process.exit(result.exitCode)
}

// 仅在直接作为 CLI 运行时执行（避免被 import 时自动运行）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
