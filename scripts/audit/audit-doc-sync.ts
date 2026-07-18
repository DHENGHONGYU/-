#!/usr/bin/env tsx
/**
 * audit-doc-sync.ts
 * 代码-文档同步审计脚本 v3.0（白盒/透明管道）
 *
 * 检查目标：
 * 扫描 src/ 中新增/修改的文件，检查是否已在文档
 * （docs/ 全树、CHANGELOG.md、AGENTS.md）中得到体现。
 *
 * v3.0 改造（2026-07-06）：
 * - 采用白盒/透明管道模式：export scan() / formatReport() / main()
 * - stdout 输出 JSON 数据流（机器可读）
 * - stderr 输出诊断日志 + 人类可读报告
 * - 持久化报告到 docs/reports/audit/audit-doc-sync-{timestamp}.json
 * - 支持 CLI 参数：--json / --quiet / --output / --no-persist
 * - 测试可直接 import scan() 验证 Report 对象，无需解析字符串
 *
 * v2.1 增强：
 * - 排除常见但无意义的短词，避免误判为"已文档化"
 * - 自动排除的文件模式（无需文档化的内部实现文件）
 *
 * 输出契约：
 * - stdout：JSON 数据流（AuditReport 结构）
 * - stderr：诊断日志 + 人类可读报告
 * - 文件：docs/reports/audit/audit-doc-sync-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规, 2=执行错误
 */

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runAuditPipeline, colorize, type AuditReport } from './_debug/_audit-pipeline'

export interface Finding {
  file: string
  type: string
  message: string
}

export interface Report extends AuditReport {
  violations: Finding[]
  summary: {
    totalFiles: number
    totalViolations: number
    scanMode: 'changed' | 'all'
    docFilesCount: number
  }
}

import { dirname } from 'node:path'
const ROOT = dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts(?:[\\/][^\\/]+)*$/, '')
const SRC_DIR = join(ROOT, 'src')
const DOCS_DIR = join(ROOT, 'docs')

// v2.1 增强：排除常见但无意义的短词，避免误判为"已文档化"
const COMMON_NOISE_WORDS = new Set([
  'index', 'utils', 'helpers', 'types', 'constants', 'config',
  'components', 'pages', 'services', 'store', 'core', 'lib',
  'ui', 'hooks', 'assets', 'styles', 'shared', 'common',
  'test', 'mock', 'fixtures', 'setup', 'teardown',
])

// v2.1 增强：自动排除的文件模式（无需文档化的内部实现文件）
const AUTO_EXCLUDED_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /\.d\.ts$/,
  /\/__tests__\//,
  /\/__mocks__\//,
  /\/fixtures\//,
  /mock[A-Z]/,           // mock 开头的文件（如 mockProvider.ts）
  /\.prompt\.ts$/,       // LLM prompt 模板文件
  /\.types\.ts$/,        // 纯类型文件（如 foo.types.ts）
  /\/types\.ts$/,        // 独立 types.ts 文件（如 data/types.ts）
  /\/utils\.ts$/,        // 独立 utils.ts 文件（如 lib/utils.ts）
  /\/config\.ts$/,       // 独立 config.ts 文件（如 v6-engine/config.ts）
  /index\.ts$/,          // barrel 文件
  // 纯端点/监控配置常量文件，本身即文档
  /[A-Z][a-zA-Z]*Endpoints\.ts$/,
  /[A-Z][a-zA-Z]*Monitoring\.ts$/,
]

function collectDocs(dir: string, docFiles: Set<string>): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    // 目录不存在或无权限时静默返回（边界条件健壮性）
    return
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      collectDocs(fullPath, docFiles)
    } else if (entry.endsWith('.md')) {
      docFiles.add(fullPath)
    }
  }
}

function getChangedFiles(since = 'HEAD~1'): string[] {
  try {
    const output = execSync(`git diff --name-only ${since} HEAD`, { encoding: 'utf-8', cwd: ROOT })
    return output.split('\n').filter((line) => line.startsWith('src/'))
  } catch {
    // 该脚本仅在 CLI / CI 中运行，非生产 UI 路径；使用 console.warn 可直接提示审计人员
    // git 环境异常时的降级行为，避免引入额外日志依赖。
    console.warn('⚠️  无法获取 git diff，尝试扫描全部 src 文件')
    return []
  }
}

function scanAllSrcFiles(dir: string): string[] {
  const result: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    // 目录不存在或无权限时返回空列表（边界条件健壮性）
    return result
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      result.push(...scanAllSrcFiles(fullPath))
    } else if (['.ts', '.tsx'].includes(extname(entry))) {
      result.push(relative(ROOT, fullPath).replace(/\\/g, '/'))
    }
  }
  return result
}

