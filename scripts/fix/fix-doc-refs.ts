#!/usr/bin/env tsx
/**
 * fix-doc-refs.ts
 * 自动校正文档中的跨文档错路径（P1 任务）
 *
 * 配套：scripts/audit-doc-integrity.ts v1.2
 * 消费其 "missing-file-path" 类警告（活跃文档的 .md 链接断链 + 历史/裸路径错引用），
 * 通过以下策略定位正确目标文件并将引用改写为正确的相对路径：
 *   1. basename 唯一匹配：绝大多数错路径只是目录迁移/改名，文件名（含扩展名）保持不变
 *   2. 无扩展名时回退补 .md 再匹配
 *   3. 同名多候选：用原引用中的目录线索（dirname）二次过滤，仍 >1 则判为歧义（不自动改）
 *   4. basename 也无匹配：模糊相似度（Levenshtein ratio ≥ 阈值）兜底，唯一高相似则采用
 *
 * 安全策略：
 *   - 默认 dry-run：仅报告，绝不写盘
 *   - --apply 才真正写盘；写前对每个被改文件生成 `.fixbak` 旁位备份（--no-backup 关闭）
 *   - 仅当目标「唯一确定」时才自动改写；歧义 / 无匹配 → 列入待人工清单
 *
 * 用法：
 *   node ./node_modules/tsx/dist/cli.mjs scripts/fix-doc-refs.ts [选项]
 *   选项：
 *     --apply            真正写盘（默认 dry-run）
 *     --scope <s>        active(默认) | historical | all  扫描范围
 *     --threshold <0-1>  模糊匹配相似度阈值（默认 0.8）
 *     --report <path>    输出 JSON 报告到指定路径
 *     --no-backup        写盘时不生成 .fixbak 备份
 *     --help             显示帮助
 *
 * 退出码：0（本脚本为修复辅助工具，不阻断；即使有未解决项也返回 0）
 * 版本：v1.0
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
} from 'node:fs'
import { readTextAdaptive, writeTextUtf8 } from '../lib/encoding'
import { join, resolve, dirname, relative, basename, extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ============================================================
// 路径与常量（与 audit-doc-integrity.ts v1.2 对齐）
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const DOCS_DIR = join(ROOT, 'docs')
const PROMPTS_DIR = join(ROOT, 'prompts')

const ROOT_DOC_FILES = [
  'AGENTS.md',
  'architecture.md',
  'CHANGELOG.md',
  'data-definition.md',
  'docs/explanation/README.md',
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

// 文档中故意引用的已废弃/占位/通配路径 → 跳过
const IGNORED_FILE_PATHS = new Set(['src/utils/'])

// 历史文档模式：其中的漂移通常不再修复（写盘时默认跳过，除非 --scope all）
const HISTORICAL_DOC_PATTERNS = [
  /^CHANGELOG\.md$/,
  /^docs\/reports\//,
  /^docs\/audit\//,
  /^docs\/04-testing\/audit-reports\//,
  /^docs\/07-archive\//,
  /^docs\/[^/]+\/DEPRECATED_/,
  /^docs\/00-meta\/.*-report\.md$/,
  /^docs\/00-meta\/23.*\.md$/,
]

// 构建目标注册表时跳过的重型 / 无关目录
const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.workbuddy',
])

// ============================================================
// 类型
// ============================================================

type Scope = 'active' | 'historical' | 'all'

interface ExtractedRef {
  /** 源文件中逐字出现的引用片段（含可能的 ./ 前缀与 #anchor） */
  original: string
  /** 归一化后的引用（去 ./、../、#anchor），用于匹配 */
  normalized: string
  line: number
  kind: 'md-link' | 'inline-code' | 'bare-path'
  /** 从 original 中析出的锚点（不含 #），无则为 '' */
  anchor: string
  /** 从 original 中析出的行号引用（不含 :，形如 123），无则为 '' */
  lineRef: string
}

interface FixItem {
  file: string
  line: number
  kind: ExtractedRef['kind']
  oldRef: string
  newRef: string
}

