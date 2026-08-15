#!/usr/bin/env tsx
/**
 * inject-doc-id.ts
 * 批量为无 doc_id 的 .md 文件注入 doc_id frontmatter
 *
 * 策略：
 *   1. 扫描磁盘无 doc_id 的 .md 文件
 *   2. 根据所在目录推断 domain
 *   3. 每个 domain 取现有最大编号 +1 生成新 doc_id
 *   4. 注入到 frontmatter（有则加字段，无则创建）
 *
 * 用法：
 *   npx tsx scripts/fix/inject-doc-id.ts --dry-run  # 预览
 *   npx tsx scripts/fix/inject-doc-id.ts            # 执行
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(ROOT, 'docs')

const EXCLUDE_DIRS = new Set(['ai-index', '.ai-index', 'archive', '_drafts', 'node_modules'])
const EXCLUDE_FILES = new Set(['doc-id-registry.md', 'README.md', 'AGENTS.md', 'ai-index.md'])

/** 归档候选关键词（命中即跳过注入，由 classify-orphan-docs.ts 输出清单） */
const ARCHIVE_KEYWORDS = [
  'report',
  'audit',
  'test',
  'summary',
  'review',
  'snapshot',
  'comparison',
  'compare',
  'feasibility',
  'assessment',
  '临时',
  '总结',
  '复盘',
  '审计',
  '对比',
  '快照',
  '诊断',
  'diagnose',
  'debug',
  '排查',
  'investigat',
  'health',
  'repair',
  'fix-log',
  'changelog',
  'change-log',
  'migration-log',
  'remediation',
  'tech-debt',
  'debt',
  'cleanup',
  '清理',
  '整改',
  '治理',
  'governance',
  'quality-audit',
  'checklist',
  'pending-items',
  'backlog',
  'todo',
  'TODO',
  'status',
  'progress',
  'weekly',
  'daily',
  'monthly',
  'meeting',
  '会议',
  '周报',
  '日报',
  '月报',
]

const ARCHIVE_DIR_PREFIXES = ['audit/', 'reports/', 'audit/reports/', 'reports/governance/']
const DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}-/

/**
 * meta/ 目录下的临时治理产物清单（自动生成、定期归档/移出，不纳入 doc_id 注册表）。
 * 须与 audit-doc-id-reverse.ts 中的 META_TEMPORARY_FILES 保持一致。
 */
const META_TEMPORARY_FILES = new Set([
  'meta/doc-code-direct-xref.md',
  'meta/orphan-archive-candidates.md',
  'meta/文件整理清单.md',
  'meta/doc-governance-calibration-2026-08-15.md',
])

/** 判断是否为归档候选（不注入 ID） */
function isArchiveCandidate(relPath: string, fileName: string): boolean {
  const lowerPath = relPath.toLowerCase()
  const lowerName = fileName.toLowerCase()
  if (META_TEMPORARY_FILES.has(relPath) || META_TEMPORARY_FILES.has(lowerPath)) return true
  for (const prefix of ARCHIVE_DIR_PREFIXES) {
    if (lowerPath.startsWith(prefix)) return true
  }
  if (DATE_PREFIX_PATTERN.test(fileName)) return true
  for (const kw of ARCHIVE_KEYWORDS) {
    if (lowerName.includes(kw) || lowerPath.includes(kw)) return true
  }
  return false
}

/** 目录路径 → domain 映射 */
function inferDomain(relPath: string): string {
  const lower = relPath.toLowerCase()
  if (lower.startsWith('meta/')) return 'META'
  if (lower.startsWith('specs/architecture/') || lower.startsWith('specs/')) return 'ARCH'
  if (lower.startsWith('audit/')) return 'AUDIT'
  if (lower.startsWith('reports/governance/')) return 'GOV'
  if (lower.startsWith('reports/')) return 'REP'
  if (lower.startsWith('guides/development/') || lower.startsWith('guides/how-to/')) return 'DEV'
  if (lower.startsWith('guides/')) return 'GUIDE'
  if (lower.startsWith('explanation/architecture/')) return 'ARCH'
  if (lower.startsWith('explanation/design/')) {
    if (lower.includes('back') || lower.includes('operation')) return 'BACK'
    if (lower.includes('front') || lower.includes('ui') || lower.includes('routing')) return 'FRONT'
    return 'PROJ'
  }
  if (lower.startsWith('explanation/2026-')) return 'PROJ'
  if (lower.startsWith('reference/prompts/')) return 'AI'
  if (lower.startsWith('reference/')) return 'REF'
  if (lower.startsWith('explanation/')) return 'EXP'
  if (lower.startsWith('assets/articles/')) return 'PROJ'
  return 'PROJ'
}

