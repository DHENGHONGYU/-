#!/usr/bin/env tsx
/**
 * audit-doc-id-reverse.ts
 * doc_id 注册表反向校验脚本 v1.0
 *
 * 检查目标（补墙核心机制）：
 *   1. 正向：注册表每条 entry 指向的文件必须存在
 *   2. 反向：磁盘上每个 .md 文件（含 doc_id frontmatter）必须在注册表中登记
 *   3. 一致性：文件 frontmatter 中的 doc_id 必须与注册表登记的 doc_id 一致
 *
 * 退出码：0=通过, 1=有违规, 2=执行错误
 *
 * 用法：
 *   npx tsx scripts/audit/audit-doc-id-reverse.ts           # 全量校验
 *   npx tsx scripts/audit/audit-doc-id-reverse.ts --json    # JSON 输出（CI 集成）
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(ROOT, 'docs')
const REGISTRY_PATH = join(DOCS_DIR, 'meta', 'doc-id-registry.md')
const ARCHIVE_CANDIDATES_PATH = join(DOCS_DIR, 'meta', 'orphan-archive-candidates.md')

/** 排除目录（索引产物、归档、临时） */
const EXCLUDE_DIRS = new Set(['ai-index', '.ai-index', 'archive', '_drafts', 'node_modules'])

/** 排除文件名（自动生成的索引、README 索引） */
const EXCLUDE_FILES = new Set([
  'doc-id-registry.md',
  'README.md',
  'AGENTS.md',
  'ai-index.md',
  'orphan-archive-candidates.md',
])

/** 归档候选关键词（命中即豁免 no-doc-id 违规） */
const ARCHIVE_KEYWORDS = [
  'report', 'audit', 'test', 'summary', 'review', 'snapshot', 'comparison', 'compare',
  'feasibility', 'assessment', '临时', '总结', '复盘', '审计', '对比', '快照', '诊断',
  'diagnose', 'debug', '排查', 'investigat', 'health', 'repair', 'fix-log', 'changelog',
  'change-log', 'migration-log', 'remediation', 'tech-debt', 'debt', 'cleanup', '清理',
  '整改', '治理', 'governance', 'quality-audit', 'checklist', 'pending-items', 'backlog',
  'todo', 'TODO', 'status', 'progress', 'weekly', 'daily', 'monthly', 'meeting', '会议',
  '周报', '日报', '月报',
]
const ARCHIVE_DIR_PREFIXES = ['audit/', 'reports/', 'audit/reports/', 'reports/governance/']
const DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}-/

/**
 * meta/ 目录下的临时治理产物清单（自动生成、定期归档/移出，不纳入 doc_id 注册表）。
 * 命中即视为归档候选，豁免 no-doc-id 违规。
 */
const META_TEMPORARY_FILES = new Set([
  'meta/doc-code-direct-xref.md', // 文档↔代码 直接关系快速索引（临时）
  'meta/orphan-archive-candidates.md', // 无 doc_id 归档候选清单（临时）
  'meta/文件整理清单.md', // 文件整理清单（临时）
  'meta/doc-governance-calibration-2026-08-15.md', // 文档治理二次校准报告（临时）
])

/** 判断是否为归档候选（预期无 doc_id，不报违规） */
function isArchiveCandidate(relPath: string, fileName: string): boolean {
  const lowerPath = relPath.toLowerCase()
  const lowerName = fileName.toLowerCase()
  // meta 目录下的临时治理产物清单（精确匹配，避免误豁免其它正式 meta 文档）
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

// ============================================================
// 类型
// ============================================================

interface RegistryEntry {
  doc_id: string
  domain: string
  title: string
  path: string
}

interface Violation {
  type:
    | 'missing-file' // 注册表 entry 指向的文件不存在
    | 'unregistered-doc' // 磁盘文件有 doc_id 但未在注册表
    | 'no-doc-id' // 磁盘文件无 doc_id frontmatter
    | 'id-mismatch' // 文件 doc_id 与注册表不一致
  doc_id?: string
  path: string
  message: string
}

interface Report {
  summary: {
    totalDiskDocs: number
    totalRegistryEntries: number
    docsWithId: number
    docsWithoutId: number
    archiveCandidates: number
    registryCoverage: string
    violations: number
    passed: boolean
  }
  violations: Violation[]
}

// ============================================================
// 扫描磁盘文档
// ============================================================

interface DiskDoc {
  absPath: string
  relPath: string // 相对 docs/
  doc_id: string | null
  hasFrontmatter: boolean
}

function scanDiskDocs(dir: string): DiskDoc[] {
  const out: DiskDoc[] = []
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    if (EXCLUDE_DIRS.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...scanDiskDocs(full))
    } else if (e.isFile() && e.name.endsWith('.md') && !EXCLUDE_FILES.has(e.name)) {
      const content = readFileSync(full, 'utf8')
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
      const hasFrontmatter = !!fmMatch
      let doc_id: string | null = null
      if (fmMatch) {
        const idMatch = fmMatch[1].match(/^doc_id:\s*(\S+)/m)
        if (idMatch) doc_id = idMatch[1]
      }
      out.push({
        absPath: full,
        relPath: relative(DOCS_DIR, full).replace(/\\/g, '/'),
        doc_id,
        hasFrontmatter,
      })
    }
  }
  return out
}

