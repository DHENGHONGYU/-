/**
 * @module _audit-pipeline
 * @description 审计脚本共享管道工具 —— 实现"白盒/透明管道"输出规范
 *
 * 核心契约：
 * - stdout = 数据流（JSON）：机器可读的审计结果
 * - stderr = 诊断流（人类可读日志）：进度、警告、汇总
 * - 文件 = 持久化归档：docs/reports/audit/{name}-{timestamp}.json
 *
 * 退出码：
 * - 0：无违规
 * - 1：有违规
 * - 2：脚本执行错误
 *
 * @example
 * ```typescript
 * import { runAuditPipeline, type AuditReport } from './_audit-pipeline'
 *
 * export function scan(): AuditReport {
 *   // 纯数据扫描逻辑
 *   return { violations: [], summary: { totalFiles: 0, totalViolations: 0 } }
 * }
 *
 * export function main(): void {
 *   runAuditPipeline({
 *     scriptName: 'audit-layer-calls',
 *     scanFn: scan,
 *     formatReportFn: (report) => '人类可读报告字符串',
 *   })
 * }
 * ```
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

// ============================================================
// 类型定义
// ============================================================

/** 基础审计报告接口（各脚本可扩展） */
export interface AuditReport {
  /** 违规列表（脚本特定结构） */
  violations: unknown[]
  /** 警告列表（脚本特定结构） */
  warnings?: unknown[]
  /** 汇总信息 */
  summary: {
    totalFiles: number
    totalViolations: number
    totalWarnings?: number
    [key: string]: unknown
  }
  /** 脚本元信息 */
  meta?: AuditMeta
}

/** 审计元信息 */
export interface AuditMeta {
  /** 脚本名称 */
  scriptName: string
  /** 脚本版本 */
  version?: string
  /** 执行时间戳（ISO） */
  timestamp: string
  /** 执行耗时（毫秒） */
  durationMs?: number
  /** 根目录 */
  rootDir: string
}

/** 管道配置（泛型版本，确保类型安全） */
export interface PipelineConfig<TReport extends AuditReport = AuditReport> {
  /** 脚本名称（用于持久化文件名和日志前缀） */
  scriptName: string
  /** 扫描函数（纯数据，无副作用） */
  scanFn: () => TReport
  /** 人类可读报告格式化函数（输出到 stderr） */
  formatReportFn: (report: TReport) => string
  /** 脚本版本（可选） */
  version?: string
}

/** 管道执行结果（泛型版本，保留报告类型信息） */
export interface PipelineResult<TReport extends AuditReport = AuditReport> {
  /** 审计报告 */
  report: TReport
  /** 退出码 */
  exitCode: number
  /** 持久化文件路径（未持久化则为 null） */
  persistedPath: string | null
}

// ============================================================
// CLI 参数解析
// ============================================================

/** 解析 CLI 参数 */
export interface CliOptions {
  /** --json：stdout 仅输出 JSON（默认 true） */
  json: boolean
  /** --quiet：抑制 stderr 诊断 */
  quiet: boolean
  /** --output <path>：自定义持久化路径 */
  output: string | null
  /** --no-persist：跳过文件持久化 */
  noPersist: boolean
}

/** 解析命令行参数 */
export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliOptions {
  return {
    json: !argv.includes('--no-json'),
    quiet: argv.includes('--quiet'),
    output: (() => {
      const idx = argv.indexOf('--output')
      return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1]! : null
    })(),
    noPersist: argv.includes('--no-persist'),
  }
}

// ============================================================
// 输出通道
// ============================================================

/** 写入 stderr（诊断流，同步） */
export function writeStderr(message: string): void {
  const output = message.endsWith('\n') ? message : message + '\n'
  fs.writeSync(2, output)
}

/** 写入 stdout（数据流，JSON 格式，同步） */
export function writeStdoutJson(data: unknown): void {
  fs.writeSync(1, JSON.stringify(data, null, 2) + '\n')
}

/** 带时间戳的日志写入 stderr */
export function logDiagnostic(message: string, quiet = false): void {
  if (quiet) return
  const timestamp = new Date().toISOString()
  writeStderr(`[${timestamp}] ${message}`)
}

// ============================================================
// 持久化
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const AUDIT_REPORTS_DIR = path.join(ROOT, 'docs', 'reports', 'audit')

/**
 * 持久化审计报告到文件
 * @returns 文件路径，失败返回 null
 */
