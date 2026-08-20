/**
 * 一次性批量修复脚本：处理 doc-cross-ref-sync 遗留的不可自动修复断链（歧义/无候选）
 *
 * 输入: outputs/cross-ref-unfixable.json（由 analyze-cross-ref-unfixable.ts 生成）
 *
 * 修复规则：
 *   A. 歧义项（candidates > 1）：
 *      1. 候选路径含原 target 的父目录段（目录线索）→ 选之（多个含线索取公共前缀最长）
 *      2. 无线索 → 与源文件公共目录前缀最长的候选（同批次归档优先）
 *   B. 无候选项（candidates == 0）：
 *      1. basename（补 .md / 剥 docs/ 前缀后）全库唯一匹配 → 修复
 *      2. Levenshtein 相似度 >= 0.8 且唯一 → 修复
 *      3. 彻底无目标（乱码/已删除）→ 链接降级为纯文本（保留显示文本）
 *
 * 安全策略：默认 dry-run；--apply 写盘；写盘用 readTextAdaptive/writeTextUtf8（GBK 安全）
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextAdaptive, writeTextUtf8 } from '../lib/encoding'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..', '..')
const docsDir = join(projectRoot, 'docs')

const APPLY = process.argv.includes('--apply')
const PLAN_PATH = join(projectRoot, 'outputs', 'cross-ref-unfixable.json')
const OUT_PATH = join(projectRoot, 'outputs', 'cross-ref-batch-result.json')

// ── 全库 md 文件清单（与 collectMarkdownFiles 一致）──────────
const EXCLUDE = new Set(['node_modules', 'deprecated-docs', 'old-versions', 'ai-index'])
function collectMd(dir: string, out: string[]): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) collectMd(full, out)
    else if (st.isFile() && extname(entry).toLowerCase() === '.md') out.push(full)
  }
}
const allMdAbs: string[] = []
collectMd(docsDir, allMdAbs)
const allMdRel = allMdAbs.map((a) => relative(docsDir, a).replace(/\\/g, '/'))
const allBaseIdx = new Map<string, string[]>()
for (const rel of allMdRel) {
  const b = basename(rel)
  if (!allBaseIdx.has(b)) allBaseIdx.set(b, [])
  allBaseIdx.get(b)!.push(rel)
}

// ── Levenshtein 相似度 ───────────────────────────────────────
function similarity(a: string, b: string): number {
  if (a === b) return 1
  const m = a.length, n = b.length
  if (!m || !n) return 0
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return 1 - dp[m][n] / Math.max(m, n)
}

// ── 消歧 ─────────────────────────────────────────────────────
function commonPrefixSegs(a: string, b: string): number {
  const sa = a.split('/'), sb = b.split('/')
  let i = 0
  while (i < sa.length - 1 && i < sb.length - 1 && sa[i] === sb[i]) i++
  return i
}

function disambiguate(
  sourceRel: string,
  target: string,
  candidatesAbs: string[],
): { pick: string | null; rule: string } {
  const candRel = candidatesAbs.map((c) => relative(docsDir, c).replace(/\\/g, '/'))
  // 规则 1：候选路径含 target 的父目录段（取最后一段目录名作线索）
  const segs = target.split('/')
  const dirHint = segs.length >= 2 ? segs[segs.length - 2] : null
  if (dirHint && dirHint !== '..' && !dirHint.startsWith('.')) {
    const hits = candRel.filter((c) => c.split('/').includes(dirHint))
    if (hits.length === 1) return { pick: hits[0], rule: `dirHint(${dirHint})` }
    if (hits.length > 1) {
      const best = hits
        .map((c) => ({ c, p: commonPrefixSegs(sourceRel, c) }))
        .sort((x, y) => y.p - x.p)[0]!
      return { pick: best.c, rule: `dirHint(${dirHint})+prefix` }
    }
  }
  // 规则 2：公共目录前缀最长
  const ranked = candRel
    .map((c) => ({ c, p: commonPrefixSegs(sourceRel, c) }))
    .sort((x, y) => y.p - x.p)
  if (ranked[0] && (ranked[0].p > ranked[1]!.p || candRel.length === 1)) {
    return { pick: ranked[0].c, rule: 'commonPrefix' }
  }
  // 平手：archive 源优先 archive 候选；活跃源优先非 archive 候选
  const srcIsArchive = sourceRel.startsWith('archive/')
  const sameState = ranked.filter((r) => r.c.startsWith('archive/') === srcIsArchive)
  const pool = sameState.length > 0 ? sameState : ranked
  return { pick: pool[0]!.c, rule: 'sameStateTiebreak' }
}

// ── 无候选恢复匹配 ───────────────────────────────────────────
function recoverTarget(target: string): { pick: string | null; rule: string } {
  const rawName = basename(target.split(/[?#]/)[0] || '')
  if (!rawName) return { pick: null, rule: 'none' }
  // 1. 精确 basename
  const exact = allBaseIdx.get(rawName)
  if (exact?.length === 1) return { pick: exact[0], rule: 'basenameExact' }
  // 2. 补 .md
  if (!rawName.endsWith('.md')) {
    const withMd = allBaseIdx.get(`${rawName}.md`)
    if (withMd?.length === 1) return { pick: withMd[0], rule: 'basenamePlusMd' }
  }
  // 3. 剥 docs/ 前缀直接定位
  const t = target.replace(/^docs\//, '')
  if (!t.includes('..') && existsSync(join(docsDir, t))) {
    return { pick: t.replace(/\\/g, '/'), rule: 'stripDocsPrefix' }
  }
  // 4. Levenshtein >= 0.9 且唯一（阈值收紧：0.8 区间实测存在日期文本误配）
  let best: { name: string; sim: number } | null = null
  let tie = false
  for (const [name] of allBaseIdx) {
    const sim = similarity(rawName.toLowerCase(), name.toLowerCase())
    if (!best || sim > best.sim) { best = { name, sim }; tie = false }
    else if (sim === best.sim) tie = true
  }
  if (best && best.sim >= 0.9 && !tie) {
    const hits = allBaseIdx.get(best.name)!
    if (hits.length === 1) return { pick: hits[0], rule: `fuzzy(${best.sim.toFixed(2)})` }
  }
  return { pick: null, rule: 'none' }
}

// ── 主流程 ───────────────────────────────────────────────────
interface Item {
  source: string
  line: number
  text: string
  target: string
  candidates: string[]
}

const data = JSON.parse(readFileSync(PLAN_PATH, 'utf8')) as { items: Item[] }
const items = data.items.filter((i) => i.source.startsWith('archive/')) // 活跃目录已人工精修

type Action = 'relayout' | 'plainText'
interface PlanEntry {
  source: string
  line: number
  text: string
  oldTarget: string
  newTarget?: string
  action: Action
  rule: string
}

const plan: PlanEntry[] = []
for (const it of items) {
  if (it.candidates.length > 1) {
    const d = disambiguate(it.source, it.target, it.candidates)
    const srcAbs = join(docsDir, it.source)
    const newRel = relative(dirname(srcAbs), join(docsDir, d.pick!)).replace(/\\/g, '/')
    plan.push({
      source: it.source, line: it.line, text: it.text,
      oldTarget: it.target, newTarget: newRel, action: 'relayout', rule: `disambig:${d.rule}`,
    })
  } else {
    const r = recoverTarget(it.target)
    if (r.pick) {
      const srcAbs = join(docsDir, it.source)
      const newRel = relative(dirname(srcAbs), join(docsDir, r.pick)).replace(/\\/g, '/')
      plan.push({
        source: it.source, line: it.line, text: it.text,
        oldTarget: it.target, newTarget: newRel, action: 'relayout', rule: `recover:${r.rule}`,
      })
    } else {
      plan.push({
        source: it.source, line: it.line, text: it.text,
        oldTarget: it.target, action: 'plainText', rule: 'noTarget',
      })
    }
  }
}

// ── 统计与输出 ───────────────────────────────────────────────
const stats = {
  total: plan.length,
  relayout: plan.filter((p) => p.action === 'relayout').length,
  plainText: plan.filter((p) => p.action === 'plainText').length,
  byRule: {} as Record<string, number>,
}
for (const p of plan) {
  const k = p.rule.split(':')[0] + ':' + p.rule.split(':')[1]?.split('(')[0]
  stats.byRule[k] = (stats.byRule[k] || 0) + 1
}
console.log('计划统计:', JSON.stringify(stats, null, 2))

if (!APPLY) {
  writeFileSync(OUT_PATH, JSON.stringify({ stats, plan }, null, 2), 'utf8')
  console.log(`[dry-run] 计划已写入 ${relative(projectRoot, OUT_PATH)}，加 --apply 执行`)
  process.exit(0)
}

// ── 写盘 ─────────────────────────────────────────────────────
const bySource = new Map<string, PlanEntry[]>()
for (const p of plan) {
  if (!bySource.has(p.source)) bySource.set(p.source, [])
  bySource.get(p.source)!.push(p)
}

let touchedFiles = 0, applied = 0, missed = 0
for (const [srcRel, entries] of bySource) {
  const abs = join(docsDir, srcRel)
  if (!existsSync(abs)) { missed += entries.length; continue }
  let content = readTextAdaptive(abs)
  const lines = content.split('\n')
  // 按行号倒序处理（同文件多行互不影响行号）
  const sorted = [...entries].sort((a, b) => b.line - a.line)
  let fileChanged = false
  for (const e of sorted) {
    const li = e.line - 1
    if (li < 0 || li >= lines.length) { missed++; continue }
    let line = lines[li]!
    const anchor = `(${e.oldTarget})`
    const pos = line.indexOf(anchor)
    if (pos === -1) { missed++; continue }
    // 回溯最近的 '['
    const open = line.lastIndexOf('[', pos)
    if (open === -1 || open + 1 >= pos) { missed++; continue }
    const label = line.slice(open + 1, pos - 1) // 去掉 ']' 前的部分
    if (e.action === 'relayout') {
      line = line.slice(0, open) + `[${label}](${e.newTarget})` + line.slice(pos + anchor.length)
    } else {
      // 降级纯文本：inline code 包装则保留 code 形式
      const wasCode = label.startsWith('`') && label.endsWith('`')
      const plain = wasCode ? label : label
      line = line.slice(0, open) + plain + line.slice(pos + anchor.length)
    }
    lines[li] = line
    fileChanged = true
    applied++
  }
  if (fileChanged) {
    writeTextUtf8(abs, lines.join('\n'))
    touchedFiles++
  }
}

writeFileSync(OUT_PATH, JSON.stringify({ stats, applied, missed, touchedFiles, plan }, null, 2), 'utf8')
console.log(`已写盘: ${applied} 条修复 / ${touchedFiles} 个文件；未命中 ${missed} 条`)
