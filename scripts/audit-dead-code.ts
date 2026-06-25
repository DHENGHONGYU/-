#!/usr/bin/env tsx
/**
 * audit-dead-code.ts
 * 死代码/空壳/路由一致性扫描器
 *
 * 检查目标：
 * 1. src/ 下是否存在空函数、空组件、仅返回 null 的组件。
 * 2. src/config/routes.ts 中注册的路由是否对应真实存在的页面文件。
 * 3. pages/ 下是否存在未在路由表中注册的页面文件（仅提示）。
 *
 * 输出：问题列表 + 汇总；退出码 1 表示存在缺失路由文件。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Issue {
  file: string
  line: number
  type: string
  message: string
  context: string
}

interface Report {
  issues: Issue[]
  summary: {
    totalFiles: number
    emptyFunctions: number
    missingRouteFiles: number
    unregisteredPages: number
  }
}

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const ROUTES_FILE = path.join(SRC, 'config', 'routes.ts')

function isTsFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx')
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

function relativeFromRoot(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, '/')
}

function relativeFromSrc(file: string): string {
  return path.relative(SRC, file).replace(/\\/g, '/').replace(/\.tsx$/, '').replace(/\.ts$/, '')
}

function scanEmptyFunctions(file: string): Issue[] {
  const issues: Issue[] = []
  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')
  const rel = relativeFromRoot(file)

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue

    // 空箭头函数：const X = () => {}
    const emptyArrow = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\))?\s*=>\s*\{\s*\}/
    const arrowMatch = raw.match(emptyArrow)
    if (arrowMatch) {
      issues.push({
        file: rel,
        line: i + 1,
        type: '空函数',
        message: `空箭头函数 ${arrowMatch[1]}`,
        context: trimmed.slice(0, 80),
      })
      continue
    }

    // 空函数：function X() {}
    const emptyFunc = /function\s+(\w+)\s*\([^)]*\)\s*\{\s*\}/
    const funcMatch = raw.match(emptyFunc)
    if (funcMatch) {
      issues.push({
        file: rel,
        line: i + 1,
        type: '空函数',
        message: `空函数 ${funcMatch[1]}`,
        context: trimmed.slice(0, 80),
      })
      continue
    }

    // 仅返回 null 的组件（单文件内）
    const nullReturn = /return\s+null\s*;?\s*$/
    if (nullReturn.test(trimmed) && rel.endsWith('.tsx')) {
      issues.push({
        file: rel,
        line: i + 1,
        type: '条件返回 null',
        message: '组件在条件分支中返回 null（请确认是否为预期空状态）',
        context: trimmed.slice(0, 80),
      })
    }
  }

  return issues
}

function parseRoutes(): string[] {
  if (!fs.existsSync(ROUTES_FILE)) {
    return []
  }
  const content = fs.readFileSync(ROUTES_FILE, 'utf-8')
  const importPaths: string[] = []
  const regex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    importPaths.push(match[1])
  }
  return importPaths
}

function resolveImportPath(importPath: string): string | null {
  if (importPath.startsWith('@/')) {
    const sub = importPath.slice(2)
    const candidates = [
      path.join(SRC, `${sub}.tsx`),
      path.join(SRC, `${sub}.ts`),
    ]
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}

function scanRouteConsistency(): Issue[] {
  const issues: Issue[] = []
  const importPaths = parseRoutes()

  for (const importPath of importPaths) {
    const resolved = resolveImportPath(importPath)
    if (!resolved) {
      issues.push({
        file: relativeFromRoot(ROUTES_FILE),
        line: 0,
        type: '路由文件缺失',
        message: `路由导入的文件不存在: ${importPath}`,
        context: importPath,
      })
    }
  }

  // 反向检查：pages/ 下 .tsx 文件是否被注册
  const pagesDir = path.join(SRC, 'pages')
  if (fs.existsSync(pagesDir)) {
    const pageFiles = collectFiles(pagesDir)
      .map(relativeFromSrc)
      .filter((f) => !f.includes('.test.'))

    const registeredPaths = new Set(
      importPaths.map((p) => {
        if (p.startsWith('@/')) return p.slice(2)
        return p
      }),
    )

    for (const pageFile of pageFiles) {
      if (!registeredPaths.has(pageFile)) {
        const displayPath = `src/${pageFile}.tsx`
        issues.push({
          file: displayPath,
          line: 1,
          type: '未注册页面',
          message: `pages/ 下页面未在路由表中注册`,
          context: displayPath,
        })
      }
    }
  }

  return issues
}

function scan(): Report {
  const files = collectFiles(SRC)
  const issues: Issue[] = []

  for (const file of files) {
    issues.push(...scanEmptyFunctions(file))
  }

  issues.push(...scanRouteConsistency())

  return {
    issues,
    summary: {
      totalFiles: files.length,
      emptyFunctions: issues.filter((i) => i.type === '空函数' || i.type === '空组件').length,
      missingRouteFiles: issues.filter((i) => i.type === '路由文件缺失').length,
      unregisteredPages: issues.filter((i) => i.type === '未注册页面').length,
    },
  }
}

function main(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  死代码与路由一致性审计 — audit-dead-code.ts               ║')
  console.log('╚════════════════════════════════════════════════════════════\n')

  const report = scan()

  if (report.issues.length === 0) {
    console.log('✅ 未发现空壳函数/组件或路由不一致')
  } else {
    console.log(`发现 ${report.issues.length} 处问题：\n`)
    for (const issue of report.issues) {
      console.log(`  ${issue.file}:${issue.line} [${issue.type}]`)
      console.log(`    ${issue.message}`)
      console.log(`    ${issue.context}`)
      console.log()
    }
  }

  console.log('────────────────────────────────────────────────────────────')
  console.log(`扫描文件数: ${report.summary.totalFiles}`)
  console.log(`空函数/组件: ${report.summary.emptyFunctions}`)
  console.log(`路由文件缺失: ${report.summary.missingRouteFiles}`)
  console.log(`未注册页面: ${report.summary.unregisteredPages}（仅提示）`)
  console.log('────────────────────────────────────────────────────────────\n')

  if (report.summary.missingRouteFiles > 0) {
    console.log('❌ 存在路由文件缺失，请补全组件或清理路由表')
    process.exit(1)
  }

  process.exit(0)
}

main()
