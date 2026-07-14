#!/usr/bin/env tsx
/**
 * @module scripts/replace-date-now-ids
 * @description 自动将代码中使用 Date.now() / Math.random() 生成 ID 的写法替换为 nanoid
 *
 * 替换范围：
 * - id / traceId / orderId / sessionId / instanceId / planId / signalId 等标识字段的模板字面量
 * - generateId() / createTraceId() 等工具函数实现
 * - const id = Date.now() 这类独立 ID 赋值
 *
 * 跳过范围（仅作时间戳使用的字段）：
 * - createdAt / updatedAt / executedAt / appliedAt / lastRefresh / expiresAt / nextRun
 * - scoredAt / timestamp / now 等
 *
 * 用法：
 *   npx tsx scripts/replace-date-now-ids.ts          # 执行替换
 *   npx tsx scripts/replace-date-now-ids.ts --dry-run # 仅打印 diff
 */

import * as fs from 'fs'
import * as path from 'path'

// ============================================================
// 配置
// ============================================================

const DRY_RUN = process.argv.includes('--dry-run')

const TARGET_DIRS = ['src']

const EXTENSIONS = ['.ts', '.tsx']

// 跳过包含以下时间戳字段的行（避免误替换）
const TIMESTAMP_FIELDS = [
  'createdAt',
  'updatedAt',
  'executedAt',
  'appliedAt',
  'lastRefresh',
  'expiresAt',
  'nextRun',
  'scoredAt',
  'timestamp',
  'bookmarkedAt',
  'analyzedAt',
  'detectedAt',
  'addedAt',
  'calculatedAt',
  'generatedAt',
  'publishedAt',
  'targetDate',
  'date:',
]

// 标识字段关键词（行中包含这些赋值目标才替换）
const IDENTITY_KEYWORDS = [
  'id',
  'traceId',
  'orderId',
  'sessionId',
  'instanceId',
  'planId',
  'signalId',
]

// ============================================================
// 工具函数
// ============================================================

function isTimestampLine(line: string): boolean {
  return TIMESTAMP_FIELDS.some((field) => line.includes(field))
}

function isIdentityLine(line: string): boolean {
  return IDENTITY_KEYWORDS.some((keyword) => {
    const patterns = [
      new RegExp(`\\b${keyword}\\s*:\\s*`),
      new RegExp(`\\bconst\\s+${keyword}\\s*=`),
      new RegExp(`\\blet\\s+${keyword}\\s*=`),
      new RegExp(`\\bvar\\s+${keyword}\\s*=`),
    ]
    return patterns.some((p) => p.test(line))
  })
}

function hasNanoidImport(content: string): boolean {
  return /import\s+\{\s*nanoid\s*\}\s+from\s+['"]nanoid['"]/.test(content)
}

function addNanoidImport(content: string): string {
  if (hasNanoidImport(content)) return content

  const importRegex = /^(import\s+.*?\s+from\s+['"][^'"]+['"];?\s*)$/gm
  const imports: string[] = []
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[0])
  }

  if (imports.length === 0) {
    return `import { nanoid } from 'nanoid'\n\n${content}`
  }

  const lastImport = imports[imports.length - 1]
  if (!lastImport) {
    return `import { nanoid } from 'nanoid'\n\n${content}`
  }

  const insertIndex = content.indexOf(lastImport) + lastImport.length
  return `${content.slice(0, insertIndex)}\nimport { nanoid } from 'nanoid'${content.slice(insertIndex)}`
}

function walk(dir: string): string[] {
  const result: string[] = []
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      result.push(...walk(fullPath))
    } else if (stat.isFile() && EXTENSIONS.includes(path.extname(fullPath))) {
      result.push(fullPath)
    }
  }
  return result
}

