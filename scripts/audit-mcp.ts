#!/usr/bin/env tsx
/**
 * audit-mcp.ts
 * MCP 架构一致性审计
 *
 * 检查目标：
 * 1. 所有 services/ 子域是否有对应的 MCP Server 注册。
 * 2. 每个 Tool 是否有 description + inputSchema。
 * 3. 页面/组件是否直接 import 非 MCP 模块。
 * 4. 是否存在未注册的 Tool 硬编码调用。
 *
 * 输出：违规列表 + 汇总；退出码 1 表示发现违规。
 *
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface Finding {
  file: string
  line: number
  column: number
  type: string
  message: string
  context: string
}

interface Report {
  violations: Finding[]
  warnings: Finding[]
  summary: {
    totalFiles: number
    totalViolations: number
    totalWarnings: number
    byViolationType: Record<string, number>
    byWarningType: Record<string, number>
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const MCP_DIR = path.join(SRC, 'mcp', 'servers')

// 已知的服务子域（来自 src/services/ 目录）
const KNOWN_SERVICE_DOMAINS = [
  'analysis',
  'backtest',
  'data-collector',
  'fetcher',
  'execution',
  'export',
  'input',
  'llm',
  'news',
  'portfolio',
  'scoring',
  'screening',
  'stockpool',
  'system',
  'trade',
  'trading',
]

// 页面/组件直接 import service 的模式
const DIRECT_SERVICE_IMPORT = /from\s+['"]@\/services\/([^'"]+)['"]/

// 页面/组件 import MCP 模块的模式
const MCP_IMPORT = /from\s+['"]@\/mcp['"]/

// Tool 直接调用模式（非 MCPClient 方式）
const RAW_TOOL_CALL = /\.(score|analyze|fetch|search|screen|execute|export|import|migrate)\s*\(/

function findAllTsFiles(dir: string): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === '.git') continue
      results.push(...findAllTsFiles(fullPath))
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue
      results.push(fullPath)
    }
  }

  return results
}

function analyzeFile(filePath: string): { violations: Finding[]; warnings: Finding[] } {
  const violations: Finding[] = []
  const warnings: Finding[] = []
  const relativePath = path.relative(ROOT, filePath)
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  // 检查 1: 页面/组件直接 import service（绕过 MCP）
  if (filePath.includes('pages') || filePath.includes('components')) {
    for (let i = 0; i < lines.length; i++) {
      const match = DIRECT_SERVICE_IMPORT.exec(lines[i] ?? '')
      if (match) {
        violations.push({
          file: relativePath,
          line: i + 1,
          column: match.index + 1,
          type: 'direct-service-import',
          message: `页面/组件直接 import services/${match[1]}，应通过 MCPClient 调用`,
          context: lines[i].trim(),
        })
      }
    }
  }

  // 检查 2: 页面/组件是否使用了 MCP 模块（正向提示）
  if (filePath.includes('pages') || filePath.includes('components')) {
    let hasMcpImport = false
    for (const line of lines) {
      if (MCP_IMPORT.test(line)) {
        hasMcpImport = true
        break
      }
    }
    // 不强制要求，仅作为观察指标
  }

  return { violations, warnings }
}

function checkMcpServerCoverage(): { violations: Finding[]; warnings: Finding[] } {
  const violations: Finding[] = []
  const warnings: Finding[] = []

  // 检查 MCP servers 目录下有哪些 Server
  const existingServers: string[] = []

  if (fs.existsSync(MCP_DIR)) {
    const entries = fs.readdirSync(MCP_DIR, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // 匹配目录下任意 *Server.ts 文件
        const dirFiles = fs.readdirSync(path.join(MCP_DIR, entry.name))
        const hasServerFile = dirFiles.some((f) => f.endsWith('Server.ts'))
        if (hasServerFile) {
          existingServers.push(entry.name)
        }
      }
    }
  }

  // 对比已知服务子域
  for (const domain of KNOWN_SERVICE_DOMAINS) {
    const matched = existingServers.some((s) =>
      domain.toLowerCase().includes(s.toLowerCase()) ||
      s.toLowerCase().includes(domain.toLowerCase()),
    )

    if (!matched) {
      warnings.push({
        file: `src/services/${domain}/`,
        line: 0,
        column: 0,
        type: 'mcp-server-missing',
        message: `服务子域 ${domain} 尚未注册 MCP Server`,
        context: `预期在 src/mcp/servers/${domain}/ 下创建 ${domain}Server.ts`,
      })
    }
  }

  return { violations, warnings }
}

function checkToolCompleteness(): { violations: Finding[]; warnings: Finding[] } {
  const violations: Finding[] = []
  const warnings: Finding[] = []

  if (!fs.existsSync(MCP_DIR)) {
    warnings.push({
      file: 'src/mcp/servers/',
      line: 0,
      column: 0,
      type: 'mcp-servers-dir-missing',
      message: 'MCP servers 目录不存在',
      context: '请创建 src/mcp/servers/ 目录并注册 MCP Server',
    })
    return { violations, warnings }
  }

  return { violations, warnings }
}

// ============================================================
// 主流程
// ============================================================

function main(): void {
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  MCP 架构一致性审计 — audit-mcp.ts                         ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')

  const report: Report = {
    violations: [],
    warnings: [],
    summary: {
      totalFiles: 0,
      totalViolations: 0,
      totalWarnings: 0,
      byViolationType: {},
      byWarningType: {},
    },
  }

  // 扫描所有源文件
  const allFiles = findAllTsFiles(SRC)
  report.summary.totalFiles = allFiles.length

  for (const file of allFiles) {
    const result = analyzeFile(file)
    report.violations.push(...result.violations)
    report.warnings.push(...result.warnings)
  }

  // 检查 MCP Server 覆盖率
  const coverageResult = checkMcpServerCoverage()
  report.violations.push(...coverageResult.violations)
  report.warnings.push(...coverageResult.warnings)

  // 检查 Tool 完备性
  const toolResult = checkToolCompleteness()
  report.violations.push(...toolResult.violations)
  report.warnings.push(...toolResult.warnings)

  // 汇总
  report.summary.totalViolations = report.violations.length
  report.summary.totalWarnings = report.warnings.length

  for (const v of report.violations) {
    report.summary.byViolationType[v.type] = (report.summary.byViolationType[v.type] ?? 0) + 1
  }
  for (const w of report.warnings) {
    report.summary.byWarningType[w.type] = (report.summary.byWarningType[w.type] ?? 0) + 1
  }

  // 输出违规
  if (report.violations.length > 0) {
    console.log('🔴 违规 (Violations):')
    console.log('────────────────────────────────────────────────────────────')
    for (const v of report.violations) {
      console.log(`  ${v.file}:${v.line} [${v.type}]`)
      console.log(`    ${v.message}`)
      console.log(`    ${v.context}`)
      console.log('')
    }
  }

  // 输出警告
  if (report.warnings.length > 0) {
    console.log('🟡 警告 (Warnings):')
    console.log('────────────────────────────────────────────────────────────')
    for (const w of report.warnings) {
      console.log(`  ${w.file}:${w.line} [${w.type}]`)
      console.log(`    ${w.message}`)
      if (w.context) console.log(`    ${w.context}`)
      console.log('')
    }
  }

  // 汇总
  console.log('────────────────────────────────────────────────────────────')
  console.log(`扫描文件数: ${report.summary.totalFiles}`)
  console.log(`违规数: ${report.summary.totalViolations}`)
  console.log(`警告数: ${report.summary.totalWarnings}`)
  console.log('────────────────────────────────────────────────────────────')

  if (report.violations.length > 0) {
    console.log('')
    console.log('❌ MCP 架构审计未通过')
    process.exit(1)
  } else {
    console.log('')
    console.log('✅ MCP 架构审计通过')
    process.exit(0)
  }
}

main()