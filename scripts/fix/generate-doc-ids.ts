#!/usr/bin/env tsx
/**
 * generate-doc-ids.ts
 *
 * P1-A: 为 important 级文档补全 doc_id
 *
 * 用法：
 *   npx tsx scripts/fix/generate-doc-ids.ts            # 预览
 *   npx tsx scripts/fix/generate-doc-ids.ts --apply     # 写入
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname, relative, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(ROOT, 'docs')
const APPLY = process.argv.includes('--apply')

// 类型映射
const TYPE_CODE: Record<string, string> = {
  'reference': 'REF',
  'explanation': 'EXP',
  'how-to': 'HOW',
  'tutorials': 'TUT',
  'reports': 'REP',
  'meta': 'META',
}

// 领域映射
const DOMAIN_CODE: Record<string, string> = {
  'architecture': 'ARC',
  'frontend': 'FE',
  'backend': 'BE',
  'data': 'DATA',
  'ai': 'AI',
  'qa': 'QA',
  'project': 'PROJ',
  'product': 'PROD',
}

function walk(dir: string, out: string[]) {
  if (!existsSync(dir)) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.name.endsWith('.md')) out.push(full)
  }
}

function generateDocId(filePath: string, content: string): string {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/')
  const segments = rel.split('/')
  
  // 解析 frontmatter
  const typeMatch = content.match(/^type:\s*(.+)$/m)
  const domainMatch = content.match(/^domain:\s*(.+)$/m)
  
  let type = typeMatch ? typeMatch[1].trim() : 'explanation'
  let domain = domainMatch ? domainMatch[1].trim() : 'project'
  
  // 判断路径结构，正确提取 type-dir 和 sub-dir
  // 非 archive: docs/{type-dir}/{sub-dir?}/file.md → segments[1] = type-dir
  // archive 模式A: docs/archive/{tier}/file.md → segments.length === 4, segments[3] = filename
  // archive 模式B: docs/archive/{tier}/{type-dir}/file.md → segments.length >= 5, segments[3] = type-dir
  let topDir = ''
  let subDir = ''
  
  if (segments[1] === 'archive') {
    // archive 路径
    const tier = segments[2] // 'important' or 'normal'
    const rest = segments.slice(3)
    if (rest.length >= 2) {
      // 有类型目录层: archive/{tier}/{type-dir}/.../file.md
      topDir = rest[0] // 类型目录
      subDir = rest[1] || ''
    } else {
      // 无类型目录层: archive/{tier}/file.md
      topDir = ''
      subDir = ''
    }
  } else {
    // 非 archive 路径
    topDir = segments[1] || ''
    subDir = segments[2] || ''
  }
  
  const fileName = basename(filePath, '.md').toLowerCase()
  
  // 如果 frontmatter 的 type 缺失或过于通用，尝试从路径推断
  if (!typeMatch || type === 'explanation' || type === 'how-to') {
    if (topDir === 'reference') type = 'reference'
    else if (topDir === 'guides' && subDir === 'sops') type = 'how-to'
    else if (topDir === 'guides' && subDir === 'how-to') type = 'how-to'
    else if (topDir === 'guides') type = 'how-to'
    else if (topDir === 'specs') type = 'reference'
    else if (topDir === 'wiki') type = 'reference'
    else if (topDir === 'reports') type = 'reports'
    else if (topDir === 'explanation') type = 'explanation'
    else if (topDir === 'meta') type = 'meta'
    else if (topDir === 'architecture' || topDir === 'frontend' || topDir === 'backend') type = 'reference'
    else if (topDir === 'design' || topDir === 'implementation') type = 'reference'
  }
  
  // 如果 frontmatter 的 domain 缺失或过于通用，尝试从路径/文件名推断
  if (!domainMatch || domain === 'project') {
    // 基于文件名推断
    if (fileName.includes('data') || fileName.includes('数据库') || fileName.includes('数据') || fileName.includes('字典')) domain = 'data'
    else if (fileName.includes('arch') || fileName.includes('架构') || fileName.includes('comparison') || fileName.includes('version')) domain = 'architecture'
    else if (fileName.includes('score') || fileName.includes('trading') || fileName.includes('stock') || fileName.includes('trade')) domain = 'data'
    else if (fileName.includes('test') || fileName.includes('quality') || fileName.includes('audit') || fileName.includes('验证')) domain = 'qa'
    else if (fileName.includes('ai') || fileName.includes('llm') || fileName.includes('agent')) domain = 'ai'
    else if (fileName.includes('chip') || fileName.includes('cyq')) domain = 'data'
    else if (fileName.includes('config') || fileName.includes('配置')) domain = 'data'
    
    // 基于路径目录推断
    if (topDir === 'architecture') domain = 'architecture'
    else if (topDir === 'data') domain = 'data'
    else if (topDir === 'qa' || topDir === 'testing') domain = 'qa'
  }
  
  const typeCode = TYPE_CODE[type] || 'DOC'
  const domainCode = DOMAIN_CODE[domain] || 'PROJ'
  
  // 生成基础 ID
  const baseId = `V9-DOC-${typeCode}-${domainCode}`
  
  // 生成序号（基于文件名哈希）
  const fileBaseName = basename(filePath, '.md')
  let hash = 0
  for (let i = 0; i < fileBaseName.length; i++) {
    hash = ((hash << 5) - hash) + fileBaseName.charCodeAt(i)
    hash |= 0
  }
  const seq = Math.abs(hash) % 1000
  
  return `${baseId}-${String(seq).padStart(3, '0')}`
}

function main() {
  const mdFiles: string[] = []
  walk(DOCS_DIR, mdFiles)
  
  const candidates: Array<{ abs: string; rel: string; newDocId: string }> = []
  
  for (const abs of mdFiles) {
    const rel = relative(ROOT, abs).replace(/\\/g, '/')
    const content = readFileSync(abs, 'utf8')
    
    // 只处理有 frontmatter 的文件
    if (!content.startsWith('---')) continue
    
    // 检查是否为 important 文档
    const tierMatch = content.match(/^tier:\s*(.+)$/m)
    if (!tierMatch || tierMatch[1].trim() !== 'important') continue
    
    // 检查是否已有 doc_id
    if (content.match(/^doc_id:\s*/m)) continue
    
    // 生成新 doc_id
    const newDocId = generateDocId(abs, content)
    candidates.push({ abs, rel, newDocId })
  }
  
  console.log(`📊 发现 ${candidates.length} 个 important 文档缺少 doc_id:`)
  console.log(`   模式: ${APPLY ? 'APPLY（实际写入）' : 'DRY-RUN（预览）'}\n`)
  
  for (const c of candidates) {
    console.log(`  ${c.rel}`)
    console.log(`    → doc_id: ${c.newDocId}`)
    console.log('')
  }
  
  if (!APPLY) {
    console.log(`预览结束。确认无误后执行: npx tsx scripts/fix/generate-doc-ids.ts --apply`)
    return
  }
  
  // 执行写入
  let wrote = 0
  for (const c of candidates) {
    let content = readFileSync(c.abs, 'utf8')
    
    // 在 title 字段后面插入 doc_id
    const titleMatch = content.match(/^title:\s*.+$/m)
    if (titleMatch) {
      const insertPos = titleMatch.index + titleMatch[0].length
      content = content.slice(0, insertPos) + `\ndoc_id: ${c.newDocId}` + content.slice(insertPos)
    }
    
    writeFileSync(c.abs, content, 'utf8')
    wrote++
  }
  
  console.log(`✅ 已为 ${wrote} 个文档生成 doc_id`)
}

main()