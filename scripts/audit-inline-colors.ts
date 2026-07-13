#!/usr/bin/env tsx
/**
 * audit-inline-colors.ts —— UI 层内联颜色用法测量器（A-01 排期基线工具）
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

const UI_LAYERS = ['components', 'pages', 'cockpit', 'apps', 'portal']

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

const COLOR_VALUE_RE = /(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b)|(?:rgba?|hsla?)\s*\([^)]*\)|var\([^)]*\)|\b(?:white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|cyan|teal|indigo|violet|lime|amber|emerald|rose|fuchsia|slate|zinc|neutral|stone|transparent|currentColor|brown|lightblue|lightgreen|darkblue|darkred|magenta|gold|silver)\b/g

const STYLE_COLOR_PROP_RE = /(?<![A-Za-z])(?:color|background|backgroundColor|borderColor|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor|fill|stroke|boxShadow|textDecorationColor|outlineColor|caretColor|accentColor|columnRuleColor)\s*:\s*(['"`])([^'"`]+)\1/g

const TW_COLOR_CLASS_RE = new RegExp(
  `(?:^|[^A-Za-z0-9_-])(?:${TW_PREFIXES.map((p) => p.replace('-', '\\-')).join('|')})-(?:${TW_COLORS.join('|')})${TW_SHADES}(?=[^A-Za-z0-9_-]|$)`,
  'g',
)

const TW_ARBITRARY_RE = /(?:^|[^A-Za-z0-9_-])(?:text|bg|border|from|to|via|ring|fill|stroke)-\[(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))\]/g

export interface Hit {
  file: string
  line: number
  category: 'inlineStyleColor' | 'twColorClass' | 'twArbitrary'
  text: string
}

export interface ModuleStat {
  module: string
  inlineStyleColor: number
  twColorClass: number
  twArbitrary: number
  total: number
  files: number
}

export interface InlineColorsReport {
  meta: {
    scriptName: string
    uiLayers: string[]
    generatedAt: string
  }
  totals: {
    inlineStyleColor: number
    twColorClass: number
    twArbitrary: number
    total: number
    files: number
  }
  byModule: ModuleStat[]
  samples: Hit[]
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

export function scan(): InlineColorsReport {
  const hits: Hit[] = []
  const moduleStats = new Map<string, ModuleStat>()
  const fileCount = new Map<string, number>()

  for (const layer of UI_LAYERS) {
    const dir = path.join(SRC, layer)
    for (const file of walk(dir)) {
      const content = fs.readFileSync(file, 'utf8')
      const rel = path.relative(ROOT, file).replace(/\\/g, '/')
      const modKey = rel.split('/').slice(0, 3).join('/')
      if (!moduleStats.has(modKey)) {
        moduleStats.set(modKey, {
          module: modKey, inlineStyleColor: 0, twColorClass: 0, twArbitrary: 0, total: 0, files: 0,
        })
      }
      const ms = moduleStats.get(modKey)!
      ms.files++

      STYLE_COLOR_PROP_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = STYLE_COLOR_PROP_RE.exec(content))) {
        const val = m[2]
        if (val?.includes('${')) continue
        if (COLOR_VALUE_RE.test(val ?? '')) {
          ms.inlineStyleColor++
          ms.total++
          fileCount.set(rel, (fileCount.get(rel) ?? 0) + 1)
          hits.push({ file: rel, line: countLinesBefore(content, m.index), category: 'inlineStyleColor', text: `${m[0].slice(0, 60)}` })
        }
      }

      TW_COLOR_CLASS_RE.lastIndex = 0
      while ((m = TW_COLOR_CLASS_RE.exec(content))) {
        ms.twColorClass++
        ms.total++
        fileCount.set(rel, (fileCount.get(rel) ?? 0) + 1)
        hits.push({ file: rel, line: countLinesBefore(content, m.index), category: 'twColorClass', text: m[0].trim() })
      }

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

  return {
    meta: {
      scriptName: 'audit-inline-colors',
      uiLayers: UI_LAYERS,
      generatedAt: new Date().toISOString(),
    },
    totals,
    byModule: stats,
    samples: hits.slice(0, 30),
  }
}

function main(): void {
  const report = scan()

  process.stdout.write(JSON.stringify(report, null, 2))

  process.stderr.write(`\n══════════════════════════════════════════════════════════════\n`)
  process.stderr.write(`UI 层内联颜色用法测量（A-01 排期基线）\n`)
  process.stderr.write(`扫描层: ${UI_LAYERS.join(', ')}\n`)
  process.stderr.write(`────────────────────────────────────────────────────────────\n`)
  process.stderr.write(`合计: ${report.totals.total} 处  | 涉及文件: ${report.totals.files}\n`)
  process.stderr.write(`  • 内联 style 颜色字面量 : ${report.totals.inlineStyleColor}\n`)
  process.stderr.write(`  • Tailwind 颜色工具类   : ${report.totals.twColorClass}\n`)
  process.stderr.write(`  • Tailwind 任意值颜色   : ${report.totals.twArbitrary}\n`)
  process.stderr.write(`────────────────────────────────────────────────────────────\n`)
  process.stderr.write(`按模块（Top 15）:\n`)
  for (const s of report.byModule.slice(0, 15)) {
    process.stderr.write(`  ${s.module.padEnd(42)} 总=${String(s.total).padStart(5)}  (style=${s.inlineStyleColor}, tw=${s.twColorClass}, arb=${s.twArbitrary})\n`)
  }
  process.stderr.write(`══════════════════════════════════════════════════════════════\n`)
  process.exit(0)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
