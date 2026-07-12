#!/usr/bin/env node
/**
 * @module scripts/system-health-dashboard
 * @description 统一健康度仪表盘 — 整合7个审计命令输出，形成综合评分
 *
 * 覆盖维度：
 * - 分层调用合规性（audit:layers）
 * - 硬编码检测（audit:hardcode）
 * - 死代码检测（audit:deadcode）
 * - 文档同步状态（audit:docs）
 * - 契约合规性（audit:contract）
 * - Token消耗控制（audit:token）
 * - 组件复用率（audit-component-usage）
 * - DataBridge同步（audit-databridge-sync）
 *
 * 用法：
 *   npx tsx scripts/system-health-dashboard.ts [--detailed] [--output <path>]
 *
 * 输出：
 *   - stdout: JSON 格式健康度报告
 *   - 文件: docs/reports/system-health/latest.json
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const ROOT = resolve(__dirname, '..')

const REPORT_DIR = join(ROOT, 'docs', 'reports', 'system-health')

interface AuditResult {
  name: string
  exitCode: number
  output: string
  timestamp: string
  isPass: boolean
}

interface HealthDimension {
  name: string
  auditName: string
  weight: number
  result: AuditResult | null
  score: number
  status: 'pass' | 'warning' | 'failure'
  details: string[]
}

interface SystemHealthReport {
  meta: {
    runId: string
    startedAt: string
    finishedAt: string
    rootDir: string
  }
  dimensions: HealthDimension[]
  summary: {
    totalScore: number
    overallStatus: 'pass' | 'warning' | 'failure'
    passedCount: number
    warningCount: number
    failureCount: number
    totalDimensions: number
  }
  recommendations: string[]
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTimestamp(date: Date): string {
  return date.toISOString()
}

function runAuditCommand(command: string): AuditResult {
  const startTime = Date.now()
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      cwd: ROOT,
      timeout: 120000,
    })
    const exitCode = 0
    return {
      name: command,
      exitCode,
      output,
      timestamp: formatTimestamp(new Date()),
      isPass: exitCode === 0,
    }
  } catch (error) {
    const exitCode = (error instanceof Error && (error as { status?: number }).status) ?? 1
    const output = error instanceof Error ? error.message : String(error)
    return {
      name: command,
      exitCode,
      output,
      timestamp: formatTimestamp(new Date()),
      isPass: exitCode === 0,
    }
  }
}

function parseLayerAudit(output: string): { violations: number; warnings: number; details: string[] } {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  let violations = 0
  let warnings = 0
  const details: string[] = []

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      violations = json.summary?.totalViolations || 0
      warnings = json.summary?.totalWarnings || 0
    } catch {
      violations = (output.match(/违规数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/违规数:\s*(\d+)/) || [])[1]) : 0
      warnings = (output.match(/警告数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/警告数:\s*(\d+)/) || [])[1]) : 0
    }
  } else {
    violations = (output.match(/违规数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/违规数:\s*(\d+)/) || [])[1]) : 0
    warnings = (output.match(/警告数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/警告数:\s*(\d+)/) || [])[1]) : 0
  }

  if (violations > 0) details.push(`发现 ${violations} 个跨层调用违规`)
  if (warnings > 0) details.push(`发现 ${warnings} 个警告`)
  return { violations, warnings, details }
}

function parseHardcodeAudit(output: string): { fatal: number; critical: number; details: string[] } {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  let fatal = 0
  let critical = 0
  const details: string[] = []

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      fatal = Object.values(json.summary?.bySeverity || {}).filter((v: number, i: number, arr: number[]) => 
        Object.keys(json.summary?.bySeverity || {})[i] === 'Fatal'
      )[0] || 0
      critical = Object.values(json.summary?.bySeverity || {}).filter((v: number, i: number, arr: number[]) => 
        Object.keys(json.summary?.bySeverity || {})[i] === 'Critical'
      )[0] || 0
    } catch {
      fatal = (output.match(/Fatal:\s*(\d+)/) || [])[1] ? parseInt((output.match(/Fatal:\s*(\d+)/) || [])[1]) : 0
      critical = (output.match(/Critical:\s*(\d+)/) || [])[1] ? parseInt((output.match(/Critical:\s*(\d+)/) || [])[1]) : 0
    }
  } else {
    fatal = (output.match(/Fatal:\s*(\d+)/) || [])[1] ? parseInt((output.match(/Fatal:\s*(\d+)/) || [])[1]) : 0
    critical = (output.match(/Critical:\s*(\d+)/) || [])[1] ? parseInt((output.match(/Critical:\s*(\d+)/) || [])[1]) : 0
  }

  if (fatal > 0) details.push(`发现 ${fatal} 个 Fatal 级硬编码`)
  if (critical > 0) details.push(`发现 ${critical} 个 Critical 级硬编码`)
  return { fatal, critical, details }
}

function parseDeadcodeAudit(output: string): { missingRoutes: number; emptyFunctions: number; details: string[] } {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  let missingRoutes = 0
  let emptyFunctions = 0
  const details: string[] = []

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      missingRoutes = json.summary?.missingRoutes || json.summary?.totalMissingRoutes || 0
      emptyFunctions = json.summary?.emptyFunctions || json.summary?.totalEmptyFunctions || 0
    } catch {
      missingRoutes = (output.match(/路由文件缺失:\s*(\d+)/) || [])[1] ? parseInt((output.match(/路由文件缺失:\s*(\d+)/) || [])[1]) : 0
      emptyFunctions = (output.match(/空函数\/组件:\s*(\d+)/) || [])[1] ? parseInt((output.match(/空函数\/组件:\s*(\d+)/) || [])[1]) : 0
    }
  } else {
    missingRoutes = (output.match(/路由文件缺失:\s*(\d+)/) || [])[1] ? parseInt((output.match(/路由文件缺失:\s*(\d+)/) || [])[1]) : 0
    emptyFunctions = (output.match(/空函数\/组件:\s*(\d+)/) || [])[1] ? parseInt((output.match(/空函数\/组件:\s*(\d+)/) || [])[1]) : 0
  }

  if (missingRoutes > 0) details.push(`发现 ${missingRoutes} 个缺失路由`)
  if (emptyFunctions > 0) details.push(`发现 ${emptyFunctions} 个空函数`)
  return { missingRoutes, emptyFunctions, details }
}

function parseDocsAudit(output: string): { undocumented: number; details: string[] } {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  let undocumented = 0
  const details: string[] = []

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      undocumented = json.summary?.totalUndocumented || json.summary?.undocumentedCount || 0
    } catch {
      undocumented = (output.match(/疑似未文档化文件:\s*(\d+)/) || [])[1] ? parseInt((output.match(/疑似未文档化文件:\s*(\d+)/) || [])[1]) : 0
    }
  } else {
    undocumented = (output.match(/疑似未文档化文件:\s*(\d+)/) || [])[1] ? parseInt((output.match(/疑似未文档化文件:\s*(\d+)/) || [])[1]) : 0
  }

  if (undocumented > 0) details.push(`发现 ${undocumented} 个未文档化文件`)
  return { undocumented, details }
}

function parseContractAudit(output: string): { violations: number; details: string[] } {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  let violations = 0
  const details: string[] = []

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      violations = json.summary?.totalViolations || json.summary?.violations || 0
    } catch {
      violations = (output.match(/违规数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/违规数:\s*(\d+)/) || [])[1]) : 0
    }
  } else {
    violations = (output.match(/违规数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/违规数:\s*(\d+)/) || [])[1]) : 0
  }

  if (violations > 0) details.push(`发现 ${violations} 个契约违规`)
  return { violations, details }
}

function parseTokenAudit(output: string): { overBudget: boolean; details: string[] } {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  let overBudget = false
  const details: string[] = []

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      overBudget = json.summary?.overBudget || json.summary?.isOverBudget || false
    } catch {
      overBudget = output.includes('over budget') || output.includes('超出预算')
    }
  } else {
    overBudget = output.includes('over budget') || output.includes('超出预算')
  }

  if (overBudget) details.push('Token 消耗超出预算')
  return { overBudget, details }
}

function parseComponentUsage(output: string): { lowReuse: number; totalComponents: number; details: string[] } {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  let lowReuse = 0
  let totalComponents = 0
  const details: string[] = []

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      lowReuse = json.summary?.lowReuseCount || json.summary?.lowReuse || 0
      totalComponents = json.summary?.totalComponents || json.summary?.total || 0
    } catch {
      const match = output.match(/(\d+) components? with low reuse/)
      lowReuse = match ? Number(match[1]) : 0
      const totalMatch = output.match(/(\d+) total components?/)
      totalComponents = totalMatch ? Number(totalMatch[1]) : 0
    }
  } else {
    const match = output.match(/(\d+) components? with low reuse/)
    lowReuse = match ? Number(match[1]) : 0
    const totalMatch = output.match(/(\d+) total components?/)
    totalComponents = totalMatch ? Number(totalMatch[1]) : 0
  }

  if (lowReuse > 0) details.push(`发现 ${lowReuse} 个低复用组件`)
  return { lowReuse, totalComponents, details }
}

function parseMcpAudit(output: string): { violations: number; details: string[] } {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  let violations = 0
  let errors = 0
  const details: string[] = []

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      violations = json.summary?.totalViolations || json.summary?.violations || 0
      errors = json.summary?.totalErrors || json.summary?.errors || 0
    } catch {
      violations = (output.match(/违规数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/违规数:\s*(\d+)/) || [])[1]) : 0
      errors = (output.match(/错误数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/错误数:\s*(\d+)/) || [])[1]) : 0
    }
  } else {
    violations = (output.match(/违规数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/违规数:\s*(\d+)/) || [])[1]) : 0
    errors = (output.match(/错误数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/错误数:\s*(\d+)/) || [])[1]) : 0
  }

  if (violations > 0) details.push(`发现 ${violations} 个 MCP 架构违规`)
  if (errors > 0) details.push(`发现 ${errors} 个 MCP 错误`)
  return { violations: violations + errors, details }
}

function parseRoutesAudit(output: string): { missingRoutes: number; details: string[] } {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  let missingRoutes = 0
  let errors = 0
  const details: string[] = []

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      missingRoutes = json.summary?.missingRoutes || json.summary?.totalMissingRoutes || 0
      errors = json.summary?.totalErrors || json.summary?.errors || 0
    } catch {
      missingRoutes = (output.match(/缺失路由:\s*(\d+)/) || [])[1] ? parseInt((output.match(/缺失路由:\s*(\d+)/) || [])[1]) : 0
      errors = (output.match(/错误数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/错误数:\s*(\d+)/) || [])[1]) : 0
    }
  } else {
    missingRoutes = (output.match(/缺失路由:\s*(\d+)/) || [])[1] ? parseInt((output.match(/缺失路由:\s*(\d+)/) || [])[1]) : 0
    errors = (output.match(/错误数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/错误数:\s*(\d+)/) || [])[1]) : 0
  }

  if (missingRoutes > 0) details.push(`发现 ${missingRoutes} 个缺失路由`)
  if (errors > 0) details.push(`发现 ${errors} 个路由验证错误`)
  return { missingRoutes: missingRoutes + errors, details }
}

function parseColorTokensAudit(output: string): { violations: number; details: string[] } {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  let violations = 0
  let hardcoded = 0
  const details: string[] = []

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      violations = json.summary?.totalViolations || json.summary?.violations || 0
      hardcoded = json.summary?.totalHardcoded || json.summary?.hardcodedCount || 0
    } catch {
      violations = (output.match(/违规数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/违规数:\s*(\d+)/) || [])[1]) : 0
      hardcoded = (output.match(/硬编码颜色:\s*(\d+)/) || [])[1] ? parseInt((output.match(/硬编码颜色:\s*(\d+)/) || [])[1]) : 0
    }
  } else {
    violations = (output.match(/违规数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/违规数:\s*(\d+)/) || [])[1]) : 0
    hardcoded = (output.match(/硬编码颜色:\s*(\d+)/) || [])[1] ? parseInt((output.match(/硬编码颜色:\s*(\d+)/) || [])[1]) : 0
  }

  if (violations > 0) details.push(`发现 ${violations} 个颜色令牌违规`)
  if (hardcoded > 0) details.push(`发现 ${hardcoded} 处硬编码颜色`)
  return { violations: violations + hardcoded, details }
}

function parseVisualAudit(output: string): { issues: number; details: string[] } {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  let issues = 0
  let errors = 0
  let warnings = 0
  const details: string[] = []

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      issues = json.summary?.totalIssues || json.summary?.issues || 0
      errors = json.summary?.totalErrors || json.summary?.errors || 0
      warnings = json.summary?.totalWarnings || json.summary?.warnings || 0
    } catch {
      issues = (output.match(/问题数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/问题数:\s*(\d+)/) || [])[1]) : 0
      errors = (output.match(/错误数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/错误数:\s*(\d+)/) || [])[1]) : 0
      warnings = (output.match(/警告数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/警告数:\s*(\d+)/) || [])[1]) : 0
    }
  } else {
    issues = (output.match(/问题数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/问题数:\s*(\d+)/) || [])[1]) : 0
    errors = (output.match(/错误数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/错误数:\s*(\d+)/) || [])[1]) : 0
    warnings = (output.match(/警告数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/警告数:\s*(\d+)/) || [])[1]) : 0
  }

  if (issues > 0) details.push(`发现 ${issues} 个数据展示效果问题`)
  if (errors > 0) details.push(`发现 ${errors} 个展示效果错误`)
  if (warnings > 0) details.push(`发现 ${warnings} 个展示效果警告`)
  return { issues: issues + errors, details }
}

function calculateDimensionScore(auditName: string, result: AuditResult): { score: number; status: 'pass' | 'warning' | 'failure'; details: string[] } {
  const output = result.output || ''
  const details: string[] = []

  switch (auditName) {
    case 'audit:layers': {
      const { violations, warnings, details: layerDetails } = parseLayerAudit(output)
      details.push(...layerDetails)
      if (violations === 0 && warnings === 0) return { score: 100, status: 'pass', details }
      if (violations === 0 && warnings > 0) return { score: 85, status: 'warning', details }
      return { score: 40, status: 'failure', details }
    }
    case 'audit:hardcode': {
      const { fatal, critical, details: hcDetails } = parseHardcodeAudit(output)
      details.push(...hcDetails)
      if (fatal === 0 && critical === 0) return { score: 100, status: 'pass', details }
      if (fatal === 0 && critical > 0) return { score: 70, status: 'warning', details }
      return { score: 30, status: 'failure', details }
    }
    case 'audit:deadcode': {
      const { missingRoutes, emptyFunctions, details: dcDetails } = parseDeadcodeAudit(output)
      details.push(...dcDetails)
      if (missingRoutes === 0) return { score: 100, status: 'pass', details }
      if (missingRoutes === 0 && emptyFunctions > 0) return { score: 80, status: 'warning', details }
      return { score: 35, status: 'failure', details }
    }
    case 'audit:docs': {
      const { undocumented, details: docDetails } = parseDocsAudit(output)
      details.push(...docDetails)
      if (undocumented === 0) return { score: 100, status: 'pass', details }
      if (undocumented <= 5) return { score: 80, status: 'warning', details }
      return { score: 50, status: 'failure', details }
    }
    case 'audit:token': {
      const { overBudget, details: tokenDetails } = parseTokenAudit(output)
      details.push(...tokenDetails)
      if (!overBudget) return { score: 100, status: 'pass', details }
      return { score: 60, status: 'warning', details }
    }
    case 'audit:mcp': {
      const { violations, details: mcpDetails } = parseMcpAudit(output)
      details.push(...mcpDetails)
      if (violations === 0) return { score: 100, status: 'pass', details }
      if (violations <= 3) return { score: 80, status: 'warning', details }
      return { score: 40, status: 'failure', details }
    }
    case 'audit:routes': {
      const { missingRoutes, details: routeDetails } = parseRoutesAudit(output)
      details.push(...routeDetails)
      if (missingRoutes === 0) return { score: 100, status: 'pass', details }
      if (missingRoutes <= 2) return { score: 85, status: 'warning', details }
      return { score: 35, status: 'failure', details }
    }
    case 'audit:tokens': {
      const { violations, details: tokenDetails } = parseColorTokensAudit(output)
      details.push(...tokenDetails)
      if (violations === 0) return { score: 100, status: 'pass', details }
      if (violations <= 10) return { score: 80, status: 'warning', details }
      return { score: 45, status: 'failure', details }
    }
    case 'audit-component-usage': {
      const { lowReuse, totalComponents, details: cuDetails } = parseComponentUsage(output)
      details.push(...cuDetails)
      const reuseRate = totalComponents > 0 ? ((totalComponents - lowReuse) / totalComponents) * 100 : 100
      if (reuseRate >= 80) return { score: 100, status: 'pass', details }
      if (reuseRate >= 60) return { score: 75, status: 'warning', details }
      return { score: 50, status: 'failure', details }
    }
    case 'audit:visual': {
      const { issues, details: visualDetails } = parseVisualAudit(output)
      details.push(...visualDetails)
      if (issues === 0) return { score: 100, status: 'pass', details }
      if (issues <= 5) return { score: 75, status: 'warning', details }
      return { score: 40, status: 'failure', details }
    }
    default:
      return { score: result.isPass ? 100 : 0, status: result.isPass ? 'pass' : 'failure', details }
  }
}

function buildRecommendations(dimensions: HealthDimension[]): string[] {
  const recommendations: string[] = []

  const failures = dimensions.filter((d) => d.status === 'failure')
  const warnings = dimensions.filter((d) => d.status === 'warning')

  for (const dim of failures) {
    switch (dim.auditName) {
      case 'audit:layers':
        recommendations.push(`[紧急] ${dim.name} 失败，请运行 'npm run fix-layer-violations.ts' 修复跨层调用`)
        break
      case 'audit:hardcode':
        recommendations.push(`[紧急] ${dim.name} 失败，请检查 config 层硬编码股票代码`)
        break
      case 'audit:deadcode':
        recommendations.push(`[紧急] ${dim.name} 失败，请检查缺失路由并补充注册`)
        break
      case 'audit:docs':
        recommendations.push(`[紧急] ${dim.name} 失败，请运行 'npm run audit:docs' 查看未文档化文件`)
        break
      case 'audit:mcp':
        recommendations.push(`[紧急] ${dim.name} 失败，请检查 MCP Server/Tool 权限配置和 ACL 矩阵`)
        break
      case 'audit:routes':
        recommendations.push(`[紧急] ${dim.name} 失败，请检查路由注册和页面组件加载`)
        break
      case 'audit:tokens':
        recommendations.push(`[紧急] ${dim.name} 失败，请运行 'npm run verify:tokens' 检查颜色令牌使用`)
        break
      case 'audit:visual':
        recommendations.push(`[紧急] ${dim.name} 失败，请检查图表配置和数据展示效果`)
        break
      default:
        recommendations.push(`[紧急] ${dim.name} 失败，请运行 '${dim.auditName}' 查看详细信息`)
    }
  }

  for (const dim of warnings) {
    switch (dim.auditName) {
      case 'audit:layers':
        recommendations.push(`[建议] ${dim.name} 存在警告，请关注跨层调用警告`)
        break
      case 'audit:hardcode':
        recommendations.push(`[建议] ${dim.name} 存在硬编码警告，建议逐步清理`)
        break
      case 'audit-component-usage':
        recommendations.push(`[建议] ${dim.name} 存在低复用组件，建议抽取公共组件`)
        break
      case 'audit:mcp':
        recommendations.push(`[建议] ${dim.name} 存在警告，请检查 MCP 权限矩阵配置`)
        break
      case 'audit:routes':
        recommendations.push(`[建议] ${dim.name} 存在警告，请关注路由验证警告`)
        break
      case 'audit:tokens':
        recommendations.push(`[建议] ${dim.name} 存在颜色令牌警告，建议逐步修复`)
        break
      case 'audit:visual':
        recommendations.push(`[建议] ${dim.name} 存在数据展示效果警告，建议优化图表配置`)
        break
      default:
        recommendations.push(`[建议] ${dim.name} 存在警告，建议关注`)
    }
  }

  return recommendations
}

function runAllAudits(): AuditResult[] {
  const audits = [
    { name: 'audit:layers', command: 'npm run audit:layers' },
    { name: 'audit:hardcode', command: 'npm run audit:hardcode' },
    { name: 'audit:deadcode', command: 'npm run audit:deadcode' },
    { name: 'audit:docs', command: 'npm run audit:docs' },
    { name: 'audit:token', command: 'npm run audit:token' },
    { name: 'audit:mcp', command: 'npm run audit:mcp' },
    { name: 'audit:routes', command: 'npm run audit:routes' },
    { name: 'audit:tokens', command: 'npm run audit:tokens' },
    { name: 'audit-component-usage', command: 'npx tsx scripts/audit-component-usage.ts' },
    { name: 'audit:visual', command: 'npx tsx scripts/audit-visual.ts' },
  ]

  const results: AuditResult[] = []
  for (const audit of audits) {
    console.error(`[SystemHealth] 正在执行: ${audit.name}`)
    const result = runAuditCommand(audit.command)
    result.name = audit.name
    results.push(result)
  }
  return results
}

function buildHealthReport(auditResults: AuditResult[]): SystemHealthReport {
  const startedAt = new Date()
  const runId = generateId()

  const dimensions: HealthDimension[] = [
    { name: '分层调用合规性', auditName: 'audit:layers', weight: 12 },
    { name: '硬编码检测', auditName: 'audit:hardcode', weight: 12 },
    { name: '死代码检测', auditName: 'audit:deadcode', weight: 8 },
    { name: '文档同步状态', auditName: 'audit:docs', weight: 12 },
    { name: 'Token消耗控制', auditName: 'audit:token', weight: 8 },
    { name: 'MCP架构管理', auditName: 'audit:mcp', weight: 12 },
    { name: '路由验证', auditName: 'audit:routes', weight: 8 },
    { name: '颜色令牌合规', auditName: 'audit:tokens', weight: 10 },
    { name: '组件复用率', auditName: 'audit-component-usage', weight: 10 },
    { name: '数据展示效果', auditName: 'audit:visual', weight: 8 },
  ].map((dim) => {
    const result = auditResults.find((r) => r.name === dim.auditName) || null
    const { score, status, details } = result
      ? calculateDimensionScore(dim.auditName, result)
      : { score: 0, status: 'failure' as const, details: ['审计未执行'] }
    return { ...dim, result, score, status, details }
  })

  const totalScore = Math.round(
    dimensions.reduce((sum, dim) => sum + dim.score * dim.weight, 0) /
      dimensions.reduce((sum, dim) => sum + dim.weight, 0)
  )

  const passedCount = dimensions.filter((d) => d.status === 'pass').length
  const warningCount = dimensions.filter((d) => d.status === 'warning').length
  const failureCount = dimensions.filter((d) => d.status === 'failure').length

  let overallStatus: 'pass' | 'warning' | 'failure' = 'pass'
  if (failureCount > 0) overallStatus = 'failure'
  else if (warningCount > 0) overallStatus = 'warning'

  const recommendations = buildRecommendations(dimensions)

  return {
    meta: {
      runId,
      startedAt: formatTimestamp(startedAt),
      finishedAt: formatTimestamp(new Date()),
      rootDir: ROOT,
    },
    dimensions,
    summary: {
      totalScore,
      overallStatus,
      passedCount,
      warningCount,
      failureCount,
      totalDimensions: dimensions.length,
    },
    recommendations,
  }
}

function persistReport(report: SystemHealthReport): string | null {
  try {
    if (!existsSync(REPORT_DIR)) {
      mkdirSync(REPORT_DIR, { recursive: true })
    }
    const timestamp = report.meta.startedAt.replace(/[:.]/g, '-')
    const filePath = join(REPORT_DIR, `system-health-${timestamp}.json`)
    const latestPath = join(REPORT_DIR, 'latest.json')

    writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8')
    writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf-8')

    return filePath
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[SystemHealth] 持久化报告失败: ${message}`)
    return null
  }
}

function printSummary(report: SystemHealthReport): void {
  const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
  }

  console.log('')
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.cyan}║         系统健康度仪表盘 — System Health Dashboard        ║${C.reset}`)
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')

  console.log(`${C.bold}运行ID:${C.reset} ${report.meta.runId}`)
  console.log(`${C.bold}时间:${C.reset} ${report.meta.startedAt}`)
  console.log('')

  let statusColor = C.green
  if (report.summary.overallStatus === 'failure') statusColor = C.red
  else if (report.summary.overallStatus === 'warning') statusColor = C.yellow

  console.log(`${C.bold}综合评分:${C.reset} ${statusColor}${report.summary.totalScore}/100${C.reset}`)
  console.log(
    `${C.bold}整体状态:${C.reset} ${statusColor}${report.summary.overallStatus.toUpperCase()}${C.reset}`
  )
  console.log('')

  console.log(`${C.bold}各维度评分:${C.reset}`)
  console.log('')

  for (const dim of report.dimensions) {
    let dimColor = C.green
    if (dim.status === 'failure') dimColor = C.red
    else if (dim.status === 'warning') dimColor = C.yellow

    console.log(
      `  ${C.dim}${dim.name.padEnd(16)}${C.reset} ${dimColor}${dim.score.toString().padStart(3)}/100${C.reset} (权重: ${dim.weight}%)`
    )
    for (const detail of dim.details) {
      console.log(`    ${C.dim}→ ${detail}${C.reset}`)
    }
  }

  console.log('')

  if (report.recommendations.length > 0) {
    console.log(`${C.bold}${C.yellow}修复建议:${C.reset}`)
    console.log('')
    for (const rec of report.recommendations) {
      console.log(`  ${C.cyan}•${C.reset} ${rec}`)
    }
    console.log('')
  }

  console.log(`${C.bold}${C.green}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.green}║  ${report.summary.passedCount} 通过 | ${report.summary.warningCount} 警告 | ${report.summary.failureCount} 失败${C.reset}`)
  console.log(`${C.bold}${C.green}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')
}

function main(): void {
  const args = process.argv.slice(2)
  const detailed = args.includes('--detailed')
  const outputPathArg = args.find((a) => a.startsWith('--output='))
  const outputPath = outputPathArg ? outputPathArg.split('=')[1] : null

  console.error('[SystemHealth] 开始执行系统健康度检查...')

  const auditResults = runAllAudits()
  const report = buildHealthReport(auditResults)

  printSummary(report)

  if (!outputPath) {
    const persisted = persistReport(report)
    if (persisted) {
      console.error(`[SystemHealth] 报告已保存到: ${persisted}`)
    }
  } else {
    writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8')
    console.error(`[SystemHealth] 报告已保存到: ${outputPath}`)
  }

  if (detailed) {
    console.log(JSON.stringify(report, null, 2))
  }

  process.exit(report.summary.overallStatus === 'failure' ? 1 : 0)
}

main()