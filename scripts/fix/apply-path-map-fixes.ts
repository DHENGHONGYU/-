/**
 * apply-path-map-fixes-v2.ts
 * 基于 审计报告 + path-map 精确修复文档中已确认的断裂引用
 *
 * v2 关键改进：
 * - 只处理 audit-doc-code-references 报告中确认断裂的引用
 * - 按 source:line 精确定位，避免误改合法引用
 * - 优先使用 path-map 映射
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')

const DRY_RUN = !process.argv.includes('--apply')

interface BrokenRef {
  source: string
  target: string
  line: number
  type: string
}

interface PhantomMap {
  phantomDocs: Record<string, string>
  unresolvable: string[]
}

function loadPathMap(): Record<string, string> {
  const p = path.join(ROOT, 'scripts', 'config', 'doc-ref-path-map.json')
  return JSON.parse(fs.readFileSync(p, 'utf-8')).docPathMap || {}
}

function loadPhantomMap(): PhantomMap {
  const p = path.join(ROOT, 'scripts', 'config', 'doc-phantom-map.json')
  if (!fs.existsSync(p)) return { phantomDocs: {}, unresolvable: [] }
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function loadLatestReport(): BrokenRef[] {
  const dir = path.join(ROOT, 'scripts', 'docs', 'reports', 'audit')
  const files = fs.readdirSync(dir)
    .filter(f => /^audit-doc-code-references-\d{4}-\d{2}-\d{2}T/.test(f))
    .sort()
    .reverse()
  if (files.length === 0) {
    console.error('No audit report found')
    process.exit(1)
  }
  const latest = path.join(dir, files[0]!)
  console.log(`Loading: ${files[0]}`)
  const data = JSON.parse(fs.readFileSync(latest, 'utf-8'))
  return data.brokenReferences
}

function buildRelative(fromFile: string, target: string): string {
  const fromDir = path.dirname(path.resolve(ROOT, fromFile))
  const targetAbs = path.resolve(ROOT, target)
  let rel = path.relative(fromDir, targetAbs).replace(/\\/g, '/')
  if (!rel.startsWith('.') && !rel.startsWith('/')) rel = './' + rel
  return rel
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function main(): void {
  console.log('=== apply-path-map-fixes v2 ===')
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`)

  const allBroken = loadLatestReport().filter(r => r.type === 'doc-to-doc')
  console.log(`Total d2d broken: ${allBroken.length}`)

  const pathMap = loadPathMap()
  const phantomMap = loadPhantomMap()
  const combinedMap = { ...pathMap, ...phantomMap.phantomDocs }
  console.log(`Loaded ${Object.keys(pathMap).length} path-map + ${Object.keys(phantomMap.phantomDocs).length} phantom-map entries`)

  // 按 source 分组
  const byFile = new Map<string, BrokenRef[]>()
  for (const r of allBroken) {
    if (!byFile.has(r.source)) byFile.set(r.source, [])
    byFile.get(r.source)!.push(r)
  }

  const plan: Array<{ file: string; line: number; oldTarget: string; newRef: string; reason: string }> = []
  const skipped: Array<{ file: string; line: number; oldTarget: string; reason: string }> = []

  for (const [file, refs] of byFile.entries()) {
    for (const r of refs) {
      // 1. 尝试 path-map
      let mapped = combinedMap[r.target]
      // 2. 尝试 basename 唯一匹配
      if (!mapped) {
        const base = path.basename(r.target)
        if (!base.includes('/')) {
          // basename-only 引用，尝试在 path-map 中找同名
          mapped = combinedMap[base]
        }
      }
      // 3. 处理路径重复/反斜杠
      if (!mapped) {
        const cleaned = r.target.replace(/(\.\.\/)+/g, '../')
        if (cleaned !== r.target && combinedMap[cleaned]) mapped = combinedMap[cleaned]
      }
      if (!mapped) {
        const normalized = r.target.replace(/\\/g, '/')
        if (normalized !== r.target && combinedMap[normalized]) mapped = combinedMap[normalized]
      }

      if (mapped) {
        const newRef = buildRelative(r.source, mapped)
        plan.push({ file: r.source, line: r.line, oldTarget: r.target, newRef, reason: 'path-map' })
      } else {
        skipped.push({ file: r.source, line: r.line, oldTarget: r.target, reason: 'no-mapping' })
      }
    }
  }

  console.log(`\nPlan: ${plan.length} fixes, Skipped: ${skipped.length}`)

  // Top 20 by pattern
  const counts = new Map<string, { count: number; sample: typeof plan[0] }>()
  for (const p of plan) {
    const key = `${p.oldTarget} -> ${p.newRef}`
    if (!counts.has(key)) counts.set(key, { count: 0, sample: p })
    counts.get(key)!.count++
  }
  const sortedPlan = Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count)
  console.log('\nTop 20 plan entries:')
  sortedPlan.slice(0, 20).forEach(([k, v]) => {
    console.log(`  ${v.count}\t${k}`)
  })

  if (DRY_RUN) {
    console.log('\n(DRY-RUN: no changes made. Use --apply to write.)')
    return
  }

  // Apply
  let applied = 0
  const fileChanges = new Map<string, Array<{ line: number; oldTarget: string; newRef: string }>>()
  for (const p of plan) {
    if (!fileChanges.has(p.file)) fileChanges.set(p.file, [])
    fileChanges.get(p.file)!.push({ line: p.line, oldTarget: p.oldTarget, newRef: p.newRef })
  }

  for (const [file, changes] of fileChanges.entries()) {
    const abs = path.resolve(ROOT, file)
    if (!fs.existsSync(abs)) continue
    let content = fs.readFileSync(abs, 'utf-8')
    const lines = content.split('\n')

    // 按行号去重（同line的多处target一次性处理）
    const byLine = new Map<number, Array<{ oldTarget: string; newRef: string }>>()
    for (const c of changes) {
      if (!byLine.has(c.line)) byLine.set(c.line, [])
      byLine.get(c.line)!.push({ oldTarget: c.oldTarget, newRef: c.newRef })
    }

    for (const [line, replacements] of byLine.entries()) {
      const idx = line - 1
      if (idx < 0 || idx >= lines.length) continue
      let lineText = lines[idx]!
      for (const r of replacements) {
        const escaped = escapeRegExp(r.oldTarget)
        const regex = new RegExp(escaped, 'g')
        if (regex.test(lineText)) {
          lineText = lineText.replace(regex, r.newRef)
          applied++
        }
      }
      lines[idx] = lineText
    }
    fs.writeFileSync(abs, lines.join('\n'), 'utf-8')
  }

  console.log(`\n✅ Applied ${applied} replacements across ${fileChanges.size} files`)
}

main()
