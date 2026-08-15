#!/usr/bin/env tsx
/**
 * sync-doc-id-registry.ts
 * doc_id 注册表同步脚本 v1.0
 *
 * 功能：
 *   1. 扫描磁盘所有有 doc_id 的 .md 文件
 *   2. 清理注册表中指向不存在文件的失效条目（missing-file）
 *   3. 补全磁盘有 doc_id 但未在注册表的条目（unregistered-doc）
 *   4. 修正 path 不一致的条目（id-mismatch）
 *
 * 不处理：无 doc_id 的文件（由 inject-doc-id.ts 处理）
 *
 * 用法：
 *   npx tsx scripts/fix/sync-doc-id-registry.ts           # 执行同步
 *   npx tsx scripts/fix/sync-doc-id-registry.ts --dry-run # 预览不写入
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(ROOT, 'docs')
const REGISTRY_PATH = join(DOCS_DIR, 'meta', 'doc-id-registry.md')

const EXCLUDE_DIRS = new Set(['ai-index', '.ai-index', 'archive', '_drafts', 'node_modules'])
const EXCLUDE_FILES = new Set(['doc-id-registry.md', 'README.md', 'AGENTS.md', 'ai-index.md'])

interface DiskDoc {
  relPath: string
  doc_id: string
  title: string
  domain: string
}

interface RegistryEntry {
  doc_id: string
  domain: string
  title: string
  path: string
}

// ============================================================
// 扫描磁盘有 doc_id 的文档
// ============================================================

function scanDiskDocsWithId(): DiskDoc[] {
  const out: DiskDoc[] = []
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
          const idMatch = fmMatch[1].match(/^doc_id:\s*(\S+)/m)
          if (idMatch) {
            const titleMatch = fmMatch[1].match(/^title:\s*["']?([^"'\n]+)["']?/m)
            const domainMatch = fmMatch[1].match(/^domain:\s*(\S+)/m)
            // 从 doc_id 推断 domain：支持 V9-DOC-{DOMAIN}-{NUM} 和 V9-{DOMAIN}-{NUM}
            const domainFromId =
              idMatch[1].match(/^V9-DOC-([A-Z]+)-/) ||
              idMatch[1].match(/^V9-([A-Z]+)-/) ||
              idMatch[1].match(/^([A-Z]+)-/)
            const title =
              titleMatch?.[1]?.trim() ||
              content.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
              e.name.replace(/\.md$/, '')
            out.push({
              relPath: relative(DOCS_DIR, full).replace(/\\/g, '/'),
              doc_id: idMatch[1],
              title,
              domain: domainMatch?.[1] || domainFromId?.[1]?.toLowerCase() || 'proj',
            })
          }
        }
      }
    }
  }
  walk(DOCS_DIR)
  return out
}

// ============================================================
// 解析注册表
// ============================================================

function parseRegistry(): { entries: RegistryEntry[]; headerLines: string[]; tableHeader: string[] } {
  const content = readFileSync(REGISTRY_PATH, 'utf8')
  const lines = content.split('\n')

  // 找表格起始（| doc_id | domain | title | path |）
  let tableStart = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\|\s*doc_id\s*\|/)) {
      tableStart = i
      break
    }
  }

  if (tableStart === -1) {
    return { entries: [], headerLines: lines, tableHeader: [] }
  }

  const headerLines = lines.slice(0, tableStart)
  const tableHeader = lines.slice(tableStart, tableStart + 2) // 表头 + 分隔行
  const tableLines = lines.slice(tableStart + 2)

  const entries: RegistryEntry[] = []
  for (const line of tableLines) {
    const m = line.match(
      /^\|\s*(V9-DOC-[A-Z]+-\S+)\s*\|\s*(\S+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/,
    )
    if (m) {
      entries.push({
        doc_id: m[1],
        domain: m[2],
        title: m[3].trim(),
        path: m[4].trim(),
      })
    }
  }

  return { entries, headerLines, tableHeader }
}

// ============================================================
// 同步逻辑
// ============================================================

function sync(dryRun: boolean): void {
  const diskDocs = scanDiskDocsWithId()
  const { entries: regEntries, headerLines, tableHeader } = parseRegistry()

  const regById = new Map<string, RegistryEntry>()
  for (const e of regEntries) regById.set(e.doc_id, e)

  const diskById = new Map<string, DiskDoc>()
  for (const d of diskDocs) diskById.set(d.doc_id, d)

  const stats = {
    cleanedMissing: 0, // 清理失效条目
    addedNew: 0, // 新增条目
    fixedPath: 0, // 修正 path
    unchanged: 0,
  }

  const resultEntries: RegistryEntry[] = []

  // 1. 保留注册表中文件存在的条目，修正 path 不一致
  for (const reg of regEntries) {
    const disk = diskById.get(reg.doc_id)
    if (disk) {
      if (disk.relPath !== reg.path) {
        stats.fixedPath++
        resultEntries.push({
          ...reg,
          path: disk.relPath,
          title: disk.title,
          domain: disk.domain,
        })
      } else {
        stats.unchanged++
        resultEntries.push(reg)
      }
    } else {
      // 注册表有条目但磁盘无对应文件 → 清理
      stats.cleanedMissing++
    }
  }

  // 2. 补全磁盘有 doc_id 但未在注册表的条目
  for (const disk of diskDocs) {
    if (!regById.has(disk.doc_id)) {
      stats.addedNew++
      resultEntries.push({
        doc_id: disk.doc_id,
        domain: disk.domain,
        title: disk.title,
        path: disk.relPath,
      })
    }
  }

  // 按 doc_id 排序
  resultEntries.sort((a, b) => a.doc_id.localeCompare(b.doc_id))

  console.log('========== doc_id 注册表同步 ==========')
  console.log(`磁盘有 doc_id 文档: ${diskDocs.length}`)
  console.log(`注册表原有条目: ${regEntries.length}`)
  console.log(`清理失效条目: ${stats.cleanedMissing}`)
  console.log(`新增条目: ${stats.addedNew}`)
  console.log(`修正 path: ${stats.fixedPath}`)
  console.log(`保持不变: ${stats.unchanged}`)
  console.log(`同步后总条目: ${resultEntries.length}`)

  if (dryRun) {
    console.log('\n[dry-run] 未写入文件')
    if (stats.addedNew > 0) {
      console.log('\n--- 新增条目预览（前 20）---')
      for (const e of resultEntries.filter(
        (r) => !regById.has(r.doc_id),
      ).slice(0, 20)) {
        console.log(`  + ${e.doc_id} | ${e.domain} | ${e.title.slice(0, 40)} | ${e.path}`)
      }
    }
    return
  }

  // 写入注册表
  const tableRows = resultEntries
    .map((e) => `| ${e.doc_id} | ${e.domain} | ${e.title} | ${e.path} |`)
    .join('\n')

  const newContent =
    headerLines.join('\n') +
    '\n' +
    tableHeader.join('\n') +
    '\n' +
    tableRows +
    '\n'

  writeFileSync(REGISTRY_PATH, newContent, 'utf8')
  console.log(`\n✅ 已写入 ${REGISTRY_PATH}`)
}

const dryRun = process.argv.includes('--dry-run')
sync(dryRun)
