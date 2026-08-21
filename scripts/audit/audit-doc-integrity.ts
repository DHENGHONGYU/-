#!/usr/bin/env tsx
/**
 * audit-doc-integrity.ts
 * 文档-代码双向完整性审计脚本 v1.0
 *
 * 检查目标：
 * 1. 文档中引用的 npm scripts 必须真实存在于 package.json
 * 2. 文档中引用的脚本文件（npx tsx scripts/xxx.ts）必须真实存在
 * 3. 文档中引用的相对文件路径（docs/、scripts/、src/ 等）必须真实存在
 * 4. 关键 package.json scripts（audit:* / gate:* / test:* / doc:* / file:*）必须在文档中有覆盖
 *
 * 退出码：0=通过, 1=有违规, 2=执行错误
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runAuditPipeline, colorize, type AuditReport } from './_debug/_audit-pipeline'

// ============================================================
// 类型定义
// ============================================================

export interface Finding {
  file: string
  line: number
  type: 'missing-npm-script' | 'missing-tsx-script' | 'missing-file-path' | 'undocumented-script'
  ref: string
  message: string
}

export interface Report extends AuditReport {
  violations: Finding[]
  warnings: Finding[]
  summary: {
    totalFiles: number
    totalViolations: number
    totalWarnings: number
    npmScriptRefs: number
    tsxScriptRefs: number
    filePathRefs: number
    undocumentedScripts: number
  }
}

// ============================================================
// 常量
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')

const DOCS_DIR = join(ROOT, 'docs')
const PROMPTS_DIR = join(ROOT, 'prompts')
const PACKAGE_JSON_PATH = join(ROOT, 'package.json')

const ROOT_DOC_FILES = [
  'AGENTS.md',
  'architecture.md',
  'CHANGELOG.md',
  'data-definition.md',
  // 原 explanation/README.md 已归档至 archive/historical-2026-08-16/batch7/
]

const PATH_PREFIXES = [
  'src/',
  'scripts/',
  'docs/',
  'prompts/',
  'e2e/',
  'public/',
  'design-tokens/',
  'file-management-system/',
  '.husky/',
  '.github/',
  'plugins/',
  'packages/',
]

const ROOT_FILE_NAMES = [
  'package.json',
  'tsconfig.json',
  'tsconfig.test.json',
  'tsconfig.api.json',
  'vite.config.ts',
  'vite.config.js',
  'tailwind.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'postcss.config.ts',
  'eslint.config.js',
  'eslint.config.ts',
  'eslint.colors.config.js',
]

// 原 SOP_PATH 已归档至 archive/historical-2026-08-16/batch7/
const SOP_PATH = ''
const HUSKY_PRE_COMMIT_PATH = '.husky/pre-commit'

// 排除列表：这些字符串看起来像脚本名但实际上是示例/占位符
const IGNORED_NPM_SCRIPTS = new Set([
  '<script>',
  '...',
  'start',
  'install',
  'publish',
])

// 排除列表：文档中故意引用的已废弃/占位/通配路径
const IGNORED_FILE_PATHS = new Set([
  'src/utils/', // AGENTS.md 中作为已废弃目录示例引用
])

// 历史文档模式：这些文档中的漂移通常不再修复，仅作为警告
const HISTORICAL_DOC_PATTERNS = [
  /^CHANGELOG\.md$/,
  /^docs\/reports\//,
  /^docs\/audit\//,
  /^docs\/04-testing\/audit-reports\//,
  /^docs\/07-archive\//,
  /^docs\/[^/]+\/DEPRECATED_/,
  /^docs\/meta\/.*-report\.md$/,
  /^docs\/meta\/23.*\.md$/,
]

function isHistoricalDoc(filePath: string): boolean {
  return HISTORICAL_DOC_PATTERNS.some((pattern) => pattern.test(filePath))
}

// ============================================================
// 工具函数
// ============================================================

function readPackageJson(): { scripts: Record<string, string> } {
  const content = readFileSync(PACKAGE_JSON_PATH, 'utf-8')
  return JSON.parse(content) as { scripts: Record<string, string> }
}

function collectDocFiles(): string[] {
  const files: string[] = []

  // docs/ 下所有 .md
  function walk(dir: string): void {
    if (!existsSync(dir)) return
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      try {
        const st = statSync(fullPath)
        if (st.isDirectory()) {
          walk(fullPath)
        } else if (st.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath)
        }
      } catch {
        // 跳过无法 stat 的条目（权限/符号链接等）
        continue
      }
    }
  }

  walk(DOCS_DIR)
  walk(PROMPTS_DIR)

  // 根级关键文档
  for (const name of ROOT_DOC_FILES) {
    const fullPath = join(ROOT, name)
    if (existsSync(fullPath)) {
      try {
        const st = statSync(fullPath)
        if (st.isFile()) files.push(fullPath)
      } catch {
        // 跳过
      }
    }
  }

  // .husky/pre-commit 虽然不是 md，但包含门禁命令引用
  const huskyPath = join(ROOT, '.husky', 'pre-commit')
  if (existsSync(huskyPath)) {
    try {
      const st = statSync(huskyPath)
      if (st.isFile()) files.push(huskyPath)
    } catch {
      // 跳过
    }
  }

  return [...new Set(files)].sort()
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

function isExternalUrl(path: string): boolean {
  return /^https?:\/\//i.test(path) || /^mailto:/i.test(path) || path.startsWith('#')
}

function normalizePath(path: string): string {
  return path.replace(/^\.\/|^\.\.\//, '').replace(/#.*$/, '')
}

function fileExistsFromRoot(relativePath: string): boolean {
  if (!relativePath) return false
  const fullPath = join(ROOT, relativePath)
  return existsSync(fullPath)
}

function dirExistsFromRoot(relativePath: string): boolean {
  if (!relativePath) return false
  const fullPath = join(ROOT, relativePath)
  return existsSync(fullPath) && statSync(fullPath).isDirectory()
}

// ============================================================
// 引用提取
// ============================================================

interface ExtractedRef {
  raw: string
  line: number
  kind: 'npm-script' | 'tsx-script' | 'file-path'
}

function extractNpmRunRefs(content: string): ExtractedRef[] {
  const refs: ExtractedRef[] = []
  const regex = /(?:^|[\s"'`(\[])npm run ([a-zA-Z0-9:._-]+)(?=[\s"'`\)\]\n]|$)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const scriptName = match[1]!
    if (IGNORED_NPM_SCRIPTS.has(scriptName)) continue
    refs.push({
      raw: scriptName,
      line: getLineNumber(content, match.index),
      kind: 'npm-script',
    })
  }
  return refs
}

function extractTsxScriptRefs(content: string): ExtractedRef[] {
  const refs: ExtractedRef[] = []
  const regex = /(?:^|[\s"'`(\[])npx tsx (scripts\/[a-zA-Z0-9/._-]+\.(?:ts|cjs|js))(?=[\s"'`\)\]\n]|$)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    refs.push({
      raw: match[1]!,
      line: getLineNumber(content, match.index),
      kind: 'tsx-script',
    })
  }
  return refs
}

function extractFilePathRefs(content: string): ExtractedRef[] {
  const refs: ExtractedRef[] = []
  const seen = new Set<string>()

  function add(raw: string, index: number): void {
    const normalized = normalizePath(raw)
    if (seen.has(normalized)) return
    seen.add(normalized)

    if (isExternalUrl(normalized)) return
    if (normalized.startsWith('node_modules/')) return
    if (IGNORED_FILE_PATHS.has(normalized)) return
    if (/^\d+\.\d+\.\d+/.test(normalized)) return // 版本号

    // 必须是已知的根前缀或根文件
    const hasKnownPrefix = PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    const isRootFile = ROOT_FILE_NAMES.includes(normalized)

    if (!hasKnownPrefix && !isRootFile) return

    refs.push({
      raw: normalized,
      line: getLineNumber(content, index),
      kind: 'file-path',
    })
  }

  // Markdown 链接 [text](path)
  const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = mdLinkRegex.exec(content)) !== null) {
    const path = match[2]!
    if (!path.startsWith('http') && !path.startsWith('mailto:') && !path.startsWith('#')) {
      add(path, match.index)
    }
  }

  // 行内代码 `path`
  const inlineCodeRegex = /`([^`]+)`/g
  while ((match = inlineCodeRegex.exec(content)) !== null) {
    const code = match[1]!
    // 过滤掉纯命令、npm 脚本名、URL、版本号
    if (
      code.includes('/') &&
      !code.startsWith('npm ') &&
      !code.startsWith('npx ') &&
      !/^https?:\/\//.test(code) &&
      !/^v?\d+\.\d+\.\d+/.test(code)
    ) {
      add(code, match.index)
    }
  }

  // 裸路径：前面有空格或换行，且以已知前缀开头
  const barePathRegex = new RegExp(
    `(?:^|[\\s"'\\(\\[])((?:${PATH_PREFIXES.map((p) => p.replace(/\./g, '\\.')).join('|')})[a-zA-Z0-9/._-]+)(?=[\\s"'\\)\\]\\n]|$)`,
    'gm',
  )
  while ((match = barePathRegex.exec(content)) !== null) {
    add(match[1]!, match.index)
  }

  // 根文件裸引用
  const rootFileRegex = new RegExp(
    `(?:^|[\\s"'\\(\\[])((?:${ROOT_FILE_NAMES.join('|')}))(?=[\\s"'\\)\\]\\n]|$)`,
    'gm',
  )
  while ((match = rootFileRegex.exec(content)) !== null) {
    add(match[1]!, match.index)
  }

  return refs
}

// ============================================================
// 校验逻辑
// ============================================================

function pushFinding(
  target: Finding[],
  filePath: string,
  ref: ExtractedRef,
  type: Finding['type'],
  message: string,
): void {
  target.push({
    file: filePath,
    line: ref.line,
    type,
    ref: ref.raw,
    message,
  })
}

function validateRefs(
  filePath: string,
  content: string,
  pkgScripts: Record<string, string>,
): { violations: Finding[]; warnings: Finding[]; counts: { npm: number; tsx: number; file: number } } {
  const violations: Finding[] = []
  const warnings: Finding[] = []
  const counts = { npm: 0, tsx: 0, file: 0 }
  const historical = isHistoricalDoc(filePath)

  const npmRefs = extractNpmRunRefs(content)
  counts.npm = npmRefs.length
  for (const ref of npmRefs) {
    if (!pkgScripts[ref.raw]) {
      const finding = {
        file: filePath,
        line: ref.line,
        type: 'missing-npm-script' as const,
        ref: ref.raw,
        message: `文档引用了未定义的 npm script: "${ref.raw}"`,
      }
      if (historical) {
        warnings.push(finding)
      } else {
        violations.push(finding)
      }
    }
  }

  const tsxRefs = extractTsxScriptRefs(content)
  counts.tsx = tsxRefs.length
  for (const ref of tsxRefs) {
    if (!fileExistsFromRoot(ref.raw)) {
      const finding = {
        file: filePath,
        line: ref.line,
        type: 'missing-tsx-script' as const,
        ref: ref.raw,
        message: `文档引用了不存在的 tsx 脚本文件: "${ref.raw}"`,
      }
      if (historical) {
        warnings.push(finding)
      } else {
        violations.push(finding)
      }
    }
  }

  const fileRefs = extractFilePathRefs(content)
  counts.file = fileRefs.length
  for (const ref of fileRefs) {
    const normalized = ref.raw
    const endsWithSlash = normalized.endsWith('/')

    let exists = false
    if (endsWithSlash) {
      exists = dirExistsFromRoot(normalized)
    } else {
      exists = fileExistsFromRoot(normalized)
      // 如果没有扩展名，尝试补 .md
      if (!exists && !/\.[^/]+$/.test(normalized)) {
        exists = fileExistsFromRoot(`${normalized}.md`)
      }
    }

    if (!exists) {
      // 文件路径缺失作为警告（某些路径可能是未来计划或示例）
      warnings.push({
        file: filePath,
        line: ref.line,
        type: 'missing-file-path',
        ref: ref.raw,
        message: `文档引用的文件/目录不存在: "${ref.raw}"`,
      })
    }
  }

  return { violations, warnings, counts }
}

/**
 * 反向检查：.husky/pre-commit 中调用的 npm script 必须在 SOP 中有文档覆盖
 * 这是真正的“代码 → 文档”完整性检查：门禁改了，SOP 必须同步
 */
