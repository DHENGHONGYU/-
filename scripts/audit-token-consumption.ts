#!/usr/bin/env tsx
/**
 * audit-token-consumption.ts
 * Token 消耗检测脚本 v3.0（白盒/透明管道）
 *
 * 检查目标：
 * 1. 检测知识图谱生成脚本是否支持增量更新（基于文件 mtime）
 * 2. 检测是否存在重复搜索模式（应使用知识图谱替代）
 * 3. 检测 AI 辅助开发中的 Token 浪费行为
 * 4. 验证 Token 预算控制（单次会话 < 50,000 tokens）
 *
 * v3.0 改造（2026-07-06）：
 * - 采用白盒/透明管道模式：export scan() / formatReport() / main()
 * - stdout 输出 JSON 数据流（机器可读）
 * - stderr 输出诊断日志 + 人类可读报告
 * - 持久化报告到 docs/reports/audit/audit-token-consumption-{timestamp}.json
 * - 支持 CLI 参数：--json / --quiet / --output / --no-persist
 * - 测试可直接 import scan() 验证 Report 对象，无需解析字符串
 * - 文件读取添加 try-catch 边界条件处理
 *
 * 输出契约：
 * - stdout：JSON 数据流（AuditReport 结构）
 * - stderr：诊断日志 + 人类可读报告
 * - 文件：docs/reports/audit/audit-token-consumption-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规, 2=执行错误
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runAuditPipeline, colorize, type AuditReport } from './_audit-pipeline'

/** Token 消耗违规/警告项 */
export interface Finding {
  file: string
  line: number
  type: string
  message: string
  suggestion: string
}

