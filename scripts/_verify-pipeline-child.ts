#!/usr/bin/env tsx
/**
 * _verify-pipeline-child.ts
 * 白盒/透明管道验证的子进程脚本
 *
 * 根据环境变量 MOCK_SCENARIO 调用不同的 mock 场景：
 * - clean      → 无违规（exitCode=0）
 * - violations → 有违规（exitCode=1）
 * - error      → 执行错误（exitCode=2）
 *
 * 父进程通过 spawnSync 运行本脚本，捕获 stdout / stderr / 退出码。
 *
 * 执行：MOCK_SCENARIO=clean npx tsx scripts/_verify-pipeline-child.ts
 */

import { runAuditPipeline, type AuditReport } from './_audit-pipeline'

/** Mock 报告：无违规 */
function mockCleanReport(): AuditReport {
  return {
    violations: [],
    warnings: [],
    summary: {
      totalFiles: 10,
      totalViolations: 0,
      totalWarnings: 0,
    },
  }
}

/** Mock 报告：有违规 */
function mockViolationsReport(): AuditReport {
  return {
    violations: [
      {
        file: 'src/components/Foo.tsx',
        line: 42,
        type: '硬编码颜色',
        message: '检测到 HEX 颜色 #ef4444',
      },
      {
        file: 'src/services/bar.ts',
        line: 88,
        type: '魔法数字',
        message: '检测到魔法数字 86400',
      },
    ],
    warnings: [
      {
        file: 'src/lib/utils.ts',
        line: 15,
        type: '未使用导入',
        message: 'lodash 已导入但未使用',
      },
    ],
    summary: {
      totalFiles: 50,
      totalViolations: 2,
      totalWarnings: 1,
    },
  }
}

/** Mock 报告：执行错误（scan 抛出异常） */
function mockErrorScan(): AuditReport {
  throw new Error('模拟扫描失败：无法读取目录 /nonexistent')
}

/** Mock 人类可读报告格式化 */
function mockFormatReport(report: AuditReport): string {
  const lines: string[] = []
  lines.push('=== Mock 审计报告 ===')
  lines.push(`扫描文件数: ${report.summary.totalFiles}`)
  lines.push(`违规数: ${report.summary.totalViolations}`)
  if (report.summary.totalWarnings && report.summary.totalWarnings > 0) {
    lines.push(`警告数: ${report.summary.totalWarnings}`)
  }
  if (report.violations.length > 0) {
    lines.push('\n违规列表:')
    for (const v of report.violations) {
      const item = v as { file: string; line: number; type: string; message: string }
      lines.push(`  - ${item.file}:${item.line} [${item.type}] ${item.message}`)
    }
  }
  if (report.warnings && report.warnings.length > 0) {
    lines.push('\n警告列表:')
    for (const w of report.warnings) {
      const item = w as { file: string; line: number; type: string; message: string }
      lines.push(`  - ${item.file}:${item.line} [${item.type}] ${item.message}`)
    }
  }
  if (report.summary.totalViolations === 0) {
    lines.push('\n✅ 无违规')
  } else {
    lines.push('\n❌ 存在违规')
  }
  return lines.join('\n')
}

// ============================================================
// 主函数：根据环境变量调用不同场景
// ============================================================

const scenario = process.env.MOCK_SCENARIO ?? 'clean'

let scanFn: () => AuditReport
let scriptName: string

switch (scenario) {
  case 'clean':
    scanFn = mockCleanReport
    scriptName = 'mock-clean-audit'
    break
  case 'violations':
    scanFn = mockViolationsReport
    scriptName = 'mock-violations-audit'
    break
  case 'error':
    scanFn = mockErrorScan
    scriptName = 'mock-error-audit'
    break
  default:
    console.error(`未知场景: ${scenario}`)
    process.exit(2)
}

const result = runAuditPipeline<AuditReport>({
  scriptName,
  version: 'test-1.0',
  scanFn,
  formatReportFn: mockFormatReport,
})

process.exit(result.exitCode)
