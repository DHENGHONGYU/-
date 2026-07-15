#!/usr/bin/env tsx
/**
 * @module scripts/docs-tool/doc-sync-scheduler
 * @description 定时文档同步调度器 — 周期性扫描文档变更，检测新增/修改/删除，校验规则，触发同步
 *
 * 功能：
 *   1. 检测自上次运行以来的文档变更（git diff + 文件系统扫描）
 *   2. 对变更文档执行编制规则校验（doc-rule-validator）
 *   3. 对代码变更触发 TRIGGER_RULES 检测（doc-update-trigger --check）
 *   4. 校验 frontmatter / 交叉引用 / 清单同步
 *   5. 输出结构化报告（JSON + 控制台摘要）
 *
 * 用法：
 *   npx tsx scripts/docs-tool/doc-sync-scheduler.ts [选项]
 *
 * 选项：
 *   --since <ref>     git diff 起点（缺省：上次运行记录的 ref）
 *   --report <path>   报告输出路径（缺省：docs/reports/doc-sync/）
 *   --fix             自动修正可修复的违规
 *   --auto-update     触发文档自动更新（对接 doc-update-trigger --auto-update）
 *   --silent          仅输出摘要
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const DOCS = join(ROOT, 'docs')
const STATE_FILE = join(ROOT, 'docs/reports/doc-sync/.last-ref')
const REPORT_DIR = join(ROOT, 'docs/reports/doc-sync')

interface SyncReport {
  timestamp: string
  since: string
  codeChanges: string[]
  docChanges: { added: string[]; modified: string[]; deleted: string[] }
  triggerHits: { rule: string; matchedFiles: string[]; docsToUpdate: string[] }[]
  ruleViolations: number
  crossRefBroken: number
  gatePassed: boolean
  autoFixed: number
  summary: string
}

function getLastRef(): string {
  if (existsSync(STATE_FILE)) {
    return readFileSync(STATE_FILE, 'utf-8').trim()
  }
  return 'HEAD~1'
}

/** 取得当前 HEAD 的真实 commit SHA（而非字面量 'HEAD'，避免周期调度 git diff HEAD HEAD 恒空） */
function getHeadSha(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim()
  } catch {
    return 'HEAD'
  }
}

function saveLastRef(ref: string): void {
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, ref, 'utf-8')
}

function gitDiff(ref: string): string[] {
  try {
    return execSync(`git diff --name-only ${ref} HEAD`, { cwd: ROOT, encoding: 'utf-8' })
      .split('\n').filter(l => l.trim())
  } catch {
    return []
  }
}

function gitDiffStatus(ref: string): { added: string[]; modified: string[]; deleted: string[] } {
  const result = { added: [] as string[], modified: [] as string[], deleted: [] as string[] }
  try {
    const out = execSync(`git diff --name-status ${ref} HEAD`, { cwd: ROOT, encoding: 'utf-8' })
    for (const line of out.split('\n')) {
      if (!line.trim()) continue
      const [status, ...pathParts] = line.split('\t')
      const path = pathParts.join('\t')
      if (status === 'A') result.added.push(path)
      else if (status === 'D') result.deleted.push(path)
      else if (status.startsWith('R')) result.added.push(path)
      else result.modified.push(path)
    }
  } catch {
    // ignore
  }
  return result
}