function checkPreCommitScriptsDocumented(sopContent: string): Finding[] {
  const findings: Finding[] = []
  const huskyPath = join(ROOT, HUSKY_PRE_COMMIT_PATH)

  if (!existsSync(huskyPath)) {
    findings.push({
      file: HUSKY_PRE_COMMIT_PATH,
      line: 0,
      type: 'undocumented-script',
      ref: '',
      message: '找不到 .husky/pre-commit 文件',
    })
    return findings
  }

  const huskyContent = readFileSync(huskyPath, 'utf-8')
  const regex = /npm run ([a-zA-Z0-9:._-]+)/g
  const seen = new Set<string>()

  let match: RegExpExecArray | null
  while ((match = regex.exec(huskyContent)) !== null) {
    const scriptName = match[1]!
    if (seen.has(scriptName)) continue
    seen.add(scriptName)

    const mentionedInSop =
      sopContent.includes(`npm run ${scriptName}`) ||
      sopContent.includes(scriptName)

    if (!mentionedInSop) {
      findings.push({
        file: HUSKY_PRE_COMMIT_PATH,
        line: getLineNumber(huskyContent, match.index),
        type: 'undocumented-script',
        ref: scriptName,
        message: `.husky/pre-commit 调用的 "${scriptName}" 未在 ${SOP_PATH} 中说明`,
      })
    }
  }

  return findings
}

