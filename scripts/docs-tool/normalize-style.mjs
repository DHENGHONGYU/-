#!/usr/bin/env node
/**
 * normalize-style.mjs — P1/P2 文档风格半自动归一
 *
 * 依据 docs/00-meta/doc-style-standard.md：
 *   P1: 元数据块中文键→英文(精确白名单)；已知作者标签→受控枚举；
 *       正文术语 数据定义→数据字典 / 部件→组件
 *   P2: 标题装饰 emoji 清理(保留状态 emoji)；日期格式归一 YYYY-MM-DD
 *
 * 安全策略：
 *   - 严格跳过 fenced code block（``` / ~~~）
 *   - 保留原文件 EOL（CRLF/LF 不强制转换）
 *   - 治理元文档(EXCLUDE_ALL)整体跳过，避免破坏规则示例表述
 *   - T2 仅对 Proofreader/Generator 键值做整值/枚举(、,|)映射，不切 / . 等
 *   - --dry 预演：仅统计与输出样例，不写盘
 *
 * 用法：
 *   node scripts/docs-tool/normalize-style.mjs            # 真改
 *   node scripts/docs-tool/normalize-style.mjs --dry      # 预演
 */
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync,
} from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const DOCS_ROOT = join(ROOT, 'docs')
const DRY = process.argv.includes('--dry')

// 治理元文档：整体跳过，避免破坏规则示例表述（手动保持合规）
const EXCLUDE_ALL = new Set([
  'docs/00-meta/doc-style-standard.md',
  'docs/00-meta/doc-style-remediation-plan.md',
  'docs/00-meta/markdown-reorg-framework.md',
  'docs/00-meta/agent-app-docs-classification.md',
  'docs/reference/hybrid-proofread-contract.md',
  'docs/00-meta/doc-proofreading-strategy.md',
])

const pad = (n) => String(n).padStart(2, '0')

// ---- T1: 元数据块中文键 → 英文（精确键白名单，仅整键匹配）----
const KEY_EXACT = {
  '版本': 'Version',
  '报告生成时间': 'Date',
  '同步日期': 'Date',
  '日期': 'Date',
  '生成时间': 'Date',
  '生成日期': 'Date',
  '校对人员': 'Proofreader',
  '执行人': 'Proofreader',
  '审核人': 'Proofreader',
  '报告生成人': 'Generator',
  '报告作者': 'Generator',
  '日志生成工具': 'Generator',
  '测试执行人': 'Generator',
  '生成人': 'Generator',
  '来源': 'Source',
  '关联': 'Source',
  '单一事实源': 'Source',
}
const META_KEY_RE = /^(\s*>\s*)\*{0,2}(.+?)\*{0,2}(\s*[:：]\s*)(.+)$/

// ---- T2: 作者标签 → 受控枚举（仅 Proofreader/Generator 键值）----
const AUTHOR_KEYS = new Set(['Proofreader', 'Generator'])
const AUTHOR_RULES = [
  [/claude|opus|sonnet/i, 'claude'],
  [/kimi/i, 'kimi'],
  [/glm|智谱/i, 'glm'],
  [/deepseek|深度求索/i, 'deepseek'],
  [/qwen|通义|千问/i, 'qwen'],
  [/gpt|chatgpt/i, 'gpt'],
  [/gemini/i, 'gemini'],
  [/v9[- ]?quality[- ]?audit/i, 'v9-quality-audit'],
  [/v9[- ]?arch/i, 'v9-arch-team'],
  [/v9[- ]?doc/i, 'v9-doc-eng'],
  [/架构组/i, 'v9-arch-team'],
  [/文档工程师/i, 'v9-doc-eng'],
  [/应潇震|人工复核|人工/i, 'human'],
  [/workbuddy|codebuddy|寇豆码|software[- ]?engineer/i, 'workbuddy'],
  [/ai\s*辅助开发/i, 'workbuddy'],
  [/ai\s*文档/i, 'v9-doc-eng'],
]
function mapAuthorValue(val) {
  const trimmed = String(val).trim()
  if (!trimmed) return trimmed
  for (const [re, ev] of AUTHOR_RULES) if (re.test(trimmed)) return ev
  // 枚举分隔（仅 、,|；不切 / . 以免破坏路径/版本）
  const parts = trimmed.split(/[、,|；;]\s*/).map((s) => s.trim()).filter(Boolean)
  if (parts.length > 1) {
    const mapped = parts.map((p) => {
      for (const [re, ev] of AUTHOR_RULES) if (re.test(p)) return ev
      return p
    })
    if (mapped.some((m, i) => m !== parts[i])) return mapped.join(' | ')
  }
  return trimmed
}

