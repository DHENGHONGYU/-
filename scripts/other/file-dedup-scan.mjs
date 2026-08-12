// 内容哈希去重扫描器（仅用于文件治理评估，不修改任何文件）
/**
 * @file file-dedup-scan.mjs
 * @description 基于内容哈希的文件去重扫描器，识别完全相同及命名近似碰撞文件
 * @status 孤立脚本（未在 package.json 中引用）
 * @category 未接入审计流水线 — 评估后接入
 * @maintainer 待定
 * @lastVerified 2026-07-13
 */

import { readdirSync, statSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, relative, extname, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'

// 仓库根：相对脚本位置自动推导（scripts/ -> 项目根），避免硬编码路径导致在其他环境扫错目录
const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
// 扫描范围：仅从仓库根开始（根已覆盖所有子目录），避免子目录重复计入
const SCAN_DIRS = [ROOT]
const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', 'dist-e2e', 'dist-test', 'dist-verify', 'dist_e2e',
  'dist_preview', 'dist_s1verify', 'coverage', 'coverage_cmd', 'test-results',
  'test-results-f01', 'playwright-report', 'e2e-test-report', 'widget_test_logs',
  'widget_test_logs_run2', 'widget_test_logs_run3', '.git', '.workbuddy',
  'packages', 'temp', 'public', 'releases', 'e2e', 'tests', 'test-output',
  '.venv', '.playwright-mcp', '.github', '.trae', '.trae-cn', '.codebuddy',
  '.agents', '.dbg', 'docs/G-reports', 'docs/assets', 'docs/G4-drafts', 'docs/G5-release-management',
  'reports', // docs/reports 生成物（按基名排除）
  '_',        // .husky/_ 钩子模板（husky 必需，非源码重复）
  'node_modules',
])
// 0 字节空文件（虚拟环境/占位）不计入"可节省"指标
const SKIP_EMPTY = true
const EXCLUDE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.map', '.zip'])

/**
 * 有意保留的发行/格式副本，不计入"可删重复"：
 * - toolkit/：整改工具包（模板 + 复用脚本，其 README 明确说明供新项目直接复用，
 *   safeCoerce.ts 等是模板副本而非 app 源码冗余）
 * - plugins/<x>/skills/<x>/SKILL.md：插件技能加载格式要求（与插件根 SKILL.md 并存，删任一份都会破坏加载）
 */
function isIntentional(rel) {
  if (rel === 'toolkit' || rel.startsWith('toolkit/')) return true
  if (/^plugins\/[^/]+\/skills(\/|$)/.test(rel)) return true
  return false
}

function walk(dir, acc) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = join(dir, e.name)
    const rel = relative(ROOT, full).split('\\').join('/')
    if (isIntentional(rel)) continue
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue
      walk(full, acc)
    } else if (e.isFile()) {
      if (EXCLUDE_EXT.has(extname(e.name).toLowerCase())) continue
      acc.push(full)
    }
  }
}

const files = []
for (const d of SCAN_DIRS) if (existsSync(d)) walk(d, files)

const byHash = new Map()
for (const f of files) {
  try {
    const buf = readFileSync(f)
    if (SKIP_EMPTY && buf.length === 0) continue
    const h = createHash('sha256').update(buf).digest('hex')
    const rel = relative(ROOT, f).split('\\').join('/')
    const size = buf.length
    if (!byHash.has(h)) byHash.set(h, [])
    byHash.get(h).push({ rel, size })
  } catch { /* skip unreadable */ }
}

// 完全相同的重复集（同哈希、多路径）
const dupSets = []
for (const [h, arr] of byHash) {
  if (arr.length > 1) dupSets.push({ hash: h.slice(0, 12), files: arr })
}
dupSets.sort((a, b) => b.files.length - a.files.length)

// 文件名近似（忽略大小写/空格/连字符）分组，供"命名标准化"参考
const byNorm = new Map()
for (const f of files) {
  const b = basename(f)
  const norm = b.toLowerCase().replace(/[\s_\-./]+/g, '')
  if (!byNorm.has(norm)) byNorm.set(norm, [])
  byNorm.get(norm).push(relative(ROOT, f).split('\\').join('/'))
}
const nameCollisions = [...byNorm.entries()].filter(([, v]) => v.length > 1)

// 命名不规范：含空格、特殊字符、全大写驼峰等
const namingIssues = []
for (const f of files) {
  const b = basename(f)
  const rel = relative(ROOT, f).split('\\').join('/')
  if (b.includes(' ')) namingIssues.push({ file: rel, issue: '含空格' })
  if (/[&|"'>]/.test(b)) namingIssues.push({ file: rel, issue: '含特殊字符(&|">)' })
  if (/[？？？？？]/.test(b)) namingIssues.push({ file: rel, issue: '含中文问号' })
}

const total = files.length
const dupFileCount = dupSets.reduce((s, d) => s + d.files.length - 1, 0)
const totalDupBytes = dupSets.reduce((s, d) => s + (d.files[0].size * (d.files.length - 1)), 0)

console.log('=== 哈希去重扫描结果 ===')
console.log('扫描文件总数:', total)
console.log('完全相同重复集数:', dupSets.length)
console.log('因重复可节省文件数:', dupFileCount)
console.log('因重复可节省字节数:', totalDupBytes, `(${(totalDupBytes/1024).toFixed(1)} KB)`)
console.log('文件名近似碰撞组数:', nameCollisions.length)
console.log('命名不规范文件数:', namingIssues.length)
console.log('')
console.log('--- 完全相同重复明细（前30组）---')
dupSets.slice(0, 30).forEach((d, i) => {
  console.log(`#${i + 1} [hash ${d.hash}] (${d.files.length}份, 单份${d.files[0].size}B)`)
  d.files.forEach(x => console.log('   ' + x.rel))
})
console.log('')
console.log('--- 文件名近似碰撞（前20组）---')
nameCollisions.slice(0, 20).forEach(([n, v]) => {
  console.log(`norm="${n}" ->`)
  v.forEach(x => console.log('   ' + x))
})
console.log('')
console.log('--- 命名不规范样例（前30）---')
namingIssues.slice(0, 30).forEach(x => console.log(`  [${x.issue}] ${x.file}`))

// 写 JSON 供后续报告引用
const out = {
  total, dupSets: dupSets.length, dupFileCount, totalDupBytes,
  nameCollisions: nameCollisions.length, namingIssues: namingIssues.length,
  duplicates: dupSets.map(d => ({ hash: d.hash, size: d.files[0].size, files: d.files.map(x => x.rel) })),
  nameCollisionList: nameCollisions.map(([n, v]) => ({ norm: n, files: v })),
  namingIssueList: namingIssues,
}
writeFileSync(join(tmpdir(), 'dedup-result.json'), JSON.stringify(out, null, 2))
console.log('\n已写出 dedup-result.json')
