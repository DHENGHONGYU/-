import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'fs'
import { resolve, basename, extname, relative, dirname } from 'path'

const ROOT = resolve('.')
const reportPath = process.argv[2] || 'scripts/docs/reports/audit/audit-doc-code-references-2026-07-15T23-20-26-955Z.json'
const report = JSON.parse(readFileSync(resolve(reportPath), 'utf-8'))

const broken = report.brokenReferences as Array<{
  source: string
  target: string
  line: number
  type: 'doc-to-code' | 'doc-to-doc' | 'code-to-doc'
}>

const byTarget = new Map<string, { count: number; types: Record<string, number> }>()
for (const ref of broken) {
  const entry = byTarget.get(ref.target) || { count: 0, types: {} }
  entry.count++
  entry.types[ref.type] = (entry.types[ref.type] || 0) + 1
  byTarget.set(ref.target, entry)
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue
      yield* walk(full)
    } else {
      yield full
    }
  }
}

const allFiles: string[] = []
for (const p of walk(ROOT)) {
  const rel = relative(ROOT, p).replace(/\\/g, '/')
  if (rel.startsWith('src/') || rel.startsWith('scripts/') || rel.startsWith('docs/')) {
    allFiles.push(rel)
  }
}

function normalizeTarget(target: string): string {
  // remove line number suffixes for code refs
  return target
    .replace(/(\.\w+)?(?::\d+(?:[-/]\d+)?(?:,\d+)*(?::\d+)?)$/, '$1')
    .replace(/#.*$/, '')
}

function findCandidates(target: string): string[] {
  const nt = normalizeTarget(target)
  const base = basename(nt)
  const ext = extname(nt) || ''
  const baseNoExt = base.replace(ext, '')

  const candidates: string[] = []

  // exact basename match
  for (const f of allFiles) {
    if (basename(f) === base) candidates.push(f)
  }

  // similar basename (no ext)
  if (candidates.length === 0) {
    for (const f of allFiles) {
      const fb = basename(f).replace(extname(f), '')
      if (fb === baseNoExt) candidates.push(f)
      else if (fb.includes(baseNoExt) || baseNoExt.includes(fb)) {
        if (Math.abs(fb.length - baseNoExt.length) <= 5) candidates.push(f)
      }
    }
  }

  return [...new Set(candidates)]
}

const sorted = [...byTarget.entries()].sort((a, b) => b[1].count - a[1].count)

const lines: string[] = []
lines.push('=== 高频断裂目标及候选替代文件 ===')
for (const [target, info] of sorted) {
  if (info.count < 2) continue
  const cands = findCandidates(target)
  lines.push(`${info.count}\t${target}`)
  for (const c of cands.slice(0, 5)) lines.push(`\t-> ${c}`)
  if (cands.length === 0) lines.push(`\t-> (no candidate)`)
}

lines.push('')
lines.push('=== 出现 1 次的断裂目标（可能需创建 stub） ===')
for (const [target, info] of sorted) {
  if (info.count !== 1) continue
  const cands = findCandidates(target)
  lines.push(`${info.count}\t${target}`)
  for (const c of cands.slice(0, 3)) lines.push(`\t-> ${c}`)
  if (cands.length === 0) lines.push(`\t-> (no candidate)`)
}

const outPath = 'scripts/docs/reports/audit/phase19-alternatives.txt'
writeFileSync(outPath, lines.join('\n'), 'utf-8')
console.log(`已写入 ${outPath}`)
