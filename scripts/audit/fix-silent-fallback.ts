/**
 * @fileoverview 静默回退批量修复脚本 v2.0
 *
 * 针对 audit-hardcode 扫描出的静默回退模式（?? '' / ?? 0 / ?? [] / || 兜底），
 * 批量添加注释说明设计意图。对 Critical 级别自动添加 logger.warn。
 *
 * 使用方式:
 *   npx tsx scripts/audit/fix-silent-fallback.ts --dry-run              # 仅输出修复计划
 *   npx tsx scripts/audit/fix-silent-fallback.ts --apply                # 应用所有修复
 *   npx tsx scripts/audit/fix-silent-fallback.ts --apply --severity Critical  # 仅修复 Critical
 *
 * @version v2.0.0
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { resolve, relative } from 'path'

// ─── 配置 ───────────────────────────────────────────────────────
const ROOT = process.cwd()
const REPORTS_DIR = resolve(ROOT, 'scripts/audit/docs/reports/audit')
const BACKUP_DIR = resolve(ROOT, 'scripts/audit/docs/backups')
const DRY_RUN = process.argv.includes('--dry-run')
const APPLY = process.argv.includes('--apply')
const SEVERITY_FILTER = getSeverityFilter()

// ─── 类型 ───────────────────────────────────────────────────────
type Severity = 'Critical' | 'Major' | 'Warning' | 'Info'

interface FallbackViolation {
  file: string
  line: number
  column: number
  category: string
  message: string
  context: string
  severity: Severity
}

interface FixEntry {
  line: number
  action: 'add-logger' | 'add-comment' | 'skip'
  original: string
  replacement: string
  reason: string
  severity: Severity
}

interface FixPlan {
  file: string
  violations: FallbackViolation[]
  fixes: FixEntry[]
}

// ─── 主流程 ───────────────────────────────────────────────────────
function main(): void {
  const reportPath = findLatestAuditReport()
  if (!reportPath) {
    console.error('❌ 找不到 audit-hardcode 报告，请先运行 npx tsx scripts/audit/audit-hardcode.ts')
    process.exit(1)
  }

  console.log(`📋 读取审计报告: ${relative(ROOT, reportPath)}`)
  const violations = loadViolations(reportPath)
  const fallbackViolations = violations.filter(
    (v) => v.category === '静默回退' && v.severity !== 'Info'
  )

  const filtered = SEVERITY_FILTER
    ? fallbackViolations.filter((v) => SEVERITY_FILTER.includes(v.severity))
    : fallbackViolations

  console.log(`🎯 待修复静默回退: ${filtered.length} 处 (筛选自 ${fallbackViolations.length})`)
  for (const sev of ['Critical', 'Major', 'Warning'] as Severity[]) {
    const count = filtered.filter((v) => v.severity === sev).length
    if (count > 0) console.log(`   ${sev}: ${count}`)
  }

  const plans = buildFixPlans(filtered)

  if (DRY_RUN) {
    printPlanSummary(plans)
    console.log('\n🔍 Dry-run 模式：未修改任何文件')
    return
  }

  if (APPLY) {
    console.log('\n⚠️  Apply 模式：将修改源文件')
    console.log('   建议先使用 --dry-run 预览，或通过 --severity Critical 限制范围')
    console.log('   备份文件将保存至 scripts/audit/docs/backups/\n')
    applyFixes(plans)
    console.log('\n✅ 修复完成')
    console.log('\n📝 验证命令:')
    console.log('   npx tsc -p tsconfig.prod.json --noEmit')
    console.log('   npx tsx scripts/audit/audit-hardcode.ts')
    return
  }

  printPlanSummary(plans)
  console.log('\n💡 使用 --dry-run 预览，--apply 应用修复')
  console.log('   可选: --severity Critical | Major | Warning')
}

// ─── 工具函数 ────────────────────────────────────────────────────
function getSeverityFilter(): Severity[] | null {
  const idx = process.argv.indexOf('--severity')
  if (idx === -1 || idx + 1 >= process.argv.length) return null
  const val = process.argv[idx + 1] as Severity
  if (['Critical', 'Major', 'Warning'].includes(val)) return [val]
  return null
}

function findLatestAuditReport(): string | null {
  if (!existsSync(REPORTS_DIR)) return null
  const files = readdirSync(REPORTS_DIR)
  const auditFiles = files
    .filter((f: string) => f.startsWith('audit-hardcode-') && f.endsWith('.json'))
    .sort((a: string, b: string) => {
      // Sort by timestamp in filename
      const ta = a.replace('audit-hardcode-', '').replace('.json', '')
      const tb = b.replace('audit-hardcode-', '').replace('.json', '')
      return tb.localeCompare(ta)
    })
  return auditFiles.length > 0 ? resolve(REPORTS_DIR, auditFiles[0]) : null
}

function loadViolations(reportPath: string): FallbackViolation[] {
  const content = readFileSync(reportPath, 'utf-8')
  const report = JSON.parse(content)
  return report.violations || []
}

// ─── 构建修复计划 ────────────────────────────────────────────────
function buildFixPlans(violations: FallbackViolation[]): FixPlan[] {
  const grouped = new Map<string, FixPlan>()

  for (const v of violations) {
    if (!grouped.has(v.file)) {
      grouped.set(v.file, { file: v.file, violations: [], fixes: [] })
    }
    const plan = grouped.get(v.file)!
    plan.violations.push(v)
    plan.fixes.push(determineFix(v))
  }

  return Array.from(grouped.values()).sort((a, b) => a.file.localeCompare(b.file))
}

// ─── 判定修复方式 ────────────────────────────────────────────────
function determineFix(v: FallbackViolation): FixEntry {
  const ctx = v.context
  const isCritical = v.severity === 'Critical'

  // Critical: ?? 0 on store/services → 添加 logger.warn
  if (isCritical && (/\?\?\s*0\b/.test(ctx) || /\|\|\s*0\b/.test(ctx))) {
    return {
      line: v.line,
      action: 'add-logger',
      original: ctx,
      replacement: buildLoggerLine(v),
      reason: 'Critical ?? 0 数值兜底：添加 logger.warn 警告',
      severity: v.severity,
    }
  }

  // Critical: ?? '' on error → 添加 logger.warn
  if (isCritical && /error\s*\?\?\s*['"]/.test(ctx)) {
    return {
      line: v.line,
      action: 'add-logger',
      original: ctx,
      replacement: buildLoggerLine(v),
      reason: 'Critical error ?? 空字符串：添加 logger.warn',
      severity: v.severity,
    }
  }

  // Major: 静默回退 → 添加行内注释
  if (v.severity === 'Major') {
    return {
      line: v.line,
      action: 'add-comment',
      original: ctx,
      replacement: `// HARDCODE-MAJOR: 静默回退需人工确认 - ${ctx.trim().substring(0, 50)}`,
      reason: 'Major 级：需人工确认兜底意图',
      severity: v.severity,
    }
  }

  // Warning: 按模式分类添加注释
  const patternComments: Array<{ re: RegExp; label: string }> = [
    { re: /\?\?\s*['"]/, label: '空字符串兜底' },
    { re: /\?\?\s*0\b/, label: '数值零兜底' },
    { re: /\?\?\s*\[\]/, label: '空数组兜底' },
    { re: /\|\|\s*['"]/, label: '|| 字符串兜底' },
    { re: /\|\|\s*0\b/, label: '|| 数值兜底' },
    { re: /\|\|\s*\[\]/, label: '|| 数组兜底' },
  ]

  for (const { re, label } of patternComments) {
    if (re.test(ctx)) {
      return {
        line: v.line,
        action: 'add-comment',
        original: ctx,
        replacement: `// 静默回退(${label})：确认数据源可能为 undefined/null`,
        reason: `${label}：添加注释说明`,
        severity: v.severity,
      }
    }
  }

  return {
    line: v.line,
    action: 'add-comment',
    original: ctx,
    replacement: `// 静默回退：确认数据源和兜底意图`,
    reason: '通用兜底：添加注释',
    severity: v.severity,
  }
}

function buildLoggerLine(v: FallbackViolation): string {
  return `  logger.warn('静默回退触发', { source: '${v.file}:${v.line}', context: ${JSON.stringify(v.context)} })`
}

// ─── 应用修复 ────────────────────────────────────────────────────
function applyFixes(plans: FixPlan[]): void {
  mkdirSync(BACKUP_DIR, { recursive: true })
  let fixedCount = 0
  let skippedCount = 0

  for (const plan of plans) {
    const filePath = resolve(ROOT, plan.file)
    if (!existsSync(filePath)) {
      console.log(`  ⚠️  文件不存在: ${plan.file}`)
      continue
    }

    let content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    // 检查是否已有 logger 导入
    const hasLoggerImport = /import\s*\{[^}]*logger[^}]*\}\s*from\s*['"][^'"]+['"]/.test(content)

    // 按行号倒序处理，防止行号偏移
    const sortedFixes = [...plan.fixes].sort((a, b) => b.line - a.line)

    for (const fix of sortedFixes) {
      if (fix.action === 'skip') {
        skippedCount++
        continue
      }

      const lineIdx = fix.line - 1
      if (lineIdx >= lines.length) {
        console.log(`  ⚠️  行号超出范围: ${plan.file}:${fix.line}`)
        continue
      }

      const actualLine = lines[lineIdx]
      const contextMatch = actualLine.trim().includes(fix.original.trim().substring(0, 15))
      if (!contextMatch) {
        console.log(`  ⚠️  上下文不匹配: ${plan.file}:${fix.line}`)
        skippedCount++
        continue
      }

      const indent = getIndent(actualLine)

      if (fix.action === 'add-logger') {
        if (!hasLoggerImport) {
          console.log(`  ⚠️  跳过 logger 注入（无 logger 导入）: ${plan.file}:${fix.line}`)
          skippedCount++
          continue
        }
        const condition = extractFallbackCondition(fix.original)
        lines.splice(lineIdx, 0, `${indent}if (${condition} === undefined || ${condition} === null) {`)
        lines.splice(lineIdx + 1, 0, fix.replacement)
        lines.splice(lineIdx + 2, 0, `${indent}}`)
        fixedCount++
      } else if (fix.action === 'add-comment') {
        lines.splice(lineIdx, 0, `${indent}${fix.replacement}`)
        fixedCount++
      }
    }

    content = lines.join('\n')
    writeFileSync(filePath, content, 'utf-8')
    console.log(`  ✏️  ${plan.file} (${plan.fixes.length} 处)`)
  }

  console.log(`\n📊 修复统计: ${fixedCount} 处已修复, ${skippedCount} 处跳过`)
}

// ─── 辅助函数 ────────────────────────────────────────────────────
function getIndent(line: string): string {
  return line.match(/^\s*/)?.[0] || ''
}

