#!/usr/bin/env tsx
/**
 * audit-layer-calls.ts
 * 跨层调用扫描器 v3.0（白盒/透明管道）
 *
 * 检查目标：
 * 1. L5/L4（pages/components/portal/cockpit/apps）是否直接调用 dataLayer 写操作或 db 原生方法。
 *    注：L5/L4 经 dataLayer 读取是过渡期允许行为，仅作为警告提示，不计入违规。
 * 2. src/config/ 是否依赖引擎层/应用层/展示层。
 * 3. src/core/ 是否依赖展示层/应用层。
 * 4. src/services/ 是否绕过 DataBridge 直接写 db。
 * 5. src/services/ 是否直接依赖 src/store/（违反分层规则：services → core/data，禁止依赖 store）。
 * 5c. src/services/ 是否依赖 src/lib/ 中的业务模块（仅允许基础设施）。
 * 6. src/lib/ 是否依赖上层（services/store/pages/components）。
 * 7. src/constants/ 是否依赖任何业务层（services/store/pages/components/config）。
 *
 * v3.0 改造（2026-07-06）：
 * - 采用白盒/透明管道模式：export scan() / formatReport() / main()
 * - stdout 输出 JSON 数据流（机器可读）
 * - stderr 输出诊断日志 + 人类可读报告
 * - 持久化报告到 docs/reports/audit/audit-layer-calls-{timestamp}.json
 * - 支持 CLI 参数：--json / --quiet / --output / --no-persist
 * - 测试可直接 import scan() 验证 Report 对象，无需解析字符串
 *
 * v2.2 增强（2026-07-05）：
 * - 新增规则 5c：检测 services 依赖 lib 中的业务模块（仅允许基础设施）
 * - 明确 services 可依赖的 lib 基础设施白名单：logger/withBroadcast/eventBus/format/errors/utils/localStorageManager
 *
 * v2.1 修复（2026-07-05）：
 * - 修复误报：排除 @/types/ 路径（类型定义层独立于业务层）
 * - 修复误报：跳过 import type 语句（类型导入豁免跨层检查）
 * - 修复误报：明确 @/agents/ 层归属（属于 core 层扩展）
 *
 * v2.0 增强：
 * - 检测 services 直接依赖 store 的违规（应通过 core/data 或 DataBridge）
 * - 检测 lib 层依赖上层的违规（lib 是基础设施，禁止依赖业务层）
 * - 检测 constants 层依赖业务层的违规（constants 必须零依赖）
 * - 改进 import 语句解析，支持动态 import() 和 re-export
 *
 * 输出契约：
 * - stdout：JSON 数据流（AuditReport 结构）
 * - stderr：诊断日志 + 人类可读报告
 * - 文件：docs/reports/audit/audit-layer-calls-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规, 2=执行错误
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runAuditPipeline, colorize, type AuditReport } from './_audit-pipeline'

/** 跨层调用违规/警告项 */
export interface Finding {
  file: string
  line: number
  column: number
  type: string
  message: string
  context: string
}

/** 跨层调用审计报告 */
export interface Report extends AuditReport {
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

// v2.1 修复：检测 services 直接依赖 store（排除 types 层和 import type）
const IMPORT_STORE_PATTERN = /from\s+['"](?:\.\.\/store\/|@\/store\/)(?!types\/)[^'"]+['"]/
const DYNAMIC_IMPORT_STORE_PATTERN = /import\s*\(\s*['"](?:\.\.\/store\/|@\/store\/)(?!types\/)[^'"]+['"]\s*\)/

// v2.2 新增：检测 services 依赖 lib 中的业务模块（排除基础设施）
// services 可以依赖 lib 中的基础设施（logger、withBroadcast、eventBus、safeCoerce），但不能依赖业务模块
const SERVICES_IMPORT_LIB_BUSINESS = /from\s+['"](?:\.\.\/lib\/|@\/lib\/)(?!logger|withBroadcast|eventBus|format|errors|utils|localStorageManager|safeCoerce)[^'"]+['"]/

// v2.1 修复：检测 lib 层依赖上层（排除 types 层）
const LIB_IMPORT_UPPER_LAYER = /from\s+['"](?:\.\.\/(services|store|pages|components|apps|portal|cockpit)\/(?!types\/)|@\/(services|store|pages|components|apps|portal|cockpit)\/(?!types\/))[^'"]+['"]/

// v2.1 修复：检测 constants 层依赖业务层（排除 types 层）
const CONSTANTS_IMPORT_BUSINESS = /from\s+['"](?:\.\.\/(services|store|pages|components|apps|portal|cockpit|core|data|lib)\/(?!types\/)|@\/(services|store|pages|components|apps|portal|cockpit|core|data|lib)\/(?!types\/))[^'"]+['"]/

// v2.1 新增：检测 import type（类型导入应豁免）
const IMPORT_TYPE_PATTERN = /^\s*import\s+type\s+/

// v2.0 新增：检测动态 import() 和 re-export
const DYNAMIC_IMPORT_PATTERN = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/
const REEXPORT_PATTERN = /export\s+(?:\*|{[^}]*})\s+from\s+['"]([^'"]+)['"]/

function isTsFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx')
}

function collectFiles(dir: string): string[] {
  const files: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    // 目录不存在或无权限时返回空列表（边界条件健壮性）
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
    const trimmed = raw?.trim()!

    if (trimmed!.startsWith('//') || trimmed!.startsWith('*') || trimmed!.startsWith('/*')) continue

    // v2.1 修复：跳过 import type（类型导入豁免跨层检查）
    if (IMPORT_TYPE_PATTERN.test(raw ?? '')) continue

    // 规则 1：L5/L4 直接写 dataLayer / db
    if (isL5OrL4(rel)) {
      const writeMatch = raw?.match(DATA_LAYER_WRITE_PATTERN)
      if (writeMatch) {
        violations.push({
          file: rel,
          line: i + 1,
          column: (writeMatch.index ?? 0) + 1,
          type: 'L5/L4 直接写数据层',
          message: 'L5/L4 禁止直接调用 dataLayer 写操作',
          context: trimmed!.slice(0, 80),
        })
      }

      const dbWriteMatch = raw?.match(DB_WRITE_PATTERN)
      if (dbWriteMatch) {
        violations.push({
          file: rel,
          line: i + 1,
          column: (dbWriteMatch.index ?? 0) + 1,
          type: 'L5/L4 直接写 DB',
          message: 'L5/L4 禁止直接调用 db 原生写方法',
          context: trimmed!.slice(0, 80),
        })
      }

      if (IMPORT_DATA_LAYER_PATTERN.test(raw ?? '')) {
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
        const match = raw?.match(pattern)
        if (match) {
          violations.push({
            file: rel,
            line: i + 1,
            column: (match.index ?? 0) + 1,
            type: 'config 层依赖下层',
            message: '配置层禁止依赖引擎层/应用层/展示层',
            context: trimmed!.slice(0, 80),
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
        const match = raw?.match(pattern)
        if (match) {
          violations.push({
            file: rel,
            line: i + 1,
            column: (match.index ?? 0) + 1,
            type: 'core 层依赖上层',
            message: 'core 层禁止依赖展示层/应用层',
            context: trimmed!.slice(0, 80),
          })
        }
      }
    }

    // 规则 4：services 层禁止直接写 db（应通过 DataBridge）
    if (rel.startsWith('src/services/')) {
      const dbWriteMatch = raw?.match(DB_WRITE_PATTERN)
      if (dbWriteMatch) {
        violations.push({
          file: rel,
          line: i + 1,
          column: (dbWriteMatch.index ?? 0) + 1,
          type: 'services 直接写 DB',
          message: '引擎层禁止直接调用 db 写方法，应使用 DataBridge.forward()',
          context: trimmed!.slice(0, 80),
        })
      }

      // v2.0 规则 5：services 层禁止直接依赖 store（应通过 core/data 或 DataBridge）
      const storeImportMatch = raw?.match(IMPORT_STORE_PATTERN)
      if (storeImportMatch && !rel.includes('__tests__') && !rel.includes('.test.')) {
        violations.push({
          file: rel,
          line: i + 1,
          column: (storeImportMatch.index ?? 0) + 1,
          type: 'services 直接依赖 store',
          message: '引擎层禁止直接依赖 store 层，应通过 core/data 或 DataBridge',
          context: trimmed!.slice(0, 80),
        })
      }

      // v2.0 规则 5b：services 层禁止动态 import store
      const dynamicStoreMatch = raw?.match(DYNAMIC_IMPORT_STORE_PATTERN)
      if (dynamicStoreMatch && !rel.includes('__tests__') && !rel.includes('.test.')) {
        violations.push({
          file: rel,
          line: i + 1,
          column: (dynamicStoreMatch.index ?? 0) + 1,
          type: 'services 动态导入 store',
          message: '引擎层禁止动态导入 store 层',
          context: trimmed!.slice(0, 80),
        })
      }

      // v2.2 规则 5c：services 层禁止依赖 lib 中的业务模块（仅允许基础设施）
      const libBusinessMatch = raw?.match(SERVICES_IMPORT_LIB_BUSINESS)
      if (libBusinessMatch && !rel.includes('__tests__') && !rel.includes('.test.')) {
        violations.push({
          file: rel,
          line: i + 1,
          column: (libBusinessMatch.index ?? 0) + 1,
          type: 'services 依赖 lib 业务模块',
          message: '引擎层仅可依赖 lib 中的基础设施（logger/withBroadcast/eventBus/format/errors/utils/localStorageManager）',
          context: trimmed!.slice(0, 80),
        })
      }
    }

    // v2.0 规则 6：lib 层禁止依赖上层（services/store/pages/components）
    if (rel.startsWith('src/lib/')) {
      const libUpperMatch = raw?.match(LIB_IMPORT_UPPER_LAYER)
      if (libUpperMatch && !rel.includes('__tests__') && !rel.includes('.test.')) {
        violations.push({
          file: rel,
          line: i + 1,
          column: (libUpperMatch.index ?? 0) + 1,
          type: 'lib 层依赖上层',
          message: '基础设施层禁止依赖业务层（services/store/pages/components）',
          context: trimmed!.slice(0, 80),
        })
      }
    }

    // v2.0 规则 7：constants 层禁止依赖任何业务层
    if (rel.startsWith('src/constants/')) {
      const constantsBusinessMatch = raw?.match(CONSTANTS_IMPORT_BUSINESS)
      if (constantsBusinessMatch && !rel.includes('__tests__') && !rel.includes('.test.')) {
        violations.push({
          file: rel,
          line: i + 1,
          column: (constantsBusinessMatch.index ?? 0) + 1,
          type: 'constants 层依赖业务层',
          message: '常量层必须零依赖，禁止导入任何业务模块',
          context: trimmed!.slice(0, 80),
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

/** 扫描函数（白盒导出，供测试和外部调用） */
export function scan(): Report {
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

/** 格式化人类可读报告（输出到 stderr） */
export function formatReport(report: Report): string {
  const lines: string[] = []

  lines.push('╔════════════════════════════════════════════════════════════╗')
  lines.push('║  跨层调用审计 — audit-layer-calls.ts v3.0                  ║')
  lines.push('╚════════════════════════════════════════════════════════════╝')
  lines.push('')

  if (report.violations.length === 0 && report.warnings.length === 0) {
    lines.push(colorize('✅ 未发现跨层调用违规或警告', 'green'))
  } else {
    if (report.violations.length > 0) {
      lines.push(colorize(`🔴 发现 ${report.violations.length} 处跨层调用违规：`, 'red'))
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

    if (report.warnings.length > 0) {
      lines.push(colorize(`⚠️  发现 ${report.warnings.length} 处过渡期的读数据层警告：`, 'yellow'))
      lines.push('')
      for (const item of report.warnings) {
        lines.push(`  ${item.file}:${item.line}:${item.column}`)
        lines.push(`    [${item.type}] ${item.message}`)
        lines.push(`    ${item.context}`)
        lines.push('')
      }
      lines.push('按警告类型汇总：')
      for (const [type, count] of Object.entries(report.summary.byWarningType)) {
        lines.push(`  ${type}: ${count}`)
      }
      lines.push('')
    }
  }

  lines.push('────────────────────────────────────────────────────────────')
  lines.push(`扫描文件数: ${report.summary.totalFiles}`)
  lines.push(`违规数: ${report.summary.totalViolations}`)
  lines.push(`警告数: ${report.summary.totalWarnings}`)
  lines.push('────────────────────────────────────────────────────────────')

  return lines.join('\n')
}

/** CLI 入口（编排：scan → stdout JSON → stderr 诊断 → 持久化 → exit） */
export function main(): void {
  const result = runAuditPipeline<Report>({
    scriptName: 'audit-layer-calls',
    version: '3.0',
    scanFn: scan,
    formatReportFn: formatReport,
  })
  process.exit(result.exitCode)
}

// 仅在直接作为 CLI 运行时执行（避免被 import 时自动运行）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
