/**
 * @module scripts/semantic-validation
 * @description 代码-文档语义级校验脚本
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'

export interface SemanticFinding {
  file: string
  symbolName: string
  symbolType: 'interface' | 'function' | 'type' | 'class'
  missingSemantics: string[]
  matchedSemantics: string[]
}

export interface SemanticReport {
  timestamp: string
  totalFiles: number
  totalViolations: number
  scanMode: 'changed' | 'all'
  findings: SemanticFinding[]
  summary: {
    totalSymbols: number
    matchedSymbols: number
    missingSymbols: number
    coverageRate: number
  }
}

const EXCLUDED_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /\.d\.ts$/,
  /\/(__tests__|__mocks__|fixtures)\//,
]

function isExcluded(filePath: string): boolean {
  return EXCLUDED_PATTERNS.some(pattern => pattern.test(filePath))
}

function getChangedFiles(rootDir: string): string[] {
  try {
    const output = execSync('git diff --name-only HEAD~1 -- src/', {
      encoding: 'utf-8',
      cwd: rootDir,
    }).trim()
    return output
      .split('\n')
      .filter(f => f && f.endsWith('.ts') && !isExcluded(f))
      .map(f => path.join(rootDir, f))
  } catch {
    return []
  }
}

function getAllTsFiles(rootDir: string): string[] {
  const srcDir = path.join(rootDir, 'src')
  const files: string[] = []
  function walk(dir: string) {
    const entries = fs.readdirSync(dir)
    for (const entry of entries) {
      const fullPath = path.join(dir, entry)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (stat.isFile() && fullPath.endsWith('.ts') && !isExcluded(fullPath)) {
        files.push(fullPath)
      }
    }
  }
  walk(srcDir)
  return files
}

interface SymbolInfo {
  name: string
  type: 'interface' | 'function' | 'type' | 'class'
  semantics: string[]
}

function extractInterfaceBody(content: string, startIndex: number): { body: string; endIndex: number } | null {
  let braceCount = 0
  let i = startIndex
  let foundOpen = false
  while (i < content.length) {
    const ch = content[i]
    if (ch === '{') {
      braceCount++
      foundOpen = true
    } else if (ch === '}') {
      braceCount--
      if (foundOpen && braceCount === 0) {
        return { body: content.slice(startIndex, i + 1), endIndex: i }
      }
    }
    i++
  }
  return null
}

function extractSymbols(content: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = []

  // export interface Name { ... }
  const interfaceRegex = /export\s+interface\s+(\w+)/g
  let match: RegExpExecArray | null
  while ((match = interfaceRegex.exec(content)) !== null) {
    const name = match[1]!
    const extracted = extractInterfaceBody(content, match.index + match[0].length)
    if (!extracted) continue
    const semantics = [name]
    const memberRegex = /\b(\w+)\??\s*:/g
    let m: RegExpExecArray | null
    while ((m = memberRegex.exec(extracted.body)) !== null) {
      semantics.push(m[1]!)
    }
    symbols.push({ name, type: 'interface', semantics })
  }

  // export type Name = ...;
  const typeRegex = /export\s+type\s+(\w+)\s*=[^;]+;/g
  while ((match = typeRegex.exec(content)) !== null) {
    const name = match[1]!
    const body = match[0]
    const semantics = [name]
    const memberRegex = /\b(\w+)\??\s*:/g
    let m: RegExpExecArray | null
    while ((m = memberRegex.exec(body)) !== null) {
      semantics.push(m[1]!)
    }
    symbols.push({ name, type: 'type', semantics })
  }

  // export function Name(...) { ... }
  const funcRegex = /export\s+function\s+(\w+)\s*\(/g
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1]!
    const openIdx = content.indexOf('(', match.index + match[0].length - 1)
    let closeIdx = -1
    let parenCount = 0
    for (let i = openIdx; i < content.length; i++) {
      if (content[i] === '(') parenCount++
      else if (content[i] === ')') {
        parenCount--
        if (parenCount === 0) {
          closeIdx = i
          break
        }
      }
    }
    const semantics = [name]
    if (closeIdx !== -1) {
      const params = content.slice(openIdx + 1, closeIdx)
      const paramRegex = /(\w+)[?:]/g
      let pm: RegExpExecArray | null
      while ((pm = paramRegex.exec(params)) !== null) {
        semantics.push(pm[1]!)
      }
    }
    symbols.push({ name, type: 'function', semantics })
  }

  // export const Name = (...) => ...
  const arrowFuncRegex = /export\s+const\s+(\w+)\s*=\s*[\(\w]/g
  while ((match = arrowFuncRegex.exec(content)) !== null) {
    const name = match[1]!
    if (symbols.some(s => s.name === name)) continue
    const semantics = [name]
    const startIdx = match.index + match[0].length
    const openIdx = content.indexOf('(', startIdx)
    if (openIdx !== -1) {
      let closeIdx = -1
      let parenCount = 0
      for (let i = openIdx; i < content.length; i++) {
        if (content[i] === '(') parenCount++
        else if (content[i] === ')') {
          parenCount--
          if (parenCount === 0) {
            closeIdx = i
            break
          }
        }
      }
      if (closeIdx !== -1) {
        const params = content.slice(openIdx + 1, closeIdx)
        const paramRegex = /(\w+)[?:]/g
        let pm: RegExpExecArray | null
        while ((pm = paramRegex.exec(params)) !== null) {
          semantics.push(pm[1]!)
        }
      }
    }
    symbols.push({ name, type: 'function', semantics })
  }

  // export class Name { ... }
  const classRegex = /export\s+class\s+(\w+)/g
  while ((match = classRegex.exec(content)) !== null) {
    const name = match[1]!
    const extracted = extractInterfaceBody(content, match.index + match[0].length)
    if (!extracted) continue
    const semantics = [name]
    const memberRegex = /\b(\w+)\??\s*:/g
    let m: RegExpExecArray | null
    while ((m = memberRegex.exec(extracted.body)) !== null) {
      semantics.push(m[1]!)
    }
    symbols.push({ name, type: 'class', semantics })
  }

  return symbols
}

function getDocContent(rootDir: string): string {
  const contents: string[] = []
  const docsDir = path.join(rootDir, 'docs')
  function walk(dir: string) {
    const entries = fs.readdirSync(dir)
    for (const entry of entries) {
      const fullPath = path.join(dir, entry)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (stat.isFile() && fullPath.endsWith('.md')) {
        contents.push(fs.readFileSync(fullPath, 'utf-8'))
      }
    }
  }
  walk(docsDir)
  return contents.join('\n\n')
}

export function scan(scanMode: 'changed' | 'all' = 'changed'): SemanticReport {
  const rootDir = process.cwd()
  const files = scanMode === 'changed' ? getChangedFiles(rootDir) : getAllTsFiles(rootDir)
  const allDocContent = getDocContent(rootDir)

  const findings: SemanticFinding[] = []
  let totalSymbols = 0
  let matchedSymbols = 0
  let missingSymbols = 0

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const symbols = extractSymbols(content)
    if (symbols.length === 0) continue

    for (const symbol of symbols) {
      totalSymbols++
      const missingSemantics: string[] = []
      const matchedSemantics: string[] = []

      for (const semantic of symbol.semantics) {
        if (allDocContent.includes(semantic)) {
          matchedSemantics.push(semantic)
        } else {
          missingSemantics.push(semantic)
        }
      }

      if (missingSemantics.length > 0) {
        missingSymbols++
        findings.push({
          file: path.relative(rootDir, filePath),
          symbolName: symbol.name,
          symbolType: symbol.type,
          missingSemantics,
          matchedSemantics,
        })
      } else {
        matchedSymbols++
      }
    }
  }

  const coverageRate = totalSymbols > 0
    ? parseFloat(((matchedSymbols / totalSymbols) * 100).toFixed(2))
    : 100

  return {
    timestamp: new Date().toISOString(),
    totalFiles: files.length,
    totalViolations: findings.length,
    scanMode,
    findings,
    summary: {
      totalSymbols,
      matchedSymbols,
      missingSymbols,
      coverageRate,
    },
  }
}

export function formatReport(report: SemanticReport): string {
  let output = '\n语义级校验报告\n'
  output += `${'='.repeat(60)}\n\n`
  output += `扫描模式: ${report.scanMode === 'changed' ? '仅变更文件' : '全部文件'}\n`
  output += `扫描文件数: ${report.totalFiles}\n`
  output += `总符号数: ${report.summary.totalSymbols}\n`
  output += `已匹配符号数: ${report.summary.matchedSymbols}\n`
  output += `缺失符号数: ${report.summary.missingSymbols}\n`
  output += `覆盖率: ${report.summary.coverageRate}%\n\n`

  if (report.findings.length > 0) {
    output += `发现 ${report.findings.length} 个语义级违规:\n\n`
    for (const finding of report.findings) {
      output += `• 文件: ${finding.file}\n`
      output += `  ${finding.symbolType}: ${finding.symbolName}\n`
      if (finding.missingSemantics.length > 0) {
        output += `    缺失语义: ${finding.missingSemantics.join(', ')}\n`
      }
      if (finding.matchedSemantics.length > 0) {
        output += `    已匹配语义: ${finding.matchedSemantics.join(', ')}\n`
      }
      output += '\n'
    }
  } else {
    output += '✅ 所有符号已在文档中体现\n'
  }

  return output
}