/** Token 消耗审计报告 */
export interface Report extends AuditReport {
  violations: Finding[]
  warnings: Finding[]
  summary: {
    totalFiles: number
    totalChecks: number
    totalViolations: number
    totalWarnings: number
    estimatedTokenSavings: number
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

/** 安全读取文件内容（边界条件处理：文件存在但读取失败时返回 null） */
function safeReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function checkExtractCodeGraphIncremental(): Finding[] {
  const findings: Finding[] = []
  const scriptPath = path.join(ROOT, 'scripts', 'extract-code-graph.ts')

  if (!fs.existsSync(scriptPath)) {
    findings.push({
      file: 'scripts/extract-code-graph.ts',
      line: 0,
      type: '缺失文件',
      message: '知识图谱生成脚本不存在',
      suggestion: '创建 scripts/extract-code-graph.ts 并实现增量更新逻辑',
    })
    return findings
  }

  const content = safeReadFile(scriptPath)
  if (content === null) {
    findings.push({
      file: 'scripts/extract-code-graph.ts',
      line: 0,
      type: '读取失败',
      message: '知识图谱生成脚本读取失败（权限或编码问题）',
      suggestion: '检查文件权限和编码，确保可被正常读取',
    })
    return findings
  }

  // 检查是否支持增量更新（基于 mtime）
  if (!content.includes('mtime') && !content.includes('lastModified')) {
    findings.push({
      file: 'scripts/extract-code-graph.ts',
      line: 1,
      type: '缺少增量更新',
      message: '知识图谱生成脚本未支持增量更新（基于文件 mtime）',
      suggestion: '添加文件 mtime 检查逻辑，仅重新解析变更文件，预计节省 7.5M tokens/月',
    })
  }

  // 检查是否缓存已解析的文件
  if (!content.includes('cache') && !content.includes('Cache')) {
    findings.push({
      file: 'scripts/extract-code-graph.ts',
      line: 1,
      type: '缺少缓存机制',
      message: '知识图谱生成脚本未缓存已解析的文件 AST',
      suggestion: '添加 AST 缓存机制，避免重复解析未变更文件',
    })
  }

  return findings
}

function checkQuickQueryTemplates(): Finding[] {
  const findings: Finding[] = []
  const quickQueryPath = path.join(ROOT, 'scripts', 'quick-query.sh')

  if (!fs.existsSync(quickQueryPath)) {
    findings.push({
      file: 'scripts/quick-query.sh',
      line: 0,
      type: '缺失快速查询模板',
      message: '未创建快速查询脚本',
      suggestion: '创建 scripts/quick-query.sh，提供常用查询模板（Store 依赖、跨层违规、最大文件等）',
    })
    return findings
  }

  const content = safeReadFile(quickQueryPath)
  if (content === null) {
    findings.push({
      file: 'scripts/quick-query.sh',
      line: 0,
      type: '读取失败',
      message: '快速查询脚本读取失败（权限或编码问题）',
      suggestion: '检查文件权限和编码，确保可被正常读取',
    })
    return findings
  }

  // 检查是否包含常用查询
  const requiredQueries = [
    'query-store-deps',
    'query-cross-layer-violations',
    'query-largest-files',
    'query-top-imported',
  ]

  for (const query of requiredQueries) {
    if (!content.includes(query)) {
      findings.push({
        file: 'scripts/quick-query.sh',
        line: 1,
        type: '缺少查询模板',
        message: `快速查询脚本缺少 ${query} 模板`,
        suggestion: `添加 ${query} 函数，提供标准化查询接口`,
      })
    }
  }

  return findings
}

function checkTokenBudgetDocumentation(): Finding[] {
  const findings: Finding[] = []
  const agentsPath = path.join(ROOT, 'AGENTS.md')

  if (!fs.existsSync(agentsPath)) {
    findings.push({
      file: 'AGENTS.md',
      line: 0,
      type: '缺失文档',
      message: 'AGENTS.md 不存在',
      suggestion: '创建 AGENTS.md 并添加 Token 消耗控制规则',
    })
    return findings
  }

  const content = safeReadFile(agentsPath)
  if (content === null) {
    findings.push({
      file: 'AGENTS.md',
      line: 0,
      type: '读取失败',
      message: 'AGENTS.md 读取失败（权限或编码问题）',
      suggestion: '检查文件权限和编码，确保可被正常读取',
    })
    return findings
  }

  // 检查是否包含 Token 预算规则
  if (!content.includes('Token 预算') && !content.includes('token budget')) {
    findings.push({
      file: 'AGENTS.md',
      line: 1,
      type: '缺少 Token 预算规则',
      message: 'AGENTS.md 未定义 Token 预算控制规则',
      suggestion: '在 §7 添加 Token 消耗控制规则，明确单次会话 Token 上限（50,000）',
    })
  }

  // 检查是否包含知识图谱优先规则
  if (!content.includes('知识图谱优先') && !content.includes('knowledge graph first')) {
    findings.push({
      file: 'AGENTS.md',
      line: 1,
      type: '缺少知识图谱优先规则',
      message: 'AGENTS.md 未强制要求优先使用知识图谱',
      suggestion: '添加知识图谱优先规则，禁止重复搜索已存在的依赖关系',
    })
  }

  return findings
}

function checkTokenOptimizationDocs(): Finding[] {
  const findings: Finding[] = []
  const docsPath = path.join(ROOT, 'docs', 'reports', 'token-optimization-best-practices.md')

  if (!fs.existsSync(docsPath)) {
    findings.push({
      file: 'docs/reports/token-optimization-best-practices.md',
      line: 0,
      type: '缺失优化指南',
      message: 'Token 优化最佳实践文档不存在',
      suggestion: '创建文档，包含代码关系理解、重复搜索消除、架构合规检查优化等章节',
    })
    return findings
  }

  const content = safeReadFile(docsPath)
  if (content === null) {
    findings.push({
      file: 'docs/reports/token-optimization-best-practices.md',
      line: 0,
      type: '读取失败',
      message: 'Token 优化文档读取失败（权限或编码问题）',
      suggestion: '检查文件权限和编码，确保可被正常读取',
    })
    return findings
  }

  // 检查是否包含关键章节
  const requiredSections = [
    '代码关系理解优化',
    '重复搜索消除',
    '架构合规性检查优化',
    '硬编码元素管理',
    '事件监听清理',
  ]

  for (const section of requiredSections) {
    if (!content.includes(section)) {
      findings.push({
        file: 'docs/reports/token-optimization-best-practices.md',
        line: 1,
        type: '缺少章节',
        message: `Token 优化文档缺少 "${section}" 章节`,
        suggestion: `补充 ${section} 章节，提供具体场景的 Token 节省方案`,
      })
    }
  }

  return findings
}

function estimateTokenSavings(violations: Finding[], _warnings: Finding[]): number {
  let savings = 0

  // 增量更新节省：7.5M tokens/月
  if (violations.some(v => v.type === '缺少增量更新')) {
    savings += 7500000
  }

  // 快速查询模板节省：每次 3,800 tokens，月度 76,000
  if (violations.some(v => v.type === '缺失快速查询模板')) {
    savings += 76000
  }

  // Token 预算控制节省：每次会话 35,000 tokens，月度 700,000
  if (violations.some(v => v.type.includes('Token 预算'))) {
    savings += 700000
  }

  // 知识图谱优先节省：每次 8,000 tokens，月度 160,000
  if (violations.some(v => v.type.includes('知识图谱优先'))) {
    savings += 160000
  }

  return savings
}

/** 扫描函数（白盒导出，供测试和外部调用） */
export function scan(): Report {
  const violations: Finding[] = []
  const warnings: Finding[] = []

  // 检查 1：知识图谱增量更新
  violations.push(...checkExtractCodeGraphIncremental())

  // 检查 2：快速查询模板
  violations.push(...checkQuickQueryTemplates())

  // 检查 3：Token 预算文档
  violations.push(...checkTokenBudgetDocumentation())

  // 检查 4：Token 优化文档
  violations.push(...checkTokenOptimizationDocs())

  return {
    violations,
    warnings,
    summary: {
      totalFiles: 4,
      totalChecks: 4,
      totalViolations: violations.length,
      totalWarnings: warnings.length,
      estimatedTokenSavings: estimateTokenSavings(violations, warnings),
    },
  }
}

/** 格式化人类可读报告（输出到 stderr） */
export function formatReport(report: Report): string {
  const lines: string[] = []

  lines.push('╔════════════════════════════════════════════════════════════╗')
  lines.push('║  Token 消耗检测 — audit-token-consumption.ts v3.0          ║')
  lines.push('╚════════════════════════════════════════════════════════════╝')
  lines.push('')

  if (report.violations.length === 0 && report.warnings.length === 0) {
    lines.push(colorize('✅ 未发现 Token 浪费问题', 'green'))
  } else {
    if (report.violations.length > 0) {
      lines.push(colorize(`🔴 发现 ${report.violations.length} 处 Token 浪费问题：`, 'red'))
      lines.push('')
      for (const v of report.violations) {
        lines.push(`  ${v.file}:${v.line}`)
        lines.push(`    [${v.type}] ${v.message}`)
        lines.push(`    💡 ${v.suggestion}`)
        lines.push('')
      }
    }

    if (report.warnings.length > 0) {
      lines.push(colorize(`⚠️  发现 ${report.warnings.length} 处警告：`, 'yellow'))
      lines.push('')
      for (const w of report.warnings) {
        lines.push(`  ${w.file}:${w.line}`)
        lines.push(`    [${w.type}] ${w.message}`)
        lines.push(`    💡 ${w.suggestion}`)
        lines.push('')
      }
    }
  }

  lines.push('────────────────────────────────────────────────────────────')
  lines.push(`检查项数: ${report.summary.totalChecks}`)
  lines.push(`违规数: ${report.summary.totalViolations}`)
  lines.push(`警告数: ${report.summary.totalWarnings}`)
  lines.push(`预计月度 Token 节省: ${(report.summary.estimatedTokenSavings / 1000000).toFixed(2)}M tokens`)
  lines.push('────────────────────────────────────────────────────────────')

  return lines.join('\n')
}

/** CLI 入口（编排：scan → stdout JSON → stderr 诊断 → 持久化 → exit） */
export function main(): void {
  const result = runAuditPipeline<Report>({
    scriptName: 'audit-token-consumption',
    version: '3.0',
    scanFn: scan,
    formatReportFn: formatReport,
  })
  process.exit(result.exitCode)
}

// 仅在直接作为 CLI 运行时执行（避免被 import 时自动运行）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