interface AmbiguousItem {
  file: string
  line: number
  oldRef: string
  candidates: string[]
}

interface NotFoundItem {
  file: string
  line: number
  oldRef: string
}

interface ScanResult {
  scannedFiles: number
  brokenRefs: number
  fixed: FixItem[]
  ambiguous: AmbiguousItem[]
  notFound: NotFoundItem[]
  skipped: number
}

// ============================================================
// 工具函数
// ============================================================

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

function isExternalUrl(p: string): boolean {
  return /^https?:\/\//i.test(p) || /^mailto:/i.test(p) || p.startsWith('#')
}

function normalizePath(p: string): string {
  return p.replace(/^\.\//, '').replace(/^\.\.\//, '').replace(/#.*$/, '')
}

function fileExistsFromRoot(rel: string): boolean {
  if (!rel) return false
  return existsSync(join(ROOT, rel))
}

function dirExistsFromRoot(rel: string): boolean {
  if (!rel) return false
  const full = join(ROOT, rel)
  return existsSync(full) && statSync(full).isDirectory()
}

function isHistoricalDoc(filePath: string): boolean {
  return HISTORICAL_DOC_PATTERNS.some((re) => re.test(filePath))
}

// ============================================================
// 目标文件注册表（basename → 相对路径列表）
// ============================================================

const basenameMap = new Map<string, string[]>()
const dirBasenameMap = new Map<string, string[]>()

function registerFile(absPath: string): void {
  const rel = relative(ROOT, absPath).replace(/\\/g, '/')
  const base = basename(rel)
  const list = basenameMap.get(base) ?? []
  list.push(rel)
  basenameMap.set(base, list)
}

function registerDir(absPath: string): void {
  const rel = relative(ROOT, absPath).replace(/\\/g, '/')
  if (!rel) return
  const base = basename(rel)
  const list = dirBasenameMap.get(base) ?? []
  list.push(rel)
  dirBasenameMap.set(base, list)
}

function walkRegistry(dir: string): void {
  if (!existsSync(dir)) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue
      registerDir(full)
      walkRegistry(full)
    } else if (entry.isFile()) {
      registerFile(full)
    }
  }
}

function buildRegistry(): void {
  basenameMap.clear()
  dirBasenameMap.clear()
  for (const prefix of PATH_PREFIXES) {
    walkRegistry(join(ROOT, prefix))
  }
  for (const name of ROOT_FILE_NAMES) {
    if (existsSync(join(ROOT, name))) registerFile(join(ROOT, name))
  }
}

// ============================================================
// 字符串相似度（Levenshtein ratio）
// ============================================================

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prevRow = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prevRow[j] = j
  for (let i = 1; i <= m; i++) {
    let prev = prevRow[0]!
    prevRow[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = prevRow[j]!
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      prevRow[j] = Math.min(prevRow[j]! + 1, prevRow[j - 1]! + 1, prev + cost)
      prev = tmp
    }
  }
  return prevRow[n]!
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  if (max === 0) return 1
  return 1 - levenshtein(a, b) / max
}

// ============================================================
// 引用提取（与 audit-doc-integrity.ts 的提取口径一致）
// ============================================================

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isIgnoredRef(normalized: string): boolean {
  if (!normalized) return true
  if (isExternalUrl(normalized)) return true
  if (normalized.startsWith('node_modules/')) return true
  if (IGNORED_FILE_PATHS.has(normalized)) return true
  // glob 模式（含 * 或 ?）不是具体路径，跳过
  if (normalized.includes('*') || normalized.includes('?')) return true
  // 版本号
  if (/^\d+\.\d+\.\d+/.test(normalized)) return true
  const hasKnownPrefix = PATH_PREFIXES.some((p) => normalized.startsWith(p))
  const isRootFile = ROOT_FILE_NAMES.includes(normalized)
  if (!hasKnownPrefix && !isRootFile) return true
  return false
}

