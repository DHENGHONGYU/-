#!/usr/bin/env node
// 代码-文档同步审计脚本
// 扫描 src/ 中新增/修改的文件，检查是否已在文档（docs/*.md、DATA_DEFINITION.md、ARCHITECTURE.md、CHANGELOG.md）中得到体现。
// 用法：npx tsx scripts/audit-doc-sync.ts

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = process.cwd()
const SRC_DIR = join(ROOT, 'src')
const DOCS_DIR = join(ROOT, 'docs')

const DOC_FILES = new Set<string>()

function collectDocs(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      collectDocs(fullPath)
    } else if (entry.endsWith('.md')) {
      DOC_FILES.add(fullPath)
    }
  }
}

collectDocs(DOCS_DIR)
DOC_FILES.add(join(ROOT, 'DATA_DEFINITION.md'))
DOC_FILES.add(join(ROOT, 'ARCHITECTURE.md'))
DOC_FILES.add(join(ROOT, 'CHANGELOG.md'))

const allDocContent = Array.from(DOC_FILES)
  .map((path) => readFileSync(path, 'utf-8'))
  .join('\n')

function getChangedFiles(since = 'HEAD~1'): string[] {
  try {
    const output = execSync(`git diff --name-only ${since} HEAD`, { encoding: 'utf-8', cwd: ROOT })
    return output.split('\n').filter((line) => line.startsWith('src/'))
  } catch {
    console.warn('⚠️  无法获取 git diff，尝试扫描全部 src 文件')
    return []
  }
}

function scanAllSrcFiles(dir: string): string[] {
  const result: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      result.push(...scanAllSrcFiles(fullPath))
    } else if (['.ts', '.tsx'].includes(extname(entry))) {
      result.push(relative(ROOT, fullPath).replace(/\\/g, '/'))
    }
  }
  return result
}

function isLikelyReferenced(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  const fileName = normalized.split('/').pop() ?? ''
  const baseName = fileName.replace(/\.(ts|tsx)$/, '')
  const parts = normalized.split('/')

  // 直接路径引用
  if (allDocContent.includes(normalized)) return true
  // 文件名引用（不含扩展名）
  if (allDocContent.includes(baseName)) return true
  // 目录名引用
  for (const part of parts) {
    if (part === 'src') continue
    if (allDocContent.includes(part)) return true
  }
  return false
}

function main(): void {
  let files = getChangedFiles()
  const scanMode = files.length > 0 ? 'changed' : 'all'
  if (files.length === 0) {
    files = scanAllSrcFiles(SRC_DIR)
  }

  // 过滤掉测试文件、类型声明文件、纯类型 barrel 文件
  const candidates = files.filter((f) => {
    const normalized = f.replace(/\\/g, '/')
    return (
      !normalized.includes('.test.') &&
      !normalized.includes('.d.ts') &&
      !normalized.endsWith('index.ts') &&
      !normalized.endsWith('types.ts')
    )
  })

  const missing: string[] = []
  for (const file of candidates) {
    if (!isLikelyReferenced(file)) {
      missing.push(file)
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  代码-文档同步审计 — audit-doc-sync.ts                     ║')
  console.log('╚════════════════════════════════════════════════════════════\n')
  console.log(`扫描模式: ${scanMode === 'changed' ? 'git diff (HEAD~1..HEAD)' : '全量 src 扫描'}`)
  console.log(`扫描文件数: ${candidates.length}`)
  console.log(`文档文件数: ${DOC_FILES.size}`)
  console.log(`疑似未文档化文件: ${missing.length}`)
  console.log('────────────────────────────────────────────────────────────')

  if (missing.length > 0) {
    console.log('\n以下文件可能尚未在文档中体现：\n')
    for (const file of missing.slice(0, 50)) {
      console.log(`  - ${file}`)
    }
    if (missing.length > 50) {
      console.log(`  ... 还有 ${missing.length - 50} 个文件`)
    }
    console.log('\n⚠️  建议：为新增模块补充数据字典/架构说明，并更新 CHANGELOG.md')
    process.exit(1)
  } else {
    console.log('\n✅ 所有扫描文件均已在文档中找到引用')
  }
}

main()