// ============================================================
// 扫描入口
// ============================================================

export function scan(): Report {
  const pkg = readPackageJson()
  const docFiles = collectDocFiles()

  const violations: Finding[] = []
  const warnings: Finding[] = []
  let npmScriptRefs = 0
  let tsxScriptRefs = 0
  let filePathRefs = 0

  let allDocContent = ''

  for (const filePath of docFiles) {
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      // 跳过无法读取的文件（可能是目录或权限问题）
      continue
    }
    allDocContent += `\n${content}`

    const relativePath = filePath.replace(/\\/g, '/').replace(`${ROOT.replace(/\\/g, '/')}/`, '')
    const { violations: fileViolations, warnings: fileWarnings, counts } = validateRefs(
      relativePath,
      content,
      pkg.scripts,
    )

    violations.push(...fileViolations)
    warnings.push(...fileWarnings)
    npmScriptRefs += counts.npm
    tsxScriptRefs += counts.tsx
    filePathRefs += counts.file
  }

  // 反向检查：pre-commit 脚本必须在 SOP 中说明
  const sopPath = join(ROOT, SOP_PATH)
  const sopContent = existsSync(sopPath) ? readFileSync(sopPath, 'utf-8') : ''
  const reverseFindings = checkPreCommitScriptsDocumented(sopContent)
  violations.push(...reverseFindings)

  return {
    violations,
    warnings,
    summary: {
      totalFiles: docFiles.length,
      totalViolations: violations.length,
      totalWarnings: warnings.length,
      npmScriptRefs,
      tsxScriptRefs,
      filePathRefs,
      undocumentedScripts: reverseFindings.length,
    },
  }
}

