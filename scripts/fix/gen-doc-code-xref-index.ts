#!/usr/bin/env tsx
/**
 * gen-doc-code-xref-index.ts
 * 生成"文档↔代码 直接关系快速索引"临时清单。
 *
 * 用途：
 *   - 标志出文档与代码之间有"直接引用关系"的条目，作为二次校对的快速入口。
 *   - 输出双向映射：doc→code（文档引用的代码路径）、code→doc（代码引用的文档/doc_id）。
 *   - 仅记录磁盘上真实存在的引用；断链由 audit-doc-code-references.ts 单独管。
 *
 * 输出：
 *   - docs/meta/doc-code-direct-xref.md（临时治理材料，定期归档/移出）
 *
 * 用法：
 *   npx tsx scripts/fix/gen-doc-code-xref-index.ts
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, resolve, dirname, relative, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanDocReferences, scanCodeReferences, validateReference } from '../docs-tool/cross-ref-engine'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(ROOT, 'docs')
const SRC_DIR = join(ROOT, 'src')
const SCRIPTS_DIR = join(ROOT, 'scripts')
const OUTPUT_PATH = join(DOCS_DIR, 'meta', 'doc-code-direct-xref.md')

interface XrefEntry {
  source: string
  target: string
  line: number
  type: 'doc-to-code' | 'code-to-doc'
  /** 关系强度：强=文件级直接引用，弱=目录/泛指 */
  strength: 'strong' | 'weak'
}

/** 判断引用强度：以具体文件名结尾视为强引用，否则为弱（目录/通配） */
function judgeStrength(target: string): 'strong' | 'weak' {
  // 含具体扩展名视为强
  if (/\.(ts|tsx|js|jsx|json|md|cjs|mjs)$/.test(target)) return 'strong'
  // 含占位/通配视为弱
  if (/[${}<>*]/.test(target)) return 'weak'
  // 尾斜杠目录引用视为弱
  if (target.endsWith('/')) return 'weak'
  // 其它裸路径（无扩展名）默认弱
  return 'weak'
}

function walk(dir: string, cb: (full: string) => void, exts: string[]) {
  if (!existsSync(dir)) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue
    if (e.name === 'node_modules' || e.name === 'archive') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, cb, exts)
    else if (exts.some((ext) => e.name.endsWith(ext))) cb(full)
  }
}

function collect(): XrefEntry[] {
  const out: XrefEntry[] = []

  // doc → code
  walk(DOCS_DIR, (f) => {
    const refs = scanDocReferences(f)
    for (const r of refs) {
      if (r.type !== 'doc-to-code') continue
      if (!validateReference(r, ROOT)) continue // 仅记录有效引用
      out.push({
        source: relative(ROOT, f).replace(/\\/g, '/'),
        target: r.target,
        line: r.line,
        type: 'doc-to-code',
        strength: judgeStrength(r.target),
      })
    }
  }, ['.md'])

  // code → doc
  const codeDirs = [SRC_DIR, SCRIPTS_DIR]
  for (const d of codeDirs) {
    walk(d, (f) => {
      const refs = scanCodeReferences(f)
      for (const r of refs) {
        if (r.type !== 'code-to-doc') continue
        if (!validateReference(r, ROOT)) continue
        out.push({
          source: relative(ROOT, f).replace(/\\/g, '/'),
          target: r.target,
          line: r.line,
          type: 'code-to-doc',
          strength: judgeStrength(r.target),
        })
      }
    }, ['.ts', '.tsx'])
  }

  // 额外：扫描代码中的 @doc [V9-DOC-XXX] 注解（doc_id 级引用）
  const docIdRegex = /@doc\s+\[?(V9-[A-Z]+(?:-[A-Z0-9]+)*)\]?/g
  walk(SRC_DIR, (f) => {
    const content = readFileSync(f, 'utf8')
    const lines = content.split('\n')
    lines.forEach((line, i) => {
      let m: RegExpExecArray | null
      docIdRegex.lastIndex = 0
      while ((m = docIdRegex.exec(line)) !== null) {
        out.push({
          source: relative(ROOT, f).replace(/\\/g, '/'),
          target: m[1],
          line: i + 1,
          type: 'code-to-doc',
          strength: 'strong',
        })
      }
    })
  }, ['.ts', '.tsx'])

  return out
}

