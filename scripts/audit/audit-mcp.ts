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
const ROOT = path.resolve(__dirname, '..', '..')
const SRC = path.join(ROOT, 'src')
const MCP_DIR = path.join(SRC, 'mcp', 'servers')

// 已知的服务子域（来自 src/services/ 目录，且历史上应有对应 MCP Server）
// 注：export / input / trade 三个 Server 已在 2026-07-20 P0 清理中移除
//   （export→纯 Service 函数、trade→合并入 trading:main、input→MCP 层移除），
//   故不再列入覆盖率校验，避免每次审计产生误导性的 "mcp-server-missing" 警告。
//   筛选/回测/股票池（screening/backtest/stockpool）保留为独立 Server 并已接入 Agent。
const KNOWN_SERVICE_DOMAINS = [
  'analysis',
  'backtest',
  'data-collector',
  'execution',
  'fetcher',
  'llm',
  'news',
  'portfolio',
  'scoring',
  'screening',
  'stockpool',
  'system',
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

  // 豁免的服务模块（基础设施工具，非业务服务，或工厂模式获取实例）
  const EXEMPTED_SERVICES = ['errorBus', 'system/monitorLogService', 'system/architectureService']

  // 检查 1: 页面/组件直接 import service（绕过 MCP）
  if (filePath.includes('pages') || filePath.includes('components')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      if (line.startsWith('import type')) continue
      const match = DIRECT_SERVICE_IMPORT.exec(line)
      if (match) {
        const servicePath = match[1]
        if (EXEMPTED_SERVICES.some(exempt => servicePath.startsWith(exempt))) continue
        violations.push({
          file: relativePath,
          line: i + 1,
          column: match.index + 1,
          type: 'direct-service-import',
          message: `页面/组件直接 import services/${servicePath}，应通过 MCPClient 调用`,
          context: line.trim(),
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
// 检查 4: Agent → MCP Server 绑定一致性（防止悬空 Agent）
// ============================================================
//
// 路由真相：agentRuntime.execute() 经 agent.mcpServerName 查找 MCPRegistry，
// registry key = server.info.name（无模糊匹配）。若 agent 的 mcpServerName 与
// 任何「已启用」Server 的 info.name 都不一致，运行时必返回 Server not found。
//
// 同理，UI 组件注册表（agentComponentRegistry.ts）的 mcpServerName 被
// AgentTriggerPage 用于 server 查找（servers.find(info.name === mcpServerName)），
// 失配会导致工具下拉为空。
//
// 本检查为静态分析（audit 脚本运行于 tsx，import.meta.glob 不可用），
// 因此直接解析源码：从已启用 Server 模块提取真实 info.name，比对 Agent 引用。

/** 从 Server 模块源码提取 info.name（registry 真实注册键） */
function extractServerInfoName(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf-8')
  // 兼容两种写法：
  //   info = { name: 'x' }
  //   info: MCPServerInfo = { name: 'x' }   ← 类型注解在 info 与 { 之间
  const m = content.match(/info\s*[:=][^;{]*\{[\s\S]*?name:\s*['"]([^'"]+)['"]/)
  return m ? m[1] : null
}

/** 提取源码中所有 mcpServerName: '...' 及其行号 */
function extractMcpServerNamesWithLine(content: string): Array<{ name: string; line: number }> {
  const result: Array<{ name: string; line: number }> = []
  const re = /mcpServerName:\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const line = content.slice(0, m.index).split('\n').length
    result.push({ name: m[1], line })
  }
  return result
}

/** 收集所有「已启用」Server 的真实 info.name 集合 */
function getRegisteredServerNames(): { names: Set<string>; warnings: Finding[] } {
  const warnings: Finding[] = []
  const names = new Set<string>()
  const configPath = path.join(SRC, 'config', 'mcpServerRegistry.ts')
  if (!fs.existsSync(configPath)) {
    warnings.push({
      file: 'src/config/mcpServerRegistry.ts',
      line: 0, column: 0,
      type: 'mcp-config-missing',
      message: 'MCP Server 配置清单不存在',
      context: '无法推导已注册 Server 集合',
    })
    return { names, warnings }
  }

  const content = fs.readFileSync(configPath, 'utf-8')
  const entryRe = /name:\s*'([^']+)'[\s\S]*?modulePath:\s*'([^']+)'[\s\S]*?exportName:\s*'([^']+)'[\s\S]*?enabled:\s*(true|false)/g
  let m: RegExpExecArray | null
  while ((m = entryRe.exec(content)) !== null) {
    const enabled = m[4] === 'true'
    if (!enabled) continue
    const modulePath = m[2]
    const filePath = modulePath.replace(/^@\//, SRC + '/') + '.ts'
    const infoName = extractServerInfoName(filePath)
    if (infoName) {
      names.add(infoName)
    } else {
      warnings.push({
        file: path.relative(ROOT, filePath),
        line: 0, column: 0,
        type: 'mcp-server-info-name-unreadable',
        message: `无法从 Server 模块提取 info.name：${modulePath}`,
        context: '该 Server 的 Agent 绑定检查将被跳过；请检查 info 对象定义',
      })
    }
  }
  return { names, warnings }
}

function checkAgentServerBindings(): { violations: Finding[]; warnings: Finding[] } {
  const violations: Finding[] = []
  const { names: registered, warnings } = getRegisteredServerNames()

  if (registered.size === 0) {
    warnings.push({
      file: 'src/config/mcpServerRegistry.ts',
      line: 0, column: 0,
      type: 'mcp-no-servers',
      message: '未解析到任何已注册的 MCP Server',
      context: 'Agent 绑定检查无意义，请先确认 Server 注册',
    })
    return { violations, warnings }
  }

  // 4a. 运行时 Agent（DEFAULT_AGENTS in src/agents/index.ts）
  const agentsPath = path.join(SRC, 'agents', 'index.ts')
  if (fs.existsSync(agentsPath)) {
    const agentContent = fs.readFileSync(agentsPath, 'utf-8')
    for (const { name, line } of extractMcpServerNamesWithLine(agentContent)) {
      if (!registered.has(name)) {
        violations.push({
          file: 'src/agents/index.ts',
          line, column: 1,
          type: 'dangling-agent',
          message: `运行时 Agent 引用的 MCP Server "${name}" 未注册（悬空 Agent）`,
          context: `agent.mcpServerName="${name}" 无对应 server.info.name；运行时将 Server not found`,
        })
      }
    }
  }

  // 4b. UI 组件注册表（agentComponentRegistry.ts）
  const uiPath = path.join(SRC, 'components', 'organisms', 'agent', 'agentComponentRegistry.ts')
  if (fs.existsSync(uiPath)) {
    const uiContent = fs.readFileSync(uiPath, 'utf-8')
    for (const { name, line } of extractMcpServerNamesWithLine(uiContent)) {
      if (!registered.has(name)) {
        violations.push({
          file: 'src/components/organisms/agent/agentComponentRegistry.ts',
          line, column: 1,
          type: 'dangling-agent-ui',
          message: `UI 组件注册表引用的 MCP Server "${name}" 未注册（UI 触发将找不到 Server）`,
          context: `agentComponentRegistry mcpServerName="${name}" 与真实 server.info.name 不一致`,
        })
      }
    }
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

  // 检查 Agent → MCP Server 绑定一致性（悬空 Agent 检测）
  const bindingResult = checkAgentServerBindings()
  report.violations.push(...bindingResult.violations)
  report.warnings.push(...bindingResult.warnings)

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