function isLikelyReferenced(filePath: string, allDocContent: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  const fileName = normalized.split('/').pop() ?? ''
  const baseName = fileName.replace(/\.(ts|tsx)$/, '')
  const parts = normalized.split('/')

  // 直接路径引用（完整路径）- 优先级最高，不受噪音词影响
  if (allDocContent.includes(normalized)) return true

  // v2.1 增强：过滤常见噪音词，避免误判
  if (COMMON_NOISE_WORDS.has(baseName.toLowerCase())) {
    return false
  }

  // v2.1 增强：文件名引用需要至少出现 2 次或伴随描述性文本
  // 避免单个常见词（如 "utils"）的误判
  const nameMatches = allDocContent.split(baseName).length - 1
  if (nameMatches >= 2) return true

  // v2.1 增强：检查是否有描述性段落（> 50 字符的上下文）
  const regex = new RegExp(`.{0,50}${baseName}.{0,50}`, 'g')
  const matches = allDocContent.match(regex)
  if (matches && matches.some(m => m.length > 50)) return true

  // 目录名引用（排除 src 和噪音词）
  for (const part of parts) {
    if (part === 'src' || COMMON_NOISE_WORDS.has(part.toLowerCase())) continue
    if (allDocContent.includes(part)) return true
  }
  return false
}

/** 扫描函数（白盒导出，供测试和外部调用） */
export function scan(): Report {
  // 收集文档文件
  const docFiles = new Set<string>()
  collectDocs(DOCS_DIR, docFiles)
  // 仅保留确实位于仓库根的根文档。
  // 注：data-definition.md / architecture.md 已迁移至 docs/ 子树，由 collectDocs(DOCS_DIR) 递归扫描覆盖，此处不再硬编码（避免指向不存在的路径）。
  docFiles.add(join(ROOT, 'CHANGELOG.md'))
  docFiles.add(join(ROOT, 'AGENTS.md'))

  const allDocContent = Array.from(docFiles)
    .filter((p) => {
      try { return statSync(p).isFile() } catch { return false }
    })
    .map((p) => readFileSync(p, 'utf-8'))
    .join('\n')

  // 获取待扫描文件
  let files = getChangedFiles()
  const scanMode: 'changed' | 'all' = files.length > 0 ? 'changed' : 'all'
  if (files.length === 0) {
    files = scanAllSrcFiles(SRC_DIR)
  }

  // v2.1 增强：使用 AUTO_EXCLUDED_PATTERNS 过滤
  const candidates = files.filter((f) => {
    const normalized = f.replace(/\\/g, '/')
    return !AUTO_EXCLUDED_PATTERNS.some(pattern => pattern.test(normalized))
  })

  // 检查每个候选文件是否已在文档中引用
  const violations: Finding[] = []
  for (const file of candidates) {
    if (!isLikelyReferenced(file, allDocContent)) {
      violations.push({
        file,
        type: '未文档化文件',
        message: '文件可能尚未在文档（docs/ 全树、CHANGELOG.md、AGENTS.md）中体现',
      })
    }
  }

  return {
    violations,
    summary: {
      totalFiles: candidates.length,
      totalViolations: violations.length,
      scanMode,
      docFilesCount: docFiles.size,
    },
  }
}

/** 格式化人类可读报告（输出到 stderr） */
export function formatReport(report: Report): string {
  const r = report
  const lines: string[] = []

  lines.push('╔════════════════════════════════════════════════════════════╗')
  lines.push('║  代码-文档同步审计 — audit-doc-sync.ts v3.0                ║')
  lines.push('╚════════════════════════════════════════════════════════════╝')
  lines.push('')
  lines.push(`扫描模式: ${r.summary.scanMode === 'changed' ? 'git diff (HEAD~1..HEAD)' : '全量 src 扫描'}`)
  lines.push(`扫描文件数: ${r.summary.totalFiles}`)
  lines.push(`文档文件数: ${r.summary.docFilesCount}`)
  lines.push(`疑似未文档化文件: ${r.summary.totalViolations}`)
  lines.push('────────────────────────────────────────────────────────────')

  if (r.violations.length > 0) {
    lines.push('')
    lines.push(colorize(`🔴 以下 ${r.violations.length} 个文件可能尚未在文档中体现：`, 'red'))
    lines.push('')
    for (const item of r.violations.slice(0, 50)) {
      lines.push(`  - ${item.file}`)
    }
    if (r.violations.length > 50) {
      lines.push(`  ... 还有 ${r.violations.length - 50} 个文件`)
    }
    lines.push('')
    lines.push(colorize('⚠️  建议：为新增模块补充数据字典/架构说明，并更新 CHANGELOG.md', 'yellow'))
  } else {
    lines.push('')
    lines.push(colorize('✅ 所有扫描文件均已在文档中找到引用', 'green'))
  }

  return lines.join('\n')
}

/** CLI 入口（编排：scan → stdout JSON → stderr 诊断 → 持久化 → exit） */
export function main(): void {
  const result = runAuditPipeline<Report>({
    scriptName: 'audit-doc-sync',
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
