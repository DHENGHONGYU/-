#!/usr/bin/env tsx
/**
 * semantic-validation.ts
 * 代码-文档语义级校验脚本 v1.0（AST 解析）
 *
 * 检查目标：
 * 使用 TypeScript AST 解析器提取代码中的接口定义、函数签名、类型别名，
 * 检查文档内容中是否包含这些语义信息（字段名、参数类型、返回类型等）。
 *
 * 输出契约：
 * - stdout：JSON 数据流（SemanticReport 结构）
 * - stderr：诊断日志 + 人类可读报告
 * - 文件：docs/reports/audit/semantic-validation-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规, 2=执行错误
 */

import * as ts from 'typescript'
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { colorize } from './_audit-pipeline'

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

const __filename = fileURLToPath(import.meta.url)
const ROOT = dirname(__filename).replace(/[\\/]scripts$/, '')
const SRC_DIR = join(ROOT, 'src')
const DOCS_DIR = join(ROOT, 'docs')

const AUTO_EXCLUDED_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /\.d\.ts$/,
  /\/__tests__\//,
  /\/__mocks__\//,
  /\/fixtures\//,
  /mock[A-Z]/,
  /\.prompt\.ts$/,
]

function isExcluded(filePath: string): boolean {
  const relativePath = relative(SRC_DIR, filePath)
  return AUTO_EXCLUDED_PATTERNS.some(pattern => pattern.test(relativePath))
}

function getChangedFiles(): string[] {
  try {
    const output = execSync(
      'git diff --name-only HEAD~1 -- src/',
      { encoding: 'utf-8', cwd: ROOT }
    ).trim()
    return output.split('\n').filter(f => f && f.endsWith('.ts') && !isExcluded(f))
  } catch {
    return []
  }
}

function getAllTsFiles(): string[] {
  const files: string[] = []
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (fullPath.endsWith('.ts') && !isExcluded(fullPath)) {
        files.push(fullPath)
      }
    }
  }
  walk(SRC_DIR)
  return files
}

