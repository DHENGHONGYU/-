#!/usr/bin/env node
/**
 * @module scripts/anomaly-detector
 * @description 异常检测机制 — 自动识别偏离基线的异常情况
 *
 * 异常类型：
 * - 测试失败率 > 5%
 * - 性能下降 > 10%
 * - 硬编码问题激增
 * - 文档同步失败
 * - 类型错误
 *
 * 用法：
 *   npx tsx scripts/anomaly-detector.ts [--json] [--threshold=<value>]
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── 常量 ────────────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const BASELINE_FILE = join(ROOT, 'docs', 'metrics', 'baseline.json')

// ANSI 颜色码
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

interface BaselineMetrics {
  testFailureRate: number
  lintWarnings: number
  hardcodeIssues: number
  docSyncIssues: number
  typeErrors: number
  timestamp: string
}

interface AnomalyDetectionResult {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  currentValue: number
  baselineValue: number
  threshold: number
  deviation: number
  message: string
  recommendation: string
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function loadBaseline(): BaselineMetrics {
  if (!existsSync(BASELINE_FILE)) {
    console.log(`${C.yellow}⚠️  基线文件不存在，将创建默认基线${C.reset}`)
    return {
      testFailureRate: 0,
      lintWarnings: 0,
      hardcodeIssues: 0,
      docSyncIssues: 0,
      typeErrors: 0,
      timestamp: new Date().toISOString(),
    }
  }
  const content = readFileSync(BASELINE_FILE, 'utf-8')
  return JSON.parse(content) as BaselineMetrics
}

function saveBaseline(baseline: BaselineMetrics): void {
  const metricsDir = join(ROOT, 'docs', 'metrics')
  if (!existsSync(metricsDir)) {
    execSync(`mkdir -p "${metricsDir}"`, { cwd: ROOT })
  }
  writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2), 'utf-8')
}

function runCommand(cmd: string): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, { encoding: 'utf-8', cwd: ROOT, stdio: 'pipe' })
    return { success: true, output }
  } catch (error: any) {
    return { success: false, output: error.stdout || error.stderr || error.message }
  }
}

function getCurrentMetrics(): BaselineMetrics {
  const metrics: BaselineMetrics = {
    testFailureRate: 0,
    lintWarnings: 0,
    hardcodeIssues: 0,
    docSyncIssues: 0,
    typeErrors: 0,
    timestamp: new Date().toISOString(),
  }

  // 测试失败率
  console.log(`${C.dim}  检测测试失败率...${C.reset}`)
  const testResult = runCommand('npm test -- --run 2>&1 | grep -c "FAIL" || echo "0"')
  const failedTests = parseInt(testResult.output.trim()) || 0
  const totalTestsResult = runCommand('npm test -- --run 2>&1 | grep -c "Test Files" || echo "0"')
  const totalTests = parseInt(totalTestsResult.output.trim()) || 1
  metrics.testFailureRate = (failedTests / totalTests) * 100

  // Lint 警告数
  console.log(`${C.dim}  检测 Lint 警告数...${C.reset}`)
  const lintResult = runCommand('npm run lint 2>&1 | grep -c "warning" || echo "0"')
  metrics.lintWarnings = parseInt(lintResult.output.trim()) || 0

  // 硬编码问题数
  console.log(`${C.dim}  检测硬编码问题数...${C.reset}`)
  const hardcodeResult = runCommand('npm run audit:hardcode 2>&1 | grep -c "Critical" || echo "0"')
  metrics.hardcodeIssues = parseInt(hardcodeResult.output.trim()) || 0

  // 文档同步问题数
  console.log(`${C.dim}  检测文档同步问题数...${C.reset}`)
  const docResult = runCommand('npm run audit:docs 2>&1 | grep -c "未文档化" || echo "0"')
  metrics.docSyncIssues = parseInt(docResult.output.trim()) || 0

  // 类型错误数
  console.log(`${C.dim}  检测类型错误数...${C.reset}`)
  const tscResult = runCommand('npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0"')
  metrics.typeErrors = parseInt(tscResult.output.trim()) || 0

  return metrics
}

function detectAnomalies(
  current: BaselineMetrics,
  baseline: BaselineMetrics,
  threshold: number,
): AnomalyDetectionResult[] {
  const anomalies: AnomalyDetectionResult[] = []

  // 测试失败率异常
  if (current.testFailureRate > threshold) {
    const deviation = current.testFailureRate - baseline.testFailureRate
    anomalies.push({
      type: '测试失败率',
      severity: current.testFailureRate > 10 ? 'critical' : 'high',
      currentValue: current.testFailureRate,
      baselineValue: baseline.testFailureRate,
      threshold,
      deviation,
      message: `测试失败率 ${current.testFailureRate.toFixed(2)}% 超过阈值 ${threshold}%`,
      recommendation: '检查失败的测试用例，修复代码或更新测试',
    })
  }

  // Lint 警告激增
  const lintThreshold = Math.max(baseline.lintWarnings * 1.1, 10)
  if (current.lintWarnings > lintThreshold) {
    anomalies.push({
      type: 'Lint 警告',
      severity: current.lintWarnings > 100 ? 'high' : 'medium',
      currentValue: current.lintWarnings,
      baselineValue: baseline.lintWarnings,
      threshold: lintThreshold,
      deviation: current.lintWarnings - baseline.lintWarnings,
      message: `Lint 警告数 ${current.lintWarnings} 超过基线 ${baseline.lintWarnings}`,
      recommendation: '运行 npm run lint --fix 自动修复，或手动处理警告',
    })
  }

  // 硬编码问题激增
  const hardcodeThreshold = Math.max(baseline.hardcodeIssues * 1.05, 5)
  if (current.hardcodeIssues > hardcodeThreshold) {
    anomalies.push({
      type: '硬编码问题',
      severity: current.hardcodeIssues > 50 ? 'high' : 'medium',
      currentValue: current.hardcodeIssues,
      baselineValue: baseline.hardcodeIssues,
      threshold: hardcodeThreshold,
      deviation: current.hardcodeIssues - baseline.hardcodeIssues,
      message: `硬编码问题数 ${current.hardcodeIssues} 超过基线 ${baseline.hardcodeIssues}`,
      recommendation: '提取硬编码到 constants/ 或 config/ 目录',
    })
  }

  // 文档同步失败
  if (current.docSyncIssues > 0) {
    anomalies.push({
      type: '文档同步',
      severity: current.docSyncIssues > 10 ? 'high' : 'medium',
      currentValue: current.docSyncIssues,
      baselineValue: baseline.docSyncIssues,
      threshold: 0,
      deviation: current.docSyncIssues - baseline.docSyncIssues,
      message: `发现 ${current.docSyncIssues} 个未文档化的模块`,
      recommendation: '运行 npm run doc:trigger 检查需要更新的文档',
    })
  }

  // 类型错误
  if (current.typeErrors > 0) {
    anomalies.push({
      type: '类型错误',
      severity: 'critical',
      currentValue: current.typeErrors,
      baselineValue: baseline.typeErrors,
      threshold: 0,
      deviation: current.typeErrors - baseline.typeErrors,
      message: `发现 ${current.typeErrors} 个类型错误`,
      recommendation: '运行 npx tsc --noEmit 查看错误详情并修复',
    })
  }

  return anomalies
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

interface CliArgs {
  json: boolean
  threshold: number
  updateBaseline: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { json: false, threshold: 5, updateBaseline: false }

  for (const arg of argv.slice(2)) {
    if (arg === '--json') {
      args.json = true
    } else if (arg === '--update-baseline') {
      args.updateBaseline = true
    } else if (arg.startsWith('--threshold=')) {
      args.threshold = parseFloat(arg.slice('--threshold='.length))
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
${C.bold}anomaly-detector${C.reset} — 异常检测机制

${C.bold}用法:${C.reset}
  npx tsx scripts/anomaly-detector.ts [选项]

${C.bold}选项:${C.reset}
  ${C.cyan}--json${C.reset}                  以 JSON 格式输出
  ${C.cyan}--threshold=<value>${C.reset}     设置异常检测阈值（默认 5%）
  ${C.cyan}--update-baseline${C.reset}       更新基线指标
  ${C.cyan}--help${C.reset}                  显示此帮助信息

${C.bold}异常类型:${C.reset}
  ${C.red}测试失败率${C.reset} > 阈值
  ${C.yellow}Lint 警告${C.reset} 激增
  ${C.yellow}硬编码问题${C.reset} 激增
  ${C.yellow}文档同步${C.reset} 失败
  ${C.red}类型错误${C.reset} 存在
`)
      process.exit(0)
    } else {
      console.error(`${C.red}未知参数: ${arg}${C.reset}`)
      process.exit(1)
    }
  }

  return args
}

function formatSeverity(severity: string): string {
  switch (severity) {
    case 'critical':
      return `${C.red}严重${C.reset}`
    case 'high':
      return `${C.red}高${C.reset}`
    case 'medium':
      return `${C.yellow}中${C.reset}`
    case 'low':
      return `${C.green}低${C.reset}`
    default:
      return severity
  }
}

function main(): void {
  const args = parseArgs(process.argv)

  if (!args.json) {
    console.log('')
    console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
    console.log(`${C.bold}${C.cyan}║  异常检测机制 — anomaly-detector.ts                      ║${C.reset}`)
    console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
    console.log('')
  }

  // 加载基线
  const baseline = loadBaseline()
  if (!args.json) {
    console.log(`${C.bold}基线指标 (${baseline.timestamp}):${C.reset}`)
    console.log(`  测试失败率: ${baseline.testFailureRate.toFixed(2)}%`)
    console.log(`  Lint 警告: ${baseline.lintWarnings}`)
    console.log(`  硬编码问题: ${baseline.hardcodeIssues}`)
    console.log(`  文档同步问题: ${baseline.docSyncIssues}`)
    console.log(`  类型错误: ${baseline.typeErrors}`)
    console.log('')
  }

  // 获取当前指标
  if (!args.json) {
    console.log(`${C.bold}检测当前指标...${C.reset}`)
  }
  const current = getCurrentMetrics()

  if (!args.json) {
    console.log('')
    console.log(`${C.bold}当前指标:${C.reset}`)
    console.log(`  测试失败率: ${current.testFailureRate.toFixed(2)}%`)
    console.log(`  Lint 警告: ${current.lintWarnings}`)
    console.log(`  硬编码问题: ${current.hardcodeIssues}`)
    console.log(`  文档同步问题: ${current.docSyncIssues}`)
    console.log(`  类型错误: ${current.typeErrors}`)
    console.log('')
  }

  // 检测异常
  const anomalies = detectAnomalies(current, baseline, args.threshold)

  // 输出结果
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          baseline,
          current,
          anomalies,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    )
  } else {
    if (anomalies.length === 0) {
      console.log(`${C.green}✓ 未检测到异常${C.reset}`)
    } else {
      console.log(`${C.bold}${C.red}⚠️  检测到 ${anomalies.length} 个异常:${C.reset}`)
      console.log('')
      for (const anomaly of anomalies) {
        console.log(`${C.bold}[${anomaly.type}]${C.reset} ${formatSeverity(anomaly.severity)}`)
        console.log(`  ${anomaly.message}`)
        console.log(`  当前值: ${anomaly.currentValue.toFixed(2)} | 基线值: ${anomaly.baselineValue.toFixed(2)} | 阈值: ${anomaly.threshold.toFixed(2)}`)
        console.log(`  ${C.cyan}建议:${C.reset} ${anomaly.recommendation}`)
        console.log('')
      }
    }
  }

  // 更新基线
  if (args.updateBaseline) {
    saveBaseline(current)
    if (!args.json) {
      console.log(`${C.green}✓ 基线已更新${C.reset}`)
    }
  }

  // 退出码
  if (anomalies.some((a) => a.severity === 'critical')) {
    process.exit(2)
  } else if (anomalies.length > 0) {
    process.exit(1)
  }
}

main()
