#!/usr/bin/env tsx
/**
 * audit-version-drift.ts
 * 文档版本漂移检查脚本
 *
 * 检查目标：
 * 1. docs/ 下所有 Markdown 文件的 frontmatter 中 `code_version` 是否与 package.json version 一致
 * 2. 无 frontmatter 或 frontmatter 中无 code_version 的文档跳过检查
 *
 * 退出码：0=通过, 1=有违规
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DOCS_DIR = join(ROOT, 'docs')

interface Finding {
  file: string
  expected: string
  actual: string | null
}

function getPackageVersion(): string | null {
  const pkgPath = join(ROOT, 'package.json')
  if (!existsSync(pkgPath)) return null
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }
    return pkg.version ?? null
  } catch {
    return null
  }
}

function extractFrontmatterCodeVersion(content: string): string | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return null
  const fm = match[1] ?? ''
  const versionMatch = fm.match(/^code_version:\s*["']?([^"'\n]+)["']?$/m)
  return versionMatch?.[1]?.trim() ?? null
}

function scanDir(dir: string, findings: Finding[], expectedVersion: string): number {
  let count = 0
  if (!existsSync(dir)) return count

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const childPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      count += scanDir(childPath, findings, expectedVersion)
    } else if (entry.name.endsWith('.md')) {
      count++
      const content = readFileSync(childPath, 'utf-8')
      const codeVersion = extractFrontmatterCodeVersion(content)
      if (codeVersion && codeVersion !== expectedVersion) {
        findings.push({
          file: childPath.replace(`${ROOT}/`, ''),
          expected: expectedVersion,
          actual: codeVersion,
        })
      }
    }
  }
  return count
}

function main(): void {
  console.log('══════════════════════════════════════════════════════════════')
  console.log('  文档版本漂移检查 — audit-version-drift.ts')
  console.log('══════════════════════════════════════════════════════════════')
  console.log()

  const expectedVersion = getPackageVersion()
  if (!expectedVersion) {
    console.log('❌ 无法读取 package.json version')
    process.exit(2)
  }

  const findings: Finding[] = []
  const totalFiles = scanDir(DOCS_DIR, findings, expectedVersion)

  if (findings.length === 0) {
    console.log(`✅ 文档版本一致（package.json version: ${expectedVersion}，检查 ${totalFiles} 个文档）`)
    console.log()
    process.exit(0)
  } else {
    console.log(`❌ 发现 ${findings.length} 处文档版本漂移（package.json version: ${expectedVersion}）`)
    console.log()
    for (const f of findings) {
      console.log(`  📄 ${f.file}: expected ${f.expected}, actual ${f.actual}`)
    }
    console.log()
    process.exit(1)
  }
}

main()