function main() {
  const entries = collect()
  const docToCode = entries.filter((e) => e.type === 'doc-to-code')
  const codeToDoc = entries.filter((e) => e.type === 'code-to-doc')

  // 按源文件聚合
  const byDoc = new Map<string, XrefEntry[]>()
  for (const e of docToCode) {
    if (!byDoc.has(e.source)) byDoc.set(e.source, [])
    byDoc.get(e.source)!.push(e)
  }
  const byCode = new Map<string, XrefEntry[]>()
  for (const e of codeToDoc) {
    if (!byCode.has(e.source)) byCode.set(e.source, [])
    byCode.get(e.source)!.push(e)
  }

  // 统计代码被多少文档引用（反向索引：code → docs）
  const codeRefCount = new Map<string, Set<string>>()
  for (const e of docToCode) {
    const key = e.target.replace(/[#:].*$/, '')
    if (!codeRefCount.has(key)) codeRefCount.set(key, new Set())
    codeRefCount.get(key)!.add(e.source)
  }

  const today = new Date().toISOString().slice(0, 10)
  const lines: string[] = []
  lines.push('---')
  lines.push('title: 文档↔代码 直接关系快速索引')
  lines.push('type: meta')
  lines.push('domain: project')
  lines.push('status: active')
  lines.push(`last_updated: ${today}`)
  lines.push('---')
  lines.push('')
  lines.push('# 文档↔代码 直接关系快速索引')
  lines.push('')
  lines.push(`> 生成时间: ${today}`)
  lines.push(`> 用途: 二次校对快速入口，定位文档与代码的直接引用关系`)
  lines.push(`> 性质: 临时治理材料，定期归档/移出，不纳入 doc_id 注册表`)
  lines.push('')
  lines.push('## 统计')
  lines.push('')
  lines.push(`- 文档→代码 引用条目: ${docToCode.length}`)
  lines.push(`- 代码→文档 引用条目: ${codeToDoc.length}`)
  lines.push(`- 涉及文档数（引用代码）: ${byDoc.size}`)
  lines.push(`- 涉及代码数（被文档引用）: ${codeRefCount.size}`)
  lines.push(`- 涉及代码数（引用文档）: ${byCode.size}`)
  lines.push('')

  // ── 1. 文档→代码（按文档聚合，仅强引用）
  lines.push('## 1. 文档 → 代码（强引用，按文档聚合）')
  lines.push('')
  lines.push('> "强引用" = 文档明确引用了具体代码文件（含扩展名），二次校对优先核查。')
  lines.push('')
  const strongDocs = [...byDoc.entries()]
    .map(([src, refs]) => [src, refs.filter((r) => r.strength === 'strong')] as const)
    .filter(([, refs]) => refs.length > 0)
    .sort((a, b) => b[1].length - a[1].length)

  lines.push(`| # | 文档 | 强引用代码数 | 代码路径（前 5 个） |`)
  lines.push(`|---|------|------------|------------------|`)
  strongDocs.forEach(([src, refs], i) => {
    const top5 = refs.slice(0, 5).map((r) => r.target).join('<br>')
    lines.push(`| ${i + 1} | ${src} | ${refs.length} | ${top5} |`)
  })
  lines.push('')

  // ── 2. 代码→文档（按代码聚合，含 doc_id 注解）
  lines.push('## 2. 代码 → 文档（按代码聚合）')
  lines.push('')
  lines.push('> 含 `@doc [V9-DOC-XXX]` 注解和反引号文档路径引用。')
  lines.push('')
  const codeDocs = [...byCode.entries()].sort((a, b) => b[1].length - a[1].length)
  lines.push(`| # | 代码 | 引用文档数 | 引用目标（前 5 个） |`)
  lines.push(`|---|------|---------|------------------|`)
  codeDocs.forEach(([src, refs], i) => {
    const top5 = refs.slice(0, 5).map((r) => r.target).join('<br>')
    lines.push(`| ${i + 1} | ${src} | ${refs.length} | ${top5} |`)
  })
  lines.push('')

  // ── 3. 高频被引代码（hot list，二次校对重点）
  lines.push('## 3. 高频被引代码（被 ≥3 篇文档引用，校对重点）')
  lines.push('')
  const hot = [...codeRefCount.entries()]
    .filter(([, docs]) => docs.size >= 3)
    .sort((a, b) => b[1].size - a[1].size)
  if (hot.length === 0) {
    lines.push('_无高频被引代码_')
  } else {
    lines.push(`| # | 代码路径 | 被引文档数 | 引用文档（前 5 个） |`)
    lines.push(`|---|---------|---------|------------------|`)
    hot.forEach(([code, docs], i) => {
      const top5 = [...docs].slice(0, 5).join('<br>')
      lines.push(`| ${i + 1} | ${code} | ${docs.size} | ${top5} |`)
    })
  }
  lines.push('')

  // ── 4. 使用建议
  lines.push('## 4. 二次校对使用建议')
  lines.push('')
  lines.push('- **高频被引代码**（第 3 节）：代码改动后，必须同步校对引用它的所有文档')
  lines.push('- **强引用文档**（第 1 节）：文档变更时，校对引用的代码路径是否仍存在')
  lines.push('- **代码→文档**（第 2 节）：重构/删除文档时，必须同步清理代码中的 `@doc` 注解')
  lines.push('- 本清单为临时材料，建议每季度重新生成，旧版归档至 archive/')
  lines.push('')

  writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8')
  console.log('========== 文档↔代码 直接关系快速索引 ==========')
  console.log(`文档→代码 引用: ${docToCode.length} 条（强: ${docToCode.filter((e) => e.strength === 'strong').length}）`)
  console.log(`代码→文档 引用: ${codeToDoc.length} 条`)
  console.log(`涉及文档: ${byDoc.size}，涉及代码（被引）: ${codeRefCount.size}，涉及代码（引用）: ${byCode.size}`)
  console.log(`高频被引代码（≥3 篇）: ${hot.length}`)
  console.log(`\n✅ 索引已写入: ${OUTPUT_PATH}`)
}

main()
