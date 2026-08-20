#!/usr/bin/env tsx
/**
 * backfill-covers-code.ts
 *
 * P0-2b：为契约/规格类文档（docs/reference + docs/explanation）批量补全
 * `covers_code` 显式字段，提升 covers_code/covers_docs 覆盖率。
 *
 * 逻辑：
 *   - 复用 cross-ref-engine 的 scanDocReferences，取每篇文档的 doc-to-code 强引用。
 *   - 去重代码路径，按引用频次降序取前 N 个（默认 8）。
 *   - 仅对已有 frontmatter 且无 covers_code 字段的目标文档注入；
 *     对无 frontmatter / 归档 / 报告 / 日志类文档跳过，避免污染分析类文档正文。
 *   - 默认 DryRun 模式；--apply 实际写入。
 *
 * 用法：
 *   npx tsx scripts/fix/backfill-covers-code.ts            # 预览
 *   npx tsx scripts/fix/backfill-covers-code.ts --apply     # 写入
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname, relative, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanDocReferences, validateReference } from '../docs-tool/cross-ref-engine'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(ROOT, 'docs')
const APPLY = process.argv.includes('--apply')

// 契约/规格聚焦目录：reference + explanation（数据契约、API 契约、规范、设计说明）
const TARGET_DIRS = ['reference', 'explanation']
// 契约性文件名关键词：命中任一即视为契约/定义/规范类
const CONTRACT_KEYWORDS = /contract|data-definition|definition|schema|spec\b|-spec|data-spec/i
// 明确排除：分析/报告/迁移/指南/路线图/审计记录等非契约类（避免向分析类注入）
const EXCLUDE_BY_NAME = /report|audit|migration|roadmap|comparison|glossary|walkthrough|checklist|blueprint|optimization|integration-guide|examples|legacy|plan-i|overview|architecture-alignment|v6pro-to-v9|2026-\d{2}-\d{2}|dataflow-spec|10-glossary/i
const MAX_CODE = 8

interface Candidate {
  abs: string
  rel: string
  codes: string[] // 去重后的强引用代码路径
}

function walk(dir: string, out: string[]) {
  if (!existsSync(dir)) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'archive' || e.name === 'node_modules') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.name.endsWith('.md')) out.push(full)
  }
}

function parseFrontmatter(content: string): { map: Map<string, string>; endIdx: number } | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return null
  const map = new Map<string, string>()
  for (const ln of m[1].split('\n')) {
    const kv = ln.match(/^([A-Za-z_][\w-]*):\s?(.*)$/)
    if (kv) map.set(kv[1], kv[2])
  }
  return { map, endIdx: m[0].length }
}

function main() {
  const mdFiles: string[] = []
  walk(DOCS_DIR, mdFiles)
  const candidates: Candidate[] = []

  for (const abs of mdFiles) {
    const rel = relative(ROOT, abs).replace(/\\/g, '/')
    const seg = rel.split('/')
    // 只看 reference/explanation 顶层（含其子目录），跳过报告/日志/存档
    const isTarget = TARGET_DIRS.some((d) => rel === `docs/${d}` || rel.startsWith(`docs/${d}/`))
    if (!isTarget) continue
    // 仅保留契约性文件名（命中 CONTRACT_KEYWORDS），且不被 EXCLUDE_BY_NAME 排除
    if (!CONTRACT_KEYWORDS.test(basename(rel))) continue
    if (EXCLUDE_BY_NAME.test(rel)) continue

    const content = readFileSync(abs, 'utf8')
    const fm = parseFrontmatter(content)
    // 无 frontmatter 或已有 covers_code 的直接跳过
    if (!fm || fm.map.has('covers_code')) continue

    const refs = scanDocReferences(abs).filter((r) => r.type === 'doc-to-code')
    const strong = refs.filter((r) => r.target.match(/\.(ts|tsx|js|jsx|json|cjs|mjs)$/) && validateReference(r, ROOT))
    if (strong.length === 0) continue

    // 按 target 去重 + 计数
    const count = new Map<string, number>()
    for (const r of strong) count.set(r.target, (count.get(r.target) ?? 0) + 1)
    const codes = [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CODE)
      .map(([p]) => p)

    candidates.push({ abs, rel, codes })
  }

  // 排序：引用代码数多者优先
  candidates.sort((a, b) => b.codes.length - a.codes.length)

  console.log(`📊 候选契约/规格文档（有强代码引用且缺 covers_code）: ${candidates.length}`)
  console.log(`   模式: ${APPLY ? 'APPLY（实际写入）' : 'DRY-RUN（预览）'}\n`)

  let wrote = 0
  for (const c of candidates) {
    if (!APPLY) {
      console.log(`  [预览] ${c.rel}`)
      console.log(`          → ${c.codes.join(', ')}`)
      continue
    }
    let content = readFileSync(c.abs, 'utf8')
    const fm = parseFrontmatter(content)
    if (!fm) continue
    const yaml = c.codes.map((p) => `  - ${p}`).join('\n')
    const insertAfter = content.slice(0, fm.endIdx)
    const rest = content.slice(fm.endIdx)
    content = insertAfter + `\ncovers_code:\n${yaml}\n` + rest
    writeFileSync(c.abs, content, 'utf8')
    wrote++
  }

  if (APPLY) {
    console.log(`\n✅ 已写入 ${wrote} 个文件的 covers_code`)
  } else {
    console.log(`\n预览结束。确认无误后执行: npx tsx scripts/fix/backfill-covers-code.ts --apply`)
  }
}

main()