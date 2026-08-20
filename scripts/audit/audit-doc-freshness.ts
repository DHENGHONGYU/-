#!/usr/bin/env tsx
/**
 * audit-doc-freshness.ts
 * 文档新鲜度审计脚本（Doc Freshness Governance — G2 门禁）
 *
 * 检查三类新鲜度问题（对应 doc-freshness-governance SKILL §一）：
 *   A 类：双轨版本不一致（frontmatter.version vs 正文声明版本）
 *   B 类：last_updated 缺失/失真
 *   C 类：change_log 缺失/不闭环
 *
 * 扫描范围：
 *   - docs/**\/*.md
 *   - AGENTS.md
 *   - .trae/skills/*.md
 *   - .agents/skills/**\/*.md
 *   - prompts/**\/*.md
 *
 * 分级规则（P0 / P1 / P2）：
 *   P0：T0 级核心文档（AGENTS.md、SKILL.md、docs/reference/ 下的契约文档）
 *       存在 A/B/C 任意一类问题
 *   P1：docs/ 下其余有 frontmatter 的文档存在 A 类问题
 *   P2：docs/ 下其余文档存在 B/C 类问题（非阻断，可 waive）
 *
 * 退出码：
 *   0 = 无 P0/P1 违规（允许仅有 P2）
 *   1 = 存在 P0 或 P1 违规
 *   2 = 执行错误
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()

// ---------- CLI 参数 ----------
function parseArgs(): { mode: 'all' | 'staged' | 'since'; sinceRef?: string } {
  const args = process.argv.slice(2)
  if (args.includes('--staged')) return { mode: 'staged' }
  const sinceIdx = args.indexOf('--since')
  if (sinceIdx >= 0 && args[sinceIdx + 1]) {
    return { mode: 'since', sinceRef: args[sinceIdx + 1] }
  }
  return { mode: 'all' }
}

// ---------- 类型 ----------
type ViolationType = 'A' | 'B' | 'C'
type Priority = 'P0' | 'P1' | 'P2'

interface Violation {
  file: string
  type: ViolationType
  priority: Priority
  message: string
}

interface Frontmatter {
  version: string | null
  lastUpdated: string | null
  changeLogLatestVersion: string | null
  changeLogLatestDate: string | null
  hasChangeLog: boolean
}

// ---------- 扫描路径 ----------
const SCAN_TARGETS: Array<{ path: string; recursive: boolean; tier: 'core' | 'normal' }> = [
  { path: 'docs', recursive: true, tier: 'normal' },
  { path: 'AGENTS.md', recursive: false, tier: 'core' },
  { path: '.trae/skills', recursive: true, tier: 'core' },
  { path: '.agents/skills', recursive: true, tier: 'core' },
  { path: 'prompts', recursive: true, tier: 'normal' },
]

// P0 核心路径前缀（命中即升级为 P0）
const P0_PREFIXES = [
  'AGENTS.md',
  '.trae/skills/',
  '.agents/skills/',
  'docs/reference/',
  'docs/guides/standards/',
]

// ---------- frontmatter 解析 ----------
function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  return match?.[1] ?? null
}

function parseFrontmatter(fm: string): Frontmatter {
  const versionMatch = fm.match(/^version:\s*["']?([^"'\n]+)["']?$/m)
  const lastUpdatedMatch = fm.match(/^last_updated:\s*(\d{4}-\d{2}-\d{2})/m)
  const hasChangeLog = /^change_log:/.test(fm)

  // 提取 change_log 最新条目的 version 和 date
  let changeLogLatestVersion: string | null = null
  let changeLogLatestDate: string | null = null

  if (hasChangeLog) {
    // 找到 change_log 块中第一个 - version: 条目（最新的）
    const clMatch = fm.match(/change_log:\s*\r?\n\s*-\s*version:\s*["']?([^"'\n]+)["']?.*?\r?\n\s+date:\s*(\d{4}-\d{2}-\d{2})/s)
    if (clMatch) {
      changeLogLatestVersion = clMatch[1] ?? null
      changeLogLatestDate = clMatch[2] ?? null
    }
  }

  return {
    version: versionMatch?.[1]?.trim() ?? null,
    lastUpdated: lastUpdatedMatch?.[1]?.trim() ?? null,
    changeLogLatestVersion,
    changeLogLatestDate,
    hasChangeLog,
  }
}

// 提取正文中的版本声明（正文版本行 + 标题后缀）
function extractBodyVersion(content: string): string | null {
  // 去掉 frontmatter 部分
  const body = content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\r?\n?/, '')

  // 1. 正文显式声明：**版本**: vX.Y.Z 或 **Version**: vX.Y.Z
  const explicitMatch = body.match(/^\*\*(版本|Version)\*\*[:：]\s*(v?\d[\d.]*)/im)
  if (explicitMatch?.[2]) return explicitMatch[2]

  // 2. 标题行后缀：# 标题 — vX.Y.Z
  const titleMatch = body.match(/^#{1,6}\s+.+—\s*(v?\d[\d.]*)\s*$/m)
  if (titleMatch?.[1]) return titleMatch[1]

  return null
}

// ---------- 文件收集 ----------
function collectMdFiles(fullDir: string, recursive: boolean): string[] {
  if (!existsSync(fullDir)) return []

  const stat = statSafe(fullDir)
  if (!stat) return []

  if (stat.isFile()) {
    return fullDir.endsWith('.md') ? [fullDir] : []
  }

  const results: string[] = []
  if (stat.isDirectory()) {
    for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
      const childPath = join(fullDir, entry.name)
      if (entry.isDirectory() && recursive) {
        results.push(...collectMdFiles(childPath, recursive))
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(childPath)
      }
    }
  }
  return results
}

function statSafe(p: string) {
  try {
    return statSync(p)
  } catch {
    return null
  }
}

function relPath(fullPath: string): string {
  return relative(ROOT, fullPath).replace(/\\/g, '/')
}

// ---------- 优先级判定 ----------
function getPriority(file: string, vType: ViolationType, isIncremental: boolean): Priority {
  const rel = relPath(file)
  const isCore = P0_PREFIXES.some((p) => rel.startsWith(p))

  // 增量模式下：C 类（change_log 缺失）统一降为 P2
  // 因为 change_log 缺失通常是历史债务，而非本次改动引入
  if (isIncremental && vType === 'C') return 'P2'

  if (isCore) return 'P0'
  if (vType === 'A') return 'P1'
  return 'P2'
}

// ---------- 主检查逻辑 ----------
function auditFile(filePath: string, isIncremental: boolean): Violation[] {
  const content = readFileSync(filePath, 'utf-8')
  const fmText = extractFrontmatter(content)
  const violations: Violation[] = []

  // 无 frontmatter 的文件：跳过（不属于 doc-freshness 治理范围）
  if (!fmText) return violations

  const fm = parseFrontmatter(fmText)
  const bodyVersion = extractBodyVersion(content)

  // A 类：双轨版本不一致
  // 真值优先级：change_log 最新条目 > 正文声明 > 标题后缀 > frontmatter.version
  // 审计视角：检查 frontmatter.version 是否与更高优先级来源一致
  if (fm.version) {
    const higherVersion = fm.changeLogLatestVersion ?? bodyVersion
    // 规范化比较（都加上 v 前缀以便比较）
    const normFm = normalizeVersion(fm.version)
    const normHigher = higherVersion ? normalizeVersion(higherVersion) : null
    if (normHigher && normFm !== normHigher) {
      violations.push({
        file: relPath(filePath),
        type: 'A',
        priority: getPriority(filePath, 'A', isIncremental),
        message: `双轨版本不一致：frontmatter.version=${fm.version}，高优先级来源=${higherVersion}`,
      })
    }
  }

  // B 类：last_updated 缺失
  if (!fm.lastUpdated) {
    violations.push({
      file: relPath(filePath),
      type: 'B',
      priority: getPriority(filePath, 'B', isIncremental),
      message: 'last_updated 字段缺失',
    })
  }

  // C 类：change_log 缺失 / 不闭环
  if (!fm.hasChangeLog) {
    violations.push({
      file: relPath(filePath),
      type: 'C',
      priority: getPriority(filePath, 'C', isIncremental),
      message: 'change_log 字段缺失',
    })
  } else if (fm.changeLogLatestVersion && fm.version) {
    // 闭环检查：change_log 最新条目的 version 应与 frontmatter.version 一致
    const normCl = normalizeVersion(fm.changeLogLatestVersion)
    const normFm = normalizeVersion(fm.version)
    if (normCl !== normFm) {
      violations.push({
        file: relPath(filePath),
        type: 'C',
        priority: getPriority(filePath, 'C', isIncremental),
        message: `change_log 不闭环：最新条目 version=${fm.changeLogLatestVersion}，frontmatter.version=${fm.version}`,
      })
    }
  }

  return violations
}

function normalizeVersion(v: string): string {
  // 去掉 v 前缀统一比较
  return v.replace(/^v/i, '').trim()
}

// ---------- 主流程 ----------
function getGitChangedFiles(mode: 'staged' | 'since', sinceRef?: string): string[] {
  try {
    let cmd = ''
    if (mode === 'staged') {
      cmd = 'git diff --name-only --cached'
    } else if (mode === 'since' && sinceRef) {
      // 安全过滤 ref，防止注入
      const safeRef = sinceRef.replace(/[^\w\-./@{}^~]/g, '')
      cmd = `git diff --name-only ${safeRef}...HEAD`
    }
    if (!cmd) return []
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    return out.split('\n').map((s) => s.trim()).filter(Boolean)
  } catch {
    return []
  }
}

function isInScanTargets(relFile: string): boolean {
  for (const target of SCAN_TARGETS) {
    const tp = target.path
    if (relFile === tp) return true
    if (relFile.startsWith(tp + '/')) return true
  }
  return false
}

function main() {
  const opts = parseArgs()

  let allFiles: string[] = []
  let scanScope = '全量'

  if (opts.mode === 'all') {
    for (const target of SCAN_TARGETS) {
      allFiles.push(...collectMdFiles(join(ROOT, target.path), target.recursive))
    }
  } else {
    scanScope = opts.mode === 'staged' ? '暂存区' : `diff ${opts.sinceRef}...HEAD`
    const changed = getGitChangedFiles(opts.mode, opts.sinceRef)
    for (const f of changed) {
      if (f.endsWith('.md') && isInScanTargets(f) && existsSync(join(ROOT, f))) {
        allFiles.push(join(ROOT, f))
      }
    }
  }

  const allViolations: Violation[] = []
  const isIncremental = opts.mode !== 'all'
  for (const file of allFiles) {
    allViolations.push(...auditFile(file, isIncremental))
  }

  // 按优先级分组
  const p0 = allViolations.filter((v) => v.priority === 'P0')
  const p1 = allViolations.filter((v) => v.priority === 'P1')
  const p2 = allViolations.filter((v) => v.priority === 'P2')

  // 输出人类可读报告
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  文档新鲜度审计 — audit-doc-freshness.ts v1.0              ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`扫描范围: ${scanScope}`)
  console.log(`扫描文件数: ${allFiles.length}`)
  console.log(`违规总数:   ${allViolations.length}`)
  console.log(`  P0 (核心阻断): ${p0.length}`)
  console.log(`  P1 (重要):     ${p1.length}`)
  console.log(`  P2 (一般):     ${p2.length}`)
  console.log('')

  if (p0.length > 0) {
    console.log('── P0 违规（核心文档 A/B/C 类） ──')
    for (const v of p0) {
      console.log(`  [${v.type}] ${v.file}`)
      console.log(`        ${v.message}`)
    }
    console.log('')
  }

  if (p1.length > 0) {
    console.log('── P1 违规（A 类双轨不一致） ──')
    for (const v of p1) {
      console.log(`  [${v.type}] ${v.file}`)
      console.log(`        ${v.message}`)
    }
    console.log('')
  }

  if (p2.length > 0) {
    console.log(`── P2 违规（B/C 类，共 ${p2.length} 条，可 waive） ──`)
    // P2 只列前 10 条，避免输出过长
    for (const v of p2.slice(0, 10)) {
      console.log(`  [${v.type}] ${v.file}`)
      console.log(`        ${v.message}`)
    }
    if (p2.length > 10) {
      console.log(`  … 其余 ${p2.length - 10} 条省略`)
    }
    console.log('')
  }

  // 判断结果
  const hasBlocking = p0.length > 0 || p1.length > 0
  if (hasBlocking) {
    console.log(`⛔ 审计失败：存在 ${p0.length} 条 P0 + ${p1.length} 条 P1 违规，必须修复。`)
    console.log('   P2 级 B/C 类问题可人工 waive。')
    process.exit(1)
  } else {
    console.log(`✅ 审计通过：0 P0 / 0 P1 违规（P2: ${p2.length} 条，不阻断）。`)
    process.exit(0)
  }
}

main()
