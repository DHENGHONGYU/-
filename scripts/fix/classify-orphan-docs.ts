#!/usr/bin/env tsx
/**
 * classify-orphan-docs.ts
 * 对无 doc_id 的文档进行分类筛选
 *
 * 策略：
 *   - 归档候选（不注入 doc_id）：审计报告/测试报告/总结类/临时记录/快照/对比类
 *   - 需注入 ID：正式文档（规范/设计/指南/说明/参考等）
 *
 * 输出：
 *   - docs/meta/orphan-archive-candidates.md（归档清单，供治理阶段使用）
 *   - 控制台打印统计
 *
 * 用法：
 *   npx tsx scripts/fix/classify-orphan-docs.ts
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(ROOT, 'docs')
const OUTPUT_PATH = join(DOCS_DIR, 'meta', 'orphan-archive-candidates.md')

const EXCLUDE_DIRS = new Set(['ai-index', '.ai-index', 'archive', '_drafts', 'node_modules'])
const EXCLUDE_FILES = new Set(['doc-id-registry.md', 'README.md', 'AGENTS.md', 'ai-index.md'])

/** 归档候选关键词（文件名或路径命中即归档） */
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

/** 归档候选目录前缀 */
const ARCHIVE_DIR_PREFIXES = ['audit/', 'reports/', 'audit/reports/', 'reports/governance/']

/** 归档候选日期前缀文件名模式（explanation/2026-MM-DD-xxx.md） */
const DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}-/

interface OrphanDoc {
  relPath: string
  fileName: string
  category: 'archive-candidate' | 'inject-id'
  reason: string
  size: number
}

function isArchiveCandidate(relPath: string, fileName: string): { archive: boolean; reason: string } {
  const lowerPath = relPath.toLowerCase()
  const lowerName = fileName.toLowerCase()

  // 1. 目录前缀匹配
  for (const prefix of ARCHIVE_DIR_PREFIXES) {
    if (lowerPath.startsWith(prefix)) {
      return { archive: true, reason: `目录归档: ${prefix}` }
    }
  }

  // 2. 日期前缀文件（项目临时记录）
  if (DATE_PREFIX_PATTERN.test(fileName)) {
    return { archive: true, reason: '日期前缀临时记录' }
  }

  // 3. 关键词匹配
  for (const kw of ARCHIVE_KEYWORDS) {
    if (lowerName.includes(kw) || lowerPath.includes(kw)) {
      return { archive: true, reason: `关键词命中: "${kw}"` }
    }
  }

  return { archive: false, reason: '' }
}

function scanOrphans(): OrphanDoc[] {
  const out: OrphanDoc[] = []
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
          const { archive, reason } = isArchiveCandidate(relPath, e.name)
          const stats = statSync(full)
          out.push({
            relPath,
            fileName: e.name,
            category: archive ? 'archive-candidate' : 'inject-id',
            reason: archive ? reason : '正式文档',
            size: stats.size,
          })
        }
      }
    }
  }
  walk(DOCS_DIR)
  return out
}

function main() {
  const orphans = scanOrphans()
  const archive = orphans.filter((o) => o.category === 'archive-candidate')
  const inject = orphans.filter((o) => o.category === 'inject-id')

  console.log('========== 无 doc_id 文档分类 ==========')
  console.log(`总数: ${orphans.length}`)
  console.log(`归档候选（不注入 ID）: ${archive.length}`)
  console.log(`需注入 ID（正式文档）: ${inject.length}`)

  // 按归档原因统计
  const byReason = new Map<string, number>()
  for (const a of archive) {
    byReason.set(a.reason, (byReason.get(a.reason) || 0) + 1)
  }
  console.log('\n--- 归档候选按原因 ---')
  for (const [r, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${r.padEnd(30)} ${n}`)
  }

  // 按目录统计需注入
  const injectByDir = new Map<string, number>()
  for (const i of inject) {
    const dir = i.relPath.split('/')[0] || 'root'
    injectByDir.set(dir, (injectByDir.get(dir) || 0) + 1)
  }
  console.log('\n--- 需注入 ID 按目录 ---')
  for (const [d, n] of [...injectByDir.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${d.padEnd(20)} ${n}`)
  }

  // 生成归档清单文件
  const today = new Date().toISOString().slice(0, 10)
  const lines: string[] = []
  lines.push('---')
  lines.push(`title: 无 doc_id 归档候选清单`)
  lines.push(`type: meta`)
  lines.push(`domain: project`)
  lines.push(`status: active`)
  lines.push(`last_updated: ${today}`)
  lines.push('---')
  lines.push('')
  lines.push('# 无 doc_id 归档候选清单')
  lines.push('')
  lines.push(`> 生成时间: ${today}`)
  lines.push(`> 总数: ${archive.length} 篇`)
  lines.push('')
  lines.push('## 说明')
  lines.push('')
  lines.push('本清单收录审计报告、测试报告、总结复盘、临时记录、快照对比等非正式文档。')
  lines.push('这些文档不纳入 doc_id 注册表，作为治理阶段总结性产物，定期归档或清理。')
  lines.push('')
  lines.push('## 归档清单')
  lines.push('')
  lines.push('| # | 路径 | 归档原因 |')
  lines.push('|---|------|---------|')
  archive
    .sort((a, b) => a.relPath.localeCompare(b.relPath))
    .forEach((a, i) => {
      lines.push(`| ${i + 1} | ${a.relPath} | ${a.reason} |`)
    })
  lines.push('')
  lines.push('## 治理建议')
  lines.push('')
  lines.push('- audit/、reports/ 目录文档定期归档至 archive/ 或删除')
  lines.push('- 日期前缀临时记录（2026-MM-DD-xxx.md）保留 30 天后归档')
  lines.push('- 含 report/summary/review 关键词的文档评估后归档或降级')
  lines.push('')

  writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8')
  console.log(`\n✅ 归档清单已写入: ${OUTPUT_PATH}`)
  console.log(`\n下一步：对 ${inject.length} 篇正式文档运行 inject-doc-id.ts 注入 ID`)
}

main()
