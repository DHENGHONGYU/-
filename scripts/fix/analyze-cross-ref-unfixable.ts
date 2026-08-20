/**
 * 一次性分析脚本：dump doc-cross-ref-sync 剩余不可自动修复断链的完整清单（含候选路径）
 * 输出: outputs/cross-ref-unfixable.json
 */
import { findBrokenCrossReferences } from '../docs-tool/doc-cross-ref-sync'
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..', '..')
const docsDir = join(projectRoot, 'docs')

// 与工具内部 collectMarkdownFiles 一致的排除集
const EXCLUDE = new Set(['node_modules', 'deprecated-docs', 'old-versions', 'ai-index'])

function collectMd(dir: string, out: string[]): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) collectMd(full, out)
    else if (st.isFile() && extname(entry).toLowerCase() === '.md') out.push(full)
  }
}

const files: string[] = []
collectMd(docsDir, files)
const scanned = files.map((abs) => ({
  absolutePath: abs.replace(/\\/g, '/'),
  relativePath: relative(docsDir, abs).replace(/\\/g, '/'),
  category: 'doc',
  updateType: 'unchanged',
  sizeBytes: 0,
  lastModifiedAt: '',
  hash: '',
})) as never

const report = findBrokenCrossReferences(docsDir, scanned, { scope: 'all' })
const unfixable = (report.brokenLinks as Array<Record<string, unknown>>).filter(
  (b) => !(b as { fixable?: boolean }).fixable,
)

const out = {
  total: unfixable.length,
  ambiguous: unfixable.filter((b) => ((b as { candidates: string[] }).candidates ?? []).length > 1).length,
  zeroCandidate: unfixable.filter((b) => ((b as { candidates: string[] }).candidates ?? []).length === 0).length,
  items: unfixable.map((b) => ({
    source: b.sourceRelativePath,
    line: b.line,
    text: b.originalText,
    target: b.originalTarget,
    candidates: b.candidates,
  })),
}
writeFileSync(join(projectRoot, 'outputs', 'cross-ref-unfixable.json'), JSON.stringify(out, null, 2), 'utf8')
console.log(`unfixable=${out.total} ambiguous=${out.ambiguous} zeroCandidate=${out.zeroCandidate}`)
console.log('written: outputs/cross-ref-unfixable.json')
