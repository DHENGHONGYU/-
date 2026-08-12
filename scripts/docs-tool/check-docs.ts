#!/usr/bin/env tsx
/**
 * check-docs.ts
 * 文档规范检查脚本（替代原 file-management-system/scripts/check-docs.js）
 *
 * 检查目标：
 * 1. 关键文档文件存在性（README.md / AGENTS.md / architecture.md / CHANGELOG.md）
 * 2. docs/ 目录结构完整性（00-meta ~ 04-testing 五舱）
 * 3. AGENTS.md 版本号格式合规
 * 4. 文档文件大小不过大（单文件 < 500KB，跳过 drafts/archive/reports）
 *
 * 退出码：0=通过, 1=有违规
 */

import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DOCS_DIR = join(ROOT, 'docs')

interface Finding {
  type: 'missing' | 'oversize' | 'version' | 'structure'
  file: string
  message: string
}

const REQUIRED_ROOT_DOCS = [
  'docs/explanation/README.md',
  'AGENTS.md',
  'architecture.md',
  'CHANGELOG.md',
]

const REQUIRED_DOC_SECTIONS = [
  '00-meta',
  '01-requirements',
  '02-design',
  '03-development',
  '04-testing',
]

const MAX_DOC_SIZE_BYTES = 500 * 1024 // 500KB
const SKIP_SIZE_CHECK_DIRS = new Set(['drafts', 'archive', 'reports', '07-archive', '.ai-index', 'playground'])

function scan(): Finding[] {
  const findings: Finding[] = []

  // 1. 关键文档存在性
  for (const doc of REQUIRED_ROOT_DOCS) {
    const path = join(ROOT, doc)
    if (!existsSync(path)) {
      findings.push({ type: 'missing', file: doc, message: `关键文档缺失: ${doc}` })
    }
  }

  // 2. docs/ 目录结构
  if (!existsSync(DOCS_DIR)) {
    findings.push({ type: 'structure', file: 'docs/', message: 'docs/ 目录不存在' })
  } else {
    const sections = readdirSync(DOCS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    for (const section of REQUIRED_DOC_SECTIONS) {
      if (!sections.includes(section)) {
        findings.push({
          type: 'structure',
          file: `docs/${section}/`,
          message: `docs/ 子目录缺失: ${section}`,
        })
      }
    }
  }

  // 3. AGENTS.md 版本号格式（支持 **版本**: vX.Y.Z 或 版本: vX.Y.Z）
  const agentsPath = join(ROOT, 'AGENTS.md')
  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, 'utf-8')
    const versionMatch = content.match(/版本[\s*:：\s*]*v?\d+\.\d+\.\d+/)
    if (!versionMatch) {
      findings.push({
        type: 'version',
        file: 'AGENTS.md',
        message: 'AGENTS.md 中未找到合规版本号（格式: vX.Y.Z）',
      })
    }
  }

  // 4. 文档文件大小检查（跳过草稿/归档/报告目录）
  function checkSize(dir: string, prefix: string): void {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const childPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_SIZE_CHECK_DIRS.has(entry.name)) {
          checkSize(childPath, `${prefix}${entry.name}/`)
        }
      } else if (entry.name.endsWith('.md')) {
        const size = statSync(childPath).size
        if (size > MAX_DOC_SIZE_BYTES) {
          findings.push({
            type: 'oversize',
            file: `${prefix}${entry.name}`,
            message: `文档过大: ${prefix}${entry.name} (${(size / 1024).toFixed(1)}KB > 500KB)`,
          })
        }
      }
    }
  }
  checkSize(DOCS_DIR, 'docs/')
  for (const doc of REQUIRED_ROOT_DOCS) {
    const path = join(ROOT, doc)
    if (existsSync(path)) {
      const size = statSync(path).size
      if (size > MAX_DOC_SIZE_BYTES) {
        findings.push({
          type: 'oversize',
          file: doc,
          message: `文档过大: ${doc} (${(size / 1024).toFixed(1)}KB > 500KB)`,
        })
      }
    }
  }

  return findings
}

function main(): void {
  const findings = scan()

  console.log('══════════════════════════════════════════════════════════════')
  console.log('  文档规范检查 — check-docs.ts')
  console.log('══════════════════════════════════════════════════════════════')
  console.log()

  if (findings.length === 0) {
    console.log('✅ 所有文档规范检查通过')
    console.log()
    console.log('  检查项:')
    console.log(`    - 关键文档: ${REQUIRED_ROOT_DOCS.length}/${REQUIRED_ROOT_DOCS.length}`)
    console.log(`    - docs 子目录: ${REQUIRED_DOC_SECTIONS.length}/${REQUIRED_DOC_SECTIONS.length}`)
    console.log(`    - AGENTS.md 版本号: 已找到`)
    console.log(`    - 文档大小: 全部 ≤ 500KB`)
    console.log()
    process.exit(0)
  } else {
    console.log(`❌ 发现 ${findings.length} 处文档规范问题`)
    console.log()
    for (const f of findings) {
      const icon = f.type === 'missing' ? '📄' : f.type === 'oversize' ? '📦' : f.type === 'version' ? '🏷️' : '📁'
      console.log(`  ${icon} [${f.type}] ${f.message}`)
    }
    console.log()
    process.exit(1)
  }
}

main()
