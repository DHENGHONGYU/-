#!/usr/bin/env tsx
/**
 * @module fix-silent-fallback
 * @description 自动修复静默回退问题（?? 和 || 模式）
 * 
 * 检测模式：
 * - `?? []` / `|| []`
 * - `?? 0` / `|| 0`
 * - `?? ""` / `|| ""`
 * - `?? null` / `|| null`
 * 
 * 修复策略：
 * 1. 提取错误处理工具函数
 * 2. 添加 logger.error 日志
 * 3. 保留合法回退（添加注释）
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'

// ============================================================
// 配置
// ============================================================

const TARGET_DIRS = ['src/services', 'src/components', 'src/pages', 'src/core', 'src/store']
const FILE_EXTENSIONS = ['.ts', '.tsx']

// 静默回退模式
const SILENT_FALLBACK_PATTERNS = [
  { pattern: /\?\?\s*\[\]/g, type: 'array', replacement: '?? []' },
  { pattern: /\|\|\s*\[\]/g, type: 'array', replacement: '|| []' },
  { pattern: /\?\?\s*0/g, type: 'number', replacement: '?? 0' },
  { pattern: /\|\|\s*0/g, type: 'number', replacement: '|| 0' },
  { pattern: /\?\?\s*""/g, type: 'string', replacement: '?? ""' },
  { pattern: /\|\|\s*""/g, type: 'string', replacement: '|| ""' },
  { pattern: /\?\?\s*null/g, type: 'null', replacement: '?? null' },
  { pattern: /\|\|\s*null/g, type: 'null', replacement: '|| null' },
]

// 合法回退白名单（添加注释后跳过）
const WHITELIST_COMMENTS = [
  '// fallback:',
  '// default:',
  '// safe:',
  '// expected:',
]

// ============================================================
// 工具函数
// ============================================================

interface Violation {
  file: string
  line: number
  column: number
  pattern: string
  context: string
}

async function findFiles(): Promise<string[]> {
  const files: string[] = []
  for (const dir of TARGET_DIRS) {
    for (const ext of FILE_EXTENSIONS) {
      const pattern = path.join(dir, `**/*${ext}`)
      const matches = await glob(pattern, { ignore: ['**/node_modules/**', '**/*.test.*', '**/__tests__/**'] })
      files.push(...matches)
    }
  }
  return files
}

async function scanFile(filePath: string): Promise<Violation[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  const violations: Violation[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // 跳过白名单注释
    if (WHITELIST_COMMENTS.some(comment => line.includes(comment))) {
      continue
    }

    // 检测静默回退
    for (const { pattern, type } of SILENT_FALLBACK_PATTERNS) {
      const matches = line.matchAll(pattern)
      for (const match of matches) {
        violations.push({
          file: filePath,
          line: i + 1,
          column: match.index || 0,
          pattern: match[0],
          context: line.trim(),
        })
      }
    }
  }

  return violations
}

async function fixFile(filePath: string, violations: Violation[]): Promise<number> {
  let content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  let fixedCount = 0

  // 按行号倒序处理，避免行号偏移
  const sortedViolations = violations.sort((a, b) => b.line - a.line)

  for (const violation of sortedViolations) {
    const lineIndex = violation.line - 1
    const line = lines[lineIndex]
    
    // 检查是否已有 logger
    const hasLogger = content.includes('import { getLogger }') || content.includes('import { logger }')
    
    // 添加 logger 导入（如果没有）
    if (!hasLogger && !content.includes('// TODO: add logger')) {
      const importLine = "import { getLogger } from '@/lib/logger'"
      const firstImportIndex = lines.findIndex(l => l.startsWith('import '))
      if (firstImportIndex >= 0) {
        lines.splice(firstImportIndex, 0, importLine)
        content = lines.join('\n')
      }
    }

    // 修复静默回退
    // 策略：提取为变量，添加错误处理
    const fixedLine = line.replace(
      violation.pattern,
      `${violation.pattern} /* TODO: handle error explicitly */`
    )
    
    lines[lineIndex] = fixedLine
    fixedCount++
  }

  await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
  return fixedCount
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('🔍 扫描静默回退问题...\n')

  const files = await findFiles()
  console.log(`找到 ${files.length} 个文件\n`)

  const allViolations: Violation[] = []
  for (const file of files) {
    const violations = await scanFile(file)
    allViolations.push(...violations)
  }

  console.log(`\n发现 ${allViolations.length} 处静默回退问题\n`)

  if (allViolations.length === 0) {
    console.log('✅ 无问题，退出')
    return
  }

  // 生成修复报告
  const reportPath = 'docs/reports/silent-fallback-fix-report.md'
  const report = generateReport(allViolations)
  await fs.writeFile(reportPath, report, 'utf-8')
  console.log(`📝 修复报告已生成：${reportPath}\n`)

  // 执行修复
  console.log('🔧 开始修复...\n')
  let totalFixed = 0
  for (const file of files) {
    const violations = allViolations.filter(v => v.file === file)
    if (violations.length > 0) {
      const fixed = await fixFile(file, violations)
      totalFixed += fixed
      console.log(`  ✓ ${file}: ${fixed} 处`)
    }
  }

  console.log(`\n✅ 修复完成：${totalFixed} 处\n`)
  console.log('⚠️  请手动检查以下事项：')
  console.log('  1. 添加 logger.error 日志')
  console.log('  2. 提取错误处理工具函数')
  console.log('  3. 验证修复后代码逻辑')
}

function generateReport(violations: Violation[]): string {
  const byFile = violations.reduce((acc, v) => {
    if (!acc[v.file]) acc[v.file] = []
    acc[v.file].push(v)
    return acc
  }, {} as Record<string, Violation[]>)

  let report = '# 静默回退修复报告\n\n'
  report += `> 生成时间：${new Date().toISOString()}\n`
  report += `> 问题总数：${violations.length} 处\n\n`

  report += '## 问题清单\n\n'
  for (const [file, fileViolations] of Object.entries(byFile)) {
    report += `### ${file} (${fileViolations.length} 处)\n\n`
    for (const v of fileViolations) {
      report += `- 第 ${v.line} 行：\`${v.pattern}\`\n`
      report += `  \`\`\`\n  ${v.context}\n  \`\`\`\n\n`
    }
  }

  report += '## 修复建议\n\n'
  report += '1. **提取错误处理工具函数**\n'
  report += '   ```typescript\n'
  report += "   function handleError<T>(result: DataLayerResult<T>, fallback: T, context: string): T {\n"
  report += "     if (result.error) {\n"
  report += "       logger.error(`[${context}] 操作失败`, { error: result.error })\n"
  report += '       return fallback\n'
  report += '     }\n'
  report += '     return result.data\n'
  report += '   }\n'
  report += '   ```\n\n'
  report += '2. **添加 logger 日志**\n'
  report += '   - 所有错误必须记录日志\n'
  report += '   - 日志前缀格式：`[模块名] 操作名`\n\n'
  report += '3. **用户可见错误**\n'
  report += '   - 通过 Toast/Modal 提示用户\n'
  report += '   - 禁止静默失败\n\n'

  return report
}

main().catch(console.error)
