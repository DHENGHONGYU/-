#!/usr/bin/env node
/**
 * @module scripts/fix/apply-multi-match-fixes
 * @description 应用多匹配引用的最佳建议修复
 *
 * 策略：
 * 1. 读取 doc-refs-manual-review.json 中的 multi 列表
 * 2. 对每个建议校验目标文件/目录存在性
 * 3. 存在的建议直接应用替换
 * 4. 不存在的建议保留到失败清单
 * 5. 支持 --dry-run（默认）和 --apply 两种模式
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, normalize } from 'node:path'

const args = process.argv.slice(2)
const isDryRun = !args.includes('--apply')
const PROJECT_ROOT = resolve(process.cwd())
const REVIEW_PATH = join(PROJECT_ROOT, 'scripts', 'docs', 'reports', 'audit', 'doc-refs-manual-review.json')

interface MultiMatchItem {
  source: string
  line: number
  target: string
  suggestion: string
}

interface ReviewData {
  multi: MultiMatchItem[]
  none: unknown[]
  ignored: unknown[]
}

interface FixResult {
  applied: MultiMatchItem[]
  failed: MultiMatchItem[]
  skippedDuplicate: number
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

function buildRelativeRef(source: string, suggestion: string): string {
  const sourceDir = dirname(resolve(PROJECT_ROOT, source))
  const targetFull = resolve(PROJECT_ROOT, suggestion)
  const isDirRef = suggestion.endsWith('/')

  if (!existsSync(targetFull)) {
    const asDir = isDirRef ? targetFull : dirname(targetFull)
    if (existsSync(asDir) && statSync(asDir).isDirectory()) {
      let rel = normalizePath(relative(sourceDir, asDir))
      if (!rel.startsWith('.')) rel = './' + rel
      return rel + '/'
    }
    return suggestion
  }

  let rel = normalizePath(relative(sourceDir, targetFull))
  if (!rel.startsWith('.')) rel = './' + rel
  return rel + (statSync(targetFull).isDirectory() ? '/' : '')
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyFix(item: MultiMatchItem): boolean {
  const filePath = resolve(PROJECT_ROOT, item.source)
  if (!existsSync(filePath)) return false

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const lineIndex = item.line - 1
  if (lineIndex < 0 || lineIndex >= lines.length) return false

  const targetFull = resolve(PROJECT_ROOT, item.suggestion)
  const newTarget = buildRelativeRef(item.source, item.suggestion)

  const oldLine = lines[lineIndex]
  const escapedOld = escapeRegExp(item.target)
  const newLine = oldLine.replace(new RegExp(escapedOld, 'g'), newTarget)

  if (newLine === oldLine) return false

  lines[lineIndex] = newLine
  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return true
}

function main(): void {
  if (!existsSync(REVIEW_PATH)) {
    console.error(`❌ 复核清单不存在: ${REVIEW_PATH}`)
    process.exit(1)
  }

  const review: ReviewData = JSON.parse(readFileSync(REVIEW_PATH, 'utf-8'))
  const multi = review.multi || []

  console.log(`[${new Date().toISOString()}] 开始${isDryRun ? '预览' : '应用'}多匹配引用修复...`)
  console.log(`模式: ${isDryRun ? 'DRY-RUN' : 'APPLY'}`)
  console.log(`待处理多匹配引用: ${multi.length}`)

  const result: FixResult = { applied: [], failed: [], skippedDuplicate: 0 }
  const seen = new Set<string>()

  for (const item of multi) {
    const key = `${item.source}:${item.line}:${item.target}`
    if (seen.has(key)) {
      result.skippedDuplicate++
      continue
    }
    seen.add(key)

    const targetFull = resolve(PROJECT_ROOT, item.suggestion)
    const exists = existsSync(targetFull)
    const existsAsDir = !exists && existsSync(dirname(targetFull)) && statSync(dirname(targetFull)).isDirectory()

    if (!exists && !existsAsDir) {
      result.failed.push(item)
      continue
    }

    if (isDryRun) {
      const newTarget = buildRelativeRef(item.source, item.suggestion)
      console.log(`  ${normalizePath(item.source)}:${item.line}`)
      console.log(`    ${item.target} → ${newTarget}`)
      result.applied.push(item)
    } else {
      const success = applyFix(item)
      if (success) {
        result.applied.push(item)
      } else {
        result.failed.push(item)
      }
    }
  }

  console.log('\n修复结果统计:')
  console.log(`  可应用: ${result.applied.length}`)
  console.log(`  失败: ${result.failed.length}`)
  console.log(`  跳过重复: ${result.skippedDuplicate}`)

  if (!isDryRun && result.failed.length > 0) {
    const failedPath = join(PROJECT_ROOT, 'scripts', 'docs', 'reports', 'audit', 'multi-match-fix-failed.json')
    writeFileSync(failedPath, JSON.stringify(result.failed, null, 2), 'utf-8')
    console.log(`\n失败清单已保存: ${failedPath}`)
  }

  console.log(`[${new Date().toISOString()}] 多匹配修复流程结束`)
}

main()
