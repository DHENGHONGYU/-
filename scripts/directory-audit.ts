#!/usr/bin/env tsx
/**
 * directory-audit.ts
 * 目录结构审计脚本 v1.0.0
 *
 * 检查目标：
 * 1. AGENTS.md §一 代码块中定义的 src/ 目录是否在实际文件系统中存在
 * 2. src/ 下实际存在的一级目录是否在 AGENTS.md §一 中有定义
 * 3. 已废弃目录（src/utils/、src/databridge/、src/blueprints/）是否有残留
 *
 * 扫描范围：
 * - src/ 下所有一级子目录
 * - 废弃目录检查（全仓库）
 *
 * 输出契约：
 * - stdout：JSON 数据流（AuditReport 结构）
 * - stderr：诊断日志 + 人类可读报告
 * - 文件：docs/reports/audit/directory-audit-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规, 2=执行错误
 */

import * as fs from 'node:fs'
import { runAuditPipeline, type AuditReport } from './_audit-pipeline'

/** AGENTS.md 路径 */
const AGENTS_PATH = 'AGENTS.md'

/** 已废弃目录清单（不应存在） */
const DEPRECATED_DIRS = [
  'src/utils',
  'src/databridge',
  'src/blueprints',
]

/** 目录违规/警告项 */
export interface DirectoryFinding {
  type: 'missing_in_fs' | 'missing_in_doc' | 'deprecated_residual'
  directory: string
  message: string
}

/** 目录审计报告结构 */
export interface DirectoryAuditReport extends AuditReport {
  violations: DirectoryFinding[]
  warnings: DirectoryFinding[]
  summary: {
    totalFiles: number
    totalViolations: number
    totalWarnings: number
    definedInDoc: number
    actualInFs: number
    missingInFs: number
    missingInDoc: number
    deprecatedResidual: number
  }
}

/** 从 AGENTS.md 提取 §一 代码块中的目录定义 */
function extractDefinedDirectories(agentsPath: string): string[] {
  const content = fs.readFileSync(agentsPath, 'utf-8')

  // 找到 §一 的代码块（``` ... ```）
  const sectionRegex = /## 一、[\s\S]*?```([\s\S]*?)```/
  const match = sectionRegex.exec(content)
  if (!match) {
    throw new Error('未在 AGENTS.md 中找到 §一 的目录定义代码块')
  }

  const blockContent = match[1]
  const lines = blockContent.split('\n')
  const dirs: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 提取第一个 token（目录路径），以空格或箭头分隔
    const firstToken = trimmed.split(/\s+/)[0]
    // 匹配 src/xxx/ 或 .agents/xxx/ 或 packages/xxx/ 等架构目录
    if (/^(src\/[\w-]+\/|\.[\w-]+\/[\w-]+\/|packages\/[\w-]+\/)/.test(firstToken)) {
      // 确保以 / 结尾
      const dir = firstToken.endsWith('/') ? firstToken : firstToken + '/'
      if (!dirs.includes(dir)) {
        dirs.push(dir)
      }
    }
  }

  return dirs
}

/** 扫描 src/ 下实际存在的一级目录 */
function scanActualSrcDirectories(): string[] {
  const root = 'src'
  if (!fs.existsSync(root)) {
    return []
  }

  const dirs: string[] = []
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(`${root}/${entry.name}/`)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`扫描 src/ 目录失败: ${message}`)
  }

  return dirs
}

/** 检查废弃目录残留 */
function checkDeprecatedResiduals(): DirectoryFinding[] {
  const findings: DirectoryFinding[] = []

  for (const deprecated of DEPRECATED_DIRS) {
    const exists = fs.existsSync(deprecated)
    if (exists) {
      findings.push({
        type: 'deprecated_residual',
        directory: deprecated + '/',
        message: `已废弃目录仍存在残留：${deprecated}/`,
      })
    }
  }

  return findings
}