function extractSymbols(filePath: string): Array<{
  name: string
  type: 'interface' | 'function' | 'type' | 'class'
  semantics: string[]
}> {
  const symbols: Array<{ name: string; type: 'interface' | 'function' | 'type' | 'class'; semantics: string[] }> = []
  console.time(`[SemanticValidation] 解析 ${relative(ROOT, filePath)}`)
  try {
    const content = readFileSync(filePath, 'utf-8')
    console.debug(`[SemanticValidation] 正在解析文件: ${relative(ROOT, filePath)} (${content.length} 字符)`)
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    )

    function visit(node: ts.Node) {
      if (ts.isInterfaceDeclaration(node) && node.name && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const name = node.name.text
        const semantics: string[] = []
        semantics.push(name)
        if (node.typeParameters) {
          node.typeParameters.forEach(tp => semantics.push(tp.name.text))
        }
        node.members.forEach(member => {
          if (ts.isPropertySignature(member) && member.name) {
            const memberName = ts.isIdentifier(member.name) ? (member.name as ts.Identifier).text : String((member.name as any).text)
            semantics.push(memberName)
          } else if (ts.isMethodSignature(member) && member.name) {
            const memberName = ts.isIdentifier(member.name) ? (member.name as ts.Identifier).text : String((member.name as any).text)
            semantics.push(memberName)
          }
        })
        symbols.push({ name, type: 'interface', semantics })
        console.debug(`[SemanticValidation] 提取接口: ${name}, 语义项数: ${semantics.length}`)
      }

      if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const name = node.name.text
        const semantics: string[] = []
        semantics.push(name)
        node.parameters.forEach(param => {
          if (param.name) {
            const paramName = ts.isIdentifier(param.name) ? (param.name as ts.Identifier).text : String((param.name as any).text)
            semantics.push(paramName)
            if (param.type) {
              semantics.push(getTypeText(param.type))
            }
          }
        })
        if (node.type) {
          semantics.push(getTypeText(node.type))
        }
        symbols.push({ name, type: 'function', semantics })
        console.debug(`[SemanticValidation] 提取函数声明: ${name}, 语义项数: ${semantics.length}`)
      }

      if (ts.isFunctionExpression(node) && node.parent && ts.isVariableDeclaration(node.parent) && node.parent.name && ts.isIdentifier(node.parent.name)) {
        const name = node.parent.name.text
        const semantics: string[] = []
        semantics.push(name)
        node.parameters.forEach(param => {
          if (param.name) {
            const paramName = ts.isIdentifier(param.name) ? (param.name as ts.Identifier).text : String((param.name as any).text)
            semantics.push(paramName)
            if (param.type) {
              semantics.push(getTypeText(param.type))
            }
          }
        })
        if (node.type) {
          semantics.push(getTypeText(node.type))
        }
        symbols.push({ name, type: 'function', semantics })
      }

      if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        const name = node.name.text
        if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
          const semantics: string[] = []
          semantics.push(name)
          const func = node.initializer
          if (ts.isArrowFunction(func)) {
            func.parameters.forEach(param => {
              if (param.name) {
                const paramName = ts.isIdentifier(param.name) ? (param.name as ts.Identifier).text : String((param.name as any).text)
                semantics.push(paramName)
                if (param.type) {
                  semantics.push(getTypeText(param.type))
                }
              }
            })
            if (func.type) {
              semantics.push(getTypeText(func.type))
            }
          }
          symbols.push({ name, type: 'function', semantics })
        }
      }

      if (ts.isTypeAliasDeclaration(node) && node.name && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const name = node.name.text
        const semantics: string[] = []
        semantics.push(name)
        if (node.typeParameters) {
          node.typeParameters.forEach(tp => semantics.push(tp.name.text))
        }
        extractUnionMemberNames(node.type, semantics)
        symbols.push({ name, type: 'type', semantics })
        console.debug(`[SemanticValidation] 提取类型别名: ${name}, 语义项数: ${semantics.length}`)
      }

      if (ts.isClassDeclaration(node) && node.name && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const name = node.name.text
        const semantics: string[] = []
        semantics.push(name)
        node.members.forEach(member => {
          if (ts.isPropertyDeclaration(member) && member.name) {
            const memberName = ts.isIdentifier(member.name) ? (member.name as ts.Identifier).text : String((member.name as any).text)
            semantics.push(`prop_${memberName}`)
          } else if (ts.isMethodDeclaration(member) && member.name) {
            const memberName = ts.isIdentifier(member.name) ? (member.name as ts.Identifier).text : String((member.name as any).text)
            semantics.push(`method_${memberName}`)
          }
        })
        symbols.push({ name, type: 'class', semantics })
        console.debug(`[SemanticValidation] 提取类: ${name}, 语义项数: ${semantics.length}`)
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  } catch (error) {
    console.error(`[SemanticValidation] AST 解析失败: ${filePath}`, error)
  } finally {
    console.timeEnd(`[SemanticValidation] 解析 ${relative(ROOT, filePath)}`)
  }
  return symbols
}

function getTypeText(typeNode: ts.TypeNode): string {
  return typeNode.getText()
}

function extractUnionMemberNames(typeNode: ts.TypeNode | undefined, semantics: string[]) {
  if (!typeNode) return
  
  if (ts.isUnionTypeNode(typeNode)) {
    typeNode.types.forEach(t => extractUnionMemberNames(t, semantics))
  } else if (ts.isLiteralTypeNode(typeNode)) {
    const value = typeNode.literal.getText()
    if (value.startsWith("'") && value.endsWith("'")) {
      semantics.push(value.slice(1, -1))
    }
  } else if (ts.isTypeLiteralNode(typeNode)) {
    typeNode.members.forEach(member => {
      if (ts.isPropertySignature(member) && member.name) {
        const memberName = ts.isIdentifier(member.name) ? (member.name as ts.Identifier).text : String((member.name as any).text)
        semantics.push(memberName)
      }
    })
  }
}

function getDocContent(): string {
  const docContent: string[] = []
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        if (entry !== 'reports' && entry !== 'assets') {
          walk(fullPath)
        }
      } else if (fullPath.endsWith('.md')) {
        docContent.push(readFileSync(fullPath, 'utf-8'))
      }
    }
  }
  walk(DOCS_DIR)
  return docContent.join('\n\n')
}

