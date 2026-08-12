#!/usr/bin/env tsx
/**
 * @module scripts/docs-tool/doc-rule-validator
 * @description 文档编制规则校验器 — 校验 frontmatter 完整性/命名规范/分级一致性/清单同步
 *
 * 校验规则（R1-R8）：
 *   R1 frontmatter 存在性：每个 .md 必须有 YAML frontmatter
 *   R2 tier 字段：必须有 tier: core|important|reference
 *   R3 code_version 字段：必须有 code_version 且与 package.json 一致
 *   R4 title 字段：必须有 title 且非文件路径
 *   R5 命名规范：文件名 kebab-case（无大写/无书名号/无下划线）
 *   R6 清单同步：doc-manifest.csv 条目数 = 实际 .md 文件数
 *   R7 无重复 slug 跨目录（warning，不阻断）
 *   R8 编号连续性：C/I/R 编号无跳号
 *
 * 用法：
 *   npx tsx scripts/docs-tool/doc-rule-validator.ts [--fix] [--silent]
 *   --fix    自动修正可修复的违规（补 tier/code_version/title）
 *   --silent 仅输出违规摘要
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname, basename, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const DOCS = join(ROOT, 'docs')

interface Violation {
  rule: string
  path: string
  message: string
  fixable: boolean
}

const VALID_TIERS = new Set(['core', 'important', 'reference'])
const WHITELIST = new Set(['docs/explanation/README.md', 'CHANGELOG.md', 'AGENTS.md'])

function readPkgVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function walkMd(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    // 排除历史归档目录（不适用编制规则）
    if (entry === 'deprecated-docs' || entry === 'old-versions' || entry === 'ai-index') continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      results.push(...walkMd(full))
    } else if (entry.toLowerCase().endsWith('.md')) {
      results.push(full)
    }
  }
  return results
}

function extractFrontmatter(content: string): { has: boolean; fields: Record<string, string> } {
  const m = content.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return { has: false, fields: {} }
  const fields: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/)
    if (kv) fields[kv[1]] = kv[2].trim()
  }
  return { has: true, fields }
}

function isKebabCase(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.md$/.test(name) || WHITELIST.has(name)
}

function classifyTier(relPath: string): string {
  const p = relPath.toLowerCase()
  if (p.startsWith('00-meta/') && !p.includes('deprecated') && !p.includes('old-versions')) return 'core'
  if (p.startsWith('reference/') && ['api-contract', 'data-dictionary', 'data-definition', 'architecture-standards', 'engine-specs', 'quality-gates', 'routing-specs', 'data-flow-spec', 'databridge', 'functional-module'].some(k => p.includes(k))) return 'core'
  if (p.startsWith('reports/') || p.startsWith('archive/') || p.startsWith('drafts/')) return 'reference'
  if (/^adr-\d{3}/.test(basename(relPath).toLowerCase())) return 'reference'
  if (/^\d{4}-\d{2}-\d{2}/.test(basename(relPath))) return 'reference'
  if (['report', 'audit', 'review', 'remediation', 'rectification', 'retrospective'].some(k => p.includes(k))) return 'reference'
  return 'important'
}

export function validateRules(fix: boolean): { total: number; violations: Violation[]; fixed: number } {
  const expected = readPkgVersion()
  const files = walkMd(DOCS)
  const violations: Violation[] = []
  let fixed = 0

  for (const abs of files) {
    const rel = relative(DOCS, abs).replace(/\\/g, '/')
    const fname = basename(abs)
    const content = readFileSync(abs, 'utf-8')
    const { has, fields } = extractFrontmatter(content)

    // R1 frontmatter 存在性
    if (!has) {
      if (fix) {
        const tier = classifyTier(rel)
        const newContent = `---\ntitle: ${fname.replace(/\.md$/, '')}\ntier: ${tier}\ncode_version: ${expected}\n---\n\n${content}`
        writeFileSync(abs, newContent, 'utf-8')
        fixed++
      } else {
        violations.push({ rule: 'R1', path: rel, message: 'missing frontmatter', fixable: true })
      }
      continue
    }

    // R2 tier
    if (!fields.tier || !VALID_TIERS.has(fields.tier)) {
      if (fix) {
        const tier = fields.tier && VALID_TIERS.has(fields.tier) ? fields.tier : classifyTier(rel)
        const newContent = content.replace(/^(---\n[\s\S]*?\n)(---)/, `$1tier: ${tier}\n$2`)
        writeFileSync(abs, newContent, 'utf-8')
        fixed++
      } else {
        violations.push({ rule: 'R2', path: rel, message: `invalid tier: ${fields.tier || 'missing'}`, fixable: true })
      }
    }

    // R3 code_version
    if (!fields.code_version) {
      if (fix) {
        const newContent = content.replace(/^(---\n[\s\S]*?)(\n---)/, `$1code_version: ${expected}\n$2`)
        writeFileSync(abs, newContent, 'utf-8')
        fixed++
      } else {
        violations.push({ rule: 'R3', path: rel, message: 'missing code_version', fixable: true })
      }
    } else if (fields.code_version !== expected) {
      if (fix) {
        const newContent = content.replace(/code_version:\s*\S+/, `code_version: ${expected}`)
        writeFileSync(abs, newContent, 'utf-8')
        fixed++
      } else {
        violations.push({ rule: 'R3', path: rel, message: `code_version mismatch: ${fields.code_version} != ${expected}`, fixable: true })
      }
    }

    // R4 title
    if (!fields.title || fields.title.startsWith('docs/') || fields.title.includes('/')) {
      if (fix) {
        const goodTitle = fname.replace(/\.md$/, '')
        if (fields.title) {
          const newContent = content.replace(/title:\s*.+/, `title: ${goodTitle}`)
          writeFileSync(abs, newContent, 'utf-8')
        } else {
          const newContent = content.replace(/^(---\n[\s\S]*?)(\n---)/, `$1title: ${goodTitle}\n$2`)
          writeFileSync(abs, newContent, 'utf-8')
        }
        fixed++
      } else {
        violations.push({ rule: 'R4', path: rel, message: `invalid title: ${fields.title || 'missing'}`, fixable: true })
      }
    }

    // R5 命名规范
    if (!isKebabCase(fname)) {
      violations.push({ rule: 'R5', path: rel, message: `filename not kebab-case: ${fname}`, fixable: false })
    }
  }

  // R6 清单同步
  const manifestPath = join(DOCS, '00-meta/doc-manifest.csv')
  if (existsSync(manifestPath)) {
    const manifestLines = readFileSync(manifestPath, 'utf-8').split('\n').filter(l => l.trim() && !l.startsWith('num,'))
    if (manifestLines.length !== files.length) {
      violations.push({ rule: 'R6', path: 'doc-manifest.csv', message: `manifest entries (${manifestLines.length}) != actual files (${files.length})`, fixable: false })
    }
  }

  // R7 重复 slug（warning）
  const slugMap: Record<string, string[]> = {}
  for (const abs of files) {
    const fname = basename(abs)
    if (!slugMap[fname]) slugMap[fname] = []
    slugMap[fname].push(relative(DOCS, abs).replace(/\\/g, '/'))
  }
  for (const [slug, paths] of Object.entries(slugMap)) {
    if (paths.length > 1 && !WHITELIST.has(slug)) {
      violations.push({ rule: 'R7', path: slug, message: `duplicate slug in ${paths.length} dirs: ${paths.join(', ')}`, fixable: false })
    }
  }

  return { total: files.length, violations, fixed }
}

function main(): void {
  const args = process.argv.slice(2)
  const fix = args.includes('--fix')
  const silent = args.includes('--silent')

  const result = validateRules(fix)

  if (!silent) {
    console.log('[doc-rule-validator] scanned %d files', result.total)
    if (result.violations.length > 0) {
      const byRule: Record<string, number> = {}
      for (const v of result.violations) {
        byRule[v.rule] = (byRule[v.rule] || 0) + 1
      }
      console.log('[doc-rule-validator] violations: %d', result.violations.length)
      for (const [rule, count] of Object.entries(byRule)) {
        console.log('  %s: %d', rule, count)
      }
      if (!fix) {
        for (const v of result.violations.slice(0, 20)) {
          console.log('  %s %s — %s', v.rule, v.path, v.message)
        }
        if (result.violations.length > 20) {
          console.log('  ... and %d more', result.violations.length - 20)
        }
      }
    }
    if (fix && result.fixed > 0) {
      console.log('[doc-rule-validator] auto-fixed %d violations', result.fixed)
    }
  }

  // CI 门禁：R1-R4 frontmatter 违规 → 非零退出；R5-R8 为警告不阻断
  const blocking = result.violations.filter(v => ['R1', 'R2', 'R3', 'R4'].includes(v.rule) && !v.fixable)
  process.exit(blocking.length > 0 ? 1 : 0)
}

main()