/** 执行扫描 */
function scan(): DirectoryAuditReport {
  // 1. 从 AGENTS.md 提取定义
  const definedDirs = extractDefinedDirectories(AGENTS_PATH)

  // 2. 扫描实际 src/ 目录
  const actualDirs = scanActualSrcDirectories()

  // 3. 对比：文档定义了但实际不存在（仅限 src/ 目录）
  const missingInFs: DirectoryFinding[] = []
  for (const dir of definedDirs) {
    if (!dir.startsWith('src/')) continue
    const exists = fs.existsSync(dir)
    if (!exists) {
      missingInFs.push({
        type: 'missing_in_fs',
        directory: dir,
        message: `AGENTS.md 定义的目录在文件系统中不存在：${dir}`,
      })
    }
  }

  // 4. 对比：实际存在但文档未定义
  const missingInDoc: DirectoryFinding[] = []
  const definedSet = new Set(definedDirs)

  for (const actualDir of actualDirs) {
    if (!definedSet.has(actualDir)) {
      missingInDoc.push({
        type: 'missing_in_doc',
        directory: actualDir,
        message: `文件系统中存在但 AGENTS.md §一 未定义的目录：${actualDir}`,
      })
    }
  }

  // 5. 检查废弃目录残留
  const deprecatedResiduals = checkDeprecatedResiduals()

  // 汇总
  const violations = [...missingInFs, ...missingInDoc, ...deprecatedResiduals]
  const warnings: DirectoryFinding[] = []

  return {
    violations,
    warnings,
    summary: {
      totalFiles: actualDirs.length,
      totalViolations: violations.length,
      totalWarnings: warnings.length,
      definedInDoc: definedDirs.filter(d => d.startsWith('src/')).length,
      actualInFs: actualDirs.length,
      missingInFs: missingInFs.length,
      missingInDoc: missingInDoc.length,
      deprecatedResidual: deprecatedResiduals.length,
    },
  }
}

/** 格式化人类可读报告 */
function formatReport(report: DirectoryAuditReport): string {
  const lines: string[] = []

  lines.push('╔════════════════════════════════════════════════════════════╗')
  lines.push('║  目录结构审计 — directory-audit.ts v1.0.0                  ║')
  lines.push('╚════════════════════════════════════════════════════════════╝')
  lines.push('')

  if (report.violations.length === 0) {
    lines.push('✅ 未发现目录结构违规或警告')
    lines.push('────────────────────────────────────────────────────────────')
    lines.push(`文档定义 src/ 目录数: ${report.summary.definedInDoc}`)
    lines.push(`实际 src/ 目录数:     ${report.summary.actualInFs}`)
    lines.push('────────────────────────────────────────────────────────────')
  } else {
    lines.push('❌ 发现目录结构违规')
    lines.push('────────────────────────────────────────────────────────────')

    const missingInFs = report.violations.filter(v => v.type === 'missing_in_fs')
    const missingInDoc = report.violations.filter(v => v.type === 'missing_in_doc')
    const deprecated = report.violations.filter(v => v.type === 'deprecated_residual')

    if (missingInFs.length > 0) {
      lines.push(`【文档定义但文件系统缺失】（${missingInFs.length} 项）`)
      for (const v of missingInFs) {
        lines.push(`  ⚠️  ${v.directory}`)
      }
      lines.push('')
    }

    if (missingInDoc.length > 0) {
      lines.push(`【文件系统存在但文档未定义】（${missingInDoc.length} 项）`)
      for (const v of missingInDoc) {
        lines.push(`  ⚠️  ${v.directory}`)
      }
      lines.push('')
    }

    if (deprecated.length > 0) {
      lines.push(`【已废弃目录残留】（${deprecated.length} 项）`)
      for (const v of deprecated) {
        lines.push(`  🔴 ${v.directory}`)
      }
      lines.push('')
    }

    lines.push('────────────────────────────────────────────────────────────')
    lines.push(`文档定义 src/ 目录数: ${report.summary.definedInDoc}`)
    lines.push(`实际 src/ 目录数:     ${report.summary.actualInFs}`)
    lines.push(`违规总数:             ${report.summary.totalViolations}`)
    lines.push('────────────────────────────────────────────────────────────')
  }

  return lines.join('\n')
}

/** CLI 入口 */
function main(): void {
  runAuditPipeline({
    scriptName: 'directory-audit',
    version: '1.0.0',
    scanFn: scan,
    formatReportFn: formatReport,
  })
}

main()
