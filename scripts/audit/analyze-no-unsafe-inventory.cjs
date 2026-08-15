#!/usr/bin/env node
// no-unsafe 大盘扫描分析器（GOV-P1-01）
//
// 读取 `npx eslint --format json` 输出的 JSON 文件（UTF-8 含 BOM 兼容），
// 按 规则 / 文件 / 目录 三维统计 warnings 分布，
// 并结合 git log 90 天修改频率计算热度权重排序，输出 Batch 4/5/6 拆分建议。
//
// 用法（glob 写法见下，避免块注释内出现 glob 的斜杠星号）：
//   npx eslint "src" --ext .ts,.tsx --format json -o eslint-report.tmp.json
//   node scripts/audit/analyze-no-unsafe-inventory.cjs eslint-report.tmp.json [--since 90]
//
// 输出：
//   docs/reports/governance/no-unsafe-inventory-<date>.md（写入由 --write 开启）
//   stdout：规则分布 + Top 热文件 + 批次拆分
//
// @module scripts/audit/analyze-no-unsafe-inventory

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..', '..')

// ============================================================
// 参数解析
// ============================================================
const args = process.argv.slice(2)
const reportFile = args[0]
const sinceDays = getIntArg('--since', 90)
const doWrite = args.includes('--write')

if (!reportFile) {
  console.error('用法: node analyze-no-unsafe-inventory.cjs <eslint-json-report> [--since 90] [--write]')
  process.exit(1)
}

function getIntArg(name, dflt) {
  const i = args.indexOf(name)
  if (i >= 0 && args[i + 1]) return parseInt(args[i + 1], 10) || dflt
  return dflt
}

// ============================================================
// 读取 eslint JSON（兼容 BOM）
// ============================================================
const raw = fs.readFileSync(path.resolve(reportFile), 'utf8').replace(/^\uFEFF/, '')
const report = JSON.parse(raw)

const NO_UNSAFE_RULES = [
  '@typescript-eslint/no-unsafe-assignment',
  '@typescript-eslint/no-unsafe-call',
  '@typescript-eslint/no-unsafe-member-access',
  '@typescript-eslint/no-unsafe-return',
  '@typescript-eslint/no-unsafe-argument',
]

const byRule = {}        // ruleId -> count（全部 warnings）
const byFile = {}        // filePath -> { total, noUnsafe }
const byDir = {}         // dir -> { total, noUnsafe, files }

for (const f of report) {
  const rel = path.relative(ROOT, f.filePath).replace(/\\/g, '/')
  const dir = path.dirname(rel)
  if (!byDir[dir]) byDir[dir] = { total: 0, noUnsafe: 0, files: 0 }
  let fileHasWarning = false

  for (const m of f.messages) {
    if (m.severity !== 1) continue // 仅统计 warnings
    const rid = m.ruleId || '(null)'
    byRule[rid] = (byRule[rid] || 0) + 1
    byDir[dir].total++
    fileHasWarning = true

    if (NO_UNSAFE_RULES.includes(rid)) {
      byDir[dir].noUnsafe++
      if (!byFile[rel]) byFile[rel] = { total: 0, noUnsafe: 0 }
      byFile[rel].total++
      byFile[rel].noUnsafe++
    }
  }
  // any 规则单独统计到文件级（用于 no-explicit-any 治理参考）
  for (const m of f.messages) {
    if (m.severity === 1 && m.ruleId === '@typescript-eslint/no-explicit-any') {
      if (!byFile[rel]) byFile[rel] = { total: 0, noUnsafe: 0 }
      byFile[rel].total++
    }
  }
  if (fileHasWarning) byDir[dir].files++
}

