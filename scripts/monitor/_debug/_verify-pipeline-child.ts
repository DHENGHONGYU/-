#!/usr/bin/env tsx
/**
 * _verify-pipeline-child.ts
 * verify-pipeline-output.ts 的子进程契约验证助手
 *
 * 根据环境变量 MOCK_SCENARIO 模拟三种审计结果：
 * - clean：无违规
 * - violations：有违规 + 警告
 * - error：扫描抛错
 */

import { runAuditPipeline, type AuditReport } from './_audit-pipeline'

const scenario = process.env.MOCK_SCENARIO ?? 'clean'

function buildCleanReport(): AuditReport {
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

function buildViolationsReport(): AuditReport {
  return {
    violations: [
      { file: 'a.tsx', line: 10, type: '硬编码颜色', message: '发现硬编码颜色 #ef4444' },
      { file: 'b.ts', line: 20, type: '魔法数字', message: '发现未解释魔法数字 1200' },
    ],
    warnings: [{ file: 'c.ts', line: 5, type: '静默回退', message: '发现 ?? 静默回退' }],
    summary: {
      totalFiles: 50,
      totalViolations: 2,
      totalWarnings: 1,
    },
  }
}

function formatCleanReport(): string {
  return [
    '╔════════════════════════════════════════════════════════════╗',
    '║  Mock 审计报告                                             ║',
    '╚════════════════════════════════════════════════════════════╝',
    '',
    '✅ 无违规',
    '扫描文件数: 10',
    '违规数: 0',
    '',
  ].join('\n')
}

function formatViolationsReport(report: AuditReport): string {
  const v = report.violations.length
  const w = report.summary.totalWarnings ?? 0
  return [
    '╔════════════════════════════════════════════════════════════╗',
    '║  Mock 审计报告                                             ║',
    '╚════════════════════════════════════════════════════════════╝',
    '',
    `🔴 发现 ${v} 处违规`,
    `⚠️  发现 ${w} 处警告`,
    '',
    '违规列表:',
    '  ❌ 存在违规：硬编码颜色',
    '  ❌ 存在违规：魔法数字',
    '',
  ].join('\n')
}

function formatErrorReport(): string {
  return '审计执行失败，无人类可读报告'
}

function scan(): AuditReport {
  switch (scenario) {
    case 'clean':
      return buildCleanReport()
    case 'violations':
      return buildViolationsReport()
    case 'error':
      throw new Error('模拟扫描失败')
    default:
      throw new Error(`未知场景: ${scenario}`)
  }
}

function formatReport(report: AuditReport): string {
  switch (scenario) {
    case 'clean':
      return formatCleanReport()
    case 'violations':
      return formatViolationsReport(report)
    case 'error':
      return formatErrorReport()
    default:
      return ''
  }
}

const result = runAuditPipeline({
  scriptName: scenario === 'clean' ? 'mock-clean-audit' : scenario === 'violations' ? 'mock-violations-audit' : 'mock-error-audit',
  version: '1.0.0',
  scanFn: scan,
  formatReportFn: formatReport,
})

process.exit(result.exitCode)