function extractRefs(content: string): ExtractedRef[] {
  const refs: ExtractedRef[] = []
  const seen = new Set<string>()

  const push = (original: string, index: number, kind: ExtractedRef['kind']): void => {
    const hashIdx = original.indexOf('#')
    let pathPart = hashIdx >= 0 ? original.slice(0, hashIdx) : original
    const anchor = hashIdx >= 0 ? original.slice(hashIdx + 1) : ''
    // 剥离尾部行号引用（形如 file.ts:123），改写后补回，避免模糊匹配误吞行号
    const lineMatch = pathPart.match(/:(\d+)$/)
    let lineRef = ''
    if (lineMatch) {
      lineRef = `:${lineMatch[1]}`
      pathPart = pathPart.slice(0, lineMatch.index)
    }
    const normalized = normalizePath(pathPart)
    if (isIgnoredRef(normalized)) return
    const key = `${kind}:${normalized}`
    if (seen.has(key)) return
    seen.add(key)
    refs.push({ original, normalized, line: getLineNumber(content, index), kind, anchor, lineRef })
  }

  // 1) Markdown 链接 [text](path)
  const mdLinkRegex = /\[[^\]]*\]\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = mdLinkRegex.exec(content)) !== null) {
    const path = m[1]!
    if (!path.startsWith('http') && !path.startsWith('mailto:') && !path.startsWith('#')) {
      push(path, m.index, 'md-link')
    }
  }

  // 2) 行内代码 `path`
  const inlineCodeRegex = /`([^`]+)`/g
  while ((m = inlineCodeRegex.exec(content)) !== null) {
    const code = m[1]!
    if (
      code.includes('/') &&
      !code.startsWith('npm ') &&
      !code.startsWith('npx ') &&
      !/^https?:\/\//.test(code) &&
      !/^v?\d+\.\d+\.\d+/.test(code)
    ) {
      push(code, m.index, 'inline-code')
    }
  }

  // 3) 裸路径（以已知前缀或根文件名开头）
  const prefixAlt = PATH_PREFIXES.map(escapeRegex).join('|')
  const rootAlt = ROOT_FILE_NAMES.map(escapeRegex).join('|')
  const bareSource = `(?:${prefixAlt}|${rootAlt})[a-zA-Z0-9/._-]*`
  const bareRegex = new RegExp(bareSource, 'g')
  const boundaryRe = /[\s"'([]/
  let bm: RegExpExecArray | null
  while ((bm = bareRegex.exec(content)) !== null) {
    const start = bm.index
    const before = start > 0 ? content[start - 1]! : ''
    if (start > 0 && !boundaryRe.test(before)) continue
    push(bm[0]!, bm.index, 'bare-path')
  }

  return refs
}

// ============================================================
// 存在性判定 + 解析
// ============================================================

function refExists(normalized: string): boolean {
  if (normalized.endsWith('/')) return dirExistsFromRoot(normalized)
  if (fileExistsFromRoot(normalized)) return true
  if (!/\.[^/]+$/.test(normalized)) return fileExistsFromRoot(`${normalized}.md`)
  return false
}

interface Resolved {
  status: 'fixed' | 'ambiguous' | 'notfound'
  target?: string
  candidates?: string[]
}

function fuzzyFind(base: string, threshold: number): string | null {
  let bestKey: string | null = null
  let bestScore = 0
  for (const key of basenameMap.keys()) {
    const s = similarity(base, key)
    if (s > bestScore) {
      bestScore = s
      bestKey = key
    }
  }
  if (bestKey && bestScore >= threshold) {
    const list = basenameMap.get(bestKey)!
    if (list.length === 1) return list[0]!
  }
  return null
}

function resolveRef(normalized: string, threshold: number, fuzzy: boolean): Resolved {
  const base = basename(normalized)
  const triedBases = new Set<string>([base])
  if (!extname(base)) triedBases.add(`${base}.md`)

  let candidates: string[] = []
  for (const b of triedBases) {
    const list = basenameMap.get(b)
    if (list) candidates.push(...list)
  }
  candidates = [...new Set(candidates)]

  if (candidates.length === 0) {
    if (!fuzzy) return { status: 'notfound' }
    const fz = fuzzyFind(base, threshold)
    return fz ? { status: 'fixed', target: fz } : { status: 'notfound' }
  }

  if (candidates.length === 1) {
    return { status: 'fixed', target: candidates[0]! }
  }

  // 同名多候选 → 用原引用的目录线索二次过滤
  const hintDir = dirname(normalized).replace(/^\.\//, '')
  const preferred = candidates.filter((c) => hintDir && c.includes(hintDir))
  if (preferred.length === 1) {
    return { status: 'fixed', target: preferred[0]! }
  }

  // 目录线索无果 → 尝试模糊兜底（针对每个候选的 basename）
  if (fuzzy) {
    const fz = fuzzyFind(base, threshold)
    if (fz && candidates.includes(fz)) {
      return { status: 'fixed', target: fz }
    }
  }

  return { status: 'ambiguous', candidates }
}

// 计算从引用方文件目录到目标文件的相对路径（带 ./ 前缀规范化）
function computeRelativeRef(fromFileRel: string, targetRel: string): string {
  const fromDir = dirname(fromFileRel)
  let rel = relative(fromDir, targetRel).replace(/\\/g, '/')
  if (!rel.startsWith('.') && !/^[A-Za-z]:/.test(rel)) {
    rel = `./${rel}`
  }
  return rel
}

// ============================================================
// 改写应用（按行，最长优先，避免子串误替）
// ============================================================

interface LineFix {
  original: string
  newFull: string
}

function applyFixes(content: string, fixes: FixItem[]): string {
  // 按 file:line 去重（同原始片段只改一次）
  const uniq = new Map<string, FixItem>()
  for (const f of fixes) {
    const key = `${f.file}#${f.line}#${f.oldRef}`
    if (!uniq.has(key)) uniq.set(key, f)
  }

  const byLine = new Map<number, LineFix[]>()
  for (const f of uniq.values()) {
    const lineFixes = byLine.get(f.line) ?? []
    lineFixes.push({ original: f.oldRef, newFull: f.newRef })
    byLine.set(f.line, lineFixes)
  }

  const lines = content.split('\n')
  for (const [lineNo, lineFixes] of byLine) {
    if (lineNo < 1 || lineNo > lines.length) continue
    // 最长优先：先替换更长的原始片段，避免短片段在长片段内部被提前替换
    lineFixes.sort((a, b) => b.original.length - a.original.length)
    let line = lines[lineNo - 1]!
    for (const lf of lineFixes) {
      if (!line.includes(lf.original)) continue
      line = line.replace(lf.original, lf.newFull)
    }
    lines[lineNo - 1] = line
  }
  return lines.join('\n')
}

