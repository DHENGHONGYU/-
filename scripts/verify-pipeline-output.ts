#!/usr/bin/env tsx
/**
 * verify-pipeline-output.ts
 * 白盒/透明管道输出完整性验证脚本
 *
 * 验证目标：
 * 1. 管道契约本身（_audit-pipeline.ts 的 runAuditPipeline()）
 *    - 场景 A：无违规 → exitCode=0
 *    - 场景 B：有违规 → exitCode=1
 *    - 场景 C：执行错误 → exitCode=2
 *    - 每种场景验证：stdout JSON / stderr 诊断 / 文件持久化 / 退出码
 *
 * 2. 端到端实际审计脚本运行
 *    - 运行 audit-token-consumption.ts --json --no-persist
 *    - 运行 verify-all-routes.ts --json --no-persist
 *    - 捕获 stdout / stderr / 退出码
 *    - 验证 JSON 结构完整性
 *
 * 输出契约回顾：
 * - stdout = 数据流（JSON）：机器可读的审计结果
 * - stderr = 诊断流（人类可读日志）：进度、警告、汇总
 * - 文件 = 持久化归档：docs/reports/audit/{name}-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规, 2=执行错误
 *
 * 执行：npx tsx scripts/verify-pipeline-output.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { persistReport, type AuditReport } from './_debug/_audit-pipeline'

// ============================================================
// 辅助：验证结果收集
// ============================================================

interface CheckResult {
  name: string
  passed: boolean
  detail?: string
}

const results: CheckResult[] = []

function check(name: string, condition: boolean, detail?: string): void {
  results.push({ name, passed: condition, detail })
}

function summarize(): void {
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  console.log('\n' + '═'.repeat(70))
  console.log('验证结果汇总')
  console.log('═'.repeat(70))
  console.log(`总计: ${total} | 通过: ${passed} | 失败: ${failed}`)
  console.log('═'.repeat(70))

  if (failed > 0) {
    console.log('\n失败项详情:')
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  ❌ ${r.name}`)
      if (r.detail) console.log(`     ${r.detail}`)
    }
  } else {
    console.log('\n✅ 所有验证项通过')
  }

  process.exit(failed > 0 ? 1 : 0)
}

// ============================================================
// 辅助：运行子进程并捕获输出
// ============================================================

interface ChildProcessResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

function runChild(scriptPath: string, args: string[] = [], env: Record<string, string> = {}): ChildProcessResult {
  const result = spawnSync(
    'npx',
    ['tsx', scriptPath, ...args],
    {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 60000,
      shell: true,
      env: { ...process.env, ...env },
    },
  )

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  }
}

/** 从 stdout 中提取 JSON（可能包含 tsx 编译日志等非 JSON 内容） */
function extractJson(stdout: string): AuditReport | null {
  const jsonStart = stdout.indexOf('{')
  const jsonEnd = stdout.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd <= jsonStart) return null
  try {
    return JSON.parse(stdout.substring(jsonStart, jsonEnd + 1))
  } catch {
    return null
  }
}

// ============================================================
// 第一部分：管道契约验证（子进程方式）
// ============================================================