/** 从已有 doc_id 提取每个 domain 的最大编号 */
function getDomainMaxNumbers(): Map<string, number> {
  const maxMap = new Map<string, number>()
  // 扫描所有有 doc_id 的文件（含注册表）
  function walk(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (EXCLUDE_DIRS.has(e.name)) continue
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        walk(full)
      } else if (e.isFile() && e.name.endsWith('.md') && !EXCLUDE_FILES.has(e.name)) {
        const content = readFileSync(full, 'utf8')
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
        if (fmMatch) {
          const idMatch = fmMatch[1].match(/^doc_id:\s*V9-DOC-([A-Z]+)-(\d{1,3})\s*$/m)
          if (idMatch) {
            const domain = idMatch[1]
            const num = parseInt(idMatch[2], 10)
            // 只接受 1-3 位编号（排除日期型如 20260813）
            if (num >= 1 && num <= 999) {
              const cur = maxMap.get(domain) || 0
              if (num > cur) maxMap.set(domain, num)
            }
          }
        }
      }
    }
  }
  walk(DOCS_DIR)
  return maxMap
}

interface InjectTarget {
  absPath: string
  relPath: string
  domain: string
  newDocId: string
  hasFrontmatter: boolean
  title: string
}

function scanAndPlan(): { targets: InjectTarget[]; maxMap: Map<string, number>; skipped: number } {
  const maxMap = getDomainMaxNumbers()
  const targets: InjectTarget[] = []
  const counters = new Map<string, number>()
  let skipped = 0

  function walk(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (EXCLUDE_DIRS.has(e.name)) continue
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        walk(full)
      } else if (e.isFile() && e.name.endsWith('.md') && !EXCLUDE_FILES.has(e.name)) {
        const content = readFileSync(full, 'utf8')
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
        let hasDocId = false
        if (fmMatch) {
          if (fmMatch[1].match(/^doc_id:\s*\S+/m)) hasDocId = true
        }
        if (!hasDocId) {
          const relPath = relative(DOCS_DIR, full).replace(/\\/g, '/')
          // 跳过归档候选（审计报告/测试/总结/临时记录等，不注入 ID）
          if (isArchiveCandidate(relPath, e.name)) {
            skipped++
            continue
          }
          const domain = inferDomain(relPath)
          const baseMax = maxMap.get(domain) || 0
          const counter = (counters.get(domain) || 0) + 1
          counters.set(domain, counter)
          const newNum = baseMax + counter
          const newDocId = `V9-DOC-${domain}-${String(newNum).padStart(3, '0')}`

          // 提取 title
          let title = ''
          if (fmMatch) {
            const titleMatch = fmMatch[1].match(/^title:\s*["']?([^"'\n]+)["']?/m)
            if (titleMatch) title = titleMatch[1].trim()
          }
          if (!title) {
            const h1Match = content.match(/^#\s+(.+)$/m)
            if (h1Match) title = h1Match[1].trim()
          }
          if (!title) title = e.name.replace(/\.md$/, '')

          targets.push({
            absPath: full,
            relPath,
            domain,
            newDocId,
            hasFrontmatter: !!fmMatch,
            title,
          })
        }
      }
    }
  }
  walk(DOCS_DIR)
  return { targets, maxMap, skipped }
}

function inject(target: InjectTarget): string {
  const content = readFileSync(target.absPath, 'utf8')

  if (target.hasFrontmatter) {
    // 在现有 frontmatter 中插入 doc_id（紧跟 --- 之后第一行）
    const fmMatch = content.match(/^(---\n)([\s\S]*?)(\n---)/)
    if (fmMatch) {
      const beforeFm = content.slice(0, fmMatch.index! + fmMatch[1].length)
      const fmBody = fmMatch[2]
      const afterFm = content.slice(fmMatch.index! + fmMatch[1].length + fmMatch[2].length)
      // doc_id 插在 frontmatter 第一行
      const newFm = `doc_id: ${target.newDocId}\n` + fmBody
      return beforeFm + newFm + afterFm
    }
  }

  // 无 frontmatter → 创建
  const today = new Date().toISOString().slice(0, 10)
  const fm = `---\ndoc_id: ${target.newDocId}\ntitle: "${target.title.replace(/"/g, '\\"')}"\ndomain: ${target.domain.toLowerCase()}\nstatus: active\nlast_updated: ${today}\n---\n\n`
  return fm + content
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const { targets, skipped } = scanAndPlan()

  console.log('========== doc_id 批量注入 ==========')
  console.log(`待注入文件数: ${targets.length}`)
  console.log(`跳过归档候选（不注入 ID）: ${skipped}（详见 docs/meta/orphan-archive-candidates.md）`)

  // 按domain统计
  const byDomain = new Map<string, number>()
  for (const t of targets) {
    byDomain.set(t.domain, (byDomain.get(t.domain) || 0) + 1)
  }
  console.log('\n--- 按domain分布 ---')
  for (const [d, n] of [...byDomain.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${d.padEnd(10)} ${n}`)
  }

  if (dryRun) {
    console.log('\n--- 预览（前 30）---')
    for (const t of targets.slice(0, 30)) {
      console.log(`  + ${t.newDocId}  ${t.relPath}`)
    }
    if (targets.length > 30) console.log(`  ... 还有 ${targets.length - 30} 条`)
    console.log('\n[dry-run] 未写入文件')
    return
  }

  let written = 0
  for (const t of targets) {
    const newContent = inject(t)
    writeFileSync(t.absPath, newContent, 'utf8')
    written++
  }
  console.log(`\n✅ 已注入 ${written} 个文件`)
  console.log('\n下一步：运行 npx tsx scripts/fix/sync-doc-id-registry.ts 同步注册表')
}

main()
