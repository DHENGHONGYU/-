#!/usr/bin/env node
/**
 * @module scripts/apply-doc-refs-review
 * @description 应用 doc-refs-manual-review.json 中的多匹配修复建议
 *
 * 用法：
 *   npx tsx scripts/apply-doc-refs-review.ts          # 预览
 *   npx tsx scripts/apply-doc-refs-review.ts --apply  # 应用
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const args = process.argv.slice(2)
const isDryRun = !args.includes('--apply')
const scopePrefix = args.find(a => a.startsWith('--scope='))?.replace('--scope=', '') || ''
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.replace('--limit=', '') || '0', 10) || Infinity
const reviewPath = resolve(process.cwd(), 'scripts/docs/reports/audit/doc-refs-manual-review.json')

interface ReviewItem {
  source: string
  line: number
  target: string
  suggestion: string
}

interface ReviewData {
  multi: ReviewItem[]
  none: ReviewItem[]
  ignored: ReviewItem[]
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

function verifySuggestion(item: ReviewItem): boolean {
  const sourceDir = dirname(resolve(process.cwd(), item.source))
  const realPath = resolve(sourceDir, item.suggestion)
  return existsSync(realPath)
}

function applySuggestion(item: ReviewItem): boolean {
  const filePath = resolve(process.cwd(), item.source)
  if (!existsSync(filePath)) return false

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const lineIndex = item.line - 1
  if (lineIndex < 0 || lineIndex >= lines.length) return false

  const oldTarget = item.target
  const newTarget = item.suggestion

  if (!lines[lineIndex].includes(oldTarget)) {
    // 目标不在预期行，尝试整文件替换（防御性）
    if (!content.includes(oldTarget)) return false
    const escapedOld = oldTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const newContent = content.replace(new RegExp(escapedOld, 'g'), newTarget)
    writeFileSync(filePath, newContent, 'utf-8')
    return true
  }

  const escapedOld = oldTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  lines[lineIndex] = lines[lineIndex].replace(new RegExp(escapedOld, 'g'), newTarget)
  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return true
}

function main(): void {
  const review: ReviewData = JSON.parse(readFileSync(reviewPath, 'utf-8'))
  let multi = review.multi

  if (scopePrefix) {
    multi = multi.filter(i => normalizePath(i.source).startsWith(normalizePath(scopePrefix)))
  }
  if (limit !== Infinity) {
    multi = multi.slice(0, limit)
  }

  console.log(`[${new Date().toISOString()}] 开始处理多匹配修复建议`)
  console.log(`模式: ${isDryRun ? 'DRY-RUN（预览）' : 'APPLY（应用）'}`)
  console.log(`处理条数: ${multi.length}`)
  if (scopePrefix) console.log(`来源范围: ${scopePrefix}`)

  let verified = 0
  const failed: ReviewItem[] = []

  for (const item of multi) {
    const ok = verifySuggestion(item)
    if (ok) verified++

    if (!isDryRun) {
      if (ok && applySuggestion(item)) {
        // 成功
      } else {
        failed.push(item)
      }
    }
  }

  console.log(`\n建议目标存在: ${verified}/${multi.length}`)

  if (!isDryRun) {
    console.log(`应用成功: ${multi.length - failed.length}/${multi.length}`)
    if (failed.length > 0) {
      console.log(`应用失败: ${failed.length}`)
      const reportPath = resolve(process.cwd(), 'scripts/docs/reports/audit/doc-refs-apply-failed.json')
      writeFileSync(reportPath, JSON.stringify(failed, null, 2), 'utf-8')
      console.log(`失败清单已保存: ${reportPath}`)
    }
  }

  console.log(`\n[${new Date().toISOString()}] 处理结束`)
  if (isDryRun) {
    console.log('提示: 使用 --apply 参数应用修复')
  }
}

main()
