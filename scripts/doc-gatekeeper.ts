#!/usr/bin/env tsx
/**
 * doc:gate — 文档门禁检查（聚合器）
 *
 * 聚合现有文档检查脚本，作为 pre-commit / CI 的统一文档门禁：
 * 1. doc:version-check — frontmatter code_version 完整性与一致性
 * 2. doc:cross-ref-sync --check — 文档间相对链接有效性（无断链）
 * 3. doc:update-trigger --check — TRIGGER_RULES docsToUpdate 路径存在性
 * 4. Diátaxis 目录结构合规性 — 关键目录存在
 * 5. doc:rule-validate — 编制规则校验（R1-R8）
 * 6. doc:proofread — 三类交叉引用（文档→代码 / 代码→文档 / 文档→文档），
 *    依 doc-proofreading-strategy 仅对核心/重要文档执行；当前策略非阻断，
 *    仅上报范围内断裂，待 backlog 清理后翻开 blocking 即自动阻断。
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
function runScript(label: string, args: string[], timeoutMs = 90_000): CheckResult {
  try {
    const out = execSync(`node "${TSX}" ${args.join(' ')}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
    })
    return { name: label, passed: true, stdout: out.trimEnd(), detail: summarize(out) }
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    const out = (e.stdout || e.stderr || '').trimEnd()
    return { name: label, passed: false, stdout: out, detail: summarize(out) }
  }
}

/** 十目录架构合规性检查（E阶段重构后） */
function checkDirStructure(): CheckResult {
  const required = [
    'docs/meta',
    'docs/specs',
    'docs/guides',
    'docs/reference',
    'docs/explanation',
    'docs/reports',
    'docs/archive',
    'docs/assets',
    'docs/audit',
    'docs/lessons',
  ]
  const missing = required.filter((d) => !existsSync(join(ROOT, d)))
  if (missing.length > 0) {
    return { name: '目录结构', passed: false, detail: `缺失: ${missing.join(', ')}` }
  }
  return { name: '目录结构', passed: true, detail: '10 个核心目录齐全' }
}

function main(): void {
  const results: CheckResult[] = []

  // 1. frontmatter code_version 完整性
  results.push(runScript('frontmatter code_version', [`"${join(TOOL_DIR, 'doc-version-check.ts')}"`]))

  // 2. 交叉引用有效性（扫描量大，超时 120s，非阻断不阻塞提���）
  results.push(runScript('交叉引用', [`"${join(TOOL_DIR, 'doc-cross-ref-sync.ts')}"`, '--check'], 120_000))

  // 3. TRIGGER_RULES 路径存在性
  results.push(runScript('TRIGGER_RULES 路径', [`"${join(TOOL_DIR, 'doc-update-trigger.ts')}"`, '--check']))

  // 4. 目录结构合规性
  results.push(checkDirStructure())

  // 5. 编制规则校验（R1-R8）
  const ruleResult = runScript('编制规则', [`"${join(TOOL_DIR, 'doc-rule-validator.ts')}"`])
  // 解析违规总数（F3：暴露计数，去虚假安全感）；pass/fail 直接沿用 validator 退出码
  // （validator 已正确区分「可修复 R1-R4」与「不可修复 R1-R4」——仅后者阻断，门禁应与之对齐）
  const totalViol = parseInt((ruleResult.stdout.match(/violations:\s*(\d+)/) || [, '0'])[1] as string, 10) || 0
  // 阻断级违规（不可修复 R1-R4）：validator 仅在存在此类违规时非零退出；
  // 进入全通过分支时 ruleResult.passed 必为 true，故阻断级为 0。
  const blockingViol = ruleResult.passed ? 0 : totalViol
  ruleResult.detail = `违规总数 ${totalViol}${ruleResult.passed ? '（含 R5-R8 警告，不阻断）' : '（含不可修复 R1-R4，阻断提交）'}`
  results.push(ruleResult)

  // 6. 三类交叉引用（核心/重要文档）— 依 doc-proofreading-strategy 执行
  const proofreadResult = runScript('三类交叉引用(核心/重要)', [`"${join(TOOL_DIR, 'doc-proofread.ts')}"`])
  // doc-proofread 仅在策略 blocking=true 且存在范围内断裂时返回非零；当前策略为仅上报
  proofreadResult.detail = proofreadResult.passed
    ? '核心/重要文档范围内无阻断级断裂（断链仅上报）'
    : '存在阻断级断裂（策略 blocking=true）'
  results.push(proofreadResult)

  // 7. 文档风格合规（doc-style-standard.md §9）— 当前 warning 级，不阻断
  const styleResult = runScript('文档风格', [`"${join(TOOL_DIR, 'style-lint.ts')}"`, '--json'])
  let styleTotal = 0
  try {
    const sj = JSON.parse(styleResult.stdout)
    styleTotal = sj.total ?? 0
  } catch {
    /* 解析失败不影响 */
  }
  // style-lint 默认退出 0（warning 级），passed=true；详情标注发现数
  styleResult.detail = `风格检查发现 ${styleTotal} 项（warning 级，不阻断提交，待 backlog 清理后翻 blocking）`
  results.push(styleResult)

  // 汇总输出
  console.log('🔒 doc:gate — 文档门禁检查\n')
  // 非阻断检查列表（仅 warning，不阻断提交）
  const NON_BLOCKING = ['交叉引用', '三类交叉引用(核心/重要)', '文档风格']
  let allPassed = true
  for (const r of results) {
    const isWarning = !r.passed && NON_BLOCKING.includes(r.name)
    const mark = r.passed ? '✅' : (isWarning ? '⚠️' : '❌')
    console.log(`  ${mark} ${r.name}: ${r.detail}`)
    if (!r.passed) {
      if (isWarning) {
        console.log(`      ⚠️  ${r.name} 未阻断提交（全量扫描较慢，建议手动 npm run daily-doc:cross-ref 定期检查）`)
      } else {
        allPassed = false
      }
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