export function persistReport(
  report: AuditReport,
  scriptName: string,
  customPath?: string | null,
): string | null {
  try {
    const targetDir = customPath ? path.dirname(customPath) : AUDIT_REPORTS_DIR
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = customPath
      ? path.basename(customPath)
      : `${scriptName}-${timestamp}.json`
    const filePath = customPath ?? path.join(targetDir, filename)

    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8')
    return filePath
  } catch (err) {
    logDiagnostic(`⚠️  持久化报告失败: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

// ============================================================
// 主管道
// ============================================================

/**
 * 运行审计管道
 *
 * 执行流程：
 * 1. 解析 CLI 参数
 * 2. 调用 scanFn() 生成报告（纯数据）
 * 3. stdout 输出 JSON 数据流
 * 4. stderr 输出诊断日志 + 人类可读报告
 * 5. 持久化到文件
 * 6. 设置退出码
 *
 * @param config 管道配置
 * @returns 执行结果（不调用 process.exit，由调用方决定）
 */
export function runAuditPipeline<TReport extends AuditReport = AuditReport>(
  config: PipelineConfig<TReport>,
): PipelineResult<TReport> {
  const { scriptName, scanFn, formatReportFn, version } = config
  const cliOptions = parseCliArgs()

  const startTime = Date.now()

  // ── 1. 诊断：开始 ──
  logDiagnostic(`🔍 开始审计: ${scriptName}${version ? ` v${version}` : ''}`, cliOptions.quiet)

  // ── 2. 执行扫描 ──
  let report: TReport
  try {
    report = scanFn()
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logDiagnostic(`❌ 审计执行失败: ${errorMsg}`, cliOptions.quiet)
    const errorReport = {
      violations: [],
      summary: { totalFiles: 0, totalViolations: 0 },
      meta: {
        scriptName,
        version,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        rootDir: ROOT,
      },
    } as unknown as TReport
    // 错误场景下也输出 JSON 到 stdout，保证机器可读的数据流完整性
    if (cliOptions.json) {
      writeStdoutJson(errorReport)
    }
    return {
      report: errorReport,
      exitCode: 2,
      persistedPath: null,
    }
  }

  // 注入元信息
  const meta: AuditMeta = {
    scriptName,
    version,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    rootDir: ROOT,
  }
  report = { ...report, meta }

  // ── 3. stdout 输出 JSON 数据流 ──
  if (cliOptions.json) {
    writeStdoutJson(report)
  }

  // ── 4. stderr 输出诊断 + 人类可读报告 ──
  if (!cliOptions.quiet) {
    const durationSec = (meta.durationMs! / 1000).toFixed(2)
    logDiagnostic(`📊 扫描完成: ${report.summary.totalFiles} 文件, ${report.summary.totalViolations} 违规, 耗时 ${durationSec}s`)

    if (report.summary.totalViolations > 0) {
      logDiagnostic(`🔴 发现 ${report.summary.totalViolations} 处违规`)
    }
    if (report.summary.totalWarnings && report.summary.totalWarnings > 0) {
      logDiagnostic(`⚠️  发现 ${report.summary.totalWarnings} 处警告`)
    }

    // 输出人类可读报告
    writeStderr('\n' + formatReportFn(report) + '\n')
  }

  // ── 5. 持久化到文件 ──
  let persistedPath: string | null = null
  if (!cliOptions.noPersist) {
    persistedPath = persistReport(report, scriptName, cliOptions.output)
    if (persistedPath && !cliOptions.quiet) {
      logDiagnostic(`💾 报告已持久化: ${persistedPath}`)
    }
  }

  // ── 6. 确定退出码 ──
  // RM-011/12 决策：静默回退(Warning)不阻断，仅阻断性违规(Major/Critical)才 exit 1
  const blockingCount = report.summary.totalViolations - (report.summary.totalWarnings ?? 0)
  const exitCode = blockingCount > 0 ? 1 : 0

  if (!cliOptions.quiet) {
    logDiagnostic(`✅ 审计完成，退出码: ${exitCode}`)
  }

  return { report, exitCode, persistedPath }
}

// ============================================================
// 辅助：颜色化输出（stderr 用，不影响 stdout JSON）
// ============================================================

const COLOR_RED = '\x1b[31m'
const COLOR_YELLOW = '\x1b[33m'
const COLOR_GREEN = '\x1b[32m'
const COLOR_RESET = '\x1b[0m'

export function colorize(text: string, color: 'red' | 'yellow' | 'green'): string {
  const code = color === 'red' ? COLOR_RED : color === 'yellow' ? COLOR_YELLOW : COLOR_GREEN
  return `${code}${text}${COLOR_RESET}`
}
