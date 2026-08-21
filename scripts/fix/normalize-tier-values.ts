#!/usr/bin/env tsx
/**
 * normalize-tier-values.ts
 *
 * P0-4: 规范化文档元数据中的 tier 字段值
 *
 * 映射规则：
 *   - T0 -> important
 *   - T1 -> standard
 *   - T2 -> reference
 *   - mandatory -> important
 *   - 其他非标准值 -> standard（默认降级）
 *
 * 用法：
 *   npx tsx scripts/fix/normalize-tier-values.ts            # 预览
 *   npx tsx scripts/fix/normalize-tier-values.ts --apply     # 写入
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(ROOT, 'docs')
const APPLY = process.argv.includes('--apply')

// 标准 tier 值
const STANDARD_TIERS = ['important', 'standard', 'reference', 'quick-note']

// 非标准值到标准值的映射
const TIER_MAPPING: Record<string, string> = {
  'T0': 'important',
  'T1': 'standard',
  'T2': 'reference',
  'mandatory': 'important',
  'critical': 'important',
  'high': 'important',
  'medium': 'standard',
  'low': 'quick-note',
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

function normalizeTier(tierValue: string): { normalized: string; changed: boolean } {
  const trimmed = tierValue.trim()
  
  // 如果已经是标准值，直接返回
  if (STANDARD_TIERS.includes(trimmed)) {
    return { normalized: trimmed, changed: false }
  }
  
  // 检查是否包含 "important" 关键词（复合值如 "important | reference"）
  if (trimmed.includes('important')) {
    return { normalized: 'important', changed: true }
  }
  
  // 检查是否包含多个值（用 | 或其他分隔符）
  const parts = trimmed.split(/[\s|,]+/).filter(p => p.length > 0)
  if (parts.length > 1) {
    // 尝试找到第一个标准值
    for (const part of parts) {
      if (STANDARD_TIERS.includes(part)) {
        return { normalized: part, changed: true }
      }
    }
    // 如果没有标准值，尝试映射第一个部分
    const firstPart = parts[0]
    if (TIER_MAPPING[firstPart]) {
      return { normalized: TIER_MAPPING[firstPart], changed: true }
    }
    // 默认降级
    return { normalized: 'standard', changed: true }
  }
  
  // 单一非标准值
  if (TIER_MAPPING[trimmed]) {
    return { normalized: TIER_MAPPING[trimmed], changed: true }
  }
  
  // 默认降级
  return { normalized: 'standard', changed: true }
}

function main() {
  const mdFiles: string[] = []
  walk(DOCS_DIR, mdFiles)
  
  const candidates: Array<{ abs: string; rel: string; oldTier: string; newTier: string }> = []
  
  for (const abs of mdFiles) {
    const rel = relative(ROOT, abs).replace(/\\/g, '/')
    const content = readFileSync(abs, 'utf8')
    
    // 只处理有 frontmatter 的文件
    if (!content.startsWith('---')) continue
    
    // 查找 tier 字段
    const tierMatch = content.match(/^tier:\s*(.+)$/m)
    if (!tierMatch) continue
    
    const oldTier = tierMatch[1].trim()
    const { normalized, changed } = normalizeTier(oldTier)
    
    if (changed) {
      candidates.push({ abs, rel, oldTier, newTier: normalized })
    }
  }
  
  console.log(`📊 发现 ${candidates.length} 个文件的 tier 值需要规范化:`)
  console.log(`   模式: ${APPLY ? 'APPLY（实际写入）' : 'DRY-RUN（预览）'}\n`)
  
  // 按旧值分组显示
  const grouped: Record<string, Array<{ abs: string; rel: string; newTier: string }>> = {}
  for (const c of candidates) {
    if (!grouped[c.oldTier]) grouped[c.oldTier] = []
    grouped[c.oldTier].push(c)
  }
  
  for (const [oldVal, files] of Object.entries(grouped)) {
    console.log(`  '${oldVal}' → '${files[0].newTier}' (${files.length} 个文件)`)
    files.slice(0, 3).forEach(f => console.log(`    - ${f.rel}`))
    if (files.length > 3) console.log(`    ... 和 ${files.length - 3} 个文件`)
    console.log('')
  }
  
  if (!APPLY) {
    console.log(`预览结束。确认无误后执行: npx tsx scripts/fix/normalize-tier-values.ts --apply`)
    return
  }
  
  // 执行写入
  let wrote = 0
  for (const c of candidates) {
    let content = readFileSync(c.abs, 'utf8')
    content = content.replace(/^tier:\s*.+$/m, `tier: ${c.newTier}`)
    writeFileSync(c.abs, content, 'utf8')
    wrote++
  }
  
  console.log(`✅ 已规范化 ${wrote} 个文件的 tier 值`)
}

main()