// ============================================================
// git 修改频率（90 天）
// ============================================================
let gitFreq = {}
try {
  const out = execSync(
    `git log --since="${sinceDays} days ago" --name-only --pretty=format: -- src/`,
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  for (const line of out.split('\n')) {
    const t = line.trim()
    if (t) gitFreq[t] = (gitFreq[t] || 0) + 1
  }
} catch (e) {
  console.warn('[warn] git log 不可用，热度权重退化为纯错误数:', e.message)
}

// ============================================================
// 热度权重 = no-unsafe 错误数 × (1 + min(commitCount, 20) / 4)
// 修改频率线性加分，封顶 6 倍，避免高频小文件垄断
// ============================================================
const scored = Object.entries(byFile).map(([file, c]) => {
  const commits = gitFreq[file] || 0
  const weight = c.noUnsafe * (1 + Math.min(commits, 20) / 4)
  return { file, noUnsafe: c.noUnsafe, commits, score: Math.round(weight * 10) / 10 }
}).sort((a, b) => b.score - a.score)

// ============================================================
// 批次拆分：每批 25 文件
// ============================================================
const BATCH_SIZE = 25
const batches = []
for (let i = 0; i < scored.length; i += BATCH_SIZE) {
  batches.push(scored.slice(i, i + BATCH_SIZE))
}

// ============================================================
// 汇总输出
// ============================================================
const totalWarnings = Object.values(byRule).reduce((a, b) => a + b, 0)
const totalNoUnsafe = NO_UNSAFE_RULES.reduce((s, r) => s + (byRule[r] || 0), 0)
const totalAny = byRule['@typescript-eslint/no-explicit-any'] || 0

const L = []
L.push(`# no-unsafe 大盘扫描报告（GOV-P1-01）`)
L.push('')
L.push(`- 扫描日期：${new Date().toISOString().slice(0, 10)}`)
L.push(`- 扫描范围：src/**/*.{ts,tsx}（eslint 类型感知规则）`)
L.push(`- warnings 总数：${totalWarnings}`)
L.push(`- no-unsafe-* 五类规则总数：${totalNoUnsafe}`)
L.push(`- no-explicit-any：${totalAny}`)
L.push(`- 热度权重：noUnsafe × (1 + min(commits@${sinceDays}d, 20)/4)`)
L.push('')
L.push(`## 一、规则分布（Top 20）`)
L.push('')
L.push('| 规则 | 数量 | 占比 |')
L.push('|------|------|------|')
Object.entries(byRule).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([r, c]) => {
  L.push(`| ${r} | ${c} | ${(c * 100 / totalWarnings).toFixed(1)}% |`)
})
L.push('')
L.push(`## 二、目录分布（Top 15，按 no-unsafe 数）`)
L.push('')
L.push('| 目录 | no-unsafe | warnings | 涉及文件数 |')
L.push('|------|-----------|----------|-----------|')
Object.entries(byDir).sort((a, b) => b[1].noUnsafe - a[1].noUnsafe).slice(0, 15).forEach(([d, c]) => {
  L.push(`| ${d} | ${c.noUnsafe} | ${c.total} | ${c.files} |`)
})
L.push('')
batches.forEach((batch, i) => {
  const name = i === 0 ? 'Batch 4（首批，最高热度）' : `Batch ${4 + i}`
  L.push(`## 批次建议：${name}（${batch.length} 文件，no-unsafe 合计 ${batch.reduce((s, x) => s + x.noUnsafe, 0)}）`)
  L.push('')
  L.push('| # | 文件 | no-unsafe | 90d commits | 热度分 |')
  L.push('|---|------|-----------|-------------|--------|')
  batch.forEach((x, j) => {
    L.push(`| ${j + 1} | ${x.file} | ${x.noUnsafe} | ${x.commits} | ${x.score} |`)
  })
  L.push('')
})

const report_ = L.join('\n')
console.log(report_)

if (doWrite) {
  const outFile = path.join(ROOT, 'docs', 'reports', 'governance', `no-unsafe-inventory-${new Date().toISOString().slice(0, 10)}.md`)
  fs.writeFileSync(outFile, report_, 'utf8')
  console.error(`\n[written] ${path.relative(ROOT, outFile)} (${scored.length} 文件, ${totalNoUnsafe} no-unsafe, ${batches.length} 批次)`)
}