// ---- T3: 标题装饰 emoji 清理 ----
const ALLOWED_EMOJI = new Set(['✅', '⚠️', '❌', '🔴', '🟡', '🟢', '⭐'])
const DECOR_EMOJI = new Set([
  '📊', '📋', '📘', '📈', '📉', '🔶', '📝', '📌', '💡', '🔥', '📒',
  '🗂️', '📁', '🧭', '📂', '⚡', '🎯', '🚀', '📞', '💬', '🔔', '📑', '🧩',
])
function emojiKind(ch) {
  if (ALLOWED_EMOJI.has(ch)) return 'allowed'
  if (DECOR_EMOJI.has(ch)) return 'decor'
  return null
}
const HEADING_RE = /^(#{1,6})(\s+)(.*)$/
function stripDecorEmoji(text) {
  const chars = [...text]
  let i = 0
  while (i < chars.length) {
    const k = emojiKind(chars[i])
    if (k === 'allowed') break
    if (k === 'decor') i++
    else break
  }
  if (i === 0) return null
  return chars.slice(i).join('').trim()
}

// ---- T4: 日期格式归一 ----
const RE_YMD = /(\d{4})年(\d{1,2})月(\d{1,2})日/g
const RE_SLASH = /\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b/g
const RE_DOT = /\b(\d{4})\.(\d{1,2})\.(\d{1,2})\b/g

// ---- T5: 术语（排除治理元文档 + archive + deprecated）----
const T5_SKIP_PREFIX = [
  'docs/archive/',
  'docs/00-meta/deprecated-docs/',
]
const TERM_REPL = [
  [/数据定义/g, '数据字典'],
  [/部件/g, '组件'],
]
function t5Skipped(rel) {
  if (EXCLUDE_ALL.has(rel)) return true
  return T5_SKIP_PREFIX.some((p) => rel.startsWith(p))
}

// ---- 遍历 ----
function walk(dir, out) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    const s = statSync(p)
    if (s.isDirectory()) {
      if (['node_modules', '.git'].includes(f)) continue
      walk(p, out)
    } else if (f.endsWith('.md')) {
      out.push(p)
    }
  }
}
const files = []
walk(DOCS_ROOT, files)

const report = {
  dry: DRY,
  timestamp: new Date().toISOString(),
  totalFiles: files.length,
  changedFiles: 0,
  counts: { t1_key: 0, t2_author: 0, t3_emoji: 0, t4_date: 0, t5_term: 0 },
  samples: [],
}
const WALK_LIMIT = 40

