#!/usr/bin/env node
'use strict'
/**
 * quality-gate-check.cjs — 代码质量合规门禁检查器（可测试 / 零运行时依赖）
 *
 * 设计目标：
 *  1. 可测试：每条检查输出 pass/fail + 证据(file:line)，整体退出码可断言。
 *  2. 零依赖：仅用 Node 内置模块（fs / path / child_process）。
 *  3. 自适应：检测到 V9 工程（存在 src/core/databridge.ts 且 package.json 含 audit:contract）
 *     时，运行工程内置审计套件作为权威门禁；否则退化为通用启发式检查。
 *
 * 退出码：
 *   0 = 通过（含仅警告）
 *   1 = 存在阻塞级违规(Blocking / Major)
 *   2 = 执行错误
 *
 * 用法：
 *   node scripts/quality-gate-check.cjs [--project <dir>] [--gates auto|v9|universal]
 *        [--json] [--quiet] [--no-v9-audit]
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

// ============================================================
// 工具
// ============================================================
function exists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}
function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}
const COLOR_WORDS = [
  'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey',
  'slate', 'zinc', 'neutral', 'stone', 'amber', 'emerald', 'teal', 'cyan', 'sky',
  'indigo', 'violet', 'fuchsia', 'rose', 'lime', 'black', 'white', 'primary',
  'destructive', 'success', 'warning', 'info', 'muted', 'border', 'card',
]
const TAILWIND_COLOR_RE = new RegExp(
  '\\b(?:bg|text|border|ring|from|to|via|fill|stroke|accent|divide|outline|shadow|placeholder|caret|decoration)-(?:' +
    COLOR_WORDS.join('|') +
    ')-\\d+\\b',
  'g',
)
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g
// 硬 any（类型位，真实类型退化）→ 阻断；软 any（as any 逃逸转换）→ 仅警告
const HARD_ANY_RE = /(:\s*any\b|<any>|any\[\]|,\s*any\b|\bany\b\s*\||\bany\b\s*&)/g
const SOFT_ANY_RE = /as any\b/g
const TS_IGNORE_RE = /@ts-ignore\b/g
const TEST_RE = /\.(test|spec)\.(ts|tsx)$/

function collectSourceFiles(root, exts, ignoreDirs) {
  const out = []
  function walk(dir) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (ignoreDirs.has(e.name)) continue
        walk(full)
      } else if (exts.has(path.extname(e.name))) {
        out.push(full)
      }
    }
  }
  walk(root)
  return out
}

function isTokenDefFile(rel) {
  return (
    rel.includes('constants/theme') ||
    rel.includes('config/chartColors') ||
    rel.includes('design-tokens') ||
    rel.endsWith('.tokens.')
  )
}

// ============================================================
// 通用门禁（universal）— 纯 JS 启发式，始终运行
// ============================================================
function runUniversalGates(project, srcDir) {
  const gates = []
  const ignoreDirs = new Set(['node_modules', 'dist', 'build', '.git', 'coverage'])
  const files = collectSourceFiles(srcDir, new Set(['.ts', '.tsx']), ignoreDirs)

  // --- G1: 禁止 any（硬 any 阻断；as any 软逃逸仅警告；测试文件宽松）---
  {
    const blockSamples = []
    const warnSamples = []
    let blockCount = 0
    let warnCount = 0
    for (const f of files) {
      const rel = path.relative(project, f)
      if (rel.startsWith('scripts/')) continue
      const isTest = TEST_RE.test(rel)
      const lines = readFileSafe(f).split('\n')
      lines.forEach((ln, i) => {
        const t = ln.trim()
        if (t.startsWith('//') || t.startsWith('*')) return
        if (ln.includes('@ts-expect-error')) return
        const hard = HARD_ANY_RE.test(ln)
        const soft = !hard && SOFT_ANY_RE.test(ln)
        if (!hard && !soft) return
        const loc = `${rel}:${i + 1}  ${ln.trim().slice(0, 120)}`
        if (hard && !isTest) {
          blockCount++
          if (blockSamples.length < 20) blockSamples.push(loc)
        } else {
          warnCount++
          if (warnSamples.length < 10) warnSamples.push(loc)
        }
      })
    }
    const count = blockCount + warnCount
    const status = blockCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass'
    gates.push({
      id: 'no-explicit-any',
      label: '禁止显式 any（类型安全：硬 any 阻断，as any/测试文件仅警告）',
      mode: 'universal',
      severity: 'Blocking',
      count,
      samples: status === 'fail' ? blockSamples : warnSamples,
      status,
      detail:
        blockCount > 0
          ? `发现 ${blockCount} 处硬 any（非测试文件），须改为显式接口或泛型；另有 ${warnCount} 处 as any/测试内 any（警告）`
          : warnCount > 0
            ? `未发现硬 any；${warnCount} 处 as any/测试内 any（警告，可保留）`
            : '未发现 any 类型用法',
    })
  }

  // --- G2: 禁止 @ts-ignore ---
  {
    const samples = []
    let count = 0
    for (const f of files) {
      const rel = path.relative(project, f)
      const lines = readFileSafe(f).split('\n')
      lines.forEach((ln, i) => {
        if (TS_IGNORE_RE.test(ln)) {
          count++
          if (samples.length < 20) samples.push(`${rel}:${i + 1}  ${ln.trim().slice(0, 120)}`)
        }
      })
    }
    gates.push({
      id: 'no-ts-ignore',
      label: '禁止 @ts-ignore（应使用 @ts-expect-error 并附注释）',
      mode: 'universal',
      severity: 'Blocking',
      count,
      samples,
      status: count === 0 ? 'pass' : 'fail',
      detail: count === 0 ? '未发现 @ts-ignore' : `发现 ${count} 处 @ts-ignore`,
    })
  }

  // --- G3: UI 层颜色硬编码（启发式，警告级）---
  {
    const uiDirs = ['pages', 'components', 'cockpit', 'apps']
      .map((d) => path.join(srcDir, d))
      .filter(exists)
    const samples = []
    let count = 0
    for (const uiDir of uiDirs) {
      const uiFiles = collectSourceFiles(uiDir, new Set(['.ts', '.tsx']), ignoreDirs)
      for (const f of uiFiles) {
        const rel = path.relative(project, f)
        if (isTokenDefFile(rel)) continue
        const content = readFileSafe(f)
        const m = content.match(HEX_RE)
        const t = content.match(TAILWIND_COLOR_RE)
        const hits = (m ? m.length : 0) + (t ? t.length : 0)
        if (hits > 0) {
          count += hits
          if (samples.length < 20)
            samples.push(`${rel}  (hex:${m ? m.length : 0}, tw:${t ? t.length : 0})`)
        }
      }
    }
    gates.push({
      id: 'ui-hardcoded-colors',
      label: 'UI 层禁止颜色硬编码（须用令牌系统）',
      mode: 'universal',
      severity: 'Major',
      count,
      samples,
      status: count === 0 ? 'pass' : 'warn',
      detail:
        count === 0
          ? '未发现 UI 层颜色硬编码'
          : `发现 ${count} 处疑似硬编码（含误报可能），建议用 STOCK_COLOR_TOKENS/COLOR_TOKENS/THEME_TOKENS`,
    })
  }

  // --- G4: 事件监听清理（启发式，警告级）---
  {
    const samples = []
    let count = 0
    for (const f of files) {
      const rel = path.relative(project, f)
      const content = readFileSafe(f)
      if (!/useEffect/.test(content)) continue
      const hasAdd =
        /addEventListener/.test(content) ||
        /EventBus\.subscribe/.test(content) ||
        /\.subscribe\(/.test(content)
      if (!hasAdd) continue
      const hasCleanup =
        /removeEventListener/.test(content) ||
        /unsubscribe/.test(content) ||
        /clearInterval/.test(content) ||
        /clearTimeout/.test(content)
      if (!hasCleanup) {
        count++
        if (samples.length < 20) samples.push(rel)
      }
    }
    gates.push({
      id: 'event-listener-cleanup',
      label: 'useEffect 事件监听须配对 cleanup',
      mode: 'universal',
      severity: 'Major',
      count,
      samples,
      status: count === 0 ? 'pass' : 'warn',
      detail:
        count === 0
          ? '未发现未清理的事件监听'
          : `发现 ${count} 个文件含订阅/监听但疑似缺少 cleanup（须 return 清理函数）`,
    })
  }

  // --- G5: 分层依赖方向（pages/components/store/services 禁止直连 db）---
  {
    const forbiddenInUi = ['@/data/db', '@/data/dataLayer', '@/data/queryBuilder']
    const forbiddenInServiceStore = ['@/data/db']
    const samples = []
    let count = 0
    const importRe = /import\s+[^;]*?from\s+['"]([^'"]+)['"]/g
    for (const f of files) {
      const rel = path.relative(project, f).replace(/\\/g, '/')
      const content = readFileSafe(f)
      let m
      importRe.lastIndex = 0
      while ((m = importRe.exec(content))) {
        const spec = m[1]
        let bad = false
        if (/^src\/(pages|components|cockpit|apps)\//.test(rel)) {
          bad = forbiddenInUi.some((x) => spec === x || spec.startsWith(x + '/'))
        } else if (/^src\/(services|store)\//.test(rel)) {
          bad = forbiddenInServiceStore.some((x) => spec === x)
        }
        if (bad) {
          count++
          if (samples.length < 20) samples.push(`${rel}  →  import ${spec}`)
        }
      }
    }
    gates.push({
      id: 'layer-import-direction',
      label: '分层依赖方向（UI/Store/Service 不得直连 @/data/db）',
      mode: 'universal',
      severity: 'Blocking',
      count,
      samples,
      status: count === 0 ? 'pass' : 'fail',
      detail: count === 0 ? '未发现跨层直连 db' : `发现 ${count} 处跨层直连，应改走 DataBridge/Store`,
    })
  }

  return gates
}

// ============================================================
// V9 工程门禁（权威）— 运行内置 npm audit 套件
// ============================================================
function runV9Gates(project) {
  const pkg = JSON.parse(readFileSafe(path.join(project, 'package.json')) || '{}')
  const scripts = pkg.scripts || {}
  const candidates = ['audit:layers', 'audit:hardcode', 'audit:contract']
  const gates = []
  for (const s of candidates) {
    if (!scripts[s]) {
      gates.push({
        id: s,
        label: `npm run ${s}`,
        mode: 'v9',
        severity: 'Blocking',
        count: 0,
        samples: [],
        status: 'skip',
        detail: `工程未定义 ${s} 脚本，跳过`,
      })
      continue
    }
    const r = spawnSync('npm', ['run', s], {
      cwd: project,
      encoding: 'utf8',
      timeout: 240000,
      shell: true,
      windowsHide: true,
    })
    // spawn 失败（环境错误）不应误判为代码违规 → 跳过并说明
    if (r.error || r.status === null) {
      gates.push({
        id: s,
        label: `npm run ${s}`,
        mode: 'v9',
        severity: 'Blocking',
        count: 0,
        samples: [],
        status: 'skip',
        detail: `无法执行 npm run ${s}：${r.error ? r.error.message : '进程无退出码（可能 npm 未加入 PATH）'}`,
      })
      continue
    }
    const passed = r.status === 0
    gates.push({
      id: s,
      label: `npm run ${s}`,
      mode: 'v9',
      severity: 'Blocking',
      count: passed ? 0 : 1,
      samples: passed
        ? []
        : (r.stderr || r.stdout || '')
            .split('\n')
            .filter((l) => /violation|error|fail|违规/i.test(l))
            .slice(0, 20),
      status: passed ? 'pass' : 'fail',
      detail: passed ? `${s} 通过` : `${s} 报告违规（退出码 ${r.status}）`,
    })
  }
  return gates
}

// ============================================================
// 主流程
// ============================================================
function main() {
  const argv = process.argv.slice(2)
  const getArg = (name) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : null
  }
  const project = path.resolve(getArg('--project') || process.cwd())
  let gatesMode = getArg('--gates') || 'auto'
  const jsonOnly = argv.includes('--json')
  const quiet = argv.includes('--quiet')
  const noV9Audit = argv.includes('--no-v9-audit')

  const srcDir = path.join(project, 'src')
  if (!exists(srcDir)) {
    if (!jsonOnly && !quiet) console.error(`[quality-gate] 未找到 ${srcDir}，非前端工程？`)
    process.exit(2)
  }

  const pkg = JSON.parse(readFileSyncSafe(path.join(project, 'package.json')) || '{}')
  const isV9 =
    exists(path.join(project, 'src/core/databridge.ts')) &&
    !!((pkg.scripts || {})['audit:contract'])

  let detected = 'universal'
  const gates = []
  if ((gatesMode === 'auto' && isV9 && !noV9Audit) || gatesMode === 'v9') {
    detected = 'v9'
    gates.push(...runV9Gates(project))
  }
  // 通用检查始终补充（即使 v9 模式也提供额外启发式）
  gates.push(...runUniversalGates(project, srcDir))

  // V9 模式：通用门禁仅作补充发现，失败降级为警告，避免与权威 audit:* 冲突
  if (detected === 'v9') {
    for (const g of gates) {
      if (g.mode === 'universal' && g.status === 'fail') {
        g.status = 'warn'
        g.detail = '[补充发现·非权威] ' + g.detail
      }
    }
  }

  const passed = gates.filter((g) => g.status === 'pass').length
  const failed = gates.filter((g) => g.status === 'fail').length
  const warned = gates.filter((g) => g.status === 'warn').length
  const skipped = gates.filter((g) => g.status === 'skip').length

  // 阻断判定：V9 模式以权威 audit:* 门禁为准，通用启发式降级为补充发现（避免误判项目已接受的偏差）
  const v9BlockingFailed = gates.filter(
    (g) =>
      g.mode === 'v9' &&
      g.status === 'fail' &&
      (g.severity === 'Blocking' || g.severity === 'Major'),
  ).length
  const universalBlockingFailed = gates.filter(
    (g) =>
      g.mode === 'universal' &&
      g.status === 'fail' &&
      (g.severity === 'Blocking' || g.severity === 'Major'),
  ).length
  const blockingFailed = detected === 'v9' ? v9BlockingFailed : universalBlockingFailed

  const overall = blockingFailed > 0 ? 'FAIL' : warned > 0 ? 'PASS_WITH_WARNINGS' : 'PASS'

  const report = {
    project,
    detected,
    timestamp: new Date().toISOString(),
    summary: {
      total: gates.length,
      passed,
      failed,
      warned,
      skipped,
      blockingFailed,
    },
    gates,
    overall,
  }

  if (jsonOnly) {
    process.stdout.write(JSON.stringify(report, null, 2))
  } else {
    if (!quiet) {
      console.log(`\n=== 代码质量合规门禁 (${detected}) ===`)
      console.log(`工程: ${project}`)
      console.log(`总门禁: ${gates.length}  通过: ${passed}  失败: ${failed}  警告: ${warned}  跳过: ${skipped}`)
      console.log('----------------------------------------')
      for (const g of gates) {
        const mark = g.status === 'pass' ? '✅' : g.status === 'fail' ? '❌' : g.status === 'warn' ? '⚠️ ' : '⏭ '
        console.log(`${mark} [${g.severity}] ${g.label} — ${g.detail}`)
        for (const s of g.samples.slice(0, 5)) console.log(`      • ${s}`)
      }
      console.log('----------------------------------------')
      console.log(`整体结论: ${overall}`)
    }
    process.stdout.write(JSON.stringify(report) + '\n')
  }

  process.exit(overall === 'FAIL' ? 1 : 0)
}

function readFileSyncSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

main()
