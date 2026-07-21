#!/usr/bin/env node
/**
 * @module scripts/fix-doc-refs
 * @description 文档-代码断裂引用自动修复脚本
 *
 * 策略：
 * 1. 复用 audit-doc-code-references.ts 的审计能力
 * 2. 对每个断裂引用，按 basename 在 docs/ / src/ / scripts/ 中模糊匹配真实文件
 * 3. 唯一匹配时自动替换；多匹配/无匹配时汇总人工复核
 * 4. 支持 --dry-run（默认）和 --apply 两种模式
 * 5. v1.1 新增目录引用（以 / 结尾）的自动匹配修复
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { readTextAdaptive, writeTextUtf8 } from './lib/encoding'
import { dirname, join, relative, resolve, basename, extname } from 'node:path'
import { globSync } from 'glob'
import { audit, type Reference, type AuditResult } from './audit/audit-doc-code-references.js'

const args = process.argv.slice(2)
const isDryRun = !args.includes('--apply')
const scope = args.find(a => a.startsWith('--scope='))?.replace('--scope=', '') || 'all'
const sourcePrefix = args.find(a => a.startsWith('--source-prefix='))?.replace('--source-prefix=', '') || ''
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.replace('--limit=', '') || '0', 10) || Infinity
const usePathMap = args.includes('--use-path-map')
const PROJECT_ROOT = resolve(process.cwd())

interface PathMapConfig {
  codePathMap: Record<string, string>
  docPathMap: Record<string, string>
}

let pathMap: PathMapConfig | null = null

function loadPathMap(): PathMapConfig | null {
  if (pathMap) return pathMap
  const mapPath = join(PROJECT_ROOT, 'scripts', 'config', 'doc-ref-path-map.json')
  if (!existsSync(mapPath)) return null
  try {
    const content = readTextAdaptive(mapPath)
    pathMap = JSON.parse(content)
    return pathMap
  } catch {
    return null
  }
}

function lookupPathMap(target: string, ref: Reference): string | null {
  if (!usePathMap) return null
  const map = loadPathMap()
  if (!map) return null

  const targetMap = ref.type === 'doc-to-code' ? map.codePathMap : map.docPathMap

  // 代码位置后缀（行号/行列/行范围，支持逗号分隔多位置）不应影响路径映射查找
  const locationSuffix = /(\.\w+)?(?::\d+(?:[-/]\d+)?(?:,\d+)*(?::\d+)?)$/
  let normalizedTarget = normalizePath(target)
  if (ref.type === 'doc-to-code' && locationSuffix.test(normalizedTarget)) {
    normalizedTarget = normalizedTarget.replace(locationSuffix, '$1')
  }

  if (targetMap[normalizedTarget]) {
    return targetMap[normalizedTarget]
  }

  for (const [oldPrefix, newPrefix] of Object.entries(targetMap)) {
    if (oldPrefix.endsWith('/') && normalizedTarget.startsWith(oldPrefix)) {
      const remainder = normalizedTarget.substring(oldPrefix.length)
      return newPrefix + remainder
    }
  }

  return null
}

interface FixCandidate {
  ref: Reference
  suggestion: string | null
  reason: 'unique' | 'multi' | 'none' | 'ignored'
}

const CODE_DIRS = ['src', 'scripts']
const DOC_DIRS = ['docs']

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

function getSearchDirs(ref: Reference): string[] {
  if (ref.type === 'doc-to-code') return CODE_DIRS
  if (ref.type === 'code-to-doc') return DOC_DIRS
  if (ref.type === 'doc-to-doc') return DOC_DIRS
  return []
}

function isPattern(target: string): boolean {
  return target.includes('*') || target.includes('{') || target.includes('}') || target.includes('?')
}

function searchRealFiles(target: string, ref: Reference): string[] {
  if (isPattern(target)) return []

  const isDirRef = target.endsWith('/')
  const targetName = basename(target)
  const baseNoExt = targetName.replace(/\.(ts|tsx|md|js|jsx)$/, '')
  const searchDirs = getSearchDirs(ref)
  if (searchDirs.length === 0) return []

  const roots = searchDirs.map(d => join(PROJECT_ROOT, d))
  const found: string[] = []

  for (const root of roots) {
    if (!existsSync(root)) continue

    if (isDirRef) {
      // 目录引用：优先查找同名目录
      const dirPattern = normalizePath(join(root, '**', targetName))
      const dirMatches = globSync(dirPattern, { nodir: false, absolute: true })
        .filter(p => existsSync(p) && statSync(p).isDirectory())
      found.push(...dirMatches)
    } else {
      const pattern = normalizePath(join(root, '**', baseNoExt + '*'))
      const matches = globSync(pattern, { nodir: false, absolute: true })
        .filter(p => p.endsWith('.md') || p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js'))
      found.push(...matches)
    }
  }

  // 补充：项目根目录下的核心文档（如 AGENTS.md / README.md / CHANGELOG.md）
  const rootCandidates = ['AGENTS.md', 'docs/explanation/README.md', 'CHANGELOG.md', 'LICENSE', 'CONTRIBUTING.md']
  if (rootCandidates.includes(targetName)) {
    const rootPath = join(PROJECT_ROOT, targetName)
    if (existsSync(rootPath)) {
      found.push(rootPath)
    }
  }

  if (isDirRef) {
    // 目录引用：优先 basename 完全相等
    const exactDir = found.filter(p => basename(p) === targetName)
    if (exactDir.length > 0) return exactDir
    return found
  }

  // 优先：basename 完全相等
  const exactBasename = found.filter(p => basename(p) === targetName)
  if (exactBasename.length > 0) return exactBasename

  // 其次：去掉扩展名后 basename 相等
  const noExtMatches = found.filter(p => basename(p).replace(/\.(ts|tsx|md|js|jsx)$/, '') === baseNoExt)
  if (noExtMatches.length > 0) return noExtMatches

  return found
}

function buildSuggestion(ref: Reference, realPath: string): string {
  const isDirRef = ref.target.endsWith('/')
  const relFromRoot = normalizePath(relative(PROJECT_ROOT, realPath)) + (isDirRef ? '/' : '')

  if (ref.type === 'code-to-doc' || ref.type === 'doc-to-code') {
    // 代码↔文档引用：使用相对项目根目录的路径，便于跨文件定位
    return relFromRoot
  }

  // 文档↔文档引用：使用相对源文件的路径，适配 Markdown 链接
  const sourceDir = dirname(resolve(PROJECT_ROOT, ref.source))
  let rel = relative(sourceDir, realPath)
  rel = normalizePath(rel) + (isDirRef ? '/' : '')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

function generateCandidates(result: AuditResult): FixCandidate[] {
  const candidates: FixCandidate[] = []

  for (const ref of result.brokenReferences) {
    if (isPattern(ref.target)) {
      candidates.push({ ref, suggestion: null, reason: 'ignored' })
      continue
    }

    const isBasename = !ref.target.includes('/')
    const mappedPath = lookupPathMap(ref.target, ref)

    if (mappedPath) {
      const isDirRef = ref.target.endsWith('/')
      const fullMappedPath = resolve(PROJECT_ROOT, mappedPath)
      if (existsSync(fullMappedPath)) {
        const suggestion = buildSuggestion(ref, fullMappedPath)
        candidates.push({ ref, suggestion, reason: 'unique' })
        continue
      } else {
        const mappedDir = isDirRef ? mappedPath : dirname(mappedPath)
        const mappedDirFull = resolve(PROJECT_ROOT, mappedDir)
        if (existsSync(mappedDirFull) && statSync(mappedDirFull).isDirectory()) {
          candidates.push({ ref, suggestion: mappedPath, reason: 'unique' })
          continue
        }
      }
    }

    if (isBasename) {
      candidates.push({ ref, suggestion: null, reason: 'ignored' })
      continue
    }

    const matches = searchRealFiles(ref.target, ref)
    if (matches.length === 0) {
      candidates.push({ ref, suggestion: null, reason: 'none' })
    } else if (matches.length === 1) {
      const suggestion = buildSuggestion(ref, matches[0])
      candidates.push({ ref, suggestion, reason: 'unique' })
    } else {
      const targetParts = ref.target.split('/').filter(Boolean)
      const best = matches
        .map(p => {
          const rel = normalizePath(relative(PROJECT_ROOT, p))
          const parts = rel.split('/').filter(Boolean)
          let score = 0
          for (let i = 0; i < Math.min(targetParts.length, parts.length); i++) {
            if (targetParts[i] === parts[i]) score += 10
            else if (targetParts[i].toLowerCase() === parts[i].toLowerCase()) score += 5
          }
          return { path: p, score }
        })
        .sort((a, b) => b.score - a.score)[0]
      const suggestion = buildSuggestion(ref, best.path)
      candidates.push({ ref, suggestion, reason: 'multi' })
    }
  }

  return candidates
}

function applyFix(candidate: FixCandidate): void {
  if (!candidate.suggestion) return
  const filePath = resolve(PROJECT_ROOT, candidate.ref.source)
  const content = readTextAdaptive(filePath)
  // 保留原始换行符（CRLF/LF），避免整文件行尾被改写导致 git 误判全量变更
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(eol)
  const lineIndex = candidate.ref.line - 1
  if (lineIndex < 0 || lineIndex >= lines.length) return

  const oldTarget = candidate.ref.target
  const newTarget = candidate.suggestion

  // 使用转义后的目标进行替换，避免特殊字符问题
  const escapedOld = oldTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const updated = lines[lineIndex].replace(new RegExp(escapedOld, 'g'), newTarget)
  if (updated === lines[lineIndex]) return // 无实际变更则不写回，避免无谓改动
  lines[lineIndex] = updated

  writeFileSync(filePath, lines.join(eol), 'utf-8')
}

function main(): void {
  console.log(`[${new Date().toISOString()}] 开始修复文档-代码断裂引用...`)
  console.log(`模式: ${isDryRun ? 'DRY-RUN（预览）' : 'APPLY（应用）'}`)
  console.log(`范围: ${scope}`)

  const result = audit()
  let targetRefs = result.brokenReferences
  if (scope !== 'all') {
    targetRefs = targetRefs.filter(r => r.type === scope)
  }
  if (sourcePrefix) {
    targetRefs = targetRefs.filter(r => normalizePath(r.source).startsWith(normalizePath(sourcePrefix)))
  }

  console.log(`待修复断裂引用: ${targetRefs.length}`)
  if (limit !== Infinity) {
    console.log(`本次限制处理: ${limit} 条`)
  }

  // 构造一个只包含目标引用的结果对象
  const scopedResult: AuditResult = {
    ...result,
    brokenReferences: targetRefs,
    totalReferences: targetRefs.length,
    validReferences: [],
    summary: {
      docToCode: { total: 0, broken: 0 },
      codeToDoc: { total: 0, broken: 0 },
      docToDoc: { total: 0, broken: 0 }
    }
  }

  const candidates = generateCandidates(scopedResult)
  const unique = candidates.filter(c => c.reason === 'unique')
  const multi = candidates.filter(c => c.reason === 'multi')
  const none = candidates.filter(c => c.reason === 'none')
  const ignored = candidates.filter(c => c.reason === 'ignored')

  console.log(`\n修复建议统计:`)
  console.log(`  唯一匹配可自动修复: ${unique.length}`)
  console.log(`  多匹配需人工复核: ${multi.length}`)
  console.log(`  无匹配需人工补充: ${none.length}`)
  console.log(`  已忽略（通配符/纯 basename）: ${ignored.length}`)

  if (unique.length > 0) {
    console.log(`\n${isDryRun ? '【预览】' : '【应用】'}唯一匹配修复列表（前 20 条）:`)
    for (const c of unique.slice(0, 20)) {
      console.log(`  ${c.ref.source}:${c.ref.line}`)
      console.log(`    ${c.ref.target} → ${c.suggestion}`)
    }
    if (unique.length > 20) {
      console.log(`    ... 还有 ${unique.length - 20} 条 ...`)
    }
  }

  if (multi.length > 0) {
    console.log(`\n多匹配待复核列表（前 10 条）:`)
    for (const c of multi.slice(0, 10)) {
      console.log(`  ${c.ref.source}:${c.ref.line}`)
      console.log(`    ${c.ref.target} → ${c.suggestion}（建议人工确认）`)
    }
  }

  if (!isDryRun) {
    const toApply = unique.slice(0, limit)
    let applied = 0
    for (const c of toApply) {
      applyFix(c)
      applied++
    }
    console.log(`\n已应用修复: ${applied} / ${unique.length} 处`)
    if (unique.length > limit) {
      console.log(`剩余 ${unique.length - limit} 处唯一匹配未处理（可再次运行 --apply）`)
    }

    // 保存待复核清单
    const reviewPath = join(PROJECT_ROOT, 'scripts', 'docs', 'reports', 'audit', 'doc-refs-manual-review.json')
    const reviewData = {
      multi: multi.map(c => ({ source: c.ref.source, line: c.ref.line, target: c.ref.target, suggestion: c.suggestion })),
      none: none.map(c => ({ source: c.ref.source, line: c.ref.line, target: c.ref.target })),
      ignored: ignored.map(c => ({ source: c.ref.source, line: c.ref.line, target: c.ref.target }))
    }
    writeFileSync(reviewPath, JSON.stringify(reviewData, null, 2), 'utf-8')
    console.log(`待复核清单已保存: ${reviewPath}`)
  }

  console.log(`\n[${new Date().toISOString()}] 修复流程结束`)
  if (isDryRun && unique.length > 0) {
    console.log('提示: 使用 --apply 参数应用唯一匹配修复')
  }
}

main()