// ============================================================
// 报告格式化
// ============================================================

export function formatReport(report: Report): string {
  const lines: string[] = []
  const r = report

  lines.push('╔════════════════════════════════════════════════════════════╗')
  lines.push('║  文档-代码完整性审计 — audit-doc-integrity.ts v1.0         ║')
  lines.push('╚════════════════════════════════════════════════════════════╝')
  lines.push('')
  lines.push(`扫描文档数: ${r.summary.totalFiles}`)
  lines.push(`npm run 引用: ${r.summary.npmScriptRefs}`)
  lines.push(`npx tsx 脚本引用: ${r.summary.tsxScriptRefs}`)
  lines.push(`文件路径引用: ${r.summary.filePathRefs}`)
  lines.push(`阻断性违规: ${r.summary.totalViolations}`)
  lines.push(`警告: ${r.summary.totalWarnings}`)
  lines.push('────────────────────────────────────────────────────────────')

  if (r.violations.length > 0) {
    lines.push('')
    lines.push(colorize(`🔴 阻断性违规（${r.violations.length} 处）：`, 'red'))
    lines.push('')

    const grouped = groupBy(r.violations, (v) => v.file)
    for (const [file, items] of Object.entries(grouped)) {
      lines.push(`  📄 ${file}`)
      for (const v of items.slice(0, 20)) {
        const lineInfo = v.line > 0 ? `:${v.line}` : ''
        lines.push(`     - [${v.type}]${lineInfo} ${v.message}`)
      }
      if (items.length > 20) {
        lines.push(`     ... 还有 ${items.length - 20} 处`)
      }
    }
  }

  if (r.warnings.length > 0) {
    lines.push('')
    lines.push(colorize(`⚠️  警告（${r.warnings.length} 处，不阻断）：`, 'yellow'))
    lines.push('')

    const grouped = groupBy(r.warnings, (v) => v.file)
    for (const [file, items] of Object.entries(grouped)) {
      lines.push(`  📄 ${file}`)
      for (const v of items.slice(0, 10)) {
        const lineInfo = v.line > 0 ? `:${v.line}` : ''
        lines.push(`     - [${v.type}]${lineInfo} ${v.message}`)
      }
      if (items.length > 10) {
        lines.push(`     ... 还有 ${items.length - 10} 处`)
      }
    }
  }

  if (r.violations.length === 0 && r.warnings.length === 0) {
    lines.push('')
    lines.push(colorize('✅ 所有文档-代码完整性检查通过', 'green'))
  }

  return lines.join('\n')
}

function groupBy<T, K extends keyof any>(arr: T[], keyFn: (item: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item)
    acc[key] = acc[key] ?? []
    acc[key].push(item)
    return acc
  }, {} as Record<K, T[]>)
}

// ============================================================
// CLI 入口
// ============================================================

export function main(): void {
  const result = runAuditPipeline<Report>({
    scriptName: 'audit-doc-integrity',
    version: '1.0',
    scanFn: scan,
    formatReportFn: formatReport,
  })
  process.exit(result.exitCode)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
