#!/usr/bin/env tsx
/**
 * normalize-metadata-enums.ts
 *
 * P0-4: 规范化文档元数据中的 type, domain, phase 字段值
 *
 * 映射规则：
 *   type:
 *     - guide, sop, how-to, tutorial → how-to
 *     - wiki, spec, reference-index, index → reference
 *     - report, audit-report → reports
 *     - adr, design → explanation
 *     - 其他非标准值 → explanation
 *
 *   domain:
 *     - arch → architecture
 *     - ref → data
 *     - guide, dev-workflow, dev-environment, sops, dev → project
 *     - REP, proj, project → project
 *     - 其他非标准值 → project
 *
 *   phase:
 *     - implementation, development → development
 *     - operation, maintenance, post-launch → deployment
 *     - review, verification → testing
 *     - 其他非标准值 → design
 *
 * 用法：
 *   npx tsx scripts/fix/normalize-metadata-enums.ts            # 预览
 *   npx tsx scripts/fix/normalize-metadata-enums.ts --apply     # 写入
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(ROOT, 'docs')
const APPLY = process.argv.includes('--apply')

// 标准值列表
const STANDARD_TYPES = ['reference', 'explanation', 'how-to', 'tutorials', 'reports', 'meta']
const STANDARD_DOMAINS = ['architecture', 'frontend', 'backend', 'data', 'ai', 'qa', 'project', 'product']
const STANDARD_PHASES = ['planning', 'requirements', 'design', 'development', 'testing', 'deployment', 'retrospective']

// type 映射
const TYPE_MAPPING: Record<string, string> = {
  'guide': 'how-to',
  'sop': 'how-to',
  'how-to': 'how-to',
  'tutorial': 'how-to',
  'wiki': 'reference',
  'spec': 'reference',
  'reference-index': 'reference',
  'index': 'reference',
  'report': 'reports',
  'audit-report': 'reports',
  'checklist': 'reference',
  'scorecard': 'reports',
  'go-nogo-minutes': 'reports',
  'adr': 'explanation',
  'design': 'explanation',
  'strategy': 'explanation',
  'implementation': 'explanation',
  'blueprint': 'explanation',
  'overview': 'explanation',
  'analysis': 'explanation',
  'deep-dive': 'explanation',
}

// domain 映射
const DOMAIN_MAPPING: Record<string, string> = {
  'arch': 'architecture',
  'ref': 'data',
  'guide': 'project',
  'dev-workflow': 'project',
  'dev-environment': 'project',
  'sops': 'project',
  'dev': 'project',
  'REP': 'project',
  'proj': 'project',
  'project': 'project',
  'technical': 'backend',
  'testing': 'qa',
  'quality': 'qa',
  'audit': 'qa',
  'operations': 'project',
  'release': 'product',
  'release-deploy': 'deployment',
  'release-management': 'deployment',
  'integration': 'backend',
  'code-review': 'qa',
  'analysis': 'backend',
  'system': 'architecture',
  'meta': 'project',
  'documentation': 'project',
}

// phase 映射
const PHASE_MAPPING: Record<string, string> = {
  'implementation': 'development',
  'development': 'development',
  'operation': 'deployment',
  'maintenance': 'deployment',
  'post-launch': 'deployment',
  'pre-launch': 'planning',
  'pre-merge': 'development',
  'review': 'testing',
  'verification': 'testing',
  'effective': 'testing',
  'execution': 'development',
  'onboarding': 'requirements',
  'overview': 'planning',
  'configuration': 'design',
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

function normalizeValue(value: string, mapping: Record<string, string>, standardValues: string[], defaultVal: string): { normalized: string; changed: boolean } {
  const trimmed = value.trim()
  
  if (standardValues.includes(trimmed)) {
    return { normalized: trimmed, changed: false }
  }
  
  if (mapping[trimmed]) {
    return { normalized: mapping[trimmed], changed: true }
  }
  
  // 尝试小写匹配
  const lowerKey = trimmed.toLowerCase()
  for (const [key, val] of Object.entries(mapping)) {
    if (key.toLowerCase() === lowerKey) {
      return { normalized: val, changed: true }
    }
  }
  
  return { normalized: defaultVal, changed: true }
}

function processField(
  content: string,
  fieldName: string,
  mapping: Record<string, string>,
  standardValues: string[],
  defaultVal: string
): { content: string; changed: boolean; oldVal: string; newVal: string } | null {
  const regex = new RegExp(`^${fieldName}:\\s*(.+)$`, 'm')
  const match = content.match(regex)
  if (!match) return null
  
  const oldVal = match[1].trim()
  const { normalized, changed } = normalizeValue(oldVal, mapping, standardValues, defaultVal)
  
  if (!changed) return null
  
  const newContent = content.replace(regex, `${fieldName}: ${normalized}`)
  return { content: newContent, changed: true, oldVal, newVal: normalized }
}

function main() {
  const mdFiles: string[] = []
  walk(DOCS_DIR, mdFiles)
  
  const changes: Array<{ abs: string; rel: string; changes: Array<{ field: string; old: string; newVal: string }> }> = []
  
  for (const abs of mdFiles) {
    const rel = relative(ROOT, abs).replace(/\\/g, '/')
    let content = readFileSync(abs, 'utf8')
    
    // 只处理有 frontmatter 的文件
    if (!content.startsWith('---')) continue
    
    let fileChanges: Array<{ field: string; old: string; newVal: string }> = []
    let changed = false
    
    // 处理 type
    const typeResult = processField(content, 'type', TYPE_MAPPING, STANDARD_TYPES, 'explanation')
    if (typeResult) {
      content = typeResult.content
      changed = true
      fileChanges.push({ field: 'type', old: typeResult.oldVal, newVal: typeResult.newVal })
    }
    
    // 处理 domain
    const domainResult = processField(content, 'domain', DOMAIN_MAPPING, STANDARD_DOMAINS, 'project')
    if (domainResult) {
      content = domainResult.content
      changed = true
      fileChanges.push({ field: 'domain', old: domainResult.oldVal, newVal: domainResult.newVal })
    }
    
    // 处理 phase
    const phaseResult = processField(content, 'phase', PHASE_MAPPING, STANDARD_PHASES, 'design')
    if (phaseResult) {
      content = phaseResult.content
      changed = true
      fileChanges.push({ field: 'phase', old: phaseResult.oldVal, newVal: phaseResult.newVal })
    }
    
    if (changed) {
      changes.push({ abs, rel, changes: fileChanges })
    }
  }
  
  console.log(`📊 发现 ${changes.length} 个文件的元数据需要规范化:`)
  console.log(`   模式: ${APPLY ? 'APPLY（实际写入）' : 'DRY-RUN（预览）'}\n`)
  
  // 按变更类型分组显示
  for (const c of changes) {
    console.log(`  ${c.rel}`)
    for (const ch of c.changes) {
      console.log(`    ${ch.field}: '${ch.old}' → '${ch.newVal}'`)
    }
  }
  
  if (!APPLY) {
    console.log(`\n预览结束。确认无误后执行: npx tsx scripts/fix/normalize-metadata-enums.ts --apply`)
    return
  }
  
  // 执行写入
  let wrote = 0
  for (const c of changes) {
    let content = readFileSync(c.abs, 'utf8')
    for (const ch of c.changes) {
      const regex = new RegExp(`^${ch.field}:\\s*.+$`, 'm')
      content = content.replace(regex, `${ch.field}: ${ch.newVal}`)
    }
    writeFileSync(c.abs, content, 'utf8')
    wrote++
  }
  
  console.log(`\n✅ 已规范化 ${wrote} 个文件的元数据`)
}

main()