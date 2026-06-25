#!/usr/bin/env tsx
/**
 * audit-hardcode.ts
 * 硬编码与静默回退扫描器
 *
 * 检查目标：
 * 1. config/ 中是否存在硬编码股票代码（未标注）。
 * 2. services/ / core/ 中是否存在魔法数字（3 位以上，非时间/索引常量）。
 * 3. components/ / pages/ 中是否存在 HEX 颜色或 Tailwind 颜色类名。
 * 4. 全项目（除测试/配置）中是否存在静默回退模式（?? [] / || 0 等）。
 *
 * 输出：违规列表 + 汇总；退出码 1 表示发现 Fatal 级违规。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Finding {
  file: string
  line: number
  severity: 'Fatal' | 'Critical' | 'Major' | 'Minor'
  category: string
  message: string
  context: string
}

interface Report {
  findings: Finding[]
  summary: {
    totalFiles: number
    bySeverity: Record<string, number>
    byCategory: Record<string, number>
  }
}

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

function isTsFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx')
}

function isTestFile(rel: string): boolean {
  return rel.includes('__tests__') || rel.includes('.test.') || rel.includes('.spec.')
}

function collectFiles(dir: string): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      files.push(...collectFiles(full))
    } else if (entry.isFile() && isTsFile(entry.name)) {
      files.push(full)
    }
  }
  return files
}

function relative(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, '/')
}

function scanFile(file: string): Finding[] {
  const findings: Finding[] = []
  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')
  const rel = relative(file)

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

    // 1. Fatal：config/ 中硬编码股票代码（symbols.ts 为合法配置白名单，排除）
    if (rel.startsWith('src/config/') && !rel.includes('audit-exempt') && rel !== 'src/config/symbols.ts') {
      const stockMatch = raw.match(/[^a-zA-Z0-9_.](\d{6}\.(SH|SZ|BJ|HK))[^a-zA-Z0-9_]/)
      if (stockMatch) {
        findings.push({
          file: rel,
          line: i + 1,
          severity: 'Fatal',
          category: '硬编码股票代码',
          message: `config 层出现硬编码股票代码 ${stockMatch[1]}`,
          context: trimmed.slice(0, 80),
        })
      }
    }

    // 2. Major：services/ / core/ 中魔法数字（3 位以上）
    if (
      (rel.startsWith('src/services/') || rel.startsWith('src/core/')) &&
      !isTestFile(rel) &&
      !rel.includes('audit-exempt')
    ) {
      // 匹配 3 位以上数字，但排除数组索引 [0]、[1] 等上下文
      const magicMatch = raw.match(/[^0-9a-zA-Z_\.\[\]]([0-9]{3,})[^0-9a-zA-Z_\.]/)
      if (magicMatch) {
        const num = Number(magicMatch[1])
        // 排除常见时间常量：1000, 60, 24, 3600, 86400
        const commonTimeConstants = [1000, 60000, 3600000, 86400000]
        const simpleTime = [60, 24, 3600, 86400]
        if (!commonTimeConstants.includes(num) && !simpleTime.includes(num)) {
          findings.push({
            file: rel,
            line: i + 1,
            severity: 'Major',
            category: '魔法数字',
            message: `引擎层出现未解释数字 ${magicMatch[1]}`,
            context: trimmed.slice(0, 80),
          })
        }
      }
    }

    // 3. Major：UI 层 HEX 颜色
    if (
      (rel.startsWith('src/components/') || rel.startsWith('src/pages/')) &&
      !isTestFile(rel) &&
      !rel.includes('audit-exempt')
    ) {
      const hexMatch = raw.match(/#[0-9a-fA-F]{3,6}\b/)
      if (hexMatch) {
        findings.push({
          file: rel,
          line: i + 1,
          severity: 'Major',
          category: '硬编码 HEX 颜色',
          message: `UI 层出现硬编码颜色 ${hexMatch[0]}`,
          context: trimmed.slice(0, 80),
        })
      }

      // Tailwind 颜色类：text-red-500, bg-slate-100, border-blue-200 等
      const twMatch = raw.match(/\b(bg|text|border|shadow|ring|from|to|via|stroke|fill)-([a-z]+-[0-9]+)/)
      if (twMatch) {
        findings.push({
          file: rel,
          line: i + 1,
          severity: 'Major',
          category: '硬编码 Tailwind 颜色类',
          message: `UI 层出现硬编码 Tailwind 颜色类 ${twMatch[0]}`,
          context: trimmed.slice(0, 80),
        })
      }
    }

    // 4. Critical：静默回退模式
    if (!isTestFile(rel) && !rel.includes('audit-exempt') && !rel.startsWith('src/config/fallback')) {
      const fallbackPatterns = [
        { regex: /\?\?\s*\[\]/, text: '?? []' },
        { regex: /\|\|\s*\[\]/, text: '|| []' },
        { regex: /\?\?\s*0\b/, text: '?? 0' },
        { regex: /\|\|\s*0\b/, text: '|| 0' },
        { regex: /\?\?\s*["']/, text: '?? ""' },
        { regex: /\|\|\s*["']/, text: '|| ""' },
        { regex: /\?\?\s*null\b/, text: '?? null' },
        { regex: /\|\|\s*null\b/, text: '|| null' },
      ]
      for (const pattern of fallbackPatterns) {
        const match = raw.match(pattern.regex)
        if (match) {
          findings.push({
            file: rel,
            line: i + 1,
            severity: 'Critical',
            category: '静默回退',
            message: `发现静默回退模式 ${pattern.text}`,
            context: trimmed.slice(0, 80),
          })
        }
      }
    }
  }

  return findings
}

function scan(): Report {
  const files = collectFiles(SRC)
  const findings: Finding[] = []
  for (const file of files) {
    findings.push(...scanFile(file))
  }

  const bySeverity: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1
  }

  return {
    findings,
    summary: {
      totalFiles: files.length,
      bySeverity,
      byCategory,
    },
  }
}

function main(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  硬编码与静默回退审计 — audit-hardcode.ts                  ║')
  console.log('╚════════════════════════════════════════════════════════════\n')

  const report = scan()
  const fatalCount = report.summary.bySeverity.Fatal ?? 0
  const criticalCount = report.summary.bySeverity.Critical ?? 0

  if (report.findings.length === 0) {
    console.log('✅ 未发现硬编码或静默回退')
  } else {
    console.log(`发现 ${report.findings.length} 处问题：\n`)
    for (const f of report.findings) {
      console.log(`  ${f.file}:${f.line} [${f.severity}] ${f.category}`)
      console.log(`    ${f.message}`)
      console.log(`    ${f.context}`)
      console.log()
    }

    console.log('按严重度汇总：')
    for (const [sev, count] of Object.entries(report.summary.bySeverity)) {
      console.log(`  ${sev}: ${count}`)
    }
    console.log('\n按类别汇总：')
    for (const [cat, count] of Object.entries(report.summary.byCategory)) {
      console.log(`  ${cat}: ${count}`)
    }
  }

  console.log('────────────────────────────────────────────────────────────')
  console.log(`扫描文件数: ${report.summary.totalFiles}`)
  console.log(`问题总数: ${report.findings.length}`)
  console.log('────────────────────────────────────────────────────────────\n')

  if (fatalCount > 0) {
    console.log('❌ 存在 Fatal 级硬编码，必须修正')
    process.exit(1)
  }

  if (criticalCount > 100) {
    console.log('⚠️ 静默回退超过 100 处，建议收敛')
  }

  process.exit(0)
}

main()
