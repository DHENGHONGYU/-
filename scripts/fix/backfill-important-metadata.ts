#!/usr/bin/env tsx
/**
 * backfill-important-metadata.ts
 *
 * P0-4（仅 important 高影响文档）：为缺失核心字段的 `tier: important` 文档回填 type / domain / phase。
 *
 * 目标集合：97 个 important 文档中 54 个缺失字段
 *   - 52 个缺 type/domain/phase（reference/ 数据契约类为主）
 *   - 2 个仅缺 phase（industry-chart-integration、adr-010）
 * (doc_id 由 scripts/fix/generate-doc-ids.ts 单独回填，此处不处理)
 *
 * 字段值严格对齐权威枚举（docs/meta/document-metadata-standard.md §7）：
 *   7.1 type: reference | explanation | how-to | tutorials | reports | meta
 *   7.2 domain: architecture | frontend | backend | data | ai | qa | project | product
 *   7.3 phase: planning | requirements | design | development | testing | deployment | retrospective
 *
 * 用法：
 *   npx tsx scripts/fix/backfill-important-metadata.ts            # 预览
 *   npx tsx scripts/fix/backfill-important-metadata.ts --apply     # 写入
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(ROOT, 'docs')
const APPLY = process.argv.includes('--apply')

// rel 路径（相对 docs/）→ 需补字段。缺某字段即回填，已有字段不动。
const MAPPING: Record<string, { type?: string; domain?: string; phase?: string }> = {
  // ===== 2 个仅缺 phase =====
  'explanation/implementation/industry-chart-integration-2026-08-20.md': { phase: 'development' },
  'specs/architecture/adr-010-cockpit-command-cross-layout.md': { phase: 'design' },

  // ===== explanation =====
  'explanation/production-release-checklist-SKILL.md': { type: 'explanation', domain: 'qa', phase: 'deployment' },
  'explanation/V9-体系化上线测试-TODO-LIST.md': { type: 'explanation', domain: 'qa', phase: 'testing' },

  // ===== guides/how-to =====
  'guides/how-to/how-to-deploy-docker-network.md': { type: 'how-to', domain: 'backend', phase: 'development' },
  'guides/how-to/how-to-troubleshooting-deploy-checklist.md': { type: 'how-to', domain: 'backend', phase: 'deployment' },
  'guides/how-to/mcp-acl-guide.md': { type: 'how-to', domain: 'ai', phase: 'development' },
  'guides/how-to/testing/completeness-profile-batch2.md': { type: 'how-to', domain: 'qa', phase: 'testing' },

  // ===== meta =====
  'meta/functional-module-guide.md': { type: 'meta', domain: 'project', phase: 'development' },

  // ===== release-notes =====
  'release-notes/RELEASE-NOTES-dark-mode-optimization.md': { type: 'reports', domain: 'frontend', phase: 'deployment' },

  // ===== reports/testing =====
  'reports/testing/e2e-test-expansion-plan.md': { type: 'reports', domain: 'qa', phase: 'planning' },
  'reports/testing/performance-baseline.md': { type: 'reports', domain: 'qa', phase: 'testing' },
  'reports/testing/unit-test-repair-roadmap.md': { type: 'reports', domain: 'qa', phase: 'planning' },

  // ===== specs/product =====
  'specs/product/competitive-analysis.md': { type: 'reference', domain: 'product', phase: 'planning' },
  'specs/product/data-security-and-privacy.md': { type: 'reference', domain: 'data', phase: 'design' },

  // ===== reference/ 数据契约类 =====
  'reference/_contract-template.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/ai-center-data-definition.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/analysis-cabin-spec.md': { type: 'reference', domain: 'frontend', phase: 'design' },
  'reference/analysis-contract.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/api-contract.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/architecture-version-comparison.md': { type: 'reference', domain: 'architecture', phase: 'design' },
  'reference/atomic-component-system.md': { type: 'reference', domain: 'frontend', phase: 'design' },
  'reference/command-cabin-spec.md': { type: 'reference', domain: 'frontend', phase: 'design' },
  'reference/cockpit/data-definition.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/completeness-profile.md': { type: 'reference', domain: 'qa', phase: 'testing' },
  'reference/completeness-profile-batch5.md': { type: 'reference', domain: 'qa', phase: 'testing' },
  'reference/data-collection-task-list.md': { type: 'reference', domain: 'data', phase: 'planning' },
  'reference/databridge-split-plan.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/databridge端点与数据映射清单.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/data-flow-spec.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/dataflow-engine-spec.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/execution-contract.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/jsdoc-convention.md': { type: 'reference', domain: 'frontend', phase: 'design' },
  'reference/mcp-acl-guide.md': { type: 'reference', domain: 'ai', phase: 'design' },
  'reference/output-cabin-spec.md': { type: 'reference', domain: 'frontend', phase: 'design' },
  'reference/portfolio-contract.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/pwa-offline-guide.md': { type: 'reference', domain: 'frontend', phase: 'design' },
  'reference/risk-derived-data-definition.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/scoring-contract.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/seven-dim-advanced-config-implementation.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/seven-dim-config-data-definition.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/system-contract.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/v6-to-v9-migration-spec.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/v6pro-to-v9-migration-analysis.md': { type: 'reference', domain: 'data', phase: 'retrospective' },
  'reference/v9-数据血缘追踪.md': { type: 'reference', domain: 'data', phase: 'design' },
  'reference/V9-TEST-CASES.md': { type: 'reference', domain: 'qa', phase: 'testing' },
  'reference/databridge改进建议整改实施计划.md': { type: 'reference', domain: 'data', phase: 'retrospective' },
  'reference/网页测试检索校对纳入采集方案分析.md': { type: 'reference', domain: 'qa', phase: 'testing' },

  // ===== reference/data-collection =====
  'reference/data-collection/data-definition.md': { type: 'reference', domain: 'data', phase: 'design' },

  // ===== reference/news =====
  'reference/news/data-definition.md': { type: 'reference', domain: 'data', phase: 'design' },

  // ===== reference/changelogs =====
  'reference/changelogs/2026-07/2026-07-05-databridge-query-implementation.md': { type: 'reference', domain: 'data', phase: 'retrospective' },
  'reference/changelogs/2026-07/completeness-profile-p1.md': { type: 'reference', domain: 'qa', phase: 'testing' },
  'reference/changelogs/2026-07/jsdoc-update-summary-20260712.md': { type: 'reference', domain: 'frontend', phase: 'retrospective' },
  'reference/changelogs/变更摘要-2026-06-28-phase0-数据层改造.md': { type: 'reference', domain: 'data', phase: 'retrospective' },

  // ===== reference/meta =====
  'reference/meta/file-system-assessment-v2.md': { type: 'reference', domain: 'project', phase: 'design' },
}

function parseFrontmatterLines(lines: string[]): { hasOpening: boolean; closingIdx: number; fields: Set<string> } {
  if (lines[0]?.trim() !== '---') return { hasOpening: false, closingIdx: -1, fields: new Set() }
  const closingIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  const fields = new Set<string>()
  if (closingIdx > 0) {
    for (let i = 1; i < closingIdx; i++) {
      const m = lines[i].match(/^([A-Za-z_]+):/)
      if (m && !/^\s{2,}/.test(lines[i])) fields.add(m[1])
    }
  }
  return { hasOpening: true, closingIdx, fields }
}

function main() {
  const planned: Array<{ rel: string; add: string[]; already: string[] }> = []

  for (const [rel, fields] of Object.entries(MAPPING)) {
    const abs = join(DOCS_DIR, rel)
    if (!existsSync(abs)) {
      console.log(`⚠️  文件不存在，跳过：${rel}`)
      continue
    }
    const content = readFileSync(abs, 'utf8')
    const lines = content.split('\n')
    const { hasOpening, closingIdx, fields: existing } = parseFrontmatterLines(lines)
    if (!hasOpening || closingIdx < 0) {
      console.log(`⚠️  无 frontmatter，跳过：${rel}`)
      continue
    }
    const toAdd: string[] = []
    const already: string[] = []
    const order: Array<'type' | 'domain' | 'phase'> = ['type', 'domain', 'phase']
    for (const key of order) {
      const val = fields[key]
      if (!val) continue
      if (existing.has(key)) already.push(`${key}=${existing.size ? '' : ''}`)
      else toAdd.push(`${key}: ${val}`)
    }
    if (toAdd.length) {
      planned.push({ rel, add: toAdd, already })
    }
  }

  console.log(`📊 待回填 ${planned.length} 个文件:`)
  console.log(`   模式: ${APPLY ? 'APPLY（实际写入）' : 'DRY-RUN（预览）'}\n`)

  for (const p of planned) {
    console.log(`  ${p.rel}`)
    for (const line of p.add) console.log(`    + ${line}`)
  }

  if (!APPLY) {
    console.log(`\n预览结束。确认无误后执行: npx tsx scripts/fix/backfill-important-metadata.ts --apply`)
    return
  }

  let wrote = 0
  for (const p of planned) {
    const abs = join(DOCS_DIR, p.rel)
    const lines = readFileSync(abs, 'utf8').split('\n')
    // 在起始 `---` 之后插入缺失字段
    const insertAt = 1
    for (let i = 0; i < p.add.length; i++) {
      lines.splice(insertAt + i, 0, p.add[i])
    }
    writeFileSync(abs, lines.join('\n'), 'utf8')
    wrote++
  }
  console.log(`\n✅ 已回填 ${wrote} 个文件`)
}

main()