export function scan(scanMode: 'changed' | 'all' = 'changed'): SemanticReport {
  const timestamp = new Date().toISOString()
  console.info(`[SemanticValidation] 开始语义扫描，模式: ${scanMode}`)
  
  const files = scanMode === 'changed' ? getChangedFiles() : getAllTsFiles()
  console.info(`[SemanticValidation] 扫描文件数: ${files.length}`)
  
  const allDocContent = getDocContent()
  console.info(`[SemanticValidation] 文档内容总长度: ${allDocContent.length} 字符`)

  const findings: SemanticFinding[] = []
  let totalSymbols = 0
  let matchedSymbols = 0
  let missingSymbols = 0
  let fileCount = 0

  for (const filePath of files) {
    fileCount++
    if (fileCount % 50 === 0) {
      console.info(`[SemanticValidation] 扫描进度: ${fileCount}/${files.length} 文件`)
    }
    
    const symbols = extractSymbols(filePath)
    if (symbols.length === 0) continue

    const fileFindings: SemanticFinding[] = []

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
        fileFindings.push({
          file: relative(ROOT, filePath),
          symbolName: symbol.name,
          symbolType: symbol.type,
          missingSemantics,
          matchedSemantics,
        })
      } else {
        matchedSymbols++
      }
    }

    if (fileFindings.length > 0) {
      findings.push(...fileFindings)
    }
  }

  const coverageRate = totalSymbols > 0 ? ((matchedSymbols / totalSymbols) * 100).toFixed(2) : '100.00'

  console.info(`[SemanticValidation] 扫描完成: 总符号=${totalSymbols}, 已匹配=${matchedSymbols}, 缺失=${missingSymbols}, 覆盖率=${coverageRate}%`)
  console.info(`[SemanticValidation] 发现违规数: ${findings.length}`)

  return {
    timestamp,
    totalFiles: files.length,
    totalViolations: findings.length,
    scanMode,
    findings,
    summary: {
      totalSymbols,
      matchedSymbols,
      missingSymbols,
      coverageRate: parseFloat(coverageRate),
    },
  }
}

export function formatReport(report: SemanticReport): string {
  let output = `\n${colorize('语义级校验报告', 'green')}\n`
  output += `${'='.repeat(60)}\n\n`
  output += `扫描模式: ${report.scanMode === 'changed' ? '仅变更文件' : '全部文件'}\n`
  output += `扫描文件数: ${report.totalFiles}\n`
  output += `总符号数: ${report.summary.totalSymbols}\n`
  output += `${colorize(`已匹配符号数: ${report.summary.matchedSymbols}`, 'green')}\n`
  output += `${colorize(`缺失符号数: ${report.summary.missingSymbols}`, 'red')}\n`
  output += `覆盖率: ${report.summary.coverageRate}%\n\n`

  if (report.findings.length > 0) {
    output += `${colorize(`发现 ${report.findings.length} 个语义级违规:`, 'red')}\n\n`
    for (const finding of report.findings) {
      output += `• 文件: ${finding.file}\n`
      output += `  ${colorize(`${finding.symbolType}: ${finding.symbolName}`, 'yellow')}\n`
      if (finding.missingSemantics.length > 0) {
        output += `    ${colorize('缺失语义:', 'red')} ${finding.missingSemantics.join(', ')}\n`
      }
      if (finding.matchedSemantics.length > 0) {
        output += `    ${colorize('已匹配语义:', 'green')} ${finding.matchedSemantics.join(', ')}\n`
      }
      output += '\n'
    }
  } else {
    output += `${colorize('✅ 所有符号已在文档中体现', 'green')}\n`
  }

  return output
}

export async function main() {
  const args = process.argv.slice(2)
  const jsonOutput = args.includes('--json')
  const quiet = args.includes('--quiet')
  const noPersist = args.includes('--no-persist')
  const scanMode: 'changed' | 'all' = args.includes('--all') ? 'all' : 'changed'

  try {
    const report = scan(scanMode)

    if (!quiet) {
      console.error(formatReport(report))
    }

    if (!noPersist) {
      const reportDir = join(ROOT, 'docs', 'reports', 'audit')
      const filename = `semantic-validation-${report.timestamp.replace(/[:.]/g, '-')}.json`
      writeFileSync(join(reportDir, filename), JSON.stringify(report, null, 2), 'utf-8')
    }

    if (jsonOutput || !quiet) {
      console.log(JSON.stringify(report))
    }

    process.exit(report.totalViolations > 0 ? 1 : 0)
  } catch (error) {
    console.error(`[SemanticValidation] 执行错误:`, error)
    console.log(JSON.stringify({ error: String(error) }))
    process.exit(2)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}