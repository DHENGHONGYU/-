#!/usr/bin/env tsx
/**
 * MCP Tool 使用审计脚本 — 月度运行
 *
 * @description
 * 读取 MCPBridge 的 Tool 调用计数器，结合 Registry 配置，生成使用报告：
 *   1. 每个 Server 的 Tool 调用次数排名
 *   2. 零调用 Server 列表（当前周期内）
 *   3. 已禁用但仍有调用的 Server（异常）
 *   4. Active 但零调用的 Server（建议进入 Under Review）
 *
 * 支持 CI 集成（--json 输出）和人工审查（--markdown 输出）。
 *
 * @usage
 *   npm run audit:mcp-usage              # 默认 markdown 报告
 *   npm run audit:mcp-usage -- --json    # CI 友好 JSON 输出
 *   npm run audit:mcp-usage -- --reset   # 重置计数器并记录快照
 *
 * @module scripts/audit-mcp-tool-usage
 * @created 2026-07-13 - P2 MCP 治理
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

// 注意：此脚本通过 tsx 直接运行，需确保项目编译通过
// 使用动态 import 避免在编译阶段执行副作用（如 mcpBridge 自动初始化）
const projectRoot = dirname(fileURLToPath(import.meta.url))

interface AuditSnapshot {
  /** 审计时间戳 */
  timestamp: string
  /** 各 server.tool 调用次数 */
  toolStats: Record<string, number>
  /** 当前 Registry 状态 */
  registryStats: {
    total: number
    active: number
    disabled: number
  }
}

interface AuditReport {
  /** 审计时间 */
  generatedAt: string
  /** 当前周期统计 */
  currentStats: Record<string, number>
  /** 与上次快照对比 */
  delta: Record<string, number>
  /** 零调用 Server（按 serverName 聚合） */
  zeroCallServers: string[]
  /** Active 但零调用（建议 Under Review） */
  activeButUnused: string[]
  /** 已禁用但仍有调用（异常需排查） */
  disabledButCalled: string[]
  /** 总调用次数 */
  totalCalls: number
  /** 建议操作 */
  recommendations: string[]
}

const SNAPSHOT_DIR = join(projectRoot, '..', 'docs', 'reports', 'audit', 'mcp-usage')
const SNAPSHOT_FILE = join(SNAPSHOT_DIR, 'latest-snapshot.json')

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

function loadSnapshot(): AuditSnapshot | null {
  if (!existsSync(SNAPSHOT_FILE)) return null
  try {
    return JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf-8')) as AuditSnapshot
  } catch {
    return null
  }
}

function saveSnapshot(snapshot: AuditSnapshot): void {
  ensureDir(SNAPSHOT_DIR)
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), 'utf-8')
}

function aggregateByServer(toolStats: Record<string, number>): Record<string, number> {
  const serverStats: Record<string, number> = {}
  for (const [key, count] of Object.entries(toolStats)) {
    const serverName = key.split('.')[0]
    serverStats[serverName] = (serverStats[serverName] ?? 0) + count
  }
  return serverStats
}

function generateReport(
  currentStats: Record<string, number>,
  registryServers: Array<{ name: string; enabled: boolean }>,
  lastSnapshot: AuditSnapshot | null,
): AuditReport {
  const serverStats = aggregateByServer(currentStats)
  const lastServerStats = lastSnapshot ? aggregateByServer(lastSnapshot.toolStats) : {}

  const zeroCallServers: string[] = []
  const activeButUnused: string[] = []
  const disabledButCalled: string[] = []
  const recommendations: string[] = []

  let totalCalls = 0

  // 遍历 Registry 中的所有 Server
  for (const server of registryServers) {
    const callCount = serverStats[server.name] ?? 0
    totalCalls += callCount

    if (callCount === 0) {
      zeroCallServers.push(server.name)
      if (server.enabled) {
        activeButUnused.push(server.name)
        recommendations.push(
          `[建议] Server "${server.name}" 当前周期零调用，建议进入 Under Review 状态。` +
            '参考 ADR-013 执行评估流程。',
        )
      }
    } else if (!server.enabled) {
      disabledButCalled.push(server.name)
      recommendations.push(
        `[异常] Server "${server.name}" 已禁用但仍有 ${callCount} 次调用，` +
          '请检查是否存在绕过 Registry 的调用路径或状态未同步。',
      )
    }
  }

  // 计算增量（仅针对有变化的）
  const delta: Record<string, number> = {}
  const allKeys = new Set([...Object.keys(serverStats), ...Object.keys(lastServerStats)])
  for (const key of allKeys) {
    const diff = (serverStats[key] ?? 0) - (lastServerStats[key] ?? 0)
    if (diff !== 0) delta[key] = diff
  }

  return {
    generatedAt: new Date().toISOString(),
    currentStats: serverStats,
    delta,
    zeroCallServers,
    activeButUnused,
    disabledButCalled,
    totalCalls,
    recommendations,
  }
}