function runCmd(cmd: string): { exitCode: number; stdout: string } {
  try {
    const stdout = execSync(`${cmd} 2>&1`, { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    return { exitCode: 0, stdout }
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { exitCode: err.status ?? 1, stdout: (err.stdout ?? '') + (err.stderr ?? '') }
  }
}

function main(): void {
  const args = process.argv.slice(2)
  const sinceIdx = args.indexOf('--since')
  const since = sinceIdx >= 0 ? args[sinceIdx + 1] : getLastRef()
  const fix = args.includes('--fix')
  const autoUpdate = args.includes('--auto-update')
  const silent = args.includes('--silent')

  const timestamp = new Date().toISOString()
  mkdirSync(REPORT_DIR, { recursive: true })

  console.log('[doc-sync-scheduler] since=%s, fix=%s, autoUpdate=%s', since, fix, autoUpdate)

  // 1. 检测代码变更
  const allChanges = gitDiff(since)
  const codeChanges = allChanges.filter(p => p.startsWith('src/') || p.startsWith('scripts/'))
  const docChangesRaw = gitDiffStatus(since)
  const docChanges = {
    added: docChangesRaw.added.filter(p => p.startsWith('docs/') && p.endsWith('.md')),
    modified: docChangesRaw.modified.filter(p => p.startsWith('docs/') && p.endsWith('.md')),
    deleted: docChangesRaw.deleted.filter(p => p.startsWith('docs/') && p.endsWith('.md')),
  }

  console.log('[doc-sync-scheduler] code changes: %d, doc changes: +%d ~%d -%d',
    codeChanges.length, docChanges.added.length, docChanges.modified.length, docChanges.deleted.length)

  // 2. TRIGGER_RULES 检测
  const TSX = join(ROOT, 'node_modules/tsx/dist/cli.mjs')
  const triggerScript = join(ROOT, 'scripts/docs-tool/doc-update-trigger.ts')
  const triggerResult = runCmd(`node "${TSX}" "${triggerScript}" --check --since ${since}`)
  const triggerHits: SyncReport['triggerHits'] = []
  // 解析 trigger 输出（简化：如果有命中会显示 T1-T10）
  const triggerOutput = triggerResult.stdout
  for (const m of triggerOutput.matchAll(/\[T(\d)\]\s*(.+?)\n\s*需要更新的文档:\n([\s\S]*?)(?=\n\[T|\n需要更新|$)/g)) {
    triggerHits.push({
      rule: 'T' + m[1],
      matchedFiles: m[2].trim().split('\n').map(s => s.replace(/^\s*-\s*/, '')),
      docsToUpdate: m[3].trim().split('\n').filter(s => s.trim()).map(s => s.replace(/^\s*→\s*/, '')),
    })
  }

  // 3. 编制规则校验
  const ruleScript = join(ROOT, 'scripts/docs-tool/doc-rule-validator.ts')
  const ruleResult = runCmd(`node "${TSX}" "${ruleScript}"${fix ? ' --fix' : ''}${silent ? ' --silent' : ''}`)
  const ruleViolations = parseInt((ruleResult.stdout.match(/violations:\s*(\d+)/) || [, '0'])[1] as string, 10) || 0
  const autoFixed = parseInt((ruleResult.stdout.match(/auto-fixed\s*(\d+)/) || [, '0'])[1] as string, 10) || 0

  // 4. 交叉引用校验
  const crossRefScript = join(ROOT, 'scripts/docs-tool/doc-cross-ref-sync.ts')
  const crossRefResult = runCmd(`node "${TSX}" "${crossRefScript}" --check`)
  const crossRefBroken = crossRefResult.exitCode !== 0 ? 1 : 0

  // 5. doc:gate
  const gateScript = join(ROOT, 'scripts/doc-gatekeeper.ts')
  const gateResult = runCmd(`node "${TSX}" "${gateScript}"`)
  const gatePassed = gateResult.exitCode === 0

  // 6. 自动更新（如果启用且有 trigger 命中）
  if (autoUpdate && triggerHits.length > 0) {
    console.log('[doc-sync-scheduler] auto-update triggered for %d rules', triggerHits.length)
    runCmd(`node "${TSX}" "${triggerScript}" --auto-update --since ${since}`)
  }

  // 7. 生成报告
  const report: SyncReport = {
    timestamp,
    since,
    codeChanges,
    docChanges,
    triggerHits,
    ruleViolations,
    crossRefBroken,
    gatePassed,
    autoFixed,
    summary: `code:${codeChanges.length} doc:+${docChanges.added.length}/~${docChanges.modified.length}/-${docChanges.deleted.length} trigger:${triggerHits.length} violations:${ruleViolations} gate:${gatePassed ? 'PASS' : 'FAIL'}`,
  }

  const reportPath = join(REPORT_DIR, `sync-${timestamp.replace(/[:.]/g, '-')}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')

  // 更新 last-ref 为本次基准的真实 SHA（供下次 diff 起点，避免字面量 HEAD 导致 0 变更）
  saveLastRef(since === 'HEAD' || since === 'HEAD~1' || since === 'HEAD~0' ? getHeadSha() : since)

  console.log('[doc-sync-scheduler] summary: %s', report.summary)
  console.log('[doc-sync-scheduler] report: %s', reportPath)

  // 门禁：gate 失败或有不可修复违规 → 非零退出
  process.exit(gatePassed && crossRefBroken === 0 ? 0 : 1)
}

main()