function processLine(line: string): { newLine: string; changed: boolean } {
  if (isTimestampLine(line)) return { newLine: line, changed: false }
  if (!isIdentityLine(line)) return { newLine: line, changed: false }

  let newLine = line
  let changed = false

  // 1. Date.now() + Math.random() 组合：xxx-${Date.now()}-${Math.random().slice(...)}
  const combinedPattern = /\$\{Date\.now\(\)\}(-\$\{Math\.random\(\)\.toString\(36\)\.slice\([^)]+\)\})+/g
  if (combinedPattern.test(newLine)) {
    newLine = newLine.replace(combinedPattern, '${nanoid(8)}')
    changed = true
  }

  // 2. Date.now() + 其他后缀变量：xxx-${Date.now()}-${symbol}
  const suffixPattern = /\$\{Date\.now\(\)\}(-\$\{[^}]+\})/g
  if (suffixPattern.test(newLine)) {
    newLine = newLine.replace(suffixPattern, '${nanoid(8)}$1')
    changed = true
  }

  // 3. 剩余单独的 Date.now()
  const dateNowPattern = /\$\{Date\.now\(\)\}/g
  if (dateNowPattern.test(newLine)) {
    newLine = newLine.replace(dateNowPattern, '${nanoid(8)}')
    changed = true
  }

  // 4. const id = Date.now() / let id = Date.now()
  const plainIdPattern = /\b(const|let|var)\s+(id)\s*=\s*Date\.now\(\)/g
  if (plainIdPattern.test(newLine)) {
    newLine = newLine.replace(plainIdPattern, '$1 $2 = nanoid()')
    changed = true
  }

  return { newLine, changed }
}

function replaceFunctionBodies(content: string): { newContent: string; changed: boolean } {
  let newContent = content
  let changed = false

  // generateId 函数体：支持多行、不同空格
  const generateIdPattern = /function\s+generateId\s*\(\s*\)\s*:\s*string\s*\{[\s\S]*?return\s+`\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\([^)]+\)\}`\s*;?\s*\}/g
  if (generateIdPattern.test(newContent)) {
    newContent = newContent.replace(generateIdPattern, `function generateId(): string {\n  return nanoid(16)\n}`)
    changed = true
  }

  // createTraceId 函数体
  const createTraceIdPattern = /function\s+createTraceId\s*\([^)]*\)\s*:\s*string\s*\{[\s\S]*?return\s+`\$\{prefix\}-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\([^)]+\)\}`\s*;?\s*\}/g
  if (createTraceIdPattern.test(newContent)) {
    newContent = newContent.replace(createTraceIdPattern, `function createTraceId(prefix: string): string {\n  return \`\${prefix}-\${nanoid(8)}\`\n}`)
    changed = true
  }

  return { newContent, changed }
}

function applyRules(content: string, _filePath: string): { newContent: string; changes: string[] } {
  const changes: string[] = []
  let newContent = content
  let replaced = false

  // 阶段 1：替换工具函数体
  const functionResult = replaceFunctionBodies(newContent)
  if (functionResult.changed) {
    newContent = functionResult.newContent
    changes.push('[generateId/createTraceId-function] replaced Date.now()/Math.random() with nanoid')
    replaced = true
  }

  // 阶段 2：逐行替换标识字段中的 Date.now()
  const lines = newContent.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const { newLine, changed } = processLine(lines[i] as string)
    if (changed) {
      changes.push(`[line-${i + 1}] ${(lines[i] as string).trim()}`)
      lines[i] = newLine
      replaced = true
    }
  }
  newContent = lines.join('\n')

  if (replaced && !hasNanoidImport(newContent)) {
    newContent = addNanoidImport(newContent)
  }

  return { newContent, changes }
}

// ============================================================
// 主流程
// ============================================================

function main(): void {
  const files = TARGET_DIRS.flatMap((dir) => walk(path.resolve(process.cwd(), dir)))
  const summary: { file: string; changes: string[] }[] = []
  let totalChanges = 0

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const { newContent, changes } = applyRules(content, file)

    if (changes.length === 0) continue

    totalChanges += changes.length
    summary.push({ file: path.relative(process.cwd(), file), changes })

    if (DRY_RUN) {
      console.log(`\n[DRY-RUN] ${file}`)
      for (const change of changes) {
        console.log(`  - ${change}`)
      }
    } else {
      fs.writeFileSync(file, newContent, 'utf-8')
      console.log(`[REPLACED] ${file} (${changes.length} changes)`)
    }
  }

  console.log(`\n${DRY_RUN ? 'DRY-RUN' : 'DONE'}: ${totalChanges} Date.now() ID patterns processed across ${summary.length} files`)

  if (summary.length > 0) {
    console.log('\nDetailed changes:')
    for (const item of summary) {
      console.log(`\n${item.file}`)
      for (const change of item.changes) {
        console.log(`  - ${change}`)
      }
    }
  }
}

main()