function formatMarkdownReport(report: AuditReport): string {
  const lines: string[] = []
  lines.push('# MCP Tool 使用审计报告')
  lines.push('')
  lines.push(`生成时间：${report.generatedAt}`)
  lines.push('')
  lines.push('## 概览')
  lines.push('')
  lines.push(`| 指标 | 数值 |`)
  lines.push(`|------|------|`)
  lines.push(`| 总调用次数 | ${report.totalCalls} |`)
  lines.push(`| 零调用 Server | ${report.zeroCallServers.length} 个 |`)
  lines.push(`| Active 但零调用 | ${report.activeButUnused.length} 个 |`)
  lines.push(`| 禁用但仍有调用 | ${report.disabledButCalled.length} 个 |`)
  lines.push('')

  if (report.currentStats && Object.keys(report.currentStats).length > 0) {
    lines.push('## Server 调用次数排名')
    lines.push('')
    lines.push('| 排名 | Server | 调用次数 | 变化 |')
    lines.push('|------|--------|---------|------|')
    const sorted = Object.entries(report.currentStats).sort((a, b) => b[1] - a[1])
    sorted.forEach(([server, count], idx) => {
      const delta = report.delta[server]
      const deltaStr = delta !== undefined ? (delta > 0 ? `+${delta}` : `${delta}`) : 'N/A'
      lines.push(`| ${idx + 1} | ${server} | ${count} | ${deltaStr} |`)
    })
    lines.push('')
  }

  if (report.activeButUnused.length > 0) {
    lines.push('## ⚠️ Active 但零调用 Server（建议 Under Review）')
    lines.push('')
    report.activeButUnused.forEach((s) => lines.push(`- ${s}`))
    lines.push('')
  }

  if (report.disabledButCalled.length > 0) {
    lines.push('## 🚨 已禁用但仍有调用（异常排查）')
    lines.push('')
    report.disabledButCalled.forEach((s) => lines.push(`- ${s}`))
    lines.push('')
  }

  if (report.recommendations.length > 0) {
    lines.push('## 建议操作')
    lines.push('')
    report.recommendations.forEach((r) => lines.push(`- ${r}`))
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('> 参考：docs/02-design/ADR/adr-mcp-server-lifecycle.md')
  lines.push('> 运行：`npm run audit:mcp-usage`')
  lines.push('')

  return lines.join('\n')
}

// ============================================================================
// 主流程
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const isJson = args.includes('--json')
  const isReset = args.includes('--reset')

  // 动态导入以避免编译时副作用
  const srcDir = join(projectRoot, '..', 'src')
  const { mcpBridge } = await import(pathToFileURL(join(srcDir, 'mcp', 'bridge', 'mcpBridge.ts')).href)
  const { mcpRegistry } = await import(pathToFileURL(join(srcDir, 'mcp', 'core', 'registry.ts')).href)

  // 获取当前统计
  const toolStats = mcpBridge.getToolUsageStats()
  const registryStats = mcpRegistry.getStats()
  const registryServers = mcpRegistry.listServers().map((s: { server: { info: { name: string } }; options: { enabled: boolean } }) => ({
    name: s.server.info.name,
    enabled: s.options.enabled,
  }))

  const snapshot: AuditSnapshot = {
    timestamp: new Date().toISOString(),
    toolStats,
    registryStats,
  }

  if (isReset) {
    saveSnapshot(snapshot)
    mcpBridge.resetToolUsageStats()
    console.log('[audit-mcp-usage] 计数器已重置，新快照已保存。')
    return
  }

  const lastSnapshot = loadSnapshot()
  const report = generateReport(toolStats, registryServers, lastSnapshot)

  // 保存本次快照（覆盖 latest）
  saveSnapshot(snapshot)

  if (isJson) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    const md = formatMarkdownReport(report)
    const reportPath = join(SNAPSHOT_DIR, `mcp-usage-report-${Date.now()}.md`)
    writeFileSync(reportPath, md, 'utf-8')
    console.log(md)
    console.log(`\n[audit-mcp-usage] 报告已保存至: ${reportPath}`)
  }

  // 如果有异常或建议，以非零退出码提示 CI
  if (report.disabledButCalled.length > 0 || report.activeButUnused.length > 0) {
    process.exitCode = 1
  }

  // 强制退出，避免后台定时器（MemoryCache 等）导致进程挂起
  process.exit(process.exitCode ?? 0)
}

main().catch((err) => {
  console.error('[audit-mcp-usage] 审计失败:', err)
  process.exit(1)
})