function testPipelineContract(): void {
  console.log('\n' + '╔' + '═'.repeat(68) + '╗')
  console.log('║  第一部分：管道契约验证（runAuditPipeline 输出完整性）         ║')
  console.log('╚' + '═'.repeat(68) + '╝')

  const childScript = path.join(__dirname, '_verify-pipeline-child.ts')

  // ── 场景 A：无违规（exitCode=0）──
  console.log('\n── 场景 A：无违规（期望 exitCode=0）──')
  const resultA = runChild(childScript, [], { MOCK_SCENARIO: 'clean' })

  console.log(`  退出码: ${resultA.exitCode}`)
  console.log(`  stdout 长度: ${resultA.stdout.length} 字符`)
  console.log(`  stderr 长度: ${resultA.stderr.length} 字符`)

  // 验证 stdout 是有效 JSON
  const stdoutJsonA = extractJson(resultA.stdout)
  check('A.1 stdout 是有效 JSON', stdoutJsonA !== null, stdoutJsonA ? '' : '未找到 JSON 边界')

  if (stdoutJsonA) {
    check('A.2 stdout JSON 包含 violations', Array.isArray(stdoutJsonA.violations))
    check('A.3 stdout JSON violations 为空', stdoutJsonA.violations.length === 0)
    check('A.4 stdout JSON 包含 summary', !!stdoutJsonA.summary)
    check('A.5 stdout JSON summary.totalFiles = 10', stdoutJsonA.summary.totalFiles === 10)
    check('A.6 stdout JSON summary.totalViolations = 0', stdoutJsonA.summary.totalViolations === 0)
    check('A.7 stdout JSON 包含 meta', !!stdoutJsonA.meta)
    check('A.8 stdout JSON meta.scriptName = mock-clean-audit', stdoutJsonA.meta?.scriptName === 'mock-clean-audit')
    check('A.9 stdout JSON meta.timestamp 存在', !!stdoutJsonA.meta?.timestamp)
    check('A.10 stdout JSON meta.durationMs >= 0', (stdoutJsonA.meta?.durationMs ?? -1) >= 0)
    check('A.11 stdout JSON meta.rootDir 是字符串', typeof stdoutJsonA.meta?.rootDir === 'string')
  }

  // 验证 stderr 包含诊断日志
  check('A.12 stderr 包含开始审计日志', resultA.stderr.includes('开始审计'))
  check('A.13 stderr 包含扫描完成日志', resultA.stderr.includes('扫描完成'))
  check('A.14 stderr 包含审计完成日志', resultA.stderr.includes('审计完成'))
  check('A.15 stderr 包含退出码: 0', resultA.stderr.includes('退出码: 0'))
  check('A.16 stderr 包含人类可读报告', resultA.stderr.includes('Mock 审计报告'))
  check('A.17 stderr 包含 ✅ 无违规', resultA.stderr.includes('✅ 无违规'))
  check('A.18 stderr 包含报告已持久化', resultA.stderr.includes('报告已持久化'))

  // 验证退出码
  check('A.19 exitCode = 0（无违规）', resultA.exitCode === 0, `实际: ${resultA.exitCode}`)

  // ── 场景 B：有违规（exitCode=1）──
  console.log('\n── 场景 B：有违规（期望 exitCode=1）──')
  const resultB = runChild(childScript, [], { MOCK_SCENARIO: 'violations' })

  console.log(`  退出码: ${resultB.exitCode}`)
  console.log(`  stdout 长度: ${resultB.stdout.length} 字符`)
  console.log(`  stderr 长度: ${resultB.stderr.length} 字符`)

  const stdoutJsonB = extractJson(resultB.stdout)
  check('B.1 stdout 是有效 JSON', stdoutJsonB !== null)

  if (stdoutJsonB) {
    check('B.2 stdout JSON violations 长度 = 2', stdoutJsonB.violations.length === 2)
    check('B.3 stdout JSON summary.totalViolations = 2', stdoutJsonB.summary.totalViolations === 2)
    check('B.4 stdout JSON summary.totalWarnings = 1', stdoutJsonB.summary.totalWarnings === 1)
    check('B.5 stdout JSON summary.totalFiles = 50', stdoutJsonB.summary.totalFiles === 50)
    check('B.6 stdout JSON 包含 meta', !!stdoutJsonB.meta)
    check('B.7 stdout JSON meta.scriptName = mock-violations-audit', stdoutJsonB.meta?.scriptName === 'mock-violations-audit')
  }

  check('B.8 stderr 包含发现 2 处违规', resultB.stderr.includes('2 处违规'))
  check('B.9 stderr 包含发现 1 处警告', resultB.stderr.includes('1 处警告'))
  check('B.10 stderr 包含违规列表', resultB.stderr.includes('违规列表'))
  check('B.11 stderr 包含硬编码颜色', resultB.stderr.includes('硬编码颜色'))
  check('B.12 stderr 包含魔法数字', resultB.stderr.includes('魔法数字'))
  check('B.13 stderr 包含退出码: 1', resultB.stderr.includes('退出码: 1'))
  check('B.14 stderr 包含 ❌ 存在违规', resultB.stderr.includes('❌ 存在违规'))

  check('B.15 exitCode = 1（有违规）', resultB.exitCode === 1, `实际: ${resultB.exitCode}`)

  // ── 场景 C：执行错误（exitCode=2）──
  console.log('\n── 场景 C：执行错误（期望 exitCode=2）──')
  const resultC = runChild(childScript, [], { MOCK_SCENARIO: 'error' })

  console.log(`  退出码: ${resultC.exitCode}`)
  console.log(`  stderr 长度: ${resultC.stderr.length} 字符`)

  check('C.1 stderr 包含审计执行失败', resultC.stderr.includes('审计执行失败'))
  check('C.2 stderr 包含模拟扫描失败', resultC.stderr.includes('模拟扫描失败'))
  check('C.3 exitCode = 2（执行错误）', resultC.exitCode === 2, `实际: ${resultC.exitCode}`)

  // 验证错误场景下 stdout 仍有 JSON（错误报告）
  const stdoutJsonC = extractJson(resultC.stdout)
  check('C.4 错误场景 stdout 包含 JSON', stdoutJsonC !== null)
  if (stdoutJsonC) {
    check('C.5 错误报告 violations 为空', stdoutJsonC.violations.length === 0)
    check('C.6 错误报告 summary.totalFiles = 0', stdoutJsonC.summary.totalFiles === 0)
    check('C.7 错误报告包含 meta', !!stdoutJsonC.meta)
  }

  // ── 场景 D：--no-persist 选项 ──
  console.log('\n── 场景 D：--no-persist 选项（期望不持久化文件）──')
  const resultD = runChild(childScript, ['--no-persist'], { MOCK_SCENARIO: 'clean' })

  check('D.1 --no-persist 时 stderr 不含持久化日志', !resultD.stderr.includes('报告已持久化'))
  check('D.2 --no-persist 时 exitCode 仍为 0', resultD.exitCode === 0)

  // ── 场景 E：--quiet 选项 ──
  console.log('\n── 场景 E：--quiet 选项（期望 stderr 为空或仅含 tsx 日志）──')
  const resultE = runChild(childScript, ['--quiet', '--no-persist'], { MOCK_SCENARIO: 'clean' })

  // --quiet 时 stderr 不应包含诊断日志（可能仍有 tsx 编译日志）
  check('E.1 --quiet 时 stderr 不含开始审计', !resultE.stderr.includes('开始审计'))
  check('E.2 --quiet 时 stderr 不含审计完成', !resultE.stderr.includes('审计完成'))
  check('E.3 --quiet 时 stdout 仍有 JSON', extractJson(resultE.stdout) !== null)
}