for (const abs of files) {
  const rel = 'docs/' + relative(DOCS_ROOT, abs).split('\\').join('/')
  const raw = readFileSync(abs, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const lines = raw.split(/\r?\n/)
  let inCode = false
  let changed = false
  const deltas = []
  const skipAll = EXCLUDE_ALL.has(rel)

  const newLines = lines.map((line, idx) => {
    if (/^\s*(```|~~~)/.test(line)) inCode = !inCode
    let out = line

    if (!skipAll && /^\s*>\s/.test(line)) {
      // T1: 精确键映射（中文键→英文；英文键直接识别为 normKey）
      const m = line.match(META_KEY_RE)
      let normKey = null
      if (m) {
        const keyRaw = m[2].trim()
        if (KEY_EXACT[keyRaw]) {
          normKey = KEY_EXACT[keyRaw]
          if (normKey !== keyRaw) {
            out = m[1] + '**' + normKey + '**' + m[3] + m[4]
            report.counts.t1_key++
            deltas.push({ line: idx + 1, rule: 'T1-key', from: line.trim(), to: out.trim() })
            changed = true
          }
        } else if (['Version', 'Date', 'Proofreader', 'Generator', 'Source'].includes(keyRaw)) {
          normKey = keyRaw
        }
      }
      // T2: 仅 Proofreader/Generator 键值
      if (normKey && AUTHOR_KEYS.has(normKey)) {
        const vm = out.match(/^(.*?[:：]\s*)(.+)$/)
        if (vm) {
          const mapped = mapAuthorValue(vm[2])
          if (mapped !== vm[2].trim()) {
            out = vm[1] + mapped
            report.counts.t2_author++
            deltas.push({ line: idx + 1, rule: 'T2-author', from: line.trim(), to: out.trim() })
            changed = true
          }
        }
      }
    }

    // T3: 标题装饰 emoji
    const h = out.match(HEADING_RE)
    if (h) {
      const stripped = stripDecorEmoji(h[3])
      if (stripped !== null) {
        out = h[1] + ' ' + stripped
        report.counts.t3_emoji++
        deltas.push({ line: idx + 1, rule: 'T3-emoji', from: line.trim(), to: out.trim() })
        changed = true
      }
    }

    if (!inCode && !skipAll) {
      // T4: 日期（跳过含 URL 的行；治理元文档已 skipAll）
      if (!/https?:\/\//.test(out)) {
        let t = out
        t = t.replace(RE_YMD, (_, y, m, d) => `${y}-${pad(m)}-${pad(d)}`)
        t = t.replace(RE_SLASH, (_, y, m, d) => `${y}-${pad(m)}-${pad(d)}`)
        t = t.replace(RE_DOT, (_, y, m, d) => `${y}-${pad(m)}-${pad(d)}`)
        if (t !== out) {
          out = t
          report.counts.t4_date++
          deltas.push({ line: idx + 1, rule: 'T4-date', from: line.trim(), to: out.trim() })
          changed = true
        }
      }
      // T5: 术语（排除治理/archive/deprecated）
      if (!t5Skipped(rel)) {
        for (const [re, rep] of TERM_REPL) {
          if (re.test(out)) {
            const before = out
            out = out.replace(re, rep)
            if (out !== before) {
              report.counts.t5_term++
              deltas.push({ line: idx + 1, rule: 'T5-term', from: before.trim(), to: out.trim() })
              changed = true
            }
          }
        }
      }
    }
    return out
  })

  if (changed) {
    report.changedFiles++
    if (report.samples.length < WALK_LIMIT) {
      report.samples.push({ file: rel, deltas: deltas.slice(0, 8) })
    }
    if (!DRY) writeFileSync(abs, newLines.join(eol), 'utf8')
  }
}

const repDir = join(ROOT, 'scripts', 'docs', 'reports', 'style-normalize')
if (!existsSync(repDir)) mkdirSync(repDir, { recursive: true })
const repPath = join(repDir, `style-normalize-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
writeFileSync(repPath, JSON.stringify(report, null, 2), 'utf8')

console.log(`\n=== normalize-style ${DRY ? '(DRY-RUN)' : '(APPLIED)'} ===`)
console.log(`扫描文件: ${report.totalFiles}`)
console.log(`将变更/已变更: ${report.changedFiles}`)
console.log(`T1 中文键→英文: ${report.counts.t1_key}`)
console.log(`T2 作者→枚举:   ${report.counts.t2_author}`)
console.log(`T3 装饰emoji:    ${report.counts.t3_emoji}`)
console.log(`T4 日期归一:     ${report.counts.t4_date}`)
console.log(`T5 术语替换:     ${report.counts.t5_term}`)
console.log(`报告: ${repPath}`)
if (DRY) console.log('\n⚠️ 预演模式未写盘。确认后去掉 --dry 执行。')
