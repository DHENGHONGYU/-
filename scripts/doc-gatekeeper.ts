#!/usr/bin/env tsx
/**
 * doc:gate — 文档门禁检查（聚合器）
 *
 * 聚合现有文档检查脚本，作为 pre-commit / CI 的统一文档门禁：
 * 1. doc:version-check — frontmatter code_version 完整性与一致性
 * 2. doc:cross-ref-sync --check — 交叉引用有效性（无断链）
 * 3. doc:update-trigger --check — TRIGGER_RULES docsToUpdate 路径存在性
 * 4. Diátaxis 目录结构合规性 — 关键目录存在
 *
 * 任一检查失败则非零退出（阻断门禁）。
 *
 * @see docs/00-meta/doc-auto-update-kanban.md
 * @see scripts/docs-tool/doc-version-check.ts
 * @see scripts/docs-tool/doc-cross-ref-sync.ts
 * @see scripts/docs-tool/doc-update-trigger.ts
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const TSX = join(ROOT, 'node_modules/tsx/dist/cli.mjs')
const TOOL_DIR = join(ROOT, 'scripts/docs-tool')

interface CheckResult {
  name: string
  passed: boolean
  stdout: string
  detail: string
}

/** 从子脚本完整输出中提取一行关键摘要（含 scanned / violations / broken / missing 等指标） */
function summarize(out: string): string {
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean)
  const key = lines.find((l) => /scanned|violations|broken|missing|✅|❌|OK|✔|发现/.test(l))
  return key ?? lines[lines.length - 1] ?? 'OK'
}

/** 运行一个子脚本，返回退出码、完整 stdout 与摘要（F5：不再仅取末 3 行，便于诊断） */
function runScript(label: string, args: string[]): CheckResult {
  try {
    const out = execSync(`node "${TSX}" ${args.join(' ')}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 90_000,
    })
    return { name: label, passed: true, stdout: out.trimEnd(), detail: summarize(out) }
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    const out = (e.stdout || e.stderr || '').trimEnd()
    return { name: label, passed: false, stdout: out, detail: summarize(out) }
  }
}

/** Diátaxis 目录结构合规性检查 */
function checkDirStructure(): CheckResult {
  const required = [
    'docs/00-meta',
    'docs/explanation',
    'docs/reference',
    'docs/how-to',
    'docs/tutorials',
    'docs/reports',
  ]
  const missing = required.filter((d) => !existsSync(join(ROOT, d)))
  if (missing.length > 0) {
    return { name: '目录结构', passed: false, detail: `缺失: ${missing.join(', ')}` }
  }
  return { name: '目录结构', passed: true, detail: '6 个关键目录齐全' }
}

function main(): void {
  const results: CheckResult[] = []

  // 1. frontmatter code_version 完整性
  results.push(runScript('frontmatter code_version', [`"${join(TOOL_DIR, 'doc-version-check.ts')}"`]))

  // 2. 交叉引用有效性
  results.push(runScript('交叉引用', [`"${join(TOOL_DIR, 'doc-cross-ref-sync.ts')}"`, '--check']))

  // 3. TRIGGER_RULES 路径存在性
  results.push(runScript('TRIGGER_RULES 路径', [`"${join(TOOL_DIR, 'doc-update-trigger.ts')}"`, '--check']))

  // 4. 目录结构合规性
  results.push(checkDirStructure())

  // 5. 编制规则校验（R1-R8）
  const ruleResult = runScript('编制规则', [`"${join(TOOL_DIR, 'doc-rule-validator.ts')}"`])
  // 解析违规总数（F3：暴露计数，去虚假安全感）；pass/fail 直接沿用 validator 退出码
  // （validator 已正确区分「可修复 R1-R4」与「不可修复 R1-R4」——仅后者阻断，门禁应与之对齐）
  const totalViol = parseInt((ruleResult.stdout.match(/violations:\s*(\d+)/) || [, '0'])[1] as string, 10) || 0
  ruleResult.detail = `违规总数 ${totalViol}${ruleResult.passed ? '（含 R5-R8 警告，不阻断）' : '（含不可修复 R1-R4，阻断提交）'}`
  results.push(ruleResult)

  // 汇总输出
  console.log('🔒 doc:gate — 文档门禁检查\n')
  let allPassed = true
  for (const r of results) {
    const mark = r.passed ? '✅' : '❌'
    console.log(`  ${mark} ${r.name}: ${r.detail}`)
    if (!r.passed) {
      allPassed = false
      // 失败检查打印完整 stdout 以便诊断（F5：不再仅末 3 行）
      if (r.stdout) {
        for (const line of r.stdout.split('\n')) {
          console.log(`      ${line}`)
        }
      }
    }
  }
  console.log('')
  if (allPassed) {
    const warnCount = totalViol - blockingViol
    if (warnCount > 0) {
      console.log(`⚠️  文档门禁通过，但存在 ${warnCount} 个警告级违规（R5-R8：命名/清单/编号，不阻断提交，建议后续清理）`)
    }
    console.log(`✅ 文档门禁通过（${results.length}/${results.length} 检查通过）`)
    process.exit(0)
  } else {
    const failed = results.filter((r) => !r.passed).map((r) => r.name)
    console.log(`❌ 文档门禁失败（${failed.length} 项未通过: ${failed.join(', ')}）`)
    process.exit(1)
  }
}

main()