// ============================================================
// 第二部分：端到端实际审计脚本验证
// ============================================================

function testEndToEndAudit(): void {
  console.log('\n' + '╔' + '═'.repeat(68) + '╗')
  console.log('║  第二部分：端到端实际审计脚本运行                              ║')
  console.log('╚' + '═'.repeat(68) + '╝')

  // ── 端到端测试 1：audit-token-consumption.ts ──
  console.log('\n── 端到端测试 1：audit-token-consumption.ts ──')

  const tokenScript = path.join(__dirname, 'audit-token-consumption.ts')
  console.log(`\n运行: npx tsx audit-token-consumption.ts --json --no-persist`)

  const tokenResult = runChild(tokenScript, ['--json', '--no-persist'])

  console.log(`  退出码: ${tokenResult.exitCode}`)
  console.log(`  stdout 长度: ${tokenResult.stdout.length} 字符`)
  console.log(`  stderr 长度: ${tokenResult.stderr.length} 字符`)

  const tokenReport = extractJson(tokenResult.stdout)
  check('E2E.1 stdout 包含有效 JSON', tokenReport !== null, tokenReport ? '' : '未找到 JSON 边界')

  if (tokenReport) {
    check('E2E.2 JSON 包含 violations 数组', Array.isArray(tokenReport.violations))
    check('E2E.3 JSON 包含 summary 对象', !!tokenReport.summary && typeof tokenReport.summary === 'object')
    check('E2E.4 JSON summary.totalFiles 是数字', typeof tokenReport.summary.totalFiles === 'number')
    check('E2E.5 JSON summary.totalViolations 是数字', typeof tokenReport.summary.totalViolations === 'number')
    check('E2E.6 JSON 包含 meta', !!tokenReport.meta)
    check('E2E.7 JSON meta.scriptName = audit-token-consumption', tokenReport.meta?.scriptName === 'audit-token-consumption')
    check('E2E.8 JSON meta.timestamp 是有效 ISO', !isNaN(Date.parse(tokenReport.meta?.timestamp ?? '')))
    check('E2E.9 JSON meta.durationMs >= 0', (tokenReport.meta?.durationMs ?? -1) >= 0)
    check('E2E.10 JSON meta.rootDir 是字符串', typeof tokenReport.meta?.rootDir === 'string')

    // 验证审计脚本的特定字段
    check('E2E.11 summary.totalChecks 存在', 'totalChecks' in tokenReport.summary)
    check('E2E.12 summary.estimatedTokenSavings 存在', 'estimatedTokenSavings' in tokenReport.summary)

    console.log(`\n  审计结果:`)
    console.log(`    违规数: ${tokenReport.summary.totalViolations}`)
    console.log(`    检查项数: ${(tokenReport.summary as Record<string, unknown>).totalChecks as number}`)
    const savings = (tokenReport.summary as Record<string, unknown>).estimatedTokenSavings as number
    console.log(`    预计 Token 节省: ${(savings / 1000000).toFixed(2)}M`)
  }

  check('E2E.13 stderr 包含开始审计或审计', tokenResult.stderr.includes('开始审计') || tokenResult.stderr.includes('审计'))
  check('E2E.14 stderr 包含审计完成或退出码', tokenResult.stderr.includes('审计完成') || tokenResult.stderr.includes('退出码'))

  check('E2E.15 退出码是 0 或 1（非 2）', tokenResult.exitCode === 0 || tokenResult.exitCode === 1, `实际: ${tokenResult.exitCode}`)

  if (tokenReport && tokenReport.summary.totalViolations > 0) {
    check('E2E.16 有违规时 exitCode = 1', tokenResult.exitCode === 1, `实际: ${tokenResult.exitCode}`)
  } else if (tokenReport && tokenReport.summary.totalViolations === 0) {
    check('E2E.16 无违规时 exitCode = 0', tokenResult.exitCode === 0, `实际: ${tokenResult.exitCode}`)
  }

  check('E2E.17 --no-persist 时 stderr 不含持久化日志', !tokenResult.stderr.includes('报告已持久化'))

  // ── 端到端测试 2：verify-all-routes.ts ──
  console.log('\n── 端到端测试 2：verify-all-routes.ts ──')

  const routesScript = path.join(__dirname, 'verify-all-routes.ts')
  console.log(`\n运行: npx tsx verify-all-routes.ts --json --no-persist`)

  const routesResult = runChild(routesScript, ['--json', '--no-persist'])

  console.log(`  退出码: ${routesResult.exitCode}`)
  console.log(`  stdout 长度: ${routesResult.stdout.length} 字符`)
  console.log(`  stderr 长度: ${routesResult.stderr.length} 字符`)

  const routesReport = extractJson(routesResult.stdout)
  check('E2E.18 stdout 包含有效 JSON', routesReport !== null)

  if (routesReport) {
    check('E2E.19 JSON 包含 violations 数组', Array.isArray(routesReport.violations))
    check('E2E.20 JSON 包含 warnings 数组', Array.isArray(routesReport.warnings))
    check('E2E.21 JSON 包含 summary', !!routesReport.summary)
    check('E2E.22 JSON meta.scriptName = verify-all-routes', routesReport.meta?.scriptName === 'verify-all-routes')
    check('E2E.23 JSON summary.totalRoutes 存在', 'totalRoutes' in routesReport.summary)
    check('E2E.24 JSON summary.coverageRate 存在', 'coverageRate' in routesReport.summary)
    check('E2E.25 JSON summary.totalExpected 存在', 'totalExpected' in routesReport.summary)
    check('E2E.26 JSON summary.totalCovered 存在', 'totalCovered' in routesReport.summary)

    console.log(`\n  路由审计结果:`)
    const summary = routesReport.summary as Record<string, unknown>
    console.log(`    总路由数: ${summary.totalRoutes as number}`)
    console.log(`    违规数: ${routesReport.summary.totalViolations}`)
    console.log(`    警告数: ${routesReport.summary.totalWarnings ?? 0}`)
    console.log(`    覆盖率: ${summary.coverageRate as string}`)
  }

  check('E2E.27 verify-all-routes 退出码是 0 或 1', routesResult.exitCode === 0 || routesResult.exitCode === 1, `实际: ${routesResult.exitCode}`)
}