// ============================================================
// 收集待扫描文档
// ============================================================

function collectDocFiles(): string[] {
  const files: string[] = []
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.md')) files.push(full)
    }
  }
  walk(DOCS_DIR)
  walk(PROMPTS_DIR)
  for (const name of ROOT_DOC_FILES) {
    const full = join(ROOT, name)
    if (existsSync(full)) files.push(full)
  }
  const husky = join(ROOT, '.husky', 'pre-commit')
  if (existsSync(husky)) files.push(husky)
  return [...new Set(files)].sort()
}

// ============================================================
// 扫描主逻辑
// ============================================================

function scan(scope: Scope, threshold: number, fuzzy: boolean): ScanResult {
  const result: ScanResult = {
    scannedFiles: 0,
    brokenRefs: 0,
    fixed: [],
    ambiguous: [],
    notFound: [],
    skipped: 0,
  }

  const docFiles = collectDocFiles()
  for (const absFile of docFiles) {
    const relFile = relative(ROOT, absFile).replace(/\\/g, '/')
    const historical = isHistoricalDoc(relFile)
    if (scope === 'active' && historical) continue
    if (scope === 'historical' && !historical) continue

    const content = readTextAdaptive(absFile)
    result.scannedFiles++
    const refs = extractRefs(content)

    for (const ref of refs) {
      if (refExists(ref.normalized)) continue // 引用有效，跳过
      result.brokenRefs++
      const resolved = resolveRef(ref.normalized, threshold, fuzzy)
      const newRel = resolved.target
        ? computeRelativeRef(relFile, resolved.target)
        : ''
      const newRef = newRel
        ? `${newRel}${ref.lineRef}${ref.anchor ? `#${ref.anchor}` : ''}`
        : ''

      if (resolved.status === 'fixed' && resolved.target) {
        result.fixed.push({
          file: relFile,
          line: ref.line,
          kind: ref.kind,
          oldRef: ref.original,
          newRef,
        })
      } else if (resolved.status === 'ambiguous') {
        result.ambiguous.push({
          file: relFile,
          line: ref.line,
          oldRef: ref.original,
          candidates: resolved.candidates ?? [],
        })
      } else {
        result.notFound.push({
          file: relFile,
          line: ref.line,
          oldRef: ref.original,
        })
      }
    }
  }
  return result
}

