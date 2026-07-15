/**
 * fix-doc-to-doc-basename.ts
 *
 * 修复文档中 basename-only 的 doc-to-doc 引用断裂：
 * 1. 扫描所有 .md 文档，提取所有引用
 * 2. 对每个 basename-only 引用（不含路径分隔符），在仓库内搜索匹配文件
 * 3. 如果唯一匹配，计算正确的相对路径
 * 4. 自动更新引用
 *
 * v1.0 (2026-07-15)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')

interface BrokenRef {
  source: string
  target: string
  line: number
  type: string
}

interface FileIndex {
  basenameMap: Map<string, string[]>
}

function buildFileIndex(): FileIndex {
  const basenameMap = new Map<string, string[]>()

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'coverage', '.husky'].includes(entry.name)) continue
        walk(full)
      } else if (entry.isFile() && /\.md$/.test(entry.name)) {
        const rel = path.relative(ROOT, full).replace(/\\/g, '/')
        if (!basenameMap.has(entry.name)) {
          basenameMap.set(entry.name, [])
        }
        basenameMap.get(entry.name)!.push(rel)
      }
    }
  }

  walk(path.join(ROOT, 'docs'))
  walk(path.join(ROOT, 'prompts'))

  return { basenameMap }
}

function findUniqueTarget(target: string, index: FileIndex): string | null {
  if (!index.basenameMap.has(target)) return null
  const matches = index.basenameMap.get(target)!
  if (matches.length === 1) return matches[0]!
  return null
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildRelativeRef(source: string, target: string): string {
  const sourceDir = path.dirname(path.resolve(ROOT, source))
  const targetFull = path.resolve(ROOT, target)
  let rel = path.relative(sourceDir, targetFull).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

function extractBasenameOnlyTargets(refs: BrokenRef[]): Map<string, BrokenRef[]> {
  const map = new Map<string, BrokenRef[]>()
  for (const ref of refs) {
    if (ref.type !== 'doc-to-doc') continue
    // 只处理纯 basename 引用（不含路径分隔符，且不是以 ./ 或 ../ 开头）
    if (ref.target.includes('/') || ref.target.includes('\\')) continue
    if (ref.target.startsWith('.') || ref.target.startsWith('docs/')) continue
    if (!map.has(ref.target)) map.set(ref.target, [])
    map.get(ref.target)!.push(ref)
  }
  return map
}

function main(): void {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  修复 doc-to-doc basename 引用 v1.0                       ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // 1. 加载断裂引用报告
  const reportPath = path.join(
    ROOT,
    'scripts',
    'docs',
    'reports',
    'audit',
    'audit-doc-code-references-2026-07-15T02-35-30-727Z.json',
  )
  if (!fs.existsSync(reportPath)) {
    console.error('❌ 引用报告不存在:', reportPath)
    process.exit(1)
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
  const allBroken: BrokenRef[] = report.brokenReferences
  const d2d = allBroken.filter((r) => r.type === 'doc-to-doc')
  console.log(`📊 总引用: ${report.totalReferences}, 断裂: ${allBroken.length}, doc-to-doc: ${d2d.length}\n`)

  // 2. 建立文件索引
  console.log('📂 构建文件索引...')
  const index = buildFileIndex()
  console.log(`  docs/ 和 prompts/ 中共 ${index.basenameMap.size} 个不同 basename\n`)

  // 3. 筛选 basename-only 引用
  const basenameRefs = extractBasenameOnlyTargets(d2d)
  console.log(`🔍 找到 ${basenameRefs.size} 个 basename-only 引用目标\n`)

  // 4. 查找唯一匹配
  const targetMapping = new Map<string, string | null>()
  for (const [target, refs] of basenameRefs.entries()) {
    const unique = findUniqueTarget(target, index)
    targetMapping.set(target, unique)
  }

  // 5. 输出分析
  const fixable: Array<{ target: string; actualPath: string; count: number }> = []
  const unfixable: Array<{ target: string; matches: string[]; count: number }> = []

  for (const [target, refs] of basenameRefs.entries()) {
    const actual = targetMapping.get(target)!
    if (actual) {
      fixable.push({ target, actualPath: actual, count: refs.length })
    } else {
      const matches = index.basenameMap.get(target) || []
      unfixable.push({ target, matches, count: refs.length })
    }
  }

  // 按引用数排序
  fixable.sort((a, b) => b.count - a.count)
  unfixable.sort((a, b) => b.count - a.count)

  console.log(`✅ 可修复 (唯一匹配): ${fixable.length} 个目标，共 ${fixable.reduce((s, f) => s + f.count, 0)} 处引用`)
  console.log(`⚠️  不可修复 (多匹配/无匹配): ${unfixable.length} 个目标，共 ${unfixable.reduce((s, f) => s + f.count, 0)} 处引用\n`)

  console.log('Top 20 可修复目标:')
  fixable.slice(0, 20).forEach((f) => {
    console.log(`  ${f.count} 处  ${f.target}  →  ${f.actualPath}`)
  })
  console.log()

  console.log('Top 20 不可修复目标:')
  unfixable.slice(0, 20).forEach((f) => {
    const m = f.matches.length > 0 ? f.matches.slice(0, 3).join(', ') + (f.matches.length > 3 ? '...' : '') : '(无匹配)'
    console.log(`  ${f.count} 处  ${f.target}  [${m}]`)
  })
  console.log()

  // 6. 应用修复
  const fileChanges = new Map<string, Array<{ line: number; from: string; to: string }>>()

  for (const ref of d2d) {
    if (ref.target.includes('/') || ref.target.includes('\\')) continue
    if (ref.target.startsWith('.') || ref.target.startsWith('docs/')) continue
    const actual = targetMapping.get(ref.target)
    if (!actual) continue

    const newRef = buildRelativeRef(ref.source, actual)
    if (newRef === ref.target) continue

    if (!fileChanges.has(ref.source)) fileChanges.set(ref.source, [])
    fileChanges.get(ref.source)!.push({ line: ref.line, from: ref.target, to: newRef })
  }

  console.log(`📝 准备更新 ${fileChanges.size} 个文件\n`)

  let totalReplacements = 0
  for (const [source, changes] of fileChanges.entries()) {
    const absPath = path.resolve(ROOT, source)
    if (!fs.existsSync(absPath)) continue
    let content = fs.readFileSync(absPath, 'utf-8')
    const originalContent = content
    for (const c of changes) {
      const escaped = escapeRegExp(c.from)
      const regex = new RegExp(escaped, 'g')
      const newContent = content.replace(regex, c.to)
      if (newContent !== content) {
        content = newContent
        totalReplacements++
      }
    }
    if (content !== originalContent) {
      fs.writeFileSync(absPath, content, 'utf-8')
    }
  }

  console.log(`✅ 已应用 ${totalReplacements} 处替换\n`)
}

main()