// ============================================================
// 第三部分：持久化函数单独验证
// ============================================================

function testPersistReport(): void {
  console.log('\n' + '╔' + '═'.repeat(68) + '╗')
  console.log('║  第三部分：persistReport 持久化函数验证                       ║')
  console.log('╚' + '═'.repeat(68) + '╝')

  const mockReport: AuditReport = {
    violations: [{ file: 'test.ts', type: 'test', message: '测试违规' }],
    summary: { totalFiles: 1, totalViolations: 1 },
  }

  // 测试 1：默认持久化路径
  console.log('\n── 测试 1：默认持久化路径 ──')
  const persistedPath = persistReport(mockReport, 'verify-pipeline-test')
  check('P.1 persistReport 返回非空路径', !!persistedPath)
  if (persistedPath) {
    check('P.2 持久化文件存在', fs.existsSync(persistedPath))
    check('P.3 持久化文件在 docs/reports/audit/ 目录', persistedPath.includes('docs') && persistedPath.includes('audit'))
    try {
      const content = JSON.parse(fs.readFileSync(persistedPath, 'utf-8'))
      check('P.4 持久化文件是有效 JSON', !!content)
      check('P.5 持久化文件包含 violations', Array.isArray(content.violations))
      check('P.6 持久化文件 violations 长度 = 1', content.violations.length === 1)
      check('P.7 持久化文件包含 summary', !!content.summary)
      try { fs.unlinkSync(persistedPath) } catch { /* 忽略 */ }
    } catch {
      check('P.4 持久化文件是有效 JSON', false)
    }
  }

  // 测试 2：自定义持久化路径
  console.log('\n── 测试 2：自定义持久化路径 ──')
  const customPath = path.join(ROOT, 'docs', 'reports', 'audit', 'custom-persist-test.json')
  const customPersisted = persistReport(mockReport, 'verify-pipeline-test', customPath)
  check('P.8 自定义路径返回等于输入路径', customPersisted === customPath)
  if (customPersisted) {
    check('P.9 自定义持久化文件存在', fs.existsSync(customPersisted))
    try { fs.unlinkSync(customPersisted) } catch { /* 忽略 */ }
  }

  // 测试 3：目录不存在时自动创建
  console.log('\n── 测试 3：目录不存在时自动创建 ──')
  const nestedPath = path.join(ROOT, 'docs', 'reports', 'audit', 'nested', 'deep', 'test.json')
  const nestedPersisted = persistReport(mockReport, 'verify-pipeline-test', nestedPath)
  check('P.10 嵌套目录自动创建并持久化', !!nestedPersisted && fs.existsSync(nestedPersisted))
  if (nestedPersisted) {
    try { fs.unlinkSync(nestedPersisted) } catch { /* 忽略 */ }
    // 清理空目录
    try { fs.rmdirSync(path.dirname(nestedPersisted)) } catch { /* 忽略 */ }
    try { fs.rmdirSync(path.dirname(path.dirname(nestedPersisted))) } catch { /* 忽略 */ }
  }
}

// ============================================================
// 主函数
// ============================================================

function main(): void {
  console.log('╔' + '═'.repeat(68) + '╗')
  console.log('║  白盒/透明管道输出完整性验证                                  ║')
  console.log('║  verify-pipeline-output.ts v1.0                              ║')
  console.log('╚' + '═'.repeat(68) + '╝')
  console.log(`\n时间: ${new Date().toISOString()}`)
  console.log(`Node: ${process.version}`)
  console.log(`根目录: ${ROOT}`)

  // 第一部分：管道契约验证
  testPipelineContract()

  // 第二部分：端到端实际审计脚本验证
  testEndToEndAudit()

  // 第三部分：持久化函数验证
  testPersistReport()

  // 汇总结果
  summarize()
}

main()