// ============================================================
// 写盘
// ============================================================

function applyWrites(result: ScanResult, makeBackup: boolean): string[] {
  // 按文件聚合并一次性重写，避免同一文件多次 IO
  const byFile = new Map<string, FixItem[]>()
  for (const f of result.fixed) {
    const arr = byFile.get(f.file) ?? []
    arr.push(f)
    byFile.set(f.file, arr)
  }

  const written: string[] = []
  for (const [relFile, fixes] of byFile) {
    const abs = join(ROOT, relFile)
    const content = readTextAdaptive(abs)
    const updated = applyFixes(content, fixes)
    if (updated === content) continue
    if (makeBackup) {
      const bak = `${abs}.fixbak`
      if (!existsSync(bak)) copyFileSync(abs, bak)
    }
    writeTextUtf8(abs, updated)
    written.push(relFile)
  }
  return written
}

// ============================================================
// 报告
// ============================================================

function printSummary(result: ScanResult, scope: Scope, apply: boolean, fuzzy: boolean): void {
  const mode = apply ? 'APPLY（已写盘）' : 'DRY-RUN（仅预览）'
  console.log('══════════════════════════════════════════════════════')
  console.log(`  fix-doc-refs v1.0  ·  scope=${scope}  ·  ${mode}  ·  ${fuzzy ? 'fuzzy=on' : 'fuzzy=off'}`)
  console.log('══════════════════════════════════════════════════════')
  console.log(`扫描文档数      : ${result.scannedFiles}`)
  console.log(`断链引用总数    : ${result.brokenRefs}`)
  console.log(`✅ 可自动修复   : ${result.fixed.length}`)
  console.log(`⚠️  歧义(待人工) : ${result.ambiguous.length}`)
  console.log(`❌ 无匹配(待人工): ${result.notFound.length}`)
  console.log('────────────────────────────────────────────────────────')

  if (result.fixed.length > 0) {
    console.log('\n可自动修复（预览 old → new）：')
    const byFile = new Map<string, FixItem[]>()
    for (const f of result.fixed) {
      const arr = byFile.get(f.file) ?? []
      arr.push(f)
      byFile.set(f.file, arr)
    }
    for (const [file, items] of byFile) {
      console.log(`  📄 ${file}`)
      for (const it of items.slice(0, 30)) {
        console.log(`     L${it.line} [${it.kind}] ${it.oldRef}  →  ${it.newRef}`)
      }
      if (items.length > 30) console.log(`     ... 还有 ${items.length - 30} 处`)
    }
  }

  if (result.ambiguous.length > 0) {
    console.log('\n歧义（同名多候选，未自动修改，需人工确认）：')
    for (const a of result.ambiguous.slice(0, 20)) {
      console.log(`  📄 ${a.file}:${a.line}  ${a.oldRef}`)
      for (const c of a.candidates.slice(0, 5)) console.log(`       ↳ ${c}`)
      if (a.candidates.length > 5) console.log(`       ... 还有 ${a.candidates.length - 5} 个候选`)
    }
    if (result.ambiguous.length > 20)
      console.log(`  ... 还有 ${result.ambiguous.length - 20} 处歧义`)
  }

  if (result.notFound.length > 0) {
    console.log('\n无匹配（注册表中找不到对应文件，需人工确认）：')
    for (const n of result.notFound.slice(0, 20)) {
      console.log(`  📄 ${n.file}:${n.line}  ${n.oldRef}`)
    }
    if (result.notFound.length > 20)
      console.log(`  ... 还有 ${result.notFound.length - 20} 处`)
  }
}

