#!/usr/bin/env node
/**
 * @module scripts/docs-tool/analyze-broken-refs
 * @description 分析断裂引用报告，识别高频模式与可修复候选
 */
import { readFileSync, existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { globSync } from 'glob'

interface Reference {
  source: string
  target: string
  line: number
  type: 'doc-to-code' | 'code-to-doc' | 'doc-to-doc'
}

interface AuditReport {
  totalReferences: number
  brokenReferences: Reference[]
}

const reportPath = process.argv[2] || 'scripts/docs/reports/audit/audit-doc-code-references-2026-07-15T02-53-30-852Z.json'
const PROJECT_ROOT = resolve(process.cwd())

function normalize(p: string): string {
  return p.replace(/\\/g, '/')
}

function isPattern(t: string): boolean {
  return /[*?{}]/.test(t)
}

function searchRealFiles(target: string, type: Reference['type']): string[] {
  if (isPattern(target)) return []
  const isDir = target.endsWith('/')
  const name = basename(target)
  const baseNoExt = name.replace(/\.(ts|tsx|md|js|jsx)$/, '')
  const dirs = type === 'doc-to-code' ? ['src', 'scripts'] : ['docs']
  const found: string[] = []
  for (const d of dirs) {
    const root = resolve(PROJECT_ROOT, d)
    if (!existsSync(root)) continue
    if (isDir) {
      found.push(...globSync(normalize(resolve(root, '**', name)), { nodir: false, absolute: true }).filter(p => existsSync(p)))
    } else {
      found.push(...globSync(normalize(resolve(root, '**', baseNoExt + '*')), { nodir: false, absolute: true }).filter(p => /\.(ts|tsx|md|js|jsx)$/.test(p)))
    }
  }
  const rootCandidates = ['AGENTS.md', 'docs/explanation/README.md', 'CHANGELOG.md', 'LICENSE', 'CONTRIBUTING.md']
  if (rootCandidates.includes(name)) {
    const rp = resolve(PROJECT_ROOT, name)
    if (existsSync(rp)) found.push(rp)
  }
  const exact = found.filter(p => basename(p) === name)
  if (exact.length) return exact
  const noExt = found.filter(p => basename(p).replace(/\.(ts|tsx|md|js|jsx)$/, '') === baseNoExt)
  if (noExt.length) return noExt
  return found
}

function main(): void {
  const report: AuditReport = JSON.parse(readFileSync(resolve(PROJECT_ROOT, reportPath), 'utf-8'))
  const refs = report.brokenReferences
  console.log(`报告: ${reportPath}`)
  console.log(`总引用数: ${report.totalReferences}`)
  console.log(`断裂引用数: ${refs.length}`)
  console.log(`断裂率: ${((refs.length / report.totalReferences) * 100).toFixed(2)}%`)

  const byType: Record<string, number> = {}
  for (const r of refs) byType[r.type] = (byType[r.type] || 0) + 1
  console.log('\n按类型分布:')
  for (const [t, n] of Object.entries(byType)) console.log(`  ${t}: ${n}`)

  const targetCounts: Record<string, { count: number; types: Record<string, number>; examples: Reference[] }> = {}
  const basenameOnly: Reference[] = []
  const external: Reference[] = []
  for (const r of refs) {
    const t = normalize(r.target)
    if (!t.includes('/')) basenameOnly.push(r)
    if (t.startsWith('file:///') || /^[a-zA-Z]:[\\/]/.test(t)) external.push(r)
    if (!targetCounts[t]) targetCounts[t] = { count: 0, types: {}, examples: [] }
    targetCounts[t].count++
    targetCounts[t].types[r.type] = (targetCounts[t].types[r.type] || 0) + 1
    if (targetCounts[t].examples.length < 3) targetCounts[t].examples.push(r)
  }

  console.log(`\n唯一目标数: ${Object.keys(targetCounts).length}`)
  console.log(`basename-only 引用数: ${basenameOnly.length}`)
  console.log(`外部绝对路径引用数: ${external.length}`)

  const sorted = Object.entries(targetCounts).sort((a, b) => b[1].count - a[1].count)

  console.log('\n=== 高频断裂目标 Top 40 ===')
  for (const [target, info] of sorted.slice(0, 40)) {
    const typeStr = Object.entries(info.types).map(([k, v]) => `${k}:${v}`).join(', ')
    const candidate = searchRealFiles(target, info.examples[0].type)
    let status = 'no-match'
    if (candidate.length === 1) status = `unique -> ${normalize(candidate[0]).replace(normalize(PROJECT_ROOT) + '/', '')}`
    else if (candidate.length > 1) status = `multi (${candidate.length})`
    console.log(`${info.count.toString().padStart(3)}  ${target}`)
    console.log(`    types: ${typeStr}`)
    console.log(`    candidate: ${status}`)
  }

  // Source files with many broken refs
  const sourceCounts: Record<string, number> = {}
  for (const r of refs) sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1
  const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])
  console.log('\n=== 断裂引用最多的源文件 Top 20 ===')
  for (const [src, n] of sortedSources.slice(0, 20)) {
    console.log(`${n.toString().padStart(3)}  ${src}`)
  }

  // Basename-only candidates
  console.log('\n=== Basename-only 可映射候选 ===')
  const basenameCandidates: { target: string; type: string; count: number; candidates: string[] }[] = []
  for (const r of basenameOnly) {
    const target = normalize(r.target)
    const c = searchRealFiles(target, r.type)
    if (c.length > 0) {
      basenameCandidates.push({ target, type: r.type, count: 0, candidates: c.map(p => normalize(p).replace(normalize(PROJECT_ROOT) + '/', '')) })
    }
  }
  for (const r of basenameOnly) {
    const idx = basenameCandidates.findIndex(b => b.target === normalize(r.target) && b.type === r.type)
    if (idx >= 0) basenameCandidates[idx].count++
  }
  const dedupedBasename = Array.from(new Map(basenameCandidates.map(b => [`${b.type}:${b.target}`, b])).values())
  dedupedBasename.sort((a, b) => b.count - a.count)
  for (const b of dedupedBasename.slice(0, 30)) {
    console.log(`${b.count}  ${b.type}  ${b.target} -> ${b.candidates.join(' | ')}`)
  }

  // All unique candidates (including path-based)
  console.log('\n=== 全量唯一映射候选 ===')
  const uniqueCandidates: { target: string; type: string; count: number; path: string }[] = []
  const multiCandidates: { target: string; type: string; count: number; paths: string[] }[] = []
  for (const [target, info] of sorted) {
    if (isPattern(target)) continue
    if (/^[a-zA-Z]:[\\/]|^file:\/\//.test(target)) continue
    if (/\.(ts|tsx|md|js|jsx):\d/.test(target)) continue
    const type = Object.keys(info.types)[0]
    const c = searchRealFiles(target, type as Reference['type'])
    if (c.length === 1) {
      uniqueCandidates.push({
        target,
        type,
        count: info.count,
        path: normalize(c[0]).replace(normalize(PROJECT_ROOT) + '/', '')
      })
    } else if (c.length > 1) {
      multiCandidates.push({
        target,
        type,
        count: info.count,
        paths: c.map(p => normalize(p).replace(normalize(PROJECT_ROOT) + '/', ''))
      })
    }
  }
  uniqueCandidates.sort((a, b) => b.count - a.count)
  multiCandidates.sort((a, b) => b.count - a.count)
  console.log(`唯一候选数: ${uniqueCandidates.length}`)
  for (const u of uniqueCandidates.slice(0, 60)) {
    console.log(`${u.count.toString().padStart(3)}  ${u.type.padEnd(12)} ${u.target} -> ${u.path}`)
  }
  if (uniqueCandidates.length > 60) console.log(`  ... 还有 ${uniqueCandidates.length - 60} 条唯一候选 ...`)

  console.log('\n=== 全量多映射候选 Top 30 ===')
  for (const m of multiCandidates.slice(0, 30)) {
    console.log(`${m.count.toString().padStart(3)}  ${m.type.padEnd(12)} ${m.target}`)
    for (const p of m.paths) console.log(`    -> ${p}`)
  }
}

main()
