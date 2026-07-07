/**
 * 测试脚本审计工具
 * @description 自动检测测试文件中的违规问题
 */

import { glob } from 'glob'
import { readFile } from 'fs/promises'
import path from 'path'

interface AuditResult {
  file: string
  issues: AuditIssue[]
}

interface AuditIssue {
  line: number
  severity: 'error' | 'warning'
  rule: string
  message: string
}

async function auditTestFile(filePath: string): Promise<AuditResult> {
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  const issues: AuditIssue[] = []

  lines.forEach((line, index) => {
    // 规则 1: 检测 any 类型
    if (/:\s*any\b/.test(line) && !line.includes('// eslint-disable')) {
      issues.push({
        line: index + 1,
        severity: 'error',
        rule: 'no-any',
        message: '禁止使用 any 类型，请使用明确的类型定义',
      })
    }

    // 规则 2: 检测硬编码颜色（排除令牌定义文件）
    if (
      /['"]#[0-9a-fA-F]{6}['"]/.test(line) &&
      !filePath.includes('theme.tokens.ts') &&
      !filePath.includes('chartColors.ts') &&
      !line.includes('STOCK_COLOR_TOKENS') &&
      !line.includes('COLOR_TOKENS')
    ) {
      issues.push({
        line: index + 1,
        severity: 'warning',
        rule: 'no-hardcoded-colors',
        message: '颜色值应通过令牌系统引用',
      })
    }

    // 规则 3: 检测 describe.skip（应使用 @status 注释）
    if (/describe\.skip\(/.test(line)) {
      issues.push({
        line: index + 1,
        severity: 'warning',
        rule: 'no-describe-skip',
        message: '请使用 @status known-failing 注释代替 describe.skip',
      })
    }

    // 规则 4: 检测英文测试描述（应为中文）
    if (/it\(['"]should\s/.test(line)) {
      issues.push({
        line: index + 1,
        severity: 'warning',
        rule: 'chinese-test-description',
        message: '测试描述应使用中文',
      })
    }

    // 规则 5: 检测 @ts-ignore
    if (/@ts-ignore/.test(line)) {
      issues.push({
        line: index + 1,
        severity: 'error',
        rule: 'no-ts-ignore',
        message: '禁止使用 @ts-ignore，请使用 @ts-expect-error 并说明原因',
      })
    }
  })

  return { file: filePath, issues }
}

async function main() {
  const testFiles = await glob('**/*.test.{ts,tsx}', {
    ignore: ['node_modules/**', 'dist/**', 'e2e/**'],
  })

  console.log(`审计 ${testFiles.length} 个测试文件...\n`)

  const results: AuditResult[] = []
  let totalIssues = 0

  for (const file of testFiles) {
    const result = await auditTestFile(file)
    if (result.issues.length > 0) {
      results.push(result)
      totalIssues += result.issues.length
    }
  }

  // 输出结果
  if (results.length === 0) {
    console.log('✅ 所有测试文件通过审计')
    process.exit(0)
  }

  console.log(`❌ 发现 ${totalIssues} 个问题：\n`)

  results.forEach((result) => {
    console.log(`📄 ${result.file}`)
    result.issues.forEach((issue) => {
      const icon = issue.severity === 'error' ? '❌' : '⚠️'
      console.log(`  ${icon} L${issue.line}: [${issue.rule}] ${issue.message}`)
    })
    console.log()
  })

  // 统计
  const errors = results.flatMap((r) => r.issues).filter((i) => i.severity === 'error').length
  const warnings = results.flatMap((r) => r.issues).filter((i) => i.severity === 'warning').length

  console.log('═══════════════════════════════════════')
  console.log(`总计: ${errors} 个错误, ${warnings} 个警告`)
  console.log('═══════════════════════════════════════')

  process.exit(errors > 0 ? 1 : 0)
}

main().catch(console.error)