function writeReport(result: ScanResult, reportPath: string, scope: Scope, apply: boolean): void {
  const payload = {
    generatedAt: new Date().toISOString(),
    script: 'fix-doc-refs.ts',
    version: '1.0',
    scope,
    mode: apply ? 'apply' : 'dry-run',
    summary: {
      scannedFiles: result.scannedFiles,
      brokenRefs: result.brokenRefs,
      fixed: result.fixed.length,
      ambiguous: result.ambiguous.length,
      notFound: result.notFound.length,
    },
    fixed: result.fixed,
    ambiguous: result.ambiguous,
    notFound: result.notFound,
  }
  const abs = resolve(reportPath)
  const dir = dirname(abs)
  if (!existsSync(dir)) {
    const parts = relative(ROOT, dir).split('/').filter(Boolean)
    let cur = ROOT
    for (const p of parts) {
      cur = join(cur, p)
      if (!existsSync(cur)) mkdirSync(cur)
    }
  }
  writeFileSync(abs, JSON.stringify(payload, null, 2), 'utf-8')
  console.log(`\n📝 JSON 报告已写出: ${reportPath}`)
}

// ============================================================
// CLI
// ============================================================

function showHelp(): void {
  console.log(`fix-doc-refs.ts — 自动校正文档跨文档错路径（P1）

用法:
  node ./node_modules/tsx/dist/cli.mjs scripts/fix-doc-refs.ts [选项]

选项:
  --apply            真正写盘（默认 dry-run，仅预览）
  --scope <s>        active(默认) | historical | all
  --threshold <0-1> 模糊匹配相似度阈值（默认 0.8）
  --no-fuzzy        关闭模糊匹配，仅做 basename 精确匹配（最保守）
  --report <path>    输出 JSON 报告到指定路径
  --no-backup        写盘时不生成 .fixbak 备份
  --help             显示本帮助

安全说明:
  - 默认仅预览，绝不写盘
  - 仅当目标「唯一确定」时才自动改写；歧义 / 无匹配列入待人工清单
  - --apply 写前为每个被改文件生成 .fixbak 旁位备份
`)
}

function parseArgs(argv: string[]): {
  apply: boolean
  scope: Scope
  threshold: number
  report: string | null
  noBackup: boolean
  noFuzzy: boolean
  help: boolean
} {
  const out = {
    apply: false,
    scope: 'active' as Scope,
    threshold: 0.8,
    report: null as string | null,
    noBackup: false,
    noFuzzy: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--apply') out.apply = true
    else if (a === '--no-backup') out.noBackup = true
    else if (a === '--no-fuzzy') out.noFuzzy = true
    else if (a === '--help' || a === '-h') out.help = true
    else if (a === '--scope') out.scope = (argv[++i] ?? 'active') as Scope
    else if (a === '--threshold') out.threshold = Number(argv[++i] ?? '0.8')
    else if (a === '--report') out.report = argv[++i] ?? null
  }
  return out
}

function main(): void {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)
  if (args.help) {
    showHelp()
    process.exit(0)
  }

  buildRegistry()
  const result = scan(args.scope, args.threshold, !args.noFuzzy)
  printSummary(result, args.scope, args.apply, !args.noFuzzy)

  if (args.apply) {
    const written = applyWrites(result, !args.noBackup)
    console.log(`\n💾 已写盘文件数: ${written.length}`)
    if (written.length > 0 && !args.noBackup) {
      console.log('   每个被改文件已生成 .fixbak 备份；如需回滚：git checkout <file> 或恢复 .fixbak')
    }
  } else {
    console.log('\n（dry-run 模式，未做任何修改。加 --apply 才真正写盘）')
  }

  if (args.report) {
    writeReport(result, args.report, args.scope, args.apply)
  }

  process.exit(0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
