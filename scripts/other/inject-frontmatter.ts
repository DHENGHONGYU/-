/**
 * 批量注入 Frontmatter 元数据到 docs/implementation/ 下所有 .md 文件
 * 用法: npx tsx scripts/inject-frontmatter.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BASE_DIR = path.resolve(__dirname, '..', 'docs', 'implementation')

interface Frontmatter {
  title: string
  version: string
  last_updated: string
  maintainer: string
  status: string
  change_log: Array<{ date: string; author: string; desc: string }>
}

function getFiles(dir: string): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'deprecated') {
        results.push(...getFiles(fullPath))
      }
    } else if (entry.name.endsWith('.md')) {
      results.push(fullPath)
    }
  }
  return results
}

function extractTitle(content: string, filename: string): string {
  const h1Match = content.match(/^# (.+)$/m)
  if (h1Match) return h1Match[1].replace(/^#\s*/, '')
  // Fallback: use filename without extension
  return path.basename(filename, '.md')
}

function determineStatus(lastModified: Date): string {
  const daysSince = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince <= 30) return 'active'
  if (daysSince <= 90) return 'review'
  return 'deprecated'
}

function getVersion(lastModified: Date): string {
  const date = lastModified.toISOString().slice(0, 10)
  // Use date-based versioning
  if (date >= '2026-06-27') return 'v1.0.0'
  if (date >= '2026-06-26') return 'v0.9.1'
  return 'v0.9.0'
}

function buildFrontmatter(fm: Frontmatter): string {
  const lines = [
    '---',
    `title: ${fm.title}`,
    `version: ${fm.version}`,
    `last_updated: ${fm.last_updated}`,
    `maintainer: ${fm.maintainer}`,
    `status: ${fm.status}`,
  ]
  if (fm.change_log.length > 0) {
    lines.push('change_log:')
    for (const entry of fm.change_log) {
      lines.push(`  - date: ${entry.date}`)
      lines.push(`    author: ${entry.author}`)
      lines.push(`    desc: ${entry.desc}`)
    }
  }
  lines.push('---')
  lines.push('')
  return lines.join('\n')
}

// Main
const files = getFiles(BASE_DIR)
let processed = 0
let skipped = 0

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8')
  
  // Skip files that already have frontmatter
  if (content.startsWith('---')) {
    skipped++
    continue
  }

  const stat = fs.statSync(file)
  const lastModified = stat.mtime
  const title = extractTitle(content, path.basename(file))
  const status = determineStatus(lastModified)
  const version = getVersion(lastModified)
  const lastUpdated = lastModified.toISOString().slice(0, 10)

  const fm: Frontmatter = {
    title,
    version,
    last_updated: lastUpdated,
    maintainer: 'V9 Architecture Team',
    status,
    change_log: [
      {
        date: lastUpdated,
        author: 'Documentation Governor',
        desc: '注入 Frontmatter 元数据（Phase 3 版本化）',
      },
    ],
  }

  const newContent = buildFrontmatter(fm) + content
  fs.writeFileSync(file, newContent, 'utf-8')
  processed++
  console.log(`[OK] ${path.relative(BASE_DIR, file)} : ${title} (${version}, ${status})`)
}

console.log(`\nDone: ${processed} files processed, ${skipped} skipped.`)