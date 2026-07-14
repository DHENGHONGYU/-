#!/usr/bin/env node
/**
 * @module scripts/system-check-loop
 * @description 体系检查闭环 — 开发动作→文档更新→日志记录→体系检查→保鲜度评分完整闭环
 *
 * 触发机制：
 * - 每2天定时执行（GitHub Actions cron）
 * - 代码变更触发（git hook）
 * - 手动触发（npm run system:check-loop）
 *
 * 闭环流程：
 * 1. 检测代码变更
 * 2. 触发文档自动更新（doc-update-trigger）
 * 3. 执行每日文档验证（daily-doc-validation）
 * 4. 执行系统健康度检查（system-health-dashboard）
 * 5. 计算文档保鲜度评分（doc-freshness-score）
 * 6. 生成综合报告并持久化
 * 7. 针对核心问题提供交互式处理机制
 *
 * 用法：
 *   npx tsx scripts/system-check-loop.ts [--auto-fix] [--silent] [--since <iso>]
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCurrentPhase, getPhaseConfig, getEnabledAudits, QUALITY_PHASES } from './quality-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const ROOT = resolve(__dirname, '..')

const REPORT_DIR = join(ROOT, 'docs', 'reports', 'system-check-loop')
const ISSUE_DIR = join(ROOT, 'docs', 'reports', 'issues')

interface CheckResult {
  name: string
  command: string
  exitCode: number
  output: string
  timestamp: string
}

interface Issue {
  id: string
  type: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  source: string
  suggestedFix: string
  status: 'open' | 'pending' | 'resolved' | 'wont-fix'
  createdAt: string
  updatedAt: string
  relatedFiles: string[]
}

interface SystemCheckReport {
  meta: {
    runId: string
    startedAt: string
    finishedAt: string
    rootDir: string
    triggeredBy: string
  }
  checkResults: CheckResult[]
  issues: Issue[]
  summary: {
    totalIssues: number
    criticalCount: number
    highCount: number
    mediumCount: number
    lowCount: number
    overallStatus: 'pass' | 'warning' | 'failure'
    executionTimeMs: number
  }
  recommendations: string[]
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTimestamp(date: Date): string {
  return date.toISOString()
}

function runCommand(command: string, timeout = 180000): CheckResult {
  const startTime = Date.now()
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      cwd: ROOT,
      timeout,
    })
    return {
      name: command.split(' ').slice(-1)[0],
      command,
      exitCode: 0,
      output: output.slice(0, 5000),
      timestamp: formatTimestamp(new Date()),
    }
  } catch (error) {
    const exitCode = (error instanceof Error && (error as { status?: number }).status) ?? 1
    const output = error instanceof Error ? error.message : String(error)
    return {
      name: command.split(' ').slice(-1)[0],
      command,
      exitCode,
      output: output.slice(0, 5000),
      timestamp: formatTimestamp(new Date()),
    }
  }
}

function detectCodeChanges(since?: string): string[] {
  try {
    const sinceArg = since ? `--since="${since}"` : '--since="2 days ago"'
    const output = execSync(`git log --name-only --oneline ${sinceArg}`, {
      encoding: 'utf-8',
      cwd: ROOT,
    })
    const lines = output.split('\n').filter((line) => line.trim().length > 0)
    const files = new Set<string>()
    for (const line of lines) {
      if (!line.includes(' ') && line.includes('.')) {
        files.add(line)
      }
    }
    return Array.from(files)
  } catch {
    return []
  }
}

function parseIssues(checkResults: CheckResult[]): Issue[] {
  const issues: Issue[] = []

  for (const result of checkResults) {
    if (result.exitCode === 0) continue

    const lines = result.output.split('\n').filter((l) => l.trim().length > 0)
    for (const line of lines) {
      if (line.includes('violation') || line.includes('error') || line.includes('fatal') || line.includes('critical')) {
        const issue: Issue = {
          id: generateId(),
          type: line.includes('fatal') || line.includes('critical') ? 'critical' : line.includes('error') ? 'high' : 'medium',
          title: `[${result.name}] ${line.slice(0, 50)}`,
          description: line,
          source: result.name,
          suggestedFix: '查看详细输出以获取修复建议',
          status: 'open',
          createdAt: formatTimestamp(new Date()),
          updatedAt: formatTimestamp(new Date()),
          relatedFiles: [],
        }
        issues.push(issue)
      }
    }
  }

  return issues
}

function loadExistingIssues(): Issue[] {
  const issueFile = join(ISSUE_DIR, 'issues.json')
  if (existsSync(issueFile)) {
    try {
      return JSON.parse(readFileSync(issueFile, 'utf-8'))
    } catch {
      return []
    }
  }
  return []
}

function saveIssues(issues: Issue[]): void {
  if (!existsSync(ISSUE_DIR)) {
    mkdirSync(ISSUE_DIR, { recursive: true })
  }
  writeFileSync(join(ISSUE_DIR, 'issues.json'), JSON.stringify(issues, null, 2), 'utf-8')
}

function buildReport(checkResults: CheckResult[], triggeredBy: string): SystemCheckReport {
  const startedAt = new Date()
  const runId = generateId()

  const issues = parseIssues(checkResults)

  const criticalCount = issues.filter((i) => i.type === 'critical').length
  const highCount = issues.filter((i) => i.type === 'high').length
  const mediumCount = issues.filter((i) => i.type === 'medium').length
  const lowCount = issues.filter((i) => i.type === 'low').length

  let overallStatus: 'pass' | 'warning' | 'failure' = 'pass'
  if (criticalCount > 0) overallStatus = 'failure'
  else if (highCount > 0) overallStatus = 'warning'

  const recommendations: string[] = []
  if (criticalCount > 0) {
    recommendations.push(`发现 ${criticalCount} 个严重问题，需要立即处理`)
  }
  if (highCount > 0) {
    recommendations.push(`发现 ${highCount} 个高优先级问题，建议尽快处理`)
  }
  recommendations.push('运行 npx tsx scripts/system-check-loop.ts --auto-fix 尝试自动修复')
  recommendations.push('查看 docs/reports/issues/issues.json 了解问题详情')

  const finishedAt = new Date()
  const executionTimeMs = finishedAt.getTime() - startedAt.getTime()

  return {
    meta: {
      runId,
      startedAt: formatTimestamp(startedAt),
      finishedAt: formatTimestamp(finishedAt),
      rootDir: ROOT,
      triggeredBy,
    },
    checkResults,
    issues,
    summary: {
      totalIssues: issues.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      overallStatus,
      executionTimeMs,
    },
    recommendations,
  }
}

function persistReport(report: SystemCheckReport): string | null {
  try {
    if (!existsSync(REPORT_DIR)) {
      mkdirSync(REPORT_DIR, { recursive: true })
    }
    const timestamp = report.meta.startedAt.replace(/[:.]/g, '-')
    const filePath = join(REPORT_DIR, `system-check-loop-${timestamp}.json`)
    const latestPath = join(REPORT_DIR, 'latest.json')

    writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8')
    writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf-8')

    return filePath
  } catch (error) {
    console.error(`[SystemCheckLoop] 持久化报告失败: ${error}`)
    return null
  }
}

function printInteractiveSummary(report: SystemCheckReport): void {
  const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    magenta: '\x1b[35m',
  }

  console.log('')
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.cyan}║      体系检查闭环 — System Check Loop (每2天执行)         ║${C.reset}`)
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')

  console.log(`${C.bold}运行ID:${C.reset} ${report.meta.runId}`)
  console.log(`${C.bold}触发方式:${C.reset} ${report.meta.triggeredBy}`)
  console.log(`${C.bold}时间:${C.reset} ${report.meta.startedAt}`)
  console.log(`${C.bold}执行耗时:${C.reset} ${report.summary.executionTimeMs}ms`)
  console.log('')

  let statusColor = C.green
  if (report.summary.overallStatus === 'failure') statusColor = C.red
  else if (report.summary.overallStatus === 'warning') statusColor = C.yellow

  console.log(`${C.bold}整体状态:${C.reset} ${statusColor}${report.summary.overallStatus.toUpperCase()}${C.reset}`)
  console.log('')

  console.log(`${C.bold}问题统计:${C.reset}`)
  console.log(`  ${C.red}严重:${C.reset} ${report.summary.criticalCount} 个`)
  console.log(`  ${C.yellow}高优先级:${C.reset} ${report.summary.highCount} 个`)
  console.log(`  ${C.cyan}中等:${C.reset} ${report.summary.mediumCount} 个`)
  console.log(`  ${C.green}低优先级:${C.reset} ${report.summary.lowCount} 个`)
  console.log(`  ${C.dim}总计:${C.reset} ${report.summary.totalIssues} 个`)
  console.log('')

  if (report.issues.length > 0) {
    console.log(`${C.bold}核心问题列表:${C.reset}`)
    console.log('')

    for (const issue of report.issues.slice(0, 10)) {
      let typeColor = C.green
      if (issue.type === 'critical') typeColor = C.red
      else if (issue.type === 'high') typeColor = C.yellow
      else if (issue.type === 'medium') typeColor = C.cyan

      console.log(`  ${typeColor}[${issue.type.toUpperCase()}]${C.reset} ${issue.title}`)
      console.log(`    ${C.dim}来源: ${issue.source}${C.reset}`)
      console.log(`    ${C.dim}建议: ${issue.suggestedFix}${C.reset}`)
    }

    if (report.issues.length > 10) {
      console.log(`    ${C.dim}... 还有 ${report.issues.length - 10} 个问题${C.reset}`)
    }
    console.log('')
  }

  console.log(`${C.bold}${C.yellow}修复建议:${C.reset}`)
  console.log('')
  for (const rec of report.recommendations) {
    console.log(`  ${C.cyan}•${C.reset} ${rec}`)
  }
  console.log('')

  console.log(`${C.bold}${C.green}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.green}║                  体系检查闭环执行完成                     ║${C.reset}`)
  console.log(`${C.bold}${C.green}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')
}

function runAutoFix(issues: Issue[]): void {
  console.log('\n[SystemCheckLoop] 开始自动修复...')

  const fixableIssues = issues.filter((i) => i.type === 'critical' || i.type === 'high')
  
  for (const issue of fixableIssues) {
    console.log(`[SystemCheckLoop] 尝试修复: ${issue.title}`)
    try {
      switch (issue.source) {
        case 'audit:layers':
          execSync('npx tsx scripts/fix-layer-violations.ts', { cwd: ROOT })
          issue.status = 'resolved'
          console.log(`[SystemCheckLoop] ✓ 修复成功`)
          break
        case 'audit:hardcode':
          execSync('npx tsx scripts/fix-silent-fallback.ts', { cwd: ROOT })
          issue.status = 'resolved'
          console.log(`[SystemCheckLoop] ✓ 修复成功`)
          break
        default:
          console.log(`[SystemCheckLoop] ⚠️  暂不支持自动修复此类型问题`)
          issue.status = 'pending'
      }
    } catch (error) {
      console.log(`[SystemCheckLoop] ✗ 修复失败: ${error}`)
      issue.status = 'pending'
    }
    issue.updatedAt = formatTimestamp(new Date())
  }

  saveIssues(issues)
}

function main(): void {
  const args = process.argv.slice(2)
  const autoFix = args.includes('--auto-fix')
  const silent = args.includes('--silent')
  const sinceArg = args.find((a) => a.startsWith('--since='))
  const since = sinceArg ? sinceArg.split('=')[1] : undefined
  const phaseArg = args.find((a) => a.startsWith('--phase='))
  const targetPhase = phaseArg ? phaseArg.split('=')[1] as keyof typeof QUALITY_PHASES : undefined

  const triggeredBy = args.includes('--manual') ? 'manual' : args.includes('--hook') ? 'git-hook' : 'cron'

  console.error('[SystemCheckLoop] ===== 体系检查闭环开始 =====')
  console.error(`[SystemCheckLoop] 触发方式: ${triggeredBy}`)
  console.error(`[SystemCheckLoop] 手动指定阶段: ${targetPhase || '(未指定，将自动判断)'}`)

  console.error('[SystemCheckLoop] --- 阶段判断过程 ---')
  const currentPhase = targetPhase || getCurrentPhase()
  const phaseConfig = getPhaseConfig(currentPhase as any)
  
  console.error('[SystemCheckLoop] --- 阶段配置详情 ---')
  console.error(`[SystemCheckLoop] 当前质量阶段: ${currentPhase} → ${phaseConfig.name}`)
  console.error(`[SystemCheckLoop] 阶段描述: ${phaseConfig.description}`)
  console.error(`[SystemCheckLoop] 审计频率: 每 ${phaseConfig.auditFrequencyDays} 天`)
  console.error(`[SystemCheckLoop] 自动化比例: ${(phaseConfig.automationRatio * 100).toFixed(0)}%`)
  console.error(`[SystemCheckLoop] 人工审查比例: ${(phaseConfig.manualReviewRatio * 100).toFixed(0)}%`)
  
  console.error('[SystemCheckLoop] --- 质量门禁阈值 ---')
  console.error(`[SystemCheckLoop]   综合评分 ≥ ${phaseConfig.qualityGate.minScore}`)
  console.error(`[SystemCheckLoop]   严重问题 ≤ ${phaseConfig.qualityGate.maxCriticalIssues}`)
  console.error(`[SystemCheckLoop]   高优先级问题 ≤ ${phaseConfig.qualityGate.maxHighIssues}`)
  console.error(`[SystemCheckLoop]   测试覆盖率 ≥ ${phaseConfig.qualityGate.requiredTestCoverage}%`)
  console.error(`[SystemCheckLoop]   文档保鲜度 ≥ ${phaseConfig.qualityGate.requiredDocFreshness}%`)

  const codeChanges = detectCodeChanges(since)
  console.error(`[SystemCheckLoop] 检测到 ${codeChanges.length} 个代码变更文件`)

  const checkResults: CheckResult[] = []
  const enabledAudits = getEnabledAudits(currentPhase as any)
  const disabledAudits = phaseConfig.auditConfig.filter((a) => !a.enabled)

  console.error(`[SystemCheckLoop] --- 审计项列表 (共 ${phaseConfig.auditConfig.length} 项) ---`)
  console.error(`[SystemCheckLoop] ✅ 启用审计 (${enabledAudits.length} 项):`)
  enabledAudits.forEach((audit, index) => {
    console.error(`[SystemCheckLoop]   ${index + 1}. ${audit.name}`)
    console.error(`[SystemCheckLoop]      命令: ${audit.command}`)
    console.error(`[SystemCheckLoop]      超时: ${audit.timeoutMs}ms`)
  })
  
  if (disabledAudits.length > 0) {
    console.error(`[SystemCheckLoop] ❌ 禁用审计 (${disabledAudits.length} 项):`)
    disabledAudits.forEach((audit) => {
      console.error(`[SystemCheckLoop]   - ${audit.name}`)
    })
  }

  let stepCount = 0
  for (const audit of enabledAudits) {
    stepCount++
    console.error(`[SystemCheckLoop] --- 步骤${stepCount}/${enabledAudits.length}: ${audit.name} ---`)
    console.error(`[SystemCheckLoop] 执行命令: ${audit.command}`)
    console.error(`[SystemCheckLoop] 超时设置: ${audit.timeoutMs}ms`)
    const startTime = Date.now()
    const result = runCommand(audit.command, audit.timeoutMs)
    const duration = Date.now() - startTime
    console.error(`[SystemCheckLoop] 执行耗时: ${duration}ms`)
    console.error(`[SystemCheckLoop] 退出码: ${result.exitCode} (${result.exitCode === 0 ? '成功' : '失败'})`)
    checkResults.push(result)
  }

  const report = buildReport(checkResults, triggeredBy)

  if (!silent) {
    printInteractiveSummary(report)
  }

  const persisted = persistReport(report)
  if (persisted) {
    console.error(`[SystemCheckLoop] 报告已保存到: ${persisted}`)
  }

  if (autoFix) {
    runAutoFix(report.issues)
  }

  process.exit(report.summary.overallStatus === 'failure' ? 1 : 0)
}

main()