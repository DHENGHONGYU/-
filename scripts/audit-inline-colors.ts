#!/usr/bin/env tsx
/**
 * audit-inline-colors.ts —— UI 层内联颜色用法测量器（A-01 排期基线工具）
 *
 * 目的：用真实测量替代过时的"9,482 内联样式"基线，为 A-01（颜色令牌全量落地）
 *       提供按模块切分批次的客观数据。
 *
 * 检测范围（AGENTS.md 定义的 UI 层）：
 *   src/components  src/pages  src/cockpit  src/apps  src/portal
 *
 * 检测类别：
 *   1. inlineStyleColor —— style 对象中颜色相关属性（color/background/borderColor/fill/stroke/boxShadow…）
 *      其值为 HEX / rgb() / hsl() / 具名色 / CSS 变量 的字面量（不含引用令牌常量）。
 *   2. twColorClass —— className 中字面 Tailwind 颜色工具类
 *      （text-/bg-/border-/from-/to-/via-/ring-/divide-/fill-/stroke- + 颜色名 + 色阶）。
 *   3. twArbitrary —— className 中任意值颜色（text-[#ff0000]、bg-[rgb(...)] 等）。
 *
 * 输出：stdout 输出 JSON（机器可读，可被计划脚本消费）；stderr 输出人类可读摘要。
 * 退出码：0=完成（无论是否有违规；本脚本仅测量不判违规）。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

const UI_LAYERS = ['components', 'pages', 'cockpit', 'apps', 'portal']

// Tailwind 颜色名（用于匹配工具类与具名色）
const TW_COLORS = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'white', 'black', 'current', 'transparent',
]
const TW_SHADES = '(?:(?:50|100|200|300|400|500|600|700|800|900|950))?'
const TW_PREFIXES = [
  'text', 'bg', 'border', 'from', 'to', 'via', 'ring', 'ring-offset',
  'divide', 'fill', 'stroke', 'accent', 'caret', 'decoration', 'outline', 'shadow',
  'placeholder',
]

const COLOR_NAME_SET = new Set([
  'white', 'black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink',
  'gray', 'grey', 'cyan', 'teal', 'indigo', 'violet', 'lime', 'amber', 'emerald',
  'rose', 'fuchsia', 'slate', 'zinc', 'neutral', 'stone', 'transparent', 'currentColor',
  'brown', 'lightblue', 'lightgreen', 'darkblue', 'darkred', 'magenta', 'gold', 'silver',
])

// 匹配颜色值字面量（HEX / rgb / hsl / 具名 / CSS var）
const COLOR_VALUE_RE = /(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b)|(?:rgba?|hsla?)\s*\([^)]*\)|var\([^)]*\)|\b(?:white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|cyan|teal|indigo|violet|lime|amber|emerald|rose|fuchsia|slate|zinc|neutral|stone|transparent|currentColor|brown|lightblue|lightgreen|darkblue|darkred|magenta|gold|silver)\b/g

// style 对象颜色属性（排除明显非颜色，如 borderWidth）
const STYLE_COLOR_PROP_RE = /(?<![A-Za-z])(?:color|background|backgroundColor|borderColor|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor|fill|stroke|boxShadow|textDecorationColor|outlineColor|caretColor|accentColor|columnRuleColor)\s*:\s*(['"`])([^'"`]+)\1/g

// Tailwind 颜色工具类（字面，非令牌常量引用）
const TW_COLOR_CLASS_RE = new RegExp(
  `(?:^|[^A-Za-z0-9_-])(?:${TW_PREFIXES.map((p) => p.replace('-', '\\-')).join('|')})-(?:${TW_COLORS.join('|')})${TW_SHADES}(?=[^A-Za-z0-9_-]|$)`,
  'g',
)

// Tailwind 任意值颜色
const TW_ARBITRARY_RE = /(?:^|[^A-Za-z0-9_-])(?:text|bg|border|from|to|via|ring|fill|stroke)-\[(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))\]/g

interface Hit {
  file: string
  line: number
  category: 'inlineStyleColor' | 'twColorClass' | 'twArbitrary'
  text: string
}

interface ModuleStat {
  module: string
  inlineStyleColor: number
  twColorClass: number
  twArbitrary: number
  total: number
  files: number
}

function walk(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(full))
    else if (/\.(tsx?|jsx?)$/.test(ent.name)) out.push(full)
  }
  return out
}

function countLinesBefore(content: string, index: number): number {
  let n = 1
  for (let i = 0; i < index && i < content.length; i++) if (content[i] === '\n') n++
  return n
}

function main(): void {
  const hits: Hit[] = []
  const moduleStats = new Map<string, ModuleStat>()
  const fileCount = new Map<string, number>()

  for (const layer of UI_LAYERS) {
    const dir = path.join(SRC, layer)
    for (const file of walk(dir)) {
      const content = fs.readFileSync(file, 'utf8')
      const rel = path.relative(ROOT, file).replace(/\\/g, '/')
      const modKey = rel.split('/').slice(0, 3).join('/') // src/<layer>/<sub> 或 src/<layer>
      if (!moduleStats.has(modKey)) {
        moduleStats.set(modKey, {
          module: modKey, inlineStyleColor: 0, twColorClass: 0, twArbitrary: 0, total: 0, files: 0,
        })
      }
      const ms = moduleStats.get(modKey)!
      ms.files++

      // 1. inline style color
      STYLE_COLOR_PROP_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = STYLE_COLOR_PROP_RE.exec(content))) {
        const val = m[2]
        // 排除令牌引用（如 `${COLOR_SHADES.blue.hex[500]}`）——其值含 `${`，非硬编码字面量
        if (val.includes('${')) continue
        if (COLOR_VALUE_RE.test(val)) {
          ms.inlineStyleColor++
          ms.total++
          fileCount.set(rel, (fileCount.get(rel) ?? 0) + 1)
          hits.push({ file: rel, line: countLinesBefore(content, m.index), category: 'inlineStyleColor', text: `${m[0].slice(0, 60)}` })
        }
      }

      // 2. tailwind color class
      TW_COLOR_CLASS_RE.lastIndex = 0
      while ((m = TW_COLOR_CLASS_RE.exec(content))) {
        ms.twColorClass++
        ms.total++
        fileCount.set(rel, (fileCount.get(rel) ?? 0) + 1)
        hits.push({ file: rel, line: countLinesBefore(content, m.index), category: 'twColorClass', text: m[0].trim() })
      }

      // 3. tailwind arbitrary color
      TW_ARBITRARY_RE.lastIndex = 0
      while ((m = TW_ARBITRARY_RE.exec(content))) {
        ms.twArbitrary++
        ms.total++
        fileCount.set(rel, (fileCount.get(rel) ?? 0) + 1)
        hits.push({ file: rel, line: countLinesBefore(content, m.index), category: 'twArbitrary', text: m[0].trim() })
      }
    }
  }

  const stats = [...moduleStats.values()].sort((a, b) => b.total - a.total)
  const totals = stats.reduce(
    (acc, s) => {
      acc.inlineStyleColor += s.inlineStyleColor
      acc.twColorClass += s.twColorClass
      acc.twArbitrary += s.twArbitrary
      acc.total += s.total
      acc.files += s.files
      return acc
    },
    { inlineStyleColor: 0, twColorClass: 0, twArbitrary: 0, total: 0, files: 0 },
  )

  const report = {
    meta: {
      scriptName: 'audit-inline-colors',
      uiLayers: UI_LAYERS,
      generatedAt: new Date().toISOString(),
    },
    totals,
    byModule: stats,
    samples: hits.slice(0, 30),
  }

  process.stdout.write(JSON.stringify(report, null, 2))

  // 人类可读摘要（stderr）
  process.stderr.write(`\n══════════════════════════════════════════════════════════════\n`)
  process.stderr.write(`UI 层内联颜色用法测量（A-01 排期基线）\n`)
  process.stderr.write(`扫描层: ${UI_LAYERS.join(', ')}\n`)
  process.stderr.write(`────────────────────────────────────────────────────────────\n`)
  process.stderr.write(`合计: ${totals.total} 处  | 涉及文件: ${totals.files}\n`)
  process.stderr.write(`  • 内联 style 颜色字面量 : ${totals.inlineStyleColor}\n`)
  process.stderr.write(`  • Tailwind 颜色工具类   : ${totals.twColorClass}\n`)
  process.stderr.write(`  • Tailwind 任意值颜色   : ${totals.twArbitrary}\n`)
  process.stderr.write(`────────────────────────────────────────────────────────────\n`)
  process.stderr.write(`按模块（Top 15）:\n`)
  for (const s of stats.slice(0, 15)) {
    process.stderr.write(`  ${s.module.padEnd(42)} 总=${String(s.total).padStart(5)}  (style=${s.inlineStyleColor}, tw=${s.twColorClass}, arb=${s.twArbitrary})\n`)
  }
  process.stderr.write(`══════════════════════════════════════════════════════════════\n`)
  process.exit(0)
}

main()
