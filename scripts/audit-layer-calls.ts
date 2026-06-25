#!/usr/bin/env tsx
/**
 * audit-layer-calls.ts
 * 跨层调用扫描器
 *
 * 检查目标：
 * 1. L5/L4（pages/components/portal/cockpit/apps）是否直接调用 dataLayer 写操作或 db 原生方法。
 *    注：L5/L4 经 dataLayer 读取是过渡期允许行为，仅作为警告提示，不计入违规。
 * 2. src/config/ 是否依赖引擎层/应用层/展示层。
 * 3. src/core/ 是否依赖展示层/应用层。
 * 4. src/services/ 是否绕过 DataBridge 直接写 db。
 *
 * 输出：违规列表 + 警告列表 + 汇总；退出码 1 表示发现违规。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface Finding {
  file: string
  line: number
  column: number
  type: string
  message: string
  context: string
}

interface Report {
  violations: Finding[]
  warnings: Finding[]
  summary: {
    totalFiles: number
    totalViolations: number
    totalWarnings: number
    byViolationType: Record<string, number>
    byWarningType: Record<string, number>
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

// 写操作模式
const DATA_LAYER_WRITE_PATTERN =
  /\bdataLayer\.[a-zA-Z_$][a-zA-Z0-9_$]*\.(add|put|save|update|delete|clear)\s*\(/
const DB_WRITE_PATTERN = /\bdb\.(put|add|update|delete|clear|reset|import)\s*\(/
const IMPORT_DATA_LAYER_PATTERN = /from\s+['"](?:\.\.\/data\/|@\/data\/)(dataLayer|db)['"]/

function isTsFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx')
}

function collectFiles(dir: string): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
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

function isL5OrL4(rel: string): boolean {
  return (
    rel.startsWith('src/apps/') ||
    rel.startsWith('src/pages/') ||
    rel.startsWith('src/components/') ||
    rel.startsWith('src/portal/') ||
    rel.startsWith('src/cockpit/')
  )
}

function scanFile(file: string): Pick<Report, 'violations' | 'warnings'> {
  const violations: Finding[] = []
  const warnings: Finding[] = []
  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')
  const rel = relative(file)

  let importsDataLayer = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

    // 规则 1：L5/L4 直接写 dataLayer / db
    if (isL5OrL4(rel)) {
      const writeMatch = raw.match(DATA_LAYER_WRITE_PATTERN)
      if (writeMatch) {
        violations.push({
          file: rel,
          line: i + 1,
          column: (writeMatch.index ?? 0) + 1,
          type: 'L5/L4 直接写数据层',
          message: 'L5/L4 禁止直接调用 dataLayer 写操作',
          context: trimmed.slice(0, 80),
        })
      }

      const dbWriteMatch = raw.match(DB_WRITE_PATTERN)
      if (dbWriteMatch) {
        violations.push({
          file: rel,
          line: i + 1,
          column: (dbWriteMatch.index ?? 0) + 1,
          type: 'L5/L4 直接写 DB',
          message: 'L5/L4 禁止直接调用 db 原生写方法',
          context: trimmed.slice(0, 80),
        })
      }

      if (IMPORT_DATA_LAYER_PATTERN.test(raw)) {
        importsDataLayer = true
      }
    }

    // 规则 2：config 层禁止依赖引擎/应用/展示层
    if (rel.startsWith('src/config/')) {
      const forbiddenImports = [
        /from\s+['"]\.\.\/services\//,
        /from\s+['"]@\/services\//,
        /from\s+['"]\.\.\/apps\//,
        /from\s+['"]@\/apps\//,
        /from\s+['"]\.\.\/pages\//,
        /from\s+['"]@\/pages\//,
        /from\s+['"]\.\.\/components\//,
        /from\s+['"]@\/components\//,
        /from\s+['"]\.\.\/core\/(databridge|envelope|acl|poolTransitionEngine)['"]/,
        /from\s+['"]@\/core\/(databridge|envelope|acl|poolTransitionEngine)['"]/,
      ]
      for (const pattern of forbiddenImports) {
        const match = raw.match(pattern)
        if (match) {
          violations.push({
            file: rel,
            line: i + 1,
            column: (match.index ?? 0) + 1,
            type: 'config 层依赖下层',
            message: '配置层禁止依赖引擎层/应用层/展示层',
            context: trimmed.slice(0, 80),
          })
        }
      }
    }

    // 规则 3：core 层禁止依赖展示层/应用层
    if (rel.startsWith('src/core/')) {
      const forbiddenImports = [
        /from\s+['"]\.\.\/(pages|components|apps|portal|cockpit)\//,
        /from\s+['"]@\/(pages|components|apps|portal|cockpit)\//,
      ]
      for (const pattern of forbiddenImports) {
        const match = raw.match(pattern)
        if (match) {
          violations.push({
            file: rel,
            line: i + 1,
            column: (match.index ?? 0) + 1,
            type: 'core 层依赖上层',
            message: 'core 层禁止依赖展示层/应用层',
            context: trimmed.slice(0, 80),
          })
        }
      }
    }

    // 规则 4：services 层禁止直接写 db（应通过 DataBridge）
    if (rel.startsWith('src/services/')) {
      const dbWriteMatch = raw.match(DB_WRITE_PATTERN)
      if (dbWriteMatch) {
        violations.push({
          file: rel,
          line: i + 1,
          column: (dbWriteMatch.index ?? 0) + 1,
          type: 'services 直接写 DB',
          message: '引擎层禁止直接调用 db 写方法，应使用 DataBridge.forward()',
          context: trimmed.slice(0, 80),
        })
      }
    }
  }

  // L5/L4 导入 dataLayer 仅作为警告（过渡期允许读操作）
  if (importsDataLayer && isL5OrL4(rel) && !violations.some((v) => v.file === rel)) {
    const importLine = lines.findIndex((line) => IMPORT_DATA_LAYER_PATTERN.test(line))
    if (importLine >= 0) {
      warnings.push({
        file: rel,
        line: importLine + 1,
        column: 1,
        type: 'L5/L4 导入数据层（读）',
        message: 'L5/L4 经 dataLayer 读取是过渡期允许行为，建议逐步迁移到 Service',
        context: lines[importLine].trim().slice(0, 80),
      })
    }
  }

  return { violations, warnings }
}

function scan(): Report {
  const files = collectFiles(SRC)
  const violations: Finding[] = []
  const warnings: Finding[] = []

  for (const file of files) {
    const result = scanFile(file)
    violations.push(...result.violations)
    warnings.push(...result.warnings)
  }

  const byViolationType: Record<string, number> = {}
  const byWarningType: Record<string, number> = {}
  for (const v of violations) {
    byViolationType[v.type] = (byViolationType[v.type] ?? 0) + 1
  }
  for (const w of warnings) {
    byWarningType[w.type] = (byWarningType[w.type] ?? 0) + 1
  }

  return {
    violations,
    warnings,
    summary: {
      totalFiles: files.length,
      totalViolations: violations.length,
      totalWarnings: warnings.length,
      byViolationType,
      byWarningType,
    },
  }
}

function printFindings(title: string, items: Finding[], color: 'red' | 'yellow'): void {
  const colorCode = color === 'red' ? '\x1b[31m' : '\x1b[33m'
  const reset = '\x1b[0m'

  console.log(`${colorCode}${title}${reset}\n`)
  for (const item of items) {
    console.log(`  ${item.file}:${item.line}:${item.column}`)
    console.log(`    [${item.type}] ${item.message}`)
    console.log(`    ${item.context}`)
    console.log()
  }
}

function main(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  跨层调用审计 — audit-layer-calls.ts                       ║')
  console.log('╚════════════════════════════════════════════════════════════\n')

  const report = scan()

  if (report.violations.length === 0 && report.warnings.length === 0) {
    console.log('✅ 未发现跨层调用违规或警告')
  } else {
    if (report.violations.length > 0) {
      printFindings(`🔴 发现 ${report.violations.length} 处跨层调用违规：`, report.violations, 'red')
      console.log('按违规类型汇总：')
      for (const [type, count] of Object.entries(report.summary.byViolationType)) {
        console.log(`  ${type}: ${count}`)
      }
      console.log()
    }

    if (report.warnings.length > 0) {
      printFindings(`⚠️  发现 ${report.warnings.length} 处过渡期的读数据层警告：`, report.warnings, 'yellow')
      console.log('按警告类型汇总：')
      for (const [type, count] of Object.entries(report.summary.byWarningType)) {
        console.log(`  ${type}: ${count}`)
      }
      console.log()
    }
  }

  console.log('────────────────────────────────────────────────────────────')
  console.log(`扫描文件数: ${report.summary.totalFiles}`)
  console.log(`违规数: ${report.summary.totalViolations}`)
  console.log(`警告数: ${report.summary.totalWarnings}`)
  console.log('────────────────────────────────────────────────────────────\n')

  process.exit(report.violations.length > 0 ? 1 : 0)
}

main()