function extractFallbackCondition(context: string): string {
  // Extract the variable name before ?? or ||, handling parenthesized expressions
  // e.g. "(limit ?? 0) > 0" → "limit"
  // e.g. "value ?? ''" → "value"
  const match = context.match(/([a-zA-Z_$][\w$]*)\s*\?\?/)
  if (match) return match[1]
  const matchOr = context.match(/([a-zA-Z_$][\w$]*)\s*\|\|/)
  return matchOr ? matchOr[1] : 'value'
}

// ─── 输出修复计划摘要 ────────────────────────────────────────────
function printPlanSummary(plans: FixPlan[]): void {
  const totalFixes = plans.reduce((s, p) => s + p.fixes.length, 0)
  const bySeverity = { Critical: 0, Major: 0, Warning: 0 }
  for (const p of plans) {
    for (const f of p.fixes) bySeverity[f.severity]++
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(' 静默回退批量修复计划 v2.0')
  console.log(`${'═'.repeat(60)}`)
  console.log(` 📁 涉及文件: ${plans.length}`)
  console.log(` 🔧 修复总数: ${totalFixes}`)
  console.log(`   Critical: ${bySeverity.Critical}  → logger.warn (需 logger 导入)`)
  console.log(`   Major:    ${bySeverity.Major}  → 行内注释`)
  console.log(`   Warning:  ${bySeverity.Warning}  → 分类注释`)
  console.log(`${'─'.repeat(60)}`)

  for (const plan of plans) {
    console.log(`\n 📄 ${plan.file}`)
    for (const fix of plan.fixes) {
      const icon = fix.action === 'add-logger' ? '🔊' : '📝'
      const sevTag = fix.severity === 'Critical' ? '[P0]' : fix.severity === 'Major' ? '[P1]' : '[P2]'
      console.log(`    ${icon} ${sevTag} L${fix.line}: ${fix.reason}`)
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
}

// ─── 启动 ────────────────────────────────────────────────────────
main()