// ============================================================
// 解析注册表
// ============================================================

function parseRegistry(): RegistryEntry[] {
  if (!existsSync(REGISTRY_PATH)) return []
  const content = readFileSync(REGISTRY_PATH, 'utf8')
  const entries: RegistryEntry[] = []
  // 匹配表格行：| doc_id | domain | title | path |（支持 V9-DOC-xxx、V9-REL-xxx、GOV-xxx 等格式）
  const lines = content.split('\n')
  for (const line of lines) {
    const m = line.match(/^\|\s*([A-Z][A-Z0-9-]{3,}-\S+)\s*\|\s*(\S+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/)
    if (m) {
      entries.push({
        doc_id: m[1],
        domain: m[2],
        title: m[3].trim(),
        path: m[4].trim(),
      })
    }
  }
  return entries
}

// ============================================================
// 主校验逻辑
// ============================================================

function audit(): Report {
  const diskDocs = scanDiskDocs(DOCS_DIR)
  const registry = parseRegistry()

  // 注册表 path → entry 索引
  const regByPath = new Map<string, RegistryEntry>()
  const regById = new Map<string, RegistryEntry>()
  for (const e of registry) {
    regByPath.set(e.path, e)
    regById.set(e.doc_id, e)
  }

  const violations: Violation[] = []

  // 正向：注册表 entry 指向的文件必须存在
  for (const e of registry) {
    const fullPath = join(DOCS_DIR, e.path)
    if (!existsSync(fullPath)) {
      violations.push({
        type: 'missing-file',
        doc_id: e.doc_id,
        path: e.path,
        message: `注册表 entry ${e.doc_id} 指向的文件不存在: ${e.path}`,
      })
    }
  }

  // 反向：磁盘文件必须登记
  let docsWithId = 0
  let docsWithoutId = 0
  let archiveCandidates = 0 // 归档候选（预期无 ID，不报违规）
  for (const d of diskDocs) {
    if (d.doc_id) {
      docsWithId++
      // 检查是否在注册表
      const regEntry = regById.get(d.doc_id)
      if (!regEntry) {
        violations.push({
          type: 'unregistered-doc',
          doc_id: d.doc_id,
          path: d.relPath,
          message: `文件有 doc_id=${d.doc_id} 但未在注册表登记: ${d.relPath}`,
        })
      } else if (regEntry.path !== d.relPath) {
        // 检查 path 一致性（允许注册表 path 与磁盘 path 不一致的情况）
        violations.push({
          type: 'id-mismatch',
          doc_id: d.doc_id,
          path: d.relPath,
          message: `doc_id=${d.doc_id} 注册表 path="${regEntry.path}" 与磁盘 path="${d.relPath}" 不一致`,
        })
      }
    } else {
      docsWithoutId++
      // 归档候选（审计报告/测试/总结/临时记录）豁免 no-doc-id 违规
      const fileName = d.relPath.split('/').pop() || ''
      if (isArchiveCandidate(d.relPath, fileName)) {
        archiveCandidates++
      } else {
        violations.push({
          type: 'no-doc-id',
          path: d.relPath,
          message: `文件无 doc_id frontmatter: ${d.relPath}`,
        })
      }
    }
  }

  const totalDiskDocs = diskDocs.length
  const registryCoverage =
    totalDiskDocs > 0 ? ((docsWithId / totalDiskDocs) * 100).toFixed(1) + '%' : 'N/A'

  return {
    summary: {
      totalDiskDocs,
      totalRegistryEntries: registry.length,
      docsWithId,
      docsWithoutId,
      archiveCandidates,
      registryCoverage,
      violations: violations.length,
      passed: violations.length === 0,
    },
    violations,
  }
}

// ============================================================
// CLI
// ============================================================

function main() {
  const isJson = process.argv.includes('--json')
  try {
    const report = audit()
    if (isJson) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log('========== doc_id 反向校验 ==========')
      console.log(`磁盘文档总数: ${report.summary.totalDiskDocs}`)
      console.log(`注册表条目数: ${report.summary.totalRegistryEntries}`)
      console.log(`有 doc_id 文档: ${report.summary.docsWithId}`)
      console.log(`无 doc_id 文档: ${report.summary.docsWithoutId}（其中归档候选 ${report.summary.archiveCandidates} 篇豁免）`)
      console.log(`注册表覆盖率: ${report.summary.registryCoverage}`)
      console.log(`违规总数: ${report.summary.violations}`)
      console.log(`结果: ${report.summary.passed ? '✅ 通过' : '❌ 失败'}`)
      console.log('')

      if (report.violations.length > 0) {
        // 按类型分组
        const byType = new Map<string, Violation[]>()
        for (const v of report.violations) {
          if (!byType.has(v.type)) byType.set(v.type, [])
          byType.get(v.type)!.push(v)
        }
        for (const [type, items] of byType) {
          console.log(`--- ${type} (${items.length}) ---`)
          for (const v of items.slice(0, 20)) {
            console.log(`  ${v.message}`)
          }
          if (items.length > 20) {
            console.log(`  ... 还有 ${items.length - 20} 条`)
          }
          console.log('')
        }
      }
    }
    process.exit(report.summary.passed ? 0 : 1)
  } catch (e) {
    console.error('执行错误:', e)
    process.exit(2)
  }
}

main()
