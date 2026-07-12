#!/usr/bin/env node
/**
 * audit-path-match.mjs — 文档目录-内容匹配审计
 *
 * 作用：校验 docs/ 下新增/现有的 .md 是否落入符合 A–H 归类的正确子目录，
 *       防止文档散落根目录或错位（对应 GOVERNANCE.md §2 与 P2-5）。
 *
 * 用法：
 *   node scripts/audit-path-match.mjs            #  advisory（仅报告，exit 0）
 *   node scripts/audit-path-match.mjs --enforce  #  发现违规则 exit 1（Husky pre-commit 用）
 *
 * 零依赖（仅 Node 内置 fs/path）。可被 .husky/pre-commit 在文档变动时调用。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DOCS = path.join(ROOT, 'docs')

// 目录 → 允许的内容类别（A–H）
const RULES = {
  '00-meta': { cls: 'A', desc: '治理/审查/计划类文档' },
  'architecture': { cls: 'B', desc: '架构总览/舱室/服务目录' },
  'architecture-radar-v2': { cls: 'B', desc: '架构雷达专项分析' },
  'design': { cls: 'H/D', desc: '设计/美学/无障碍指南' },
  'ops': { cls: 'H', desc: '运维/发布手册' },
  'standards': { cls: 'D', desc: '规范/数据字典索引' },
  'guides': { cls: 'H', desc: '教程/操作指南' },
  'plugins': { cls: 'C', desc: '插件/数据源集成文档' },
  'project-management': { cls: 'A', desc: '项目管理文档' },
  '05-deployment': { cls: 'H', desc: '部署文档' },
  '06-project-management': { cls: 'A', desc: '项目管理（v2 路径）' },
  'audit': { cls: 'G', desc: '审计过程产物' },
  'changelogs': { cls: 'G', desc: '变更日志' },
  'drafts': { cls: 'G', desc: '草稿（7 天清理）' },
  '01-requirements': { cls: 'C', desc: '需求规格' },
  '02-design': { cls: 'B/C', desc: '设计/舱 spec/令牌' },
  '03-development': { cls: 'D', desc: '开发规范' },
  '04-testing': { cls: 'E', desc: '测试策略' },
  '07-archive': { cls: '—', desc: '归档（DEPRECATED）' },
}

// 文件名 → 期望目录的强约束（命中即校验，值为实际相对路径）
// 注：仅强制 GOVERNANCE/CLEANUP_SCHEDULE 在 docs/ 根；README.md 允许各子类存在（子目录 README 合法）。
const EXACT = {
  'GOVERNANCE.md': 'docs/GOVERNANCE.md',
  'CLEANUP_SCHEDULE.md': 'docs/CLEANUP_SCHEDULE.md',
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.ai-index', 'reports', 'assets'])

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(full, acc)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      acc.push(full)
    }
  }
  return acc
}

function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/') }

function main() {
  const enforce = process.argv.includes('--enforce')
  const files = walk(DOCS)
  const violations = []

  for (const f of files) {
    const r = rel(f)
    const base = path.basename(f)
    const segs = r.split('/') // ['docs', top, ...]

    // 根级文件（docs/xxx.md，长度 2）单独处理
    if (segs.length === 2) {
      if (EXACT[base]) {
        if (r !== EXACT[base]) {
          violations.push({ file: r, issue: `应位于 ${EXACT[base]}，实际 ${r}` })
        }
      } else if (base === 'README.md') {
        // 主控索引 docs/README.md 合法；子目录 README 由 segs.length>=3 分支处理
      } else {
        violations.push({ file: r, issue: 'docs/ 根散落 .md（仅 README/GOVERNANCE/CLEANUP_SCHEDULE 允许）' })
      }
      continue
    }

    const top = segs[1]
    if (!(top in RULES)) {
      violations.push({ file: r, issue: `位于未归类顶层目录 docs/${top}/（无 A–H 映射）` })
    }
  }

  console.log(`\n🔍 audit-path-match: 扫描 ${files.length} 个 .md 文件`)
  if (violations.length === 0) {
    console.log('✅ 目录-内容匹配：无违规')
    process.exit(0)
  }
  console.log(`⚠️  发现 ${violations.length} 处目录-内容不匹配：`)
  for (const v of violations) console.log(`  - ${v.file}\n      ${v.issue}`)
  process.exit(enforce ? 1 : 0)
}

main()
