#!/usr/bin/env node
/**
 * @module scripts/fix-basename-root-refs
 * @description 修复文档中对项目根文档（AGENTS.md / README.md / CHANGELOG.md）的 basename 断裂引用
 *
 * 用法：
 *   npx tsx scripts/fix-basename-root-refs.ts          # 预览
 *   npx tsx scripts/fix-basename-root-refs.ts --apply  # 应用
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { readTextAdaptive, writeTextUtf8 } from './lib/encoding'
import { dirname, relative, resolve } from 'node:path'

const args = process.argv.slice(2)
const isDryRun = !args.includes('--apply')
const PROJECT_ROOT = resolve(process.cwd())

const ROOT_DOCS = ['AGENTS.md', 'docs/explanation/README.md', 'CHANGELOG.md', 'LICENSE', 'CONTRIBUTING.md']

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

function isDocFile(path: string): boolean {
  return path.toLowerCase().endsWith('.md')
}

function findBrokenRootRefs(): Array<{ source: string; line: number; target: string }> {
  const result: Array<{ source: string; line: number; target: string }> = []
  const latest = findLatestAuditReport()
  if (!latest) {
    console.warn('未找到 audit-doc-code-references 报告')
    return result
  }
  const audit = JSON.parse(readTextAdaptive(latest))
  for (const ref of audit.brokenReferences || []) {
    const target = ref.target
    if (!ROOT_DOCS.includes(target)) continue
    if (!isDocFile(ref.source)) continue
    result.push({ source: ref.source, line: ref.line, target })
  }
  return result
}

function findLatestAuditReport(): string | null {
  const dir = resolve(PROJECT_ROOT, 'scripts/docs/reports/audit')
  const files = readdirSync(dir)
    .filter((f: string) => f.startsWith('audit-doc-code-references-') && f.endsWith('.json'))
    .sort()
  return files.length > 0 ? resolve(dir, files[files.length - 1]) : null
}

function computeRelative(source: string, target: string): string {
  const sourceDir = dirname(resolve(PROJECT_ROOT, source))
  const targetPath = resolve(PROJECT_ROOT, target)
  let rel = normalizePath(relative(sourceDir, targetPath))
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

function applyFix(item: { source: string; line: number; target: string }): boolean {
  const filePath = resolve(PROJECT_ROOT, item.source)
  if (!existsSync(filePath)) return false
  const content = readTextAdaptive(filePath)
  const lines = content.split('\n')
  const idx = item.line - 1
  if (idx < 0 || idx >= lines.length) return false
  const newTarget = computeRelative(item.source, item.target)
  if (!lines[idx].includes(item.target)) return false
  const escaped = item.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  lines[idx] = lines[idx].replace(new RegExp(`\\b${escaped}\\b`, 'g'), newTarget)
  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return true
}

function main(): void {
  const refs = findBrokenRootRefs()
  console.log(`[${new Date().toISOString()}] 发现根文档 basename 断裂引用: ${refs.length}`)
  console.log(`模式: ${isDryRun ? 'DRY-RUN' : 'APPLY'}`)

  for (const item of refs.slice(0, 20)) {
    const rel = computeRelative(item.source, item.target)
    console.log(`  ${item.source}:${item.line}  ${item.target} → ${rel}`)
  }
  if (refs.length > 20) {
    console.log(`  ... 还有 ${refs.length - 20} 条 ...`)
  }

  if (!isDryRun) {
    let applied = 0
    for (const item of refs) {
      if (applyFix(item)) applied++
    }
    console.log(`\n已应用: ${applied}/${refs.length}`)
  }

  console.log(`\n[${new Date().toISOString()}] 处理结束`)
  if (isDryRun) console.log('提示: 使用 --apply 应用修复')
}

main()
