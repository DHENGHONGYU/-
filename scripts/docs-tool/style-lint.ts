#!/usr/bin/env tsx
/**
 * style-lint.ts — 文档风格合规检查器（doc-style-standard.md §9）
 *
 * 检查项：
 *   duplicate-frontmatter  重复 frontmatter 块
 *   chinese-frontmatter-key frontmatter 含中文键
 *   chinese-meta-key       元数据块(>) 含未归一中文键（已知元数据键）
 *   unnormalized-author    署名/生成人值未落入受控枚举
 *   term-violation         正文术语违例（数据定义 / 部件）
 *   date-format            非标准日期格式（YYYY年M月D日 / YYYY/MM/DD / YYYY.MM.DD）
 *   emoji-heading          标题含装饰 emoji（状态 emoji 除外）
 *   heading-skip           标题层级跳级
 *
 * 策略（doc-style-standard.md §9）：当前全部为 warning（先 warning 后 blocking）。
 *   --strict 时任何 finding 即阻断（退出 1）。
 *
 * 用法：
 *   npx tsx scripts/docs-tool/style-lint.ts [--json] [--output <path>] [--strict]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const DOCS_ROOT = join(ROOT, 'docs')
const REPORTS_DIR = join(ROOT, 'scripts', 'docs', 'reports', 'style-lint')

interface Finding {
  file: string
  line: number
  rule: string
  message: string
  severity: 'warning' | 'blocking'
}
interface StyleReport {
  meta: { scriptName: string; standard: string; timestamp: string; strict: boolean }
  findings: Finding[]
  summary: Record<string, number>
  total: number
  blockingCount: number
}

// 治理元文档：术语/日期/署名检查跳过（其为规则定义，含示例）
const EXCLUDE_ALL = new Set([
  'docs/meta/doc-style-standard.md',
  'docs/archive/00-meta-historical/doc-style-remediation-plan.md',
  'docs/meta/markdown-reorg-framework.md',
  'docs/meta/agent-app-docs-classification.md',
  'docs/reference/hybrid-proofread-contract.md',
  'docs/meta/doc-proofreading-strategy.md',
  'docs/archive/00-meta-historical/doc-style-remediation-log.md',
  'docs/meta/registry-index.md',
])
// 术语检查额外跳过（历史归档，冻结）
const TERM_SKIP_PREFIX = ['docs/archive/', 'docs/meta/deprecated-docs/']

const ALLOWED_EMOJI = new Set(['✅', '⚠️', '❌', '🔴', '🟡', '🟢', '⭐'])
const DECOR_EMOJI = new Set([
  '📊', '📋', '📘', '📈', '📉', '🔶', '📝', '📌', '💡', '🔥', '📒',
  '🗂️', '📁', '🧭', '📂', '⚡', '🎯', '🚀', '📞', '💬', '🔔', '📑', '🧩',
])
function emojiKind(ch: string): 'allowed' | 'decor' | null {
  if (ALLOWED_EMOJI.has(ch)) return 'allowed'
  if (DECOR_EMOJI.has(ch)) return 'decor'
  return null
}

const CONTROLLED_AUTHORS = new Set([
  'claude', 'kimi', 'deepseek', 'glm', 'qwen', 'gpt', 'gemini', 'workbuddy',
  'human', 'v9-arch-team', 'v9-quality-audit', 'v9-doc-eng',
])
// 已知中文元数据键（出现即视为未归一）
const KNOWN_CN_META = new Set([
  '版本', '报告生成时间', '同步日期', '日期', '生成时间', '生成日期',
  '校对人员', '执行人', '审核人', '报告生成人', '报告作者', '日志生成工具',
  '测试执行人', '生成人', '来源', '关联', '单一事实源',
])
const TERM_VIOLATION = [/数据定义/g, /部件/g]

function walk(dir: string, out: string[]): void {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    const s = statSync(p)
    if (s.isDirectory()) {
      if (['node_modules', '.git'].includes(f)) continue
      walk(p, out)
    } else if (f.endsWith('.md')) out.push(p)
  }
}

function countFrontmatterBlocks(lines: string[]): number {
  let i = 0
  let blocks = 0
  if (!lines[0] || lines[0].trim() !== '---') return 0
  while (i < lines.length) {
    if (lines[i].trim() === '---') {
      let j = i + 1
      while (j < lines.length && lines[j].trim() !== '---') j++
      if (j >= lines.length) break
      blocks++
      i = j + 1
      while (i < lines.length && lines[i].trim() === '') i++
      if (i < lines.length && lines[i].trim() === '---') continue
      else break
    } else break
  }
  return blocks
}

export function runStyleChecks(root: string = ROOT): StyleReport {
  const DOCS = join(root, 'docs')
  const files: string[] = []
  walk(DOCS, files)
  const findings: Finding[] = []
  const summary: Record<string, number> = {}

  const push = (file: string, line: number, rule: string, message: string) => {
    findings.push({ file, line, rule, message, severity: 'warning' })
    summary[rule] = (summary[rule] || 0) + 1
  }

  for (const abs of files) {
    const rel = 'docs/' + relative(DOCS, abs).split('\\').join('/')
    const raw = readFileSync(abs, 'utf8')
    const lines = raw.split(/\r?\n/)
    const excluded = EXCLUDE_ALL.has(rel)
    const termSkipped = excluded || TERM_SKIP_PREFIX.some((p) => rel.startsWith(p))

    // 1. 重复 frontmatter 块
    const blocks = countFrontmatterBlocks(lines)
    if (blocks >= 2) push(rel, 1, 'duplicate-frontmatter', `检测到 ${blocks} 个重复 frontmatter 块`)

    // frontmatter 中文键
    if (lines[0]?.trim() === '---') {
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') break
        const key = lines[i].split(/:\s*/)[0].trim()
        if (key && /[一-鿿]/.test(key)) push(rel, i + 1, 'chinese-frontmatter-key', `frontmatter 含中文键: ${lines[i]}`)
      }
    }

    let inCode = false
    const headingLevels: { level: number; line: number }[] = []
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx]
      if (/^\s*(```|~~~)/.test(line)) inCode = !inCode
      const L = idx + 1

      // 2. 中文元数据键（已知键）
      if (!excluded && /^\s*>\s/.test(line)) {
        const m = line.match(/^\s*>\s*\*{0,2}([一-鿿][^:*]*?)\*{0,2}\s*[:：]/)
        if (m && KNOWN_CN_META.has(m[1].trim())) {
          push(rel, L, 'chinese-meta-key', `元数据块含未归一中文键: ${line.trim()}`)
        }
        // 3. 未归一署名
        const am = line.match(/^\s*>\s*\*\*?(Proofreader|Generator)\*\*?\s*[:：]\s*(.+)$/)
        if (am) {
          const val = am[2].trim()
          const parts = val.split(/[、,|；;]\s*/).map((s) => s.trim()).filter(Boolean)
          const bad = parts.filter((p) => !CONTROLLED_AUTHORS.has(p.toLowerCase()))
          if (bad.length > 0) push(rel, L, 'unnormalized-author', `署名未归一: ${val}`)
        }
      }

      // 6. 标题装饰 emoji + 7. 层级收集
      const h = line.match(/^(#{1,6})(\s+)(.*)$/)
      if (h) {
        const text = h[3]
        const chars = [...text]
        let i = 0
        let leadDecor = false
        while (i < chars.length) {
          const k = emojiKind(chars[i])
          if (k === 'allowed') break
          if (k === 'decor') { leadDecor = true; i++ } else break
        }
        if (leadDecor) push(rel, L, 'emoji-heading', `标题含装饰 emoji: ${line.trim()}`)
        headingLevels.push({ level: h[1].length, line: L })
      }

      if (!inCode && !termSkipped) {
        // 4. 术语违例
        for (const re of TERM_VIOLATION) {
          if (re.test(line)) { push(rel, L, 'term-violation', `术语违例(数据定义/部件): ${line.trim().slice(0, 60)}`); break }
        }
        // 5. 日期格式（跳过 URL 行）
        if (!/https?:\/\//.test(line)) {
          if (/(^|[^0-9])(\d{4})年(\d{1,2})月(\d{1,2})日/.test(line) ||
              /\b\d{4}\/\d{1,2}\/\d{1,2}\b/.test(line) ||
              /\b\d{4}\.\d{1,2}\.\d{1,2}\b/.test(line)) {
            push(rel, L, 'date-format', `非标准日期格式: ${line.trim().slice(0, 60)}`)
          }
        }
      }
    }

    // 7. 标题层级跳级
    for (let i = 1; i < headingLevels.length; i++) {
      const prev = headingLevels[i - 1].level
      const cur = headingLevels[i].level
      if (cur - prev > 1) push(rel, headingLevels[i].line, 'heading-skip', `标题层级跳级 #${prev} → #${cur}`)
    }
  }

  return {
    meta: { scriptName: 'style-lint', standard: 'doc-style-standard.md §9', timestamp: new Date().toISOString(), strict: process.argv.includes('--strict') },
    findings,
    summary,
    total: findings.length,
    blockingCount: 0,
  }
}

function main(): void {
  const strict = process.argv.includes('--strict')
  const json = process.argv.includes('--json')
  const report = runStyleChecks(ROOT)

  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true })
  const out = join(REPORTS_DIR, `style-lint-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(out, JSON.stringify(report, null, 2), 'utf8')

  if (!json) {
    console.log('🔍 文档风格合规检查（doc-style-standard.md §9）')
    console.log('─'.repeat(60))
    const rules = Object.keys(report.summary).sort()
    if (rules.length === 0) console.log('✅ 无风格违例')
    else for (const r of rules) console.log('  ⚠️  %s: %d', r, report.summary[r])
    console.log('─'.repeat(60))
    console.log('总计: %d 项（均为 warning 级，不阻断）', report.total)
    console.log('📄 报告: %s', out)
  } else {
    console.log(JSON.stringify(report, null, 2))
  }

  process.exit(report.total > 0 && strict ? 1 : 0)
}

// 仅当本文件被直接执行时运行 CLI（被 import 时不触发 main，避免副作用）
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